// POST /api/ai/gemini — proxies Gemini for the Calobit app so the API key
// never ships inside the APK. Calobit is fully free: no accounts, no quotas,
// no premium tiers. The only guard is a basic rate limit per client IP to
// keep the shared key from being abused.
// The client sends the fully-built Gemini payload; this layer only adds the
// key and the model-fallback logic.

import { json, preflight, rateLimited, readRawBody } from '../_lib/http.js';
import { aiConfigured, generateContent } from '../_lib/ai.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return preflight(req, res);
  if (req.method !== 'POST') return json(req, res, 405, { error: 'Method not allowed' });
  if (rateLimited(req, res, 'ai', 20, 60_000)) return;

  let body;
  try {
    if (typeof req.body === 'object' && req.body !== null) {
      body = req.body;
    } else {
      body = JSON.parse((await readRawBody(req)).toString('utf8'));
    }
  } catch {
    return json(req, res, 400, { error: 'Invalid JSON body' });
  }

  if (!aiConfigured()) return json(req, res, 503, { error: 'AI is not configured yet — check back soon' });
  if (!body.payload?.contents) return json(req, res, 400, { error: 'Missing Gemini payload' });

  let text;
  try {
    text = await generateContent(body.payload);
  } catch (err) {
    return json(req, res, err.status || 502, { error: err.message });
  }

  return json(req, res, 200, { text });
}
