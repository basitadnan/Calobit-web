// GET /api/checkout/status?order_id=CB-XXXXX
// Polls PayGate for the order's status. The first poll that sees PAID also
// marks the pending_checkouts row activated (idempotently) — after that the
// order is permanently bound and can never be reused for another activation.

import { json, preflight, rateLimited } from '../_lib/http.js';
import { paygate } from '../_lib/paygate.js';
import { storeConfigured, getRowByOrderId, markActivated } from '../_lib/store.js';

const ORDER_ID_RE = /^[A-Za-z0-9-]{1,40}$/;

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return preflight(req, res);
  if (req.method !== 'GET') return json(req, res, 405, { error: 'Method not allowed' });
  // Legit clients poll ~5/min; leave generous headroom above that.
  if (rateLimited(req, res, 'status', 30, 60_000)) return;

  const orderId =
    (typeof req.query?.order_id === 'string' && req.query.order_id) ||
    new URL(req.url ?? '/', 'http://localhost').searchParams.get('order_id') ||
    '';
  if (!ORDER_ID_RE.test(orderId)) return json(req, res, 400, { error: 'Invalid order_id' });

  let remote;
  try {
    remote = await paygate(`/api/orders/${encodeURIComponent(orderId)}/status`);
  } catch (err) {
    const status = err.status === 404 ? 404 : err.status === 429 ? 429 : 502;
    if (status === 502) console.error('checkout/status PayGate error:', err.message);
    return json(req, res, status, { error: status === 502 ? 'Payment service unavailable' : err.message });
  }

  const status = remote?.status ?? 'PENDING';

  // First confirmation of PAID activates the binding exactly once.
  if (status === 'PAID' && storeConfigured()) {
    try {
      await markActivated(orderId);
    } catch (err) {
      console.error('checkout/status activation update failed:', err.message);
    }
  }

  return json(req, res, 200, { order_id: orderId, status });
}
