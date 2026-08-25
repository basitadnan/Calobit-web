// Offline-cache-backed Leaflet tile layer.
//
// Per-tile rendering rule:
//   1. Cached in IndexedDB              -> shown instantly, no network call.
//   2. Not cached + device online       -> fetched from the tile server, then
//                                          auto-saved for future offline use.
//   3. Not cached + offline (or a fetch
//      failure / timeout)               -> tile left blank, and the layer tells
//                                          the caller there's a "coverage gap"
//                                          so it can switch to the plain
//                                          route-line view. The user never sees
//                                          a map with holes in it.
//
// Tile keys are the full tile URLs (https://tile.openstreetmap.org/z/x/y.png),
// matching the LRU bookkeeping in tileCache.js.

import L from 'leaflet';
import { cacheTile, getCachedTile } from './tileCache';

const EMPTY_TILE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// A request that hangs must not leave the view half-loaded forever — the
// coverage check only runs once the view has settled.
const FETCH_TIMEOUT_MS = 15000;

export const OfflineTileLayer = L.TileLayer.extend({
  options: {
    maxZoom: 19,
  },

  // urlTemplate must be the same template the cache keys use
  // (https://tile.openstreetmap.org/{z}/{x}/{y}.png).
  initialize(urlTemplate, options) {
    this._urlTemplate = urlTemplate;
    this._onCoverageGap = null;
    this._fellBack = false;
    L.TileLayer.prototype.initialize.call(this, urlTemplate, options);
  },

  onAdd(map) {
    L.TileLayer.prototype.onAdd.call(this, map);
    this.on('load', this._viewSettled, this);
    this.on('tileerror', this._viewSettled, this);
  },

  onRemove(map) {
    this.off('load', this._viewSettled, this);
    this.off('tileerror', this._viewSettled, this);
    L.TileLayer.prototype.onRemove.call(this, map);
  },

  // Same URL form as the cache keys (no retina/subdomain variants).
  getTileUrl(coords) {
    return L.Util.template(this._urlTemplate, coords);
  },

  createTile(coords, done) {
    const tile = document.createElement('img');
    tile.alt = '';
    L.DomEvent.on(tile, 'load', L.Util.bind(this._tileOnLoad, this, done, tile));
    L.DomEvent.on(tile, 'error', L.Util.bind(this._tileOnError, this, done, tile));

    const key = this.getTileUrl(coords);

    // Cache first, always. The network is only consulted when there's no hit.
    getCachedTile(key)
      .then(blob => {
        if (!this._map || this._fellBack) return;
        if (blob) {
          tile.dataset.tileState = 'cached';
          this._showBlob(tile, blob);
          return;
        }
        this._fetchAndCache(tile, key, coords);
      })
      .catch(() => this._markMissing(tile));

    return tile;
  },

  _showBlob(tile, blob) {
    tile._blobUrl = URL.createObjectURL(blob);
    tile.src = tile._blobUrl;
  },

  _fetchAndCache(tile, key, coords) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this._markMissing(tile);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    fetch(key, { signal: controller.signal, credentials: 'omit' })
      .then(async res => {
        if (!res.ok) throw new Error(`tile fetch ${res.status}`);
        const blob = await res.blob();
        if (!this._map || this._fellBack) return;
        tile.dataset.tileState = 'fetched';
        this._showBlob(tile, blob);
        // Persist for offline reuse; LRU keeps the cache under its size cap.
        // Never blocks rendering.
        cacheTile(coords.z, coords.x, coords.y, blob).catch(() => {});
      })
      .catch(() => {
        this._markMissing(tile);
      })
      .finally(() => clearTimeout(timer));
  },

  _markMissing(tile) {
    tile.dataset.tileState = 'missing';
    // A transparent tile that "loads" fine: the view settles, then our
    // coverage check switches the caller to the clean fallback.
    tile.src = EMPTY_TILE;
  },

  // Runs after the view's tiles settle (or one of them errors). If any tile
  // of the current view couldn't be served, tell the caller to fall back.
  _viewSettled(e) {
    if (this._fellBack) return;
    if (e && e.type === 'tileerror' && e.tile) {
      e.tile.dataset.tileState = 'missing';
    }
    if (this._hasCoverageGap() && this._onCoverageGap) {
      this._fellBack = true;
      this._onCoverageGap();
    }
  },

  // True when a tile intersecting the current viewport is blank.
  _hasCoverageGap() {
    if (!this._map) return false;
    const view = this._map.getPixelBounds();
    const tileSize = this.getTileSize();
    const zoom = this._tileZoom;
    for (const key in this._tiles) {
      const t = this._tiles[key];
      if (!t || !t.el || !t.el.dataset || t.el.dataset.tileState !== 'missing') {
        continue;
      }
      if (t.coords.z !== zoom) continue; // stale zoom level, not this view
      const topLeft = t.coords.scaleBy(tileSize);
      if (view.intersects(new L.Bounds(topLeft, topLeft.add(tileSize)))) {
        return true;
      }
    }
    return false;
  },

  _tileOnLoad(done, tile) {
    this._revokeBlob(tile);
    L.TileLayer.prototype._tileOnLoad.call(this, done, tile);
  },

  _tileOnError(done, tile, e) {
    this._revokeBlob(tile);
    L.TileLayer.prototype._tileOnError.call(this, done, tile, e);
  },

  // The decoded pixels stay on screen after revoking; this just frees the
  // blob URL so a long session doesn't leak them.
  _revokeBlob(tile) {
    if (tile._blobUrl) {
      URL.revokeObjectURL(tile._blobUrl);
      tile._blobUrl = null;
    }
  },
});

/** Shared OSM attribution string for the map components. */
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';