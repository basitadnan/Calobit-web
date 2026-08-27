// Adaptive calories (premium).
//
// Auto-tunes the calorie goal from the weight trend using the deterministic
// math already in body.js (energy balance + clamped ±300 suggestion over a
// 14-day window). Pure math — no AI calls, so it costs nothing to run.
import { computeWeeklyReport } from './body';

/**
 * Rescale a goals object for a new calorie target: protein stays, fat keeps
 * its 25% share, carbs take the remainder (mirrors calculateGoals' split).
 */
export function rescaleGoals(goals, newCalories) {
  const protein = goals.protein || 130;
  const proteinCals = protein * 4;
  const fatCals = Math.round(newCalories * 0.25);
  const fat = Math.round(fatCals / 9);
  const carbCals = newCalories - proteinCals - fatCals;
  const carbs = Math.max(Math.round(carbCals / 4), 50);
  return { ...goals, calories: newCalories, carbs, fat };
}

/**
 * When the weekly report has a strong signal (≥14 days, ≥2 weigh-ins,
 * ≥5 logged days, discrepancy above water-noise), return the rescaled goals
 * for the suggested target. Null otherwise.
 */
export function maybeAdaptiveGoal({ goals, profile, weights, allMeals }) {
  if (!goals || !profile) return null;
  const report = computeWeeklyReport({ allMeals, goals, profile, weights });
  if (!report.suggestion) return null;
  return rescaleGoals(goals, report.suggestion.suggested);
}

/** True when the user has opted in. */
export function isAdaptiveEnabled(settings) {
  return !!(settings && settings.adaptiveCalories);
}
