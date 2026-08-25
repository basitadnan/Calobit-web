// Geo + session helpers for the Walk / Running tracker

const EARTH_RADIUS_M = 6371000;

/** Great-circle distance between two lat/lng points in meters (haversine). */
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Total distance of a route array in km. */
export function routeDistanceKm(route) {
  let meters = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1];
    const b = route[i];
    meters += haversineMeters(a.lat, a.lng, b.lat, b.lng);
  }
  return meters / 1000;
}

/** Format seconds as m:ss or h:mm:ss. */
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = n => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** Pace as mm:ss per km. Returns "--:--" when distance is too small. */
export function formatPace(totalSeconds, distanceKm) {
  if (!distanceKm || distanceKm < 0.01) return '--:--';
  const minPerKm = totalSeconds / 60 / distanceKm;
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  if (s === 60) return `${m + 1}:00`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Instant speed in km/h between two route points (0 if invalid). */
export function speedKmh(prev, curr) {
  if (!prev || !curr) return 0;
  const meters = haversineMeters(prev.lat, prev.lng, curr.lat, curr.lng);
  const seconds = (curr.t - prev.t) / 1000;
  if (meters <= 0 || seconds <= 0) return 0;
  return (meters / seconds) * 3.6;
}

/**
 * Estimated stride length in meters for one step, based on height.
 * Walking stride ≈ 0.414 × height; running stride is longer (~1.35×).
 */
export function strideLengthMeters(heightCm, activityType) {
  const h = heightCm || 170;
  const base = (h * 0.414) / 100; // meters per step, walking
  return activityType === 'running' ? base * 1.35 : base;
}

/** Estimate steps from distance when the device has no step sensor. */
export function estimateStepsFromDistance(distanceKm, heightCm, activityType) {
  const stride = strideLengthMeters(heightCm, activityType);
  return Math.round((distanceKm * 1000) / stride);
}

/**
 * Build a polyline string (SVG) from a route, normalized to a viewBox.
 * Returns { points, start, end, hasRoute }.
 */
export function buildPolyline(route, width = 100, height = 100, padding = 6) {
  const pts = route.filter(p => typeof p.lat === 'number' && typeof p.lng === 'number');
  if (pts.length < 2) return { points: '', start: null, end: null, hasRoute: false };

  const lats = pts.map(p => p.lat);
  const lngs = pts.map(p => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const spanLat = Math.max(maxLat - minLat, 1e-6);
  const spanLng = Math.max(maxLng - minLng, 1e-6);
  const scale = Math.min((width - padding * 2) / spanLng, (height - padding * 2) / spanLat);
  const offsetX = (width - spanLng * scale) / 2;
  const offsetY = (height - spanLat * scale) / 2;

  const px = p => offsetX + (p.lng - minLng) * scale;
  const py = p => height - (offsetY + (p.lat - minLat) * scale); // lat up = y up

  const points = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p).toFixed(2)},${py(p).toFixed(2)}`).join(' ');
  return {
    points,
    start: { x: px(pts[0]), y: py(pts[0]) },
    end: { x: px(pts[pts.length - 1]), y: py(pts[pts.length - 1]) },
    hasRoute: true,
  };
}