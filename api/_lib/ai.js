// Gemini proxy for Calobit's AI features — the API key lives server-side only
// (GEMINI_API_KEY env var), so nothing sensitive ships inside the APK.

import { storeConfigured, getAiCount, setAiCount } from './store.js';

const GOOGLE_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// Multiple keys are supported (GEMINI_API_KEYS = comma-separated). When one
// key is rate-limited (429) the request automatically moves to the next.
const API_KEYS = (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const AI_FREE_LIMIT = 15;
// Premium is unlimited in product terms; the cap exists purely to bound abuse.
export const AI_PREMIUM_LIMIT = 500;

// New API keys (created 2026) can't reach the old gemini-1.5/2.5 aliases —
// Google answers 404 for them. Candidates are tried in order and the first
// model the key can reach is remembered for the lifetime of the instance.
const MODEL_CANDIDATES = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'];
let workingModel = null;
let workingKeyIndex = 0;

export function aiConfigured() {
  return API_KEYS.length > 0;
}

function limitFor(premium) {
  return premium ? AI_PREMIUM_LIMIT : AI_FREE_LIMIT;
}

// ---- Monthly usage tracking. Supabase `ai_usage` when configured; otherwise
// an in-memory per-instance fallback (resets on cold start — best effort).
const memoryUsage = new Map(); // `${user_id}:${YYYY-MM}` -> count
const monthKey = () => new Date().toISOString().slice(0, 7);
const memKey = (userId) => `${userId}:${monthKey()}`;

export async function getUsage(userId, premium) {
  const limit = limitFor(premium);
  let used = memoryUsage.get(memKey(userId)) ?? 0;
  if (storeConfigured()) {
    try {
      used = await getAiCount(userId, monthKey());
    } catch {
      // Fall back to the memory figure — quota stays best-effort, never fatal.
    }
  }
  return { used, limit, remaining: Math.max(0, limit - used) };
}

export async function recordUsage(userId, premium) {
  memoryUsage.set(memKey(userId), (memoryUsage.get(memKey(userId)) ?? 0) + 1);
  if (storeConfigured()) {
    try {
      const count = (await getAiCount(userId, monthKey())) + 1;
      await setAiCount(userId, monthKey(), count);
    } catch {
      // Memory bucket already bumped — skip.
    }
  }
}

// ---- Google call ----

export async function generateContent(payload) {
  if (!aiConfigured()) {
    throw Object.assign(new Error('AI is not configured'), { status: 503 });
  }

  // Start from the last known-good key, then rotate through the rest: a 429
  // means that key's quota is spent, so the next key gets the request.
  const keyOrder = API_KEYS.map((_, i) => (workingKeyIndex + i) % API_KEYS.length);
  let sawOverload = false;
  let sawRateLimit = false;

  for (const keyIndex of keyOrder) {
    const models = workingModel
      ? [workingModel, ...MODEL_CANDIDATES.filter((m) => m !== workingModel)]
      : MODEL_CANDIDATES;

    for (const model of models) {
      const res = await fetch(`${GOOGLE_BASE}/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEYS[keyIndex] },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(60_000),
      });

      // 404 = key has no access to this model — try the next model.
      if (res.status === 404) continue;
      // 503 = model overloaded — the next model (or key) may still work.
      if (res.status === 503) {
        sawOverload = true;
        continue;
      }
      // 429 = this key's quota is spent — rotate to the next key.
      if (res.status === 429) {
        sawRateLimit = true;
        break;
      }
      if (!res.ok) {
        const text = await res.text();
        let msg = `Gemini API error (${res.status})`;
        try {
          msg = JSON.parse(text).error?.message || msg;
        } catch {}
        throw Object.assign(new Error(msg), { status: 502 });
      }

      workingModel = model;
      workingKeyIndex = keyIndex;
      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw Object.assign(new Error('No content returned from the AI.'), { status: 502 });
      }
      return rawText;
    }
  }

  throw Object.assign(
    new Error(
      sawRateLimit
        ? 'The AI is rate-limited right now — try again in a little while'
        : sawOverload
          ? 'The AI service is overloaded — try again in a little while'
          : 'The AI service is unavailable'
    ),
    { status: 429 }
  );
}
