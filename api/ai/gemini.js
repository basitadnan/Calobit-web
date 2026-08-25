// POST /api/ai/gemini — proxies Gemini for the Calobit app so the API key
// never ships inside the APK, and enforces the monthly AI budget:
//   free accounts  -> AI_FREE_LIMIT (15) calls per calendar month
//   premium accounts -> high abuse cap instead of a hard limit
// The client sends the fully-built Gemini payload; this layer only adds the
// key, the quota, and the model-fallback logic.

import { json, preflight, rateLimited, readRawBody } from '../_lib/http.js';
import { AI_FREE_LIMIT, aiConfigured, generateContent, getUsage, recordUsage } from '../_lib/ai.js';

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

  const userId = typeof body.user_id === 'string' ? body.user_id.trim().slice(0, 64) : '';
  if (!userId) return json(req, res, 401, { error: 'Not signed in' });
  if (!aiConfigured()) return json(req, res, 503, { error: 'AI is not configured yet — check back soon' });
  if (!body.payload?.contents) return json(req, res, 400, { error: 'Missing Gemini payload' });

  const premium = body.premium === true;

  const usage = await getUsage(userId, premium);
  if (usage.used >= usage.limit) {
    return json(req, res, 429, {
      error: premium
        ? 'Monthly AI cap reached — it resets next month'
        : `Free AI limit reached (${AI_FREE_LIMIT}/month). Upgrade to Premium for unlimited AI.`,
      remaining: 0,
      limit: usage.limit,
      premium,
    });
  }

  let text;
  try {
    text = await generateContent(body.payload);
  } catch (err) {
    return json(req, res, err.status || 502, { error: err.message });
  }

  // Only successful calls count against the budget.
  await recordUsage(userId, premium);
  const after = await getUsage(userId, premium);
  return json(req, res, 200, { text, remaining: after.remaining, limit: after.limit, premium });
}
