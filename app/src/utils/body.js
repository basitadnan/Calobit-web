// Body metrics: weight history + the weekly adaptive report.
//
// The report's numbers are pure deterministic math (energy balance):
//   predicted change (kg) = (avg daily intake − TDEE) × days logged ÷ 7700
// ~7,700 kcal ≈ 1 kg of body weight. The AI only phrases these numbers —
// it never computes them.

import { getAllMeals, getWeights, getDateStr } from './storage';
import { sumMacros } from './calculations';

export const KCALS_PER_KG = 7700;
// A discrepancy smaller than this is water noise, not metabolism.
export const MIN_SIGNAL_KG = 0.4;
// The report needs at least this many days of history to suggest a change.
export const MIN_WINDOW_DAYS = 14;

function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return getDateStr(d);
}

/**
 * Aggregated stats for the last `days` days.
 */
export function computeStats(allMeals, days = 7) {
  let totalKcal = 0;
  let daysLogged = 0;
  const perDay = [];
  for (let i = days - 1; i >= 0; i--) {
    const ds = daysAgoStr(i);
    const meals = allMeals[ds] || [];
    const kcal = sumMacros(meals).calories;
    perDay.push({ date: ds, kcal, logged: meals.length > 0 });
    if (meals.length > 0) {
      totalKcal += kcal;
      daysLogged++;
    }
  }
  return {
    days,
    daysLogged,
    totalKcal,
    avgDaily: daysLogged ? Math.round(totalKcal / daysLogged) : 0,
    perDay,
  };
}

/**
 * Actual weight change between the first and last weigh-in inside the
 * window ending today. Returns null without at least two weigh-ins.
 */
export function actualWeightChange(weights, windowDays) {
  if (!weights || weights.length < 2) return null;
  const startStr = daysAgoStr(windowDays);
  const inWindow = weights.filter((w) => w.date >= startStr);
  if (inWindow.length < 2) {
    // Not enough recent weigh-ins — fall back to the full history's span
    // only when the history itself is short (early adopters).
    const spanDays =
      (new Date(weights[weights.length - 1].date) - new Date(weights[0].date)) / 86_400_000;
    if (spanDays < MIN_WINDOW_DAYS) return null;
    return { change: weights[weights.length - 1].weight - weights[0].weight, days: Math.round(spanDays), from: weights[0], to: weights[weights.length - 1] };
  }
  const from = inWindow[0];
  const to = inWindow[inWindow.length - 1];
  const spanDays = (new Date(to.date) - new Date(from.date)) / 86_400_000;
  if (spanDays < MIN_WINDOW_DAYS) return null;
  return { change: to.weight - from.weight, days: Math.round(spanDays), from, to };
}

/**
 * The full weekly report: deterministic numbers first, then (when the data
 * is strong enough) an adaptive calorie suggestion.
 */
export function computeWeeklyReport({ allMeals, goals, profile, weights }) {
  const week = computeStats(allMeals, 7);
  const tdee = goals?.tdee || 0;
  const predictedChange =
    tdee && week.daysLogged
      ? ((week.avgDaily - tdee) * week.daysLogged) / KCALS_PER_KG
      : null;

  const weightLog = Array.isArray(weights) ? weights : getWeights();
  const actual = actualWeightChange(weightLog, MIN_WINDOW_DAYS);

  const report = {
    week: { ...week, predictedChange, goalCalories: goals?.calories ?? 0 },
    actual,
    suggestion: null,
  };

  // Adaptive suggestion: needs >= 14 days of span, >= 2 weigh-ins, >= 5
  // logged days, and a discrepancy above water-noise threshold.
  if (
    predictedChange === null ||
    !actual ||
    week.daysLogged < 5 ||
    actual.days < MIN_WINDOW_DAYS
  ) {
    return report;
  }

  const discrepancy = actual.change - predictedChange; // kg vs expectation
  if (Math.abs(discrepancy) < MIN_SIGNAL_KG) {
    report.onTrack = true;
    return report;
  }

  // If the scale moved LESS than predicted, the real burn is higher than the
  // estimate → eat more; if it moved MORE → eat less. Sign works both ways
  // for cutting and bulking.
  const correction = (-discrepancy * KCALS_PER_KG) / actual.days;
  const clamped = Math.max(-300, Math.min(300, Math.round(correction / 25) * 25));
  if (clamped === 0) {
    report.onTrack = true;
    return report;
  }

  const current = goals?.calories ?? 0;
  const suggested = Math.max(1200, current + clamped);
  report.suggestion = {
    direction: clamped > 0 ? 'increase' : 'decrease',
    adjustment: Math.abs(suggested - current),
    suggested,
    current,
    discrepancy: Math.round(discrepancy * 100) / 100,
    days: actual.days,
  };
  return report;
}
/**
 * Human-readable fallback text (used when AI is unavailable or the user is
 * on the free tier). The premium AI version phrases the same numbers.
 */
export function reportToText(report) {
  const { week, actual, suggestion, onTrack } = report;
  const lines = [];
  lines.push(
    `You logged ${week.daysLogged} of ${week.days} days and averaged ${week.avgDaily} kcal/day (goal: ${week.goalCalories}).`
  );
  if (week.predictedChange !== null) {
    const pred = week.predictedChange.toFixed(2);
    lines.push(`Based on your activity level, that's about ${pred > 0 ? '+' : ''}${pred} kg this week.`);
  }
  if (actual) {
    const act = actual.change.toFixed(2);
    lines.push(`The scale shows ${act > 0 ? '+' : ''}${act} kg over ${actual.days} days.`);
  }
  if (suggestion) {
    lines.push(
      `Your body isn't matching the estimate — ${suggestion.direction === 'increase' ? 'raise' : 'lower'} your goal to ${suggestion.suggested} kcal/day to get back on track.`
    );
  } else if (onTrack) {
    lines.push('You are right on track — no changes needed.');
  }
  return lines.join(' ');
}
