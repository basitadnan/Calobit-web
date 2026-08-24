// Shared helpers for the /api/checkout/* Vercel serverless functions.

// CORS only matters for native Capacitor WebViews (the web app is
// same-origin, which bypasses CORS entirely), so the allowlist stays tight.
const ALLOWED_ORIGIN_RE = [
  /^https:\/\/calobit\.vercel\.app$/,
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  /^capacitor:\/\/localhost$/,
];

export function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGIN_RE.some((re) => re.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
}

export function preflight(req, res) {
  applyCors(req, res);
  res.statusCode = 204;
  res.end();
}

// ---- In-memory fixed-window rate limiter (per serverless instance).
// PayGate's create budget (30/min) is shared by ALL Calobit users, so this
// front-line limit keeps one abuser from locking everyone out. Same caveat as
// PayGate's: per warm instance — good-enough first pass.
const rateBuckets = new Map();

export function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

export function checkRateLimit(key, limit, windowMs) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count++;
  return bucket.count <= limit;
}

/** Rate-limit helper returning a 429 response when the caller is over budget. */
export function rateLimited(req, res, scope, limit, windowMs) {
  if (checkRateLimit(`${scope}:${clientIp(req)}`, limit, windowMs)) return false;
  json(req, res, 429, { error: 'Too many requests — try again shortly' });
  return true;
}

export function json(req, res, status, payload) {
  applyCors(req, res);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

/** Collect the full request body as a Buffer (serverless bodies are small). */
export function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 5 * 1024 * 1024) {
        reject(new Error('body_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
