// Offline cache of scanned barcode products.
//
// Every resolved product is stored under its barcode so repeat scans log
// instantly and work fully offline; the same store feeds the local DB search.

import { openDB } from 'idb';

const DB_NAME = 'calobit_products';
const STORE = 'products';
const MAX_PRODUCTS = 400;

let dbPromise;

function db() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(d) {
        d.createObjectStore(STORE, { keyPath: 'code' });
      },
    });
  }
  return dbPromise;
}

/** Cached product for a barcode, or null. */
export async function getCachedProduct(code) {
  try {
    return (await db()).get(STORE, code) || null;
  } catch {
    return null;
  }
}

/** Persist (or refresh) a scanned product; evict oldest entries when full. */
export async function saveProduct(product) {
  try {
    const d = await db();
    const all = await d.getAll(STORE);
    const exists = all.some(p => p.code === product.code);
    await d.put(STORE, { ...product, cachedAt: Date.now() });
    if (!exists && all.length >= MAX_PRODUCTS) {
      const sorted = all.sort((a, b) => (a.cachedAt || 0) - (b.cachedAt || 0));
      const victims = sorted.slice(0, all.length - MAX_PRODUCTS + 1);
      for (const victim of victims) await d.delete(STORE, victim.code);
    }
  } catch {}
}

/** All cached products (used to surface scanned items in the DB search). */
export async function getAllCachedProducts() {
  try {
    return await (await db()).getAll(STORE);
  } catch {
    return [];
  }
}