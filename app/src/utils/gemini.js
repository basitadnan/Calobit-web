// AI features call Calobit's own backend proxy (/api/ai/gemini), which holds
// the Gemini key server-side and enforces the monthly budget: free accounts
// get AI_FREE_LIMIT calls per calendar month, premium is unlimited.
// Premium state and the API base come from premium.js (local-first design).
import { Capacitor } from '@capacitor/core';
import { isPremiumActive, checkoutApiBase } from './premium';

const AI_USAGE_KEY = 'ai_usage';
export const AI_FREE_LIMIT = 15;

export const AI_LIMIT_MSG = `You've used all ${AI_FREE_LIMIT} free AI calls this month. Upgrade to Premium for unlimited AI.`;

function currentUser() {
  return localStorage.getItem('calobit_current_user') || '';
}

function scopedKey(key) {
  const username = currentUser();
  return username ? `calobit_${username}_${key}` : `calobit_${key}`;
}

const currentMonth = () => new Date().toISOString().slice(0, 7);

function usageBucket() {
  try {
    return JSON.parse(localStorage.getItem(scopedKey(AI_USAGE_KEY))) || {};
  } catch {
    return {};
  }
}

/** { used, limit, remaining, premium } for the current calendar month. */
export function getAiUsage() {
  const premium = isPremiumActive();
  const bucket = usageBucket();
  const used = bucket.month === currentMonth() ? bucket.count || 0 : 0;
  return { used, limit: AI_FREE_LIMIT, remaining: Math.max(0, AI_FREE_LIMIT - used), premium };
}

function recordLocalUse() {
  const month = currentMonth();
  const bucket = usageBucket();
  const count = (bucket.month === month ? bucket.count || 0 : 0) + 1;
  localStorage.setItem(scopedKey(AI_USAGE_KEY), JSON.stringify({ month, count }));
}

/**
 * Send a fully-built Gemini payload through the backend proxy.
 * Throws AI_LIMIT_MSG when a free account is out of calls.
 */
async function callGeminiAPI(payload) {
  const premium = isPremiumActive();
  if (!premium && getAiUsage().remaining <= 0) {
    throw new Error(AI_LIMIT_MSG);
  }

  const res = await fetch(`${checkoutApiBase()}/api/ai/gemini`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: currentUser(), premium, payload }),
  });

  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }

  recordLocalUse();
  return data; // { text, remaining, limit, premium }
}

/**
 * Weekly coach text for the Insights report (premium). The numbers are
 * computed in code (utils/body.js) — the AI only phrases the coaching, so a
 * hallucinated number can never corrupt the math. One call per week, cached
 * by the caller.
 */
export async function getWeeklyCoachText(statsSummary) {
  if (!isPremiumActive()) {
    throw new Error('Weekly AI coach is a premium feature');
  }

  const systemInstruction = `You are a friendly, honest fitness coach for a calorie tracking app.
Write 2-3 short sentences of coaching based ONLY on the stats provided.
Do not invent numbers — reuse the exact figures given. No medical claims.
Return a JSON object: { "text": "string" }`;

  const prompt = `Weekly stats: ${JSON.stringify(statsSummary)}`;
  const { text } = await callGeminiAPI({
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemInstruction}\n\nUser Prompt: ${prompt}` }],
      },
    ],
    generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
  });

  const parsed = JSON.parse(text);
  return parsed.text || '';
}

/**
 * AI Meal Logger: Parses meal text into estimated macros and items
 */
export async function parseMealAI(mealDescription) {
  const systemInstruction = `You are an AI nutrition log assistant. Analyze the user's natural language meal description and compute total macros and individual items.
Return a JSON object strictly matching this format:
{
  "meal_name": "Short summary of meal",
  "type": "breakfast|lunch|dinner|snack",
  "totalCalories": number (integer),
  "totalProtein": number (float/int),
  "totalCarbs": number (float/int),
  "totalFat": number (float/int),
  "items": [
    {
      "name": "Item description with portion",
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number
    }
  ]
}`;

  const prompt = `Analyze this meal: "${mealDescription}"`;
  const { text } = await callGeminiAPI({
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemInstruction}\n\nUser Prompt: ${prompt}` }],
      },
    ],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
  });
  return JSON.parse(text);
}

/**
 * AI Nutrition-Panel Reader: parses a photo of a nutrition facts table
 * into per-100g macros (the same shape as a local food item, so the
 * existing scaleFoodNutrition / logMeal flow applies unchanged).
 *
 * When the label shows per-serving values, the AI converts them to per 100g.
 */
export async function parseNutritionPanel(base64Image, mimeType = 'image/jpeg') {
  const systemInstruction = `You are a nutrition label OCR expert. The user photographed a packaged food's nutrition facts panel.
Carefully read the label. Convert anything given per serving to per 100g using the serving size shown on the label.
Return a JSON object exactly matching this format:
{
  "name": "Product name as printed on the label",
  "caloriesPer100g": number (integer),
  "proteinPer100g": number (float/int, grams per 100g),
  "carbsPer100g": number (float/int, grams per 100g),
  "fatPer100g": number (float/int, grams per 100g)
}
If a value is not visible, use 0. Only return the JSON object.`;

  const prompt = `Nutrition facts panel photo. Extract calories, protein, carbs and fat per 100g:\n\n${systemInstruction}`;

  const { text } = await callGeminiAPI({
    contents: [
      {
        role: 'user',
        parts: [
          { inline_data: { mime_type: mimeType, data: base64Image } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  });

  const parsed = JSON.parse(text);
  const round1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
  return {
    name: parsed.name || 'Scanned food',
    caloriesPer100g: Math.round(Number(parsed.caloriesPer100g) || 0),
    proteinPer100g: round1(parsed.proteinPer100g),
    carbsPer100g: round1(parsed.carbsPer100g),
    fatPer100g: round1(parsed.fatPer100g),
  };
}
