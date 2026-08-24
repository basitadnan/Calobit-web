// Thin PayGate client. PAYGATE_API_URL and PAYGATE_API_KEY live only in
// server-side env vars — they must never reach the frontend bundle.

const API_URL = (process.env.PAYGATE_API_URL || '').replace(/\/+$/, '');
const API_KEY = process.env.PAYGATE_API_KEY || '';
// Abort hung upstream calls instead of running until the platform timeout.
const REQUEST_TIMEOUT_MS = 8000;

export function paygateConfigured() {
  return Boolean(API_URL && API_KEY);
}

/**
 * Call a PayGate endpoint. Throws Error with `.status` and `.body` on
 * non-2xx so routes can decide whether to surface or swallow. Timeouts and
 * unreachable hosts surface as status 502.
 */
export async function paygate(path, { method = 'GET', json: jsonBody, body, headers = {} } = {}) {
  if (!paygateConfigured()) {
    const err = new Error('PayGate is not configured');
    err.status = 503;
    throw err;
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        'X-Api-Key': API_KEY,
        ...(jsonBody !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: jsonBody !== undefined ? JSON.stringify(jsonBody) : body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    const err = new Error('PayGate is unreachable');
    err.status = 502;
    err.cause = e;
    throw err;
  }

  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Non-JSON error pages from upstream — keep the text.
  }

  if (!res.ok) {
    const err = new Error(parsed?.error || `PayGate error (${res.status})`);
    err.status = res.status;
    err.body = parsed ?? text;
    throw err;
  }
  return parsed;
}
