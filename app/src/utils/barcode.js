// Barcode normalization + OpenFoodFacts product lookup.
//
// Every look-up result is shaped like a per-100g food item
// ({ name, caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g })
// so the existing FoodLogDrawer / scaleFoodNutrition flow applies unchanged.

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product';
const OFF_FIELDS = 'product_name,brands,quantity,nutriments,image_small_url';
const OFF_TIMEOUT_MS = 8000;

/** Strip non-digits and canonicalize common retail formats:
 *  UPC-A (12 digits) → EAN-13 with a leading zero; other lengths pass through. */
export function normalizeBarcode(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D+/g, '');
  if (digits.length === 12) return '0' + digits;
  return digits;
}

/** EAN-13 / EAN-8 checksum sanity check; unverifiable lengths return true. */
export function isValidChecksum(code) {
  const d = String(code).replace(/\D+/g, '');
  if (d.length !== 8 && d.length !== 13) return true;
  const body = d.slice(0, d.length - 1);
  const weight = d.length === 13 ? (i) => (i % 2 === 0 ? 1 : 3) : (i) => (i % 2 === 0 ? 3 : 1);
  const sum = body.split('').reduce((acc, ch, i) => acc + parseInt(ch) * weight(i), 0);
  return (10 - (sum % 10)) % 10 === parseInt(d[d.length - 1]);
}

function round1(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v * 10) / 10 : 0;
}

function kcal100(nutriments) {
  const kcal = Number(nutriments['energy-kcal_100g']);
  if (Number.isFinite(kcal) && kcal > 0) return Math.round(kcal);
  const kj = Number(nutriments['energy_100g']);
  if (Number.isFinite(kj) && kj > 0) return Math.round(kj / 4.184);
  return 0;
}

/** True when the OFF record actually carries per‑100g nutrient values. */
function hasNutritionData(nutriments) {
  const n = nutriments || {};
  return ['energy-kcal_100g', 'energy_100g', 'proteins_100g', 'carbohydrates_100g', 'fat_100g']
    .some(k => Number(n[k]) > 0);
}

/** Map an OpenFoodFacts product object (v2 "product" field) to the app shape. */
export function mapProduct(offProduct, code) {
  const n = offProduct.nutriments || {};
  return {
    code: String(code),
    name: offProduct.product_name || offProduct.generic_name || offProduct.brands || `Product ${code}`,
    brand: offProduct.brands || '',
    quantity: offProduct.quantity || '',
    imageUrl: offProduct.image_small_url || '',
    source: 'openfoodfacts',
    hasNutrition: hasNutritionData(n),
    caloriesPer100g: kcal100(n),
    proteinPer100g: round1(n.proteins_100g),
    carbsPer100g: round1(n.carbohydrates_100g),
    fatPer100g: round1(n.fat_100g),
    // Extra nutrients (free tier) — 0 when OFF doesn't carry them.
    fiberPer100g: round1(n.fiber_100g),
    sugarPer100g: round1(n.sugars_100g),
    sodiumPer100g: round1(n.sodium_100g),
  };
}

/** Look up a barcode on OpenFoodFacts (v2 API). Returns null when the code
 *  is unknown (status 0), and throws on network/timeout errors. */
export async function lookupProduct(code) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OFF_TIMEOUT_MS);
  try {
    const response = await fetch(`${OFF_BASE}/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`OpenFoodFacts error (${response.status}).`);
    const data = await response.json();
    if (!data || data.status === 0 || !data.product) return null;
    return mapProduct(data.product, code);
  } finally {
    clearTimeout(timer);
  }
}