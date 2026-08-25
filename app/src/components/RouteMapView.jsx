// Leaflet map used by the live Walk/Run session and the saved-route viewer.
//
// Tiles resolve from the offline cache first (see offlineTileLayer.js). If the
// cache can't fully cover the current view — offline and never visited, or a
// fetch failed — the tile layer reports a coverage gap and this component
// removes the tiles and shows the clean route-line view instead, rather than a
// map with holes in it.

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { OfflineTileLayer, OSM_ATTRIBUTION } from '../utils/offlineTileLayer';
import { TILE_URL_TEMPLATE } from '../utils/lru';

const WORLD_VIEW = [20, 0];
const WORLD_ZOOM = 2;
const ROUTE_ZOOM = 15;

export default function RouteMapView({
  points = [],
  height = 260,
  follow = false,
  fitToRoute = false,
  markerColor = '#14B8A6',
  showAccuracy = false,
  accuracyM = 0,
  currentPos = null,
  zoomControl = false,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const polylineRef = useRef(null);
  const startMarkRef = useRef(null);
  const endMarkRef = useRef(null);
  const posMarkRef = useRef(null);
  const accuracyRef = useRef(null);
  const [fallenBack, setFallenBack] = useState(false);

  // Create the map once per mount (guarded so React 19 StrictMode's
  // double-mount just tears down and recreates cleanly).
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      zoomControl,
      dragging: !follow,
      scrollWheelZoom: !follow,
      touchZoom: !follow,
      doubleClickZoom: !follow,
      boxZoom: !follow,
      keyboard: !follow,
    });
    map.attributionControl.setPrefix(false);

    const tileLayer = new OfflineTileLayer(TILE_URL_TEMPLATE, {
      attribution: OSM_ATTRIBUTION,
    });
    tileLayer._onCoverageGap = () => setFallenBack(true);
    tileLayer.addTo(map);

    mapRef.current = map;
    tileLayerRef.current = tileLayer;

    if (fitToRoute && points.length >= 2) {
      map.fitBounds(L.latLngBounds(points.map(p => [p.lat, p.lng])), {
        padding: [24, 24],
        maxZoom: 16,
      });
    } else if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], ROUTE_ZOOM);
    } else {
      map.setView(WORLD_VIEW, WORLD_ZOOM);
    }

    return () => {
      setFallenBack(false);
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      polylineRef.current = null;
      startMarkRef.current = null;
      endMarkRef.current = null;
      posMarkRef.current = null;
      accuracyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Coverage gap -> drop the tiles, keep the clean route-line view.
  useEffect(() => {
    if (!fallenBack) return;
    if (tileLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
  }, [fallenBack]);

  // Route line (with start/end dots for the saved-route viewer).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const ref of [polylineRef, startMarkRef, endMarkRef]) {
      if (ref.current) {
        map.removeLayer(ref.current);
        ref.current = null;
      }
    }
    const pts = points.filter(p => typeof p.lat === 'number' && typeof p.lng === 'number');
    if (pts.length < 2) return;

    polylineRef.current = L.polyline(
      pts.map(p => [p.lat, p.lng]),
      { color: markerColor, weight: 4, opacity: 0.85, lineJoin: 'round' }
    ).addTo(map);

    if (fitToRoute) {
      startMarkRef.current = L.circleMarker([pts[0].lat, pts[0].lng], {
        radius: 6, color: '#fff', weight: 3, fillColor: '#22C55E', fillOpacity: 1,
      }).addTo(map);
      endMarkRef.current = L.circleMarker([pts[pts.length - 1].lat, pts[pts.length - 1].lng], {
        radius: 7, color: '#fff', weight: 3, fillColor: markerColor, fillOpacity: 1,
      }).addTo(map);
    }
  }, [points, fitToRoute, markerColor]);

  // Live position dot + GPS accuracy circle.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const clearCircle = () => {
      if (accuracyRef.current) {
        map.removeLayer(accuracyRef.current);
        accuracyRef.current = null;
      }
    };

    if (!currentPos || typeof currentPos.lat !== 'number') {
      if (posMarkRef.current) {
        map.removeLayer(posMarkRef.current);
        posMarkRef.current = null;
      }
      clearCircle();
      return;
    }

    const latlng = [currentPos.lat, currentPos.lng];
    if (!posMarkRef.current) {
      posMarkRef.current = L.circleMarker(latlng, {
        radius: 6, color: '#fff', weight: 3, fillColor: markerColor, fillOpacity: 1,
      }).addTo(map);
    } else {
      posMarkRef.current.setLatLng(latlng);
    }

    if (showAccuracy && accuracyM > 0) {
      if (!accuracyRef.current) {
        accuracyRef.current = L.circle(latlng, {
          radius: accuracyM, color: markerColor, weight: 1, opacity: 0.35,
          fillColor: markerColor, fillOpacity: 0.08,
        }).addTo(map);
      } else {
        accuracyRef.current.setLatLng(latlng).setRadius(accuracyM);
      }
    } else {
      clearCircle();
    }
  }, [currentPos, accuracyM, showAccuracy, markerColor]);

  // Live follow: keep the walking area in view without yanking the zoom.
  useEffect(() => {
    if (!follow) return;
    const map = mapRef.current;
    if (!map) return;
    const target = currentPos || (points.length ? points[points.length - 1] : null);
    if (!target || typeof target.lat !== 'number') return;
    const latlng = [target.lat, target.lng];
    if (map.getBounds().contains(latlng)) return;
    if (map.getZoom() < ROUTE_ZOOM) {
      map.setView(latlng, ROUTE_ZOOM, { animate: false });
    } else {
      map.panTo(latlng, { animate: true, duration: 0.5 });
    }
  }, [follow, currentPos, points]);

  return (
    <div
      style={{
        position: 'relative',
        zIndex: 0,
        isolation: 'isolate',
        height,
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(17, 24, 39, 0.08)',
      }}
    >
      <div
        ref={containerRef}
        style={{ height: '100%', width: '100%', background: '#EEF2F7' }}
      />
      {fallenBack && (
        <div
          style={{
            position: 'absolute',
            left: 8,
            bottom: 8,
            zIndex: 500,
            maxWidth: '78%',
            background: 'rgba(255,255,255,0.94)',
            border: '1px solid #E5E7EB',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 11,
            color: '#6B7280',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}
        >
          📍 Map tiles unavailable (offline &amp; not cached) — route shown without map
        </div>
      )}
    </div>
  );
}