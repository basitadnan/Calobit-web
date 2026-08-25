import { useState, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Motion } from '@capacitor/motion';
import { Geolocation } from '@capacitor/geolocation';
import { useApp } from '../contexts/AppContext';
import { formatDuration, formatPace, strideLengthMeters } from '../utils/geo';
import { createStepDetector } from '../utils/stepDetector';
import RouteMapView from './RouteMapView';
import { Play, Pause, Square, X, Footprints, Map as MapIcon } from 'lucide-react';

const MODES = [
  { id: 'walk', icon: '🚶', label: 'Walk' },
  { id: 'running', icon: '🏃', label: 'Running' },
];

const AVG_STRIDE_CM = 170;

export default function GymWalk() {
  const { profile, walkLogs, logWalk } = useApp();

  const [mode, setMode] = useState('walk');
  const [status, setStatus] = useState('idle'); // idle | active | paused
  const [elapsedSec, setElapsedSec] = useState(0);
  const [steps, setSteps] = useState(0);
  const [currentPace, setCurrentPace] = useState(null); // min per km (number) or null
  const [sensorDenied, setSensorDenied] = useState(false);
  const [usingMotion, setUsingMotion] = useState(false); // JS accelerometer fallback (browser)

  const stepCounter = Capacitor.isNativePlatform() ? (Capacitor.Plugins?.StepCounter || null) : null;

  // Totals accumulated before the current live segment (from paused segments).
  const baseRef = useRef({ steps: 0, durationSec: 0 });
  const segStartedAtRef = useRef(0); // Date.now() when the live segment began
  const nativeRef = useRef(false);   // true when the native foreground service is tracking
  const wasTrackingRef = useRef(false);
  const pollRef = useRef(null);
  const tickerRef = useRef(null);

  // JS motion fallback (browser / no native plugin).
  const fallbackDetectorRef = useRef(null);
  const motionHandleRef = useRef(null);

  // Route recording — the only use of location. Steps & distance stay
  // stride-based; GPS just draws the route line and saves it to history.
  const [route, setRoute] = useState([]);
  const [currentPos, setCurrentPos] = useState(null);
  const [gpsAccuracy, setGpsAccuracy] = useState(null); // meters, null until fix
  const [locationDenied, setLocationDenied] = useState(false);
  const [viewingLog, setViewingLog] = useState(null); // walk log being viewed on the map
  const routeRef = useRef([]);
  const watchIdRef = useRef(null);

  const MIN_ROUTE_METERS = 3;
  const MAX_ROUTE_POINTS = 3000;

  function resetRoute() {
    routeRef.current = [];
    setRoute([]);
    setCurrentPos(null);
    setGpsAccuracy(null);
    setLocationDenied(false);
  }

  function addRoutePoint(pos) {
    const { latitude, longitude, accuracy } = pos.coords;
    setCurrentPos({ lat: latitude, lng: longitude });
    if (typeof accuracy === 'number') setGpsAccuracy(Math.round(accuracy));

    const pt = { lat: latitude, lng: longitude, t: Date.now() };
    const prev = routeRef.current[routeRef.current.length - 1];
    if (prev) {
      const dx = (pt.lat - prev.lat) * 111320;
      const dy = (pt.lng - prev.lng) * 111320 * Math.cos((pt.lat * Math.PI) / 180);
      if (Math.hypot(dx, dy) < MIN_ROUTE_METERS) return; // too close to extend the line
    }
    const next = [...routeRef.current, pt].slice(-MAX_ROUTE_POINTS);
    routeRef.current = next;
    setRoute(next);
  }

  async function startLocationFeed() {
    if (watchIdRef.current != null || !Capacitor.isNativePlatform()) return;
    try {
      const perm = await Geolocation.checkPermissions();
      let status = perm.location;
      if (status !== 'granted') {
        status = (await Geolocation.requestPermissions()).location;
      }
      if (status !== 'granted') {
        setLocationDenied(true);
        return;
      }
      watchIdRef.current = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 2000 },
        (pos) => {
          if (pos && pos.coords) addRoutePoint(pos);
        }
      );
    } catch {
      setLocationDenied(true);
    }
  }

  async function stopLocationFeed() {
    if (watchIdRef.current == null) return;
    try {
      await Geolocation.removeWatcher({ id: watchIdRef.current });
    } catch {}
    watchIdRef.current = null;
  }

  // Current-pace delta tracking between poll/motion events.
  const lastSnapStepsRef = useRef(0);
  const lastSnapTimeRef = useRef(0);

  const heightCm = parseFloat(profile?.height) || AVG_STRIDE_CM;
  const strideKm = strideLengthMeters(heightCm, mode) / 1000;     // km per step
  const strideKmRef = useRef(strideKm);
  strideKmRef.current = strideKm;
  const distanceKm = steps * strideKm;                            // derived from steps, no GPS

  function clearTimers() {
    if (tickerRef.current) { clearInterval(tickerRef.current); tickerRef.current = null; }
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  function startTicker() {
    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = setInterval(() => {
      const seg = Math.floor((Date.now() - segStartedAtRef.current) / 1000);
      setElapsedSec(baseRef.current.durationSec + (seg > 0 ? seg : 0));
    }, 1000);
  }

  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(refreshSnapshot, 2000);
  }

  function applyCadence(totalSteps, now) {
    const dSteps = totalSteps - lastSnapStepsRef.current;
    const dH = (now - lastSnapTimeRef.current) / 3600000;
    if (dSteps > 2 && dH > 0) {
      const speed = (dSteps * strideKmRef.current) / dH; // km/h
      if (speed > 0.5) setCurrentPace(60 / speed);
    }
    lastSnapStepsRef.current = totalSteps;
    lastSnapTimeRef.current = now;
  }

  // ---- Native session (foreground service owns step tracking even in background) ----

  async function refreshSnapshot() {
    if (!stepCounter || !nativeRef.current) return;
    try {
      const snap = await stepCounter.getSnapshot();
      if (!snap) return;

      if (!snap.tracking) {
        // Stopped externally (e.g. the notification's Stop action): fold its final summary.
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (snap.steps != null) {
          baseRef.current.steps += Math.round(snap.steps || 0);
          baseRef.current.durationSec += snap.durationSec || 0;
          setSteps(baseRef.current.steps);
          setElapsedSec(baseRef.current.durationSec);
        }
        nativeRef.current = false;
        if (wasTrackingRef.current) setStatus('paused');
        return;
      }
      wasTrackingRef.current = true;

      const totalSteps = baseRef.current.steps + Math.round(snap.steps || 0);
      setSteps(totalSteps);
      applyCadence(totalSteps, Date.now());
    } catch {}
  }

  // ---- JS motion fallback (no native plugin, e.g. browser preview) ----

  async function startMotionFallback() {
    if (motionHandleRef.current) return true;
    fallbackDetectorRef.current = createStepDetector();
    try {
      motionHandleRef.current = await Motion.addListener('accel', ({ accelerationIncludingGravity }) => {
        if (!accelerationIncludingGravity) return;
        const { x, y, z } = accelerationIncludingGravity;
        const mag = Math.sqrt(x * x + y * y + z * z);
        fallbackDetectorRef.current.feed(mag);
        const total = baseRef.current.steps + fallbackDetectorRef.current.steps;
        setSteps(total);
        applyCadence(total, Date.now());
      });
      return true;
    } catch {
      motionHandleRef.current = null;
      return false;
    }
  }

  async function stopMotionFallback() {
    if (!motionHandleRef.current) return;
    try {
      await motionHandleRef.current.remove();
    } catch {}
    motionHandleRef.current = null;
    fallbackDetectorRef.current = null;
  }

  // ---- Session control ----

  async function startSession() {
    if (status !== 'idle') return;
    baseRef.current = { steps: 0, durationSec: 0 };
    setElapsedSec(0);
    setSteps(0);
    setCurrentPace(null);
    setSensorDenied(false);
    setUsingMotion(false);
    resetRoute();

    segStartedAtRef.current = Date.now();
    lastSnapStepsRef.current = 0;
    lastSnapTimeRef.current = Date.now();

    startLocationFeed();

    if (stepCounter) {
      try {
        const res = await stepCounter.startSession({ activityType: mode, heightCm: Math.round(heightCm) });
        nativeRef.current = true;
        wasTrackingRef.current = true;
        if (res && res.sensorDenied) setSensorDenied(true);
        setStatus('active');
        startPolling();
        startTicker();
        return;
      } catch {
        nativeRef.current = false; // plugin unavailable — fall back
      }
    }

    setUsingMotion(true);
    const ok = await startMotionFallback();
    if (!ok) { setStatus('idle'); return; }
    setStatus('active');
    startTicker();
  }

  async function pauseSession() {
    if (status !== 'active') return;
    setStatus('paused');
    clearTimers();
    stopLocationFeed();
    setCurrentPace(null);

    if (nativeRef.current) {
      try {
        const snap = await stepCounter.stopSession();
        if (snap) {
          baseRef.current.steps += Math.round(snap.steps || 0);
          baseRef.current.durationSec += snap.durationSec || 0;
          setSteps(baseRef.current.steps);
          setElapsedSec(baseRef.current.durationSec);
        }
      } catch {}
      nativeRef.current = false;
    } else {
      baseRef.current.steps += fallbackDetectorRef.current?.steps || 0;
      baseRef.current.durationSec += Math.floor((Date.now() - segStartedAtRef.current) / 1000);
      setSteps(baseRef.current.steps);
      setElapsedSec(baseRef.current.durationSec);
      await stopMotionFallback();
    }
  }

  async function resumeSession() {
    if (status !== 'paused') return;
    setStatus('active');
    setCurrentPace(null);
    segStartedAtRef.current = Date.now();
    lastSnapStepsRef.current = baseRef.current.steps;
    lastSnapTimeRef.current = Date.now();

    startLocationFeed();

    if (stepCounter) {
      try {
        const res = await stepCounter.startSession({ activityType: mode, heightCm: Math.round(heightCm) });
        nativeRef.current = true;
        wasTrackingRef.current = true;
        if (res && res.sensorDenied) setSensorDenied(true);
        startPolling();
        startTicker();
        return;
      } catch {
        nativeRef.current = false;
      }
    }

    setUsingMotion(true);
    const ok = await startMotionFallback();
    if (!ok) { setStatus('paused'); return; }
    startTicker();
  }

  async function finishSession(save) {
    if (status === 'idle') return;
    if (status === 'active') await pauseSession();
    const total = baseRef.current;
    const distKm = total.steps * strideKm;
    if (save && (total.steps > 0 || total.durationSec > 0)) {
      const avgPace = distKm > 0.01 ? (total.durationSec / 60) / distKm : null;
      logWalk({
        type: mode,
        date: new Date().toISOString(),
        durationSec: Math.round(total.durationSec),
        distanceKm: Math.round(distKm * 100) / 100,
        steps: Math.round(total.steps),
        avgPace,
        ...(routeRef.current.length >= 2 ? { route: routeRef.current } : {}),
      });
    }
    resetSession();
  }

  function resetSession() {
    clearTimers();
    stopLocationFeed();
    resetRoute();
    setStatus('idle');
    setElapsedSec(0);
    setSteps(0);
    setCurrentPace(null);
    setSensorDenied(false);
    setUsingMotion(false);
    stopMotionFallback();
    baseRef.current = { steps: 0, durationSec: 0 };
    nativeRef.current = false;
    wasTrackingRef.current = false;
  }

  // On mount: if a session is still running natively (app was backgrounded/restarted),
  // restore the live tracking UI. On unmount: stop everything so tracking never leaks.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!stepCounter) return;
      try {
        const snap = await stepCounter.getSnapshot();
        if (cancelled || !snap || !snap.tracking) return;
        setMode(snap.activityType === 'running' ? 'running' : 'walk');
        nativeRef.current = true;
        wasTrackingRef.current = true;
        segStartedAtRef.current = Date.now() - (snap.durationSec || 0) * 1000;
        setElapsedSec(snap.durationSec || 0);
        setSteps(Math.round(snap.steps || 0));
        lastSnapStepsRef.current = snap.steps || 0;
        lastSnapTimeRef.current = Date.now();
        setStatus('active');
        startLocationFeed();
        startPolling();
        startTicker();
      } catch {}
    })();
    return () => {
      cancelled = true;
      clearTimers();
      stopLocationFeed();
      stopMotionFallback();
      if (nativeRef.current && stepCounter) {
        try { stepCounter.stopSession(); } catch {}
        nativeRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const avgPace = distanceKm > 0.01 ? formatPace(elapsedSec, distanceKm) : null;
  const isRunning = mode === 'running';

  return (
    <div className="fade-in" style={{ paddingBottom: 20 }}>
      {/* Mode picker (only when idle) */}
      <div className="card" style={{ marginBottom: 16, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Footprints size={18} color="#14B8A6" />
          <p style={{ fontSize: 15, fontWeight: 700 }}>Walk / Running Tracker</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {MODES.map(m => (
            <button
              key={m.id}
              disabled={status !== 'idle'}
              onClick={() => { setMode(m.id); }}
              style={{
                flex: 1, padding: '14px 0', borderRadius: 12, cursor: status === 'idle' ? 'pointer' : 'not-allowed',
                border: '2px solid', fontSize: 14, fontWeight: 700,
                background: mode === m.id ? (m.id === 'running' ? '#fdf2f8' : '#f0fdf4') : '#F9FAFB',
                borderColor: mode === m.id ? (m.id === 'running' ? '#f9a8d4' : '#bbf7d0') : '#E5E7EB',
                color: '#1A1A1A', opacity: status === 'idle' ? 1 : 0.7, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4
              }}
            >
              <span style={{ fontSize: 22 }}>{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {status === 'idle' ? (
        <>
          {/* Start card */}
          <div className="card slide-up" style={{ textAlign: 'center', padding: '28px 20px', marginBottom: 16 }}>
            <p style={{ fontSize: 26, marginBottom: 8 }}>{isRunning ? '🏃' : '🚶'}</p>
            <p style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
              {isRunning ? 'Ready to run?' : 'Ready for a walk?'}
            </p>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>
              Counts your steps from your phone's motion sensors and estimates distance from
              your stride — no GPS needed, and steps count no matter how you hold your phone.
            </p>
            <button className="btn-primary" onClick={startSession} style={{ maxWidth: 220, margin: '0 auto' }}>
              <Play size={18} /> Start
            </button>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 14 }}>
              🌙 Tracking keeps running while the app is in the background — you can lock your phone.
            </p>
          </div>

          {/* History */}
          <div className="section-header" style={{ marginTop: 8 }}>
            <h3>Recent Sessions</h3>
          </div>
          {walkLogs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '24px 16px', color: '#9CA3AF', fontSize: 13 }}>
              No sessions yet — hit Start and take your first steps! 👟
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[...walkLogs].reverse().map(log => (
                <div key={log.id} className="card" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 24 }}>{log.type === 'running' ? '🏃' : '🚶'}</span>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 14, textTransform: 'capitalize' }}>{log.type}</p>
                        <p style={{ fontSize: 12, color: '#6B7280' }}>
                          {new Date(log.date || log.timestamp).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: 800, fontSize: 15 }}>{log.distanceKm} km</p>
                      <p style={{ fontSize: 11, color: '#6B7280' }}>
                        {log.steps} steps • {formatDuration(log.durationSec)} • {log.avgPace != null ? formatPace(log.durationSec, log.distanceKm) : '--:--'} /km
                      </p>
                    </div>
                  </div>
                  {log.route && log.route.length >= 2 && (
                    <button
                      className="btn-small"
                      onClick={() => setViewingLog(log)}
                      style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, background: '#f0fdf4', borderColor: '#bbf7d0', color: '#047857' }}
                    >
                      <MapIcon size={14} /> View route on map
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Active / paused session */
        <div className="card slide-up" style={{ padding: 20 }}>
          {/* Live stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div style={{ background: '#1A1A1A', color: '#fff', borderRadius: 14, padding: '14px 12px', gridColumn: '1 / -1', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1 }}>Elapsed Time</p>
              <p style={{ fontSize: 34, fontWeight: 800, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{formatDuration(elapsedSec)}</p>
              <p style={{ fontSize: 11, color: '#C6F135', marginTop: 4 }}>
                {status === 'paused' ? '⏸ Paused' : '● Live'}
              </p>
            </div>
            <div style={{ background: '#F9FAFB', borderRadius: 14, padding: '12px', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>Distance</p>
              <p style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{distanceKm.toFixed(2)} <span style={{ fontSize: 12, fontWeight: 500, color: '#6B7280' }}>km</span></p>
            </div>
            <div style={{ background: '#F9FAFB', borderRadius: 14, padding: '12px', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>Steps</p>
              <p style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{Math.round(steps).toLocaleString()}</p>
            </div>
            <div style={{ background: '#F9FAFB', borderRadius: 14, padding: '12px', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>Avg Pace</p>
              <p style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{avgPace || '--:--'}</p>
              <p style={{ fontSize: 10, color: '#9CA3AF' }}>/km</p>
            </div>
            <div style={{ background: '#F9FAFB', borderRadius: 14, padding: '12px', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 1 }}>Current Pace</p>
              <p style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{currentPace ? formatPace(60 / currentPace, 1) : '--:--'}</p>
              <p style={{ fontSize: 10, color: '#9CA3AF' }}>/km</p>
            </div>
          </div>

          {/* Live route map (location is map-only — steps/distance stay stride-based) */}
          <div style={{ marginBottom: 14 }}>
            <RouteMapView
              points={route}
              currentPos={currentPos}
              accuracyM={gpsAccuracy || 0}
              showAccuracy
              follow
              markerColor={isRunning ? '#EC4899' : '#14B8A6'}
              height={270}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 11, color: '#6B7280' }}>
              {locationDenied ? (
                <span>📍 Location off — the route line won't show (steps &amp; distance still work).</span>
              ) : currentPos ? (
                <span>🛰️ GPS locked{gpsAccuracy != null ? ` · ±${gpsAccuracy} m` : ''} — route recording</span>
              ) : (
                <span>🛰️ Searching for GPS…</span>
              )}
            </div>
          </div>

          {sensorDenied && (
            <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>
              ℹ️ Step sensor permission was denied — steps are detected from your phone's motion instead.
            </p>
          )}
          {usingMotion && (
            <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>
              📱 Motion detection active — steps are counted from your phone's accelerometer.
            </p>
          )}

          {/* Controls */}
          <div style={{ display: 'flex', gap: 10 }}>
            {status === 'active' ? (
              <button className="btn-secondary" onClick={pauseSession} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Pause size={16} /> Pause
              </button>
            ) : (
              <button className="btn-secondary" onClick={resumeSession} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#f0fdf4', borderColor: '#bbf7d0' }}>
                <Play size={16} /> Resume
              </button>
            )}
            <button className="btn-primary" onClick={() => finishSession(true)} style={{ flex: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#1A1A1A', color: '#fff' }}>
              <Square size={16} /> Save Session
            </button>
          </div>
          <button onClick={() => finishSession(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', marginTop: 10, padding: 10, background: 'none', color: '#EF4444', fontWeight: 600, fontSize: 13 }}>
            <X size={16} /> Discard Session
          </button>
        </div>
      )}

      {/* Saved-route map viewer */}
      {viewingLog && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.55)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setViewingLog(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, maxHeight: '86vh', overflowY: 'auto', padding: 18, boxShadow: '0 20px 50px rgba(0,0,0,0.25)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800 }}>
                {viewingLog.type === 'running' ? '🏃' : '🚶'} Route · {viewingLog.distanceKm} km
              </h3>
              <button onClick={() => setViewingLog(null)} style={{ background: '#F3F4F6', borderRadius: 8, padding: 6, display: 'flex' }}>
                <X size={16} />
              </button>
            </div>
            <RouteMapView
              points={viewingLog.route || []}
              fitToRoute
              height={300}
              markerColor={viewingLog.type === 'running' ? '#EC4899' : '#14B8A6'}
              zoomControl
            />
            <p style={{ fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 12 }}>
              {new Date(viewingLog.date || viewingLog.timestamp).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
              <div>
                <p style={{ fontWeight: 800, fontSize: 16 }}>{viewingLog.steps}</p>
                <p style={{ fontSize: 11, color: '#9CA3AF' }}>steps</p>
              </div>
              <div>
                <p style={{ fontWeight: 800, fontSize: 16 }}>{formatDuration(viewingLog.durationSec)}</p>
                <p style={{ fontSize: 11, color: '#9CA3AF' }}>time</p>
              </div>
              <div>
                <p style={{ fontWeight: 800, fontSize: 16 }}>{viewingLog.avgPace != null ? formatPace(viewingLog.durationSec, viewingLog.distanceKm) : '--:--'}</p>
                <p style={{ fontSize: 11, color: '#9CA3AF' }}>/km</p>
              </div>
            </div>
            <button
              className="btn-primary"
              onClick={() => setViewingLog(null)}
              style={{ width: '100%', marginTop: 14, background: '#1A1A1A', color: '#fff' }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}