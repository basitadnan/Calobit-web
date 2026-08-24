// POST /api/checkout/create
// Frontend body: { plan: "monthly", easypaisa_name: "Ali Raza" }
// Creates a PayGate order for the Calobit product and (when Supabase is
// configured) records the order_id -> local username binding. If the same
// user still has an unexpired, unactivated order, that one is returned
// instead so returning to the app mid-checkout resumes rather than duplicates.

import { json, preflight, rateLimited, readRawBody } from '../_lib/http.js';
import { paygate } from '../_lib/paygate.js';
import { storeConfigured, findResumableForUser, insertRow } from '../_lib/store.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return preflight(req, res);
  if (req.method !== 'POST') return json(req, res, 405, { error: 'Method not allowed' });
  if (rateLimited(req, res, 'create', 6, 60_000)) return;

  let body;
  try {
    if (typeof req.body === 'object' && req.body !== null) {
      body = req.body;
    } else if (typeof req.body === 'string' && req.body.length) {
      body = JSON.parse(req.body);
    } else {
      body = JSON.parse((await readRawBody(req)).toString('utf8'));
    }
  } catch {
    return json(req, res, 400, { error: 'Invalid JSON body' });
  }

  const plan = typeof body.plan === 'string' ? body.plan.trim() : '';
  const easypaisaName = typeof body.easypaisa_name === 'string' ? body.easypaisa_name.trim() : '';
  const userId = typeof body.user_id === 'string' ? body.user_id.trim().slice(0, 64) : '';

  if (!userId) return json(req, res, 401, { error: 'Not signed in' });
  if (!easypaisaName) return json(req, res, 400, { error: 'Easypaisa account name is required' });
  if (plan !== 'monthly') return json(req, res, 400, { error: 'Unknown plan. Valid plans: monthly' });

  // Resume an existing live order for this user instead of stacking new ones.
  if (storeConfigured()) {
    try {
      const existing = await findResumableForUser(userId);
      if (existing) {
        return json(req, res, 200, {
          order_id: existing.order_id,
          amount: existing.amount,
          expires_at: existing.expires_at,
          easypaisa_number: process.env.EASYPAISA_NUMBER ?? '',
          easypaisa_account_name: process.env.EASYPAISA_ACCOUNT_NAME ?? '',
          resumed: true,
        });
      }
    } catch (err) {
      console.error('checkout/create resume lookup failed:', err.message);
    }
  }

  let order;
  try {
    order = await paygate('/api/orders', {
      method: 'POST',
      json: { product: 'calobit', plan, easypaisa_name: easypaisaName },
    });
  } catch (err) {
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 502;
    console.error('checkout/create PayGate error:', err.message);
    return json(req, res, status, { error: status === 502 ? 'Payment service unavailable' : err.message });
  }

  if (storeConfigured()) {
    try {
      await insertRow({
        order_id: order.order_id,
        user_id: userId,
        plan,
        amount: order.amount,
        expires_at: order.expires_at,
      });
    } catch (err) {
      // Non-fatal: the order exists at PayGate; only the server-side binding is missing.
      console.error('checkout/create binding insert failed:', err.message);
    }
  }

  return json(req, res, 200, {
    order_id: order.order_id,
    amount: order.amount,
    expires_at: order.expires_at,
    easypaisa_number: order.easypaisa_number || process.env.EASYPAISA_NUMBER || '',
    easypaisa_account_name: process.env.EASYPAISA_ACCOUNT_NAME ?? '',
  });
}
