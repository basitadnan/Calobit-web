// pending_checkouts storage (Calobit's own Supabase), accessed via the
// PostgREST API with the service-role key — no SDK dependency needed.
//
// The table binds PayGate order IDs to local Calobit usernames so a payment
// activates exactly one account and repeated status polls can't double-process.
// Everything here degrades to a no-op when SUPABASE_URL /
// SUPABASE_SERVICE_ROLE_KEY aren't set: checkout still works as a pure
// PayGate pass-through, just without server-side binding/idempotency.

const URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TABLE = 'pending_checkouts';

export function storeConfigured() {
  return Boolean(URL && KEY);
}

function headers(extra = {}) {
  return {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function rest(path, options = {}) {
  const res = await fetch(`${URL}/rest/v1/${path.replace(/^\/+/, '')}`, {
    ...options,
    headers: headers(options.headers),
    signal: AbortSignal.timeout(8000),
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON body — leave parsed null and rely on res.ok.
  }
  if (!res.ok) {
    throw new Error(`Supabase ${options.method || 'GET'} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return parsed;
}

export async function getRowByOrderId(orderId) {
  const rows = await rest(
    `${TABLE}?order_id=eq.${encodeURIComponent(orderId)}&select=order_id,user_id,plan,amount,expires_at,activated&limit=1`
  );
  return rows?.[0] ?? null;
}

/** Newest non-activated, non-expired checkout row for a user, if any. */
export async function findResumableForUser(userId) {
  const now = new Date().toISOString();
  const rows = await rest(
    `${TABLE}?user_id=eq.${encodeURIComponent(userId)}&activated=eq.false&expires_at=gt.${now}` +
      `&select=order_id,plan,amount,expires_at&order=created_at.desc&limit=1`
  );
  return rows?.[0] ?? null;
}

export async function insertRow(row) {
  await rest(`${TABLE}`, {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    // Don't rely on column defaults — spell out every field we query on later.
    body: JSON.stringify({ ...row, activated: false, created_at: new Date().toISOString() }),
  });
}

/**
 * Flip activated false -> true in one conditional update. Returns true only
 * when this call performed the transition, so concurrent pollers (or repeated
 * polls) can't double-activate.
 */
export async function markActivated(orderId) {
  const rows = await rest(
    `${TABLE}?order_id=eq.${encodeURIComponent(orderId)}&activated=eq.false`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ activated: true }),
    }
  );
  return Array.isArray(rows) && rows.length > 0;
}

// ---- AI usage budget (see ../ai/gemini.js). One row per user per month.

const AI_TABLE = 'ai_usage';

export async function getAiCount(userId, month) {
  const rows = await rest(
    `${AI_TABLE}?user_id=eq.${encodeURIComponent(userId)}&month=eq.${month}&select=count&limit=1`
  );
  return rows?.[0]?.count ?? 0;
}

export async function setAiCount(userId, month, count) {
  await rest(AI_TABLE, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: userId, month, count }),
  });
}
