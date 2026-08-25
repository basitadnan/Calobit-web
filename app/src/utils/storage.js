const KEYS = {
  USERS: 'calobit_users',
  CURRENT_USER: 'calobit_current_user',

  // Scoped keys
  PROFILE: 'profile',
  ONBOARDED: 'onboarded',
  MEALS: 'meals',
  WATER: 'water',
  TEMPLATES: 'templates',
  SETTINGS: 'settings',
  GYM_ROUTINE: 'gym_routine',
  WORKOUT_LOGS: 'workout_logs',
  GYM_ONBOARDED: 'gym_onboarded',
  WALK_LOGS: 'walk_logs',
  WEIGHTS: 'weights',
  AI_REPORT: 'ai_report',
};

export function getActiveUser() {
  return localStorage.getItem(KEYS.CURRENT_USER) || '';
}

function getScopedKey(key) {
  if (key === KEYS.USERS || key === KEYS.CURRENT_USER) {
    return key;
  }
  const username = getActiveUser();
  return username ? `calobit_${username}_${key}` : `calobit_${key}`;
}

export function migrateLegacyData(username) {
  const keysToMigrate = ['profile', 'onboarded', 'meals', 'water', 'templates', 'settings', 'gym_routine', 'workout_logs', 'gym_onboarded', 'walk_logs'];
  keysToMigrate.forEach(key => {
    const legacyVal = localStorage.getItem(`calobit_${key}`);
    if (legacyVal !== null) {
      localStorage.setItem(`calobit_${username}_${key}`, legacyVal);
      localStorage.removeItem(`calobit_${key}`);
    }
  });
}

// Multi-profile Helpers
export function getUsers() {
  try { return JSON.parse(localStorage.getItem(KEYS.USERS)) || []; } catch { return []; }
}

export function registerUser(name, username, password) {
  const users = getUsers();
  const exists = users.find(u => u.username.toLowerCase() === username.toLowerCase().trim());
  if (exists) return false;
  
  users.push({ name, username: username.trim(), password });
  localStorage.setItem(KEYS.USERS, JSON.stringify(users));
  
  // If this is the first profile, migrate any existing guest data to it so they don't lose it!
  if (users.length === 1) {
    migrateLegacyData(username.trim());
  }
  return true;
}

export function authenticateUser(username, password) {
  const users = getUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase().trim() && u.password === password);
  if (user) {
    localStorage.setItem(KEYS.CURRENT_USER, user.username);
    return user;
  }
  return null;
}

export function logoutUser() {
  localStorage.removeItem(KEYS.CURRENT_USER);
}

// Scoped Storage wrappers
export function getProfile() {
  try { return JSON.parse(localStorage.getItem(getScopedKey(KEYS.PROFILE))) || null; } catch { return null; }
}
export function saveProfile(data) {
  localStorage.setItem(getScopedKey(KEYS.PROFILE), JSON.stringify(data));
}

export function isOnboarded() {
  return localStorage.getItem(getScopedKey(KEYS.ONBOARDED)) === 'true';
}
export function setOnboarded() {
  localStorage.setItem(getScopedKey(KEYS.ONBOARDED), 'true');
}

export function getMeals(dateStr) {
  try {
    const all = JSON.parse(localStorage.getItem(getScopedKey(KEYS.MEALS))) || {};
    return all[dateStr] || [];
  } catch { return []; }
}
export function saveMeal(dateStr, meal) {
  const all = JSON.parse(localStorage.getItem(getScopedKey(KEYS.MEALS))) || {};
  if (!all[dateStr]) all[dateStr] = [];
  all[dateStr].push({ ...meal, id: Date.now().toString(), timestamp: new Date().toISOString() });
  localStorage.setItem(getScopedKey(KEYS.MEALS), JSON.stringify(all));
  return all[dateStr];
}
export function getAllMeals() {
  try { return JSON.parse(localStorage.getItem(getScopedKey(KEYS.MEALS))) || {}; } catch { return {}; }
}
export function deleteMeal(dateStr, mealId) {
  const all = JSON.parse(localStorage.getItem(getScopedKey(KEYS.MEALS))) || {};
  if (all[dateStr]) {
    all[dateStr] = all[dateStr].filter(m => m.id !== mealId);
    localStorage.setItem(getScopedKey(KEYS.MEALS), JSON.stringify(all));
  }
  return all[dateStr] || [];
}

export function getWater(dateStr) {
  try {
    const all = JSON.parse(localStorage.getItem(getScopedKey(KEYS.WATER))) || {};
    return all[dateStr] || 0;
  } catch { return 0; }
}
export function saveWater(dateStr, count) {
  const all = JSON.parse(localStorage.getItem(getScopedKey(KEYS.WATER))) || {};
  all[dateStr] = count;
  localStorage.setItem(getScopedKey(KEYS.WATER), JSON.stringify(all));
}

export function getTemplates() {
  try { return JSON.parse(localStorage.getItem(getScopedKey(KEYS.TEMPLATES))) || []; } catch { return []; }
}
export function saveTemplate(template) {
  const t = getTemplates();
  t.push({ ...template, id: Date.now().toString() });
  localStorage.setItem(getScopedKey(KEYS.TEMPLATES), JSON.stringify(t));
}
export function deleteTemplate(id) {
  const t = getTemplates().filter(x => x.id !== id);
  localStorage.setItem(getScopedKey(KEYS.TEMPLATES), JSON.stringify(t));
}

export function getSettings() {
  try {
    return JSON.parse(localStorage.getItem(getScopedKey(KEYS.SETTINGS))) || { units: 'metric', aiNudges: true };
  } catch { return { units: 'metric', aiNudges: true }; }
}
export function saveSettings(s) {
  localStorage.setItem(getScopedKey(KEYS.SETTINGS), JSON.stringify(s));
}

export function getGymRoutine() {
  try { return JSON.parse(localStorage.getItem(getScopedKey(KEYS.GYM_ROUTINE))) || {}; } catch { return {}; }
}
export function saveGymRoutine(r) {
  localStorage.setItem(getScopedKey(KEYS.GYM_ROUTINE), JSON.stringify(r));
}

export function getWorkoutLogs() {
  try { return JSON.parse(localStorage.getItem(getScopedKey(KEYS.WORKOUT_LOGS))) || []; } catch { return []; }
}
export function saveWorkoutLog(log) {
  const logs = getWorkoutLogs();
  logs.push({ ...log, id: Date.now().toString(), timestamp: new Date().toISOString() });
  localStorage.setItem(getScopedKey(KEYS.WORKOUT_LOGS), JSON.stringify(logs));
  return logs;
}

export function getWalkLogs() {
  try { return JSON.parse(localStorage.getItem(getScopedKey(KEYS.WALK_LOGS))) || []; } catch { return []; }
}
export function saveWalkLog(log) {
  const logs = getWalkLogs();
  logs.push({ ...log, id: Date.now().toString(), timestamp: new Date().toISOString() });
  localStorage.setItem(getScopedKey(KEYS.WALK_LOGS), JSON.stringify(logs));
  return logs;
}

export function isGymOnboarded() {
  return localStorage.getItem(getScopedKey(KEYS.GYM_ONBOARDED)) === 'true';
}
export function setGymOnboarded(v = true) {
  localStorage.setItem(getScopedKey(KEYS.GYM_ONBOARDED), v.toString());
}

// ---- Weight log: one entry per day, upsert by date. [{date, weight}] ----
export function getWeights() {
  try {
    const all = JSON.parse(localStorage.getItem(getScopedKey(KEYS.WEIGHTS))) || {};
    return Object.entries(all)
      .map(([date, weight]) => ({ date, weight: Number(weight) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch { return []; }
}
export function saveWeight(dateStr, weight) {
  const all = JSON.parse(localStorage.getItem(getScopedKey(KEYS.WEIGHTS))) || {};
  all[dateStr] = Number(weight);
  localStorage.setItem(getScopedKey(KEYS.WEIGHTS), JSON.stringify(all));
  return getWeights();
}
export function getLatestWeight() {
  const weights = getWeights();
  return weights.length ? weights[weights.length - 1] : null;
}

// ---- Cached AI weekly report (premium): { weekStart, text, generatedAt } ----
export function getAiReport() {
  try { return JSON.parse(localStorage.getItem(getScopedKey(KEYS.AI_REPORT))) || null; } catch { return null; }
}
export function saveAiReport(report) {
  localStorage.setItem(getScopedKey(KEYS.AI_REPORT), JSON.stringify({ ...report, generatedAt: new Date().toISOString() }));
}

export function resetAll() {
  // Scoped reset
  const username = getActiveUser();
  if (username) {
    const scopedPrefix = `calobit_${username}_`;
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(scopedPrefix)) {
        localStorage.removeItem(k);
      }
    });
  }
}

export function getDateStr(date = new Date()) {
  return date.toISOString().split('T')[0];
}
