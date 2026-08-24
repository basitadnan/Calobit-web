// POST /api/checkout/screenshot  (multipart/form-data: file=<image>, order_id=CB-XXXXX)
// Manual-review fallback: forwards the user's payment screenshot to PayGate
// for dashboard review. The raw multipart body is piped through untouched —
// PayGate owns all validation, storage and size limits.

import { json, preflight, rateLimited, readRawBody } from '../_lib/http.js';
import { paygate } from '../_lib/paygate.js';

const ORDER_ID_RE = /^[A-Za-z0-9-]{1,40}$/;
const MAX_BODY_BYTES = 4 * 1024 * 1024; // stay under Vercel's ~4.5 MB function limit

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return preflight(req, res);
  if (req.method !== 'POST') return json(req, res, 405, { error: 'Method not allowed' });
  if (rateLimited(req, res, 'screenshot', 5, 60_000)) return;

  const contentType = req.headers['content-type'] || '';
  if (!contentType.startsWith('multipart/form-data')) {
    return json(req, res, 400, { error: 'Expected multipart/form-data with a "file" field' });
  }

  let orderId = '';
  const url = new URL(req.url, 'http://localhost');
  orderId = url.searchParams.get('order_id') || '';
  if (!orderId && typeof req.query?.order_id === 'string') orderId = req.query.order_id;
  if (!ORDER_ID_RE.test(orderId)) return json(req, res, 400, { error: 'Invalid order_id' });

  let raw;
  try {
    raw = await readRawBody(req);
  } catch (err) {
    const tooBig = err.message === 'body_too_large';
    return json(req, res, tooBig ? 413 : 400, {
      error: tooBig ? 'Screenshot too large (max 4MB)' : 'Failed to read upload',
    });
  }
  if (!raw.length || raw.length > MAX_BODY_BYTES) {
    return json(req, res, 413, { error: 'Screenshot too large (max 4MB)' });
  }

  try {
    await paygate(`/api/orders/${encodeURIComponent(orderId)}/screenshot`, {
      method: 'POST',
      body: new Uint8Array(raw),
      headers: { 'Content-Type': contentType },
    });
    return json(req, res, 200, { ok: true });
  } catch (err) {
    const status = err.status === 404 ? 404 : err.status === 409 ? 409 : err.status === 429 ? 429 : 502;
    if (status === 502) console.error('checkout/screenshot PayGate error:', err.message);
    return json(req, res, status, { error: status === 502 ? 'Payment service unavailable' : err.message });
  }
}
