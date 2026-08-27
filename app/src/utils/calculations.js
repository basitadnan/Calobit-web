// Mifflin-St Jeor BMR
export function calculateBMR(weight, height, age, sex) {
  // weight in kg, height in cm
  if (sex === 'male') return 10 * weight + 6.25 * height - 5 * age + 5;
  return 10 * weight + 6.25 * height - 5 * age - 161;
}

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
};

export function calculateTDEE(bmr, activityLevel) {
  return Math.round(bmr * (ACTIVITY_MULTIPLIERS[activityLevel] || 1.2));
}

export function calculateGoals(profile) {
  const { weight, height, age, sex, activity, goal, pace } = profile;
  const w = parseFloat(weight);
  const h = parseFloat(height);
  const a = parseInt(age);
  const bmr = calculateBMR(w, h, a, sex);
  const tdee = calculateTDEE(bmr, activity);

  let calorieGoal = tdee;
  const paceVal = parseFloat(pace) || 0.5;
  const dailyAdjust = Math.round((paceVal * 7700) / 7); // 7700 kcal per kg

  if (goal === 'lose') calorieGoal = tdee - dailyAdjust;
  else if (goal === 'gain') calorieGoal = tdee + dailyAdjust;

  calorieGoal = Math.max(calorieGoal, 1200);

  let proteinPerKg = 1.6;
  if (goal === 'gain') proteinPerKg = 2.0;
  else if (goal === 'lose') proteinPerKg = 1.8;

  const protein = Math.round(w * proteinPerKg);
  const proteinCals = protein * 4;
  const fatCals = Math.round(calorieGoal * 0.25);
  const fat = Math.round(fatCals / 9);
  const carbCals = calorieGoal - proteinCals - fatCals;
  const carbs = Math.round(carbCals / 4);

  return {
    calories: calorieGoal,
    protein,
    carbs: Math.max(carbs, 50),
    fat,
    bmr: Math.round(bmr),
    tdee,
  };
}

/**
 * Scale a per-100g food item to a portion size in grams.
 * Returns calories/protein/carbs/fat (+ optional fiber/sugar/sodium) for `grams`.
 */
export function scaleFoodNutrition(food, grams) {
  const factor = (grams || 0) / 100;
  return {
    calories: Math.round((food.caloriesPer100g || 0) * factor),
    protein: Math.round((food.proteinPer100g || 0) * factor * 10) / 10,
    carbs: Math.round((food.carbsPer100g || 0) * factor * 10) / 10,
    fat: Math.round((food.fatPer100g || 0) * factor * 10) / 10,
    fiber: Math.round((food.fiberPer100g || 0) * factor * 10) / 10,
    sugar: Math.round((food.sugarPer100g || 0) * factor * 10) / 10,
    sodium: Math.round((food.sodiumPer100g || 0) * factor * 10) / 10,
  };
}

export function sumMacros(meals) {
  return meals.reduce((acc, m) => ({
    calories: acc.calories + (m.calories || 0),
    protein: acc.protein + (m.protein_g || 0),
    carbs: acc.carbs + (m.carbs_g || 0),
    fat: acc.fat + (m.fat_g || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}

/** Extra nutrients (free tier): fiber, sugar, sodium — 0 when not logged. */
export function sumNutrients(meals) {
  return meals.reduce((acc, m) => ({
    fiber: acc.fiber + (m.fiber_g || 0),
    sugar: acc.sugar + (m.sugar_g || 0),
    sodium: acc.sodium + (m.sodium_mg || 0),
  }), { fiber: 0, sugar: 0, sodium: 0 });
}

export function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function getWeekDays(referenceDate = new Date()) {
  const d = new Date(referenceDate);
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  const days = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(start);
    dd.setDate(start.getDate() + i);
    days.push(dd);
  }
  return days;
}
