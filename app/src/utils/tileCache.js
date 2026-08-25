// Offline tile cache for the map.
//
// Tile blobs live in leaflet.offline's IndexedDB store (its `saveTile` /
// `getBlobByKey` / `hasTile` / `removeTile` / `truncate` API), while a small
// side store keeps per-tile { size, lastUsed } bookkeeping so we can enforce
// the 100 MB cap with LRU eviction.

import { openDB } from 'idb';
import {
  saveTile,
  removeTile,
  getBlobByKey,
  hasTile,
  truncate,
} from 'leaflet.offline';
import {
  computeEvictions,
  CACHE_CAP_BYTES,
  TILE_URL_TEMPLATE,
  tileKey,
} from './lru';

const DB_NAME = 'calobit_tiles';
const STORE = 'meta';
const TOTAL_KEY = '__total';

export { CACHE_CAP_BYTES, tileKey };

let dbPromise;

function metaDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('lastUsed', 'lastUsed');
      },
    });
  }
  return dbPromise;
}

// Serialize mutations so concurrent tile saves don't race the byte counter.
let lock = Promise.resolve();
function withLock(fn) {
  const run = lock.then(fn, fn);
  lock = run.catch(() => {});
  return run;
}

async function readTotal(db) {
  const stat = await db.get(STORE, TOTAL_KEY);
  return stat?.totalBytes || 0;
}

async function writeTotal(db, totalBytes) {
  await db.put(STORE, { key: TOTAL_KEY, totalBytes });
}

async function evictIfOverCap() {
  const db = await metaDb();
  let total = await readTotal(db);
  if (total <= CACHE_CAP_BYTES) return;

  // Indexed by lastUsed → ascending (least-recently-used) order.
  const records = await db.getAllFromIndex(STORE, 'lastUsed');
  const victims = computeEvictions(records, total, CACHE_CAP_BYTES);
  for (const key of victims) {
    try {
      await removeTile(key); // delete the blob from leaflet.offline's store
    } catch {}
    await db.delete(STORE, key);
    total -= records.find(r => r.key === key)?.size || 0;
  }
  await writeTotal(db, Math.max(0, total));
}

/** Blob for a cached tile, or null. Touches the tile's LRU time on a hit. */
export async function getCachedTile(key) {
  const blob = await getBlobByKey(key);
  if (blob) {
    const db = await metaDb();
    const rec = await db.get(STORE, key);
    if (rec) {
      rec.lastUsed = Date.now();
      await db.put(STORE, rec);
    }
  }
  return blob || null;
}

/** True when the tile blob is already in leaflet.offline's store. */
export async function tileIsCached(key) {
  return hasTile(key);
}

/** Persist a fetched tile (blob → leaflet.offline's IndexedDB store) and keep
 *  the cache under its size cap with LRU eviction. */
export async function cacheTile(z, x, y, blob) {
  const key = tileKey(z, x, y);
  const size = blob.size;
  await withLock(async () => {
    const db = await metaDb();
    const existing = await db.get(STORE, key);
    let total = await readTotal(db);
    if (!existing) total += size;
    await db.put(STORE, { key, size, lastUsed: Date.now() });
    await writeTotal(db, total);
    await saveTile(
      { key, url: key, urlTemplate: TILE_URL_TEMPLATE, x, y, z, createdAt: Date.now() },
      blob
    );
    await evictIfOverCap();
  });
}

/** Total bytes currently tracked by the LRU bookkeeping. */
export async function tileCacheBytes() {
  const db = await metaDb();
  return readTotal(db);
}

/** Empty both the tile store and the LRU bookkeeping. */
export async function clearTileCache() {
  await withLock(async () => {
    await truncate();
    const db = await metaDb();
    await db.clear(STORE);
  });
}