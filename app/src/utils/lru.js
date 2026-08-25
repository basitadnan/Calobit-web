// LRU eviction maths for the offline tile cache (no side effects — safe to
// unit test without IndexedDB or Leaflet).

export const CACHE_CAP_BYTES = 100 * 1024 * 1024; // 100 MB

export const TILE_URL_TEMPLATE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/** Stable cache key for a tile (the template used for the OSM tile URL). */
export function tileKey(z, x, y) {
  return TILE_URL_TEMPLATE.replace('{z}', z).replace('{x}', x).replace('{y}', y);
}

/**
 * Decide which tiles to evict to bring a cache back under `capBytes`.
 *
 * @param records   [{ key, size, lastUsed }] — every tracked tile
 * @param totalBytes current total size of tiles in the cache
 * @param capBytes  upper size limit (default 100 MB)
 * @returns array of `key`s to delete, oldest `lastUsed` first
 */
export function computeEvictions(records, totalBytes, capBytes = CACHE_CAP_BYTES) {
  let over = totalBytes - capBytes;
  if (over <= 0 || records.length === 0) return [];
  const evicted = [];
  for (const rec of [...records].sort((a, b) => a.lastUsed - b.lastUsed)) {
    if (over <= 0) break;
    evicted.push(rec.key);
    over -= rec.size;
  }
  return evicted;
}