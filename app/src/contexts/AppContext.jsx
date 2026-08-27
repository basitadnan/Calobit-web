import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as storage from '../utils/storage';
import { calculateGoals, sumMacros } from '../utils/calculations';
import { isPremiumActive, activatePremium } from '../utils/premium';
import { supabase, registerDeepLinkHandler, signOut as authSignOut } from '../utils/authSession';
import { findLegacyProfiles, hasMigrated, migrateLegacyProfile } from '../utils/migration';
import { buildSnapshot, refreshBackup, getBindStatus } from '../utils/cloudAccount';
import { getBindInfo, saveBindInfo } from '../components/BindAccountModal';
import CheckoutModal from '../components/CheckoutModal';
import LegacyProfilePicker from '../components/LegacyProfilePicker';
import BindAccountModal from '../components/BindAccountModal';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [profile, setProfileState] = useState(null);
  const [onboarded, setOnboardedState] = useState(() => {
    // Synchronous from storage so boot never flashes the wrong screen.
    try { return storage.isOnboarded(); } catch { return false; }
  });
  const [restoring, setRestoring] = useState(true); // session restore in progress
  const [todayMeals, setTodayMeals] = useState([]);
  const [goals, setGoals] = useState({ calories: 2000, protein: 130, carbs: 250, fat: 65 });
  const [settings, setSettingsState] = useState({ units: 'metric', aiNudges: true });
  const [currentTab, setCurrentTab] = useState('home');
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Gym IQ State
  const [gymOnboarded, setGymOnboardedState] = useState(false);
  const [routine, setRoutine] = useState({});
  const [workoutLogs, setWorkoutLogs] = useState([]);
  const [walkLogs, setWalkLogs] = useState([]);
  const [currentUser, setCurrentUser] = useState(storage.getActiveUser());
  const [sessionUser, setSessionUser] = useState(null); // real Supabase auth state

  // Premium / checkout
  const [isPremium, setIsPremium] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Legacy local-profile binding (v1.8 Google sign-in migration)
  const [legacyProfiles, setLegacyProfiles] = useState(null); // null = no picker

  // Cloud backup: bind prompt + manual backup modal
  const [bindOpen, setBindOpen] = useState(false);
  const [bindInfo, setBindInfo] = useState(null);
  const openBind = useCallback(() => setBindOpen(true), []);
  const closeBind = useCallback(() => setBindOpen(false), []);

  const dateStr = storage.getDateStr(selectedDate);
  const todayStr = storage.getDateStr();

  // Add Food flow (center "+" button): mode is null (chooser), 'db', or 'ai'
  const [addFlow, setAddFlow] = useState({ open: false, mode: null, mealType: 'breakfast' });
  const openAddFood = useCallback(({ mode = null, mealType = 'breakfast' } = {}) => {
    setAddFlow({ open: true, mode, mealType });
  }, []);
  const closeAddFood = useCallback(() => {
    setAddFlow({ open: false, mode: null, mealType: 'breakfast' });
  }, []);


  useEffect(() => {
    if (typeof window !== 'undefined' && window.indexedDB) {
      try { window.indexedDB.deleteDatabase('CalorieTrackerDB'); } catch (e) {}
    }
  }, []);

  // Pull all user data back into state after a migration or login.
  const hydrateFromStorage = useCallback(() => {
    const p = storage.getProfile();
    setProfileState(p);
    if (p?.goals) setGoals(p.goals);
    setOnboardedState(storage.isOnboarded());
    setSettingsState(storage.getSettings());
    setGymOnboardedState(storage.isGymOnboarded());
    setRoutine(storage.getGymRoutine());
    setWorkoutLogs(storage.getWorkoutLogs());
    setWalkLogs(storage.getWalkLogs());
    setIsPremium(isPremiumActive());
  }, []);

  // Supabase session lifecycle. currentUser = Supabase user id.
  useEffect(() => {
    const handleSession = (session) => {
      const userId = session?.user?.id || '';
      if (!userId) return;
      storage.setActiveUser(userId);
      setCurrentUser(userId);
      setSessionUser(session.user);
      // First sign-in with Google: attach any local data to the account.
      if (!hasMigrated(userId)) {
        const legacy = findLegacyProfiles();
        if (legacy.length === 1 && legacy[0].username === '') {
          // Only unscoped data (e.g. a fresh onboarding completed before
          // sign-in) → attach silently; a picker would confuse new users.
          migrateLegacyProfile('', userId);
          hydrateFromStorage();
        } else if (legacy.length > 0) {
          // Registered legacy profiles (or mixed) → let them choose.
          setLegacyProfiles(legacy);
        }
      }
    };

    registerDeepLinkHandler((session) => handleSession(session));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') handleSession(session);
      if (event === 'SIGNED_OUT') {
        storage.logoutUser();
        setCurrentUser('');
        setSessionUser(null);
        setCurrentTab('home');
      }
    });

    // Restore a persisted session on boot (survives app restarts).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) handleSession(data.session);
      else {
        // No live session: drop any stale active-user scope so the Auth
        // screen shows instead of treating a leftover calobit_current_user
        // (old username system) as a signed-in Google account.
        setSessionUser(null);
        setCurrentUser('');
      }
      setRestoring(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const bindLegacyProfile = useCallback((username) => {
    const userId = storage.getActiveUser();
    if (userId && legacyProfiles) {
      migrateLegacyProfile(username, userId);
      setLegacyProfiles(null);
      hydrateFromStorage(); // re-hydrate the just-migrated data
    }
  }, [legacyProfiles, hydrateFromStorage]);

  const skipLegacyBinding = useCallback(() => {
    const userId = storage.getActiveUser();
    if (userId) {
      // "Start fresh" — record the decision without migrating anything.
      localStorage.setItem(`calobit_migrated_${userId}`, '');
    }
    setLegacyProfiles(null);
  }, []);

  // ---- Auto cloud backup: bound users stay backed up without pressing anything. ----
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const backupTimer = useRef(null);

  const scheduleAutoBackup = useCallback(() => {
    const userId = currentUserRef.current;
    if (!userId) return;
    const info = getBindInfo();
    if (!info.boundAt) return;             // not bound → nothing to push
    if (!navigator.onLine) return;
    if (backupTimer.current) clearTimeout(backupTimer.current);
    backupTimer.current = setTimeout(async () => {
      backupTimer.current = null;
      try {
        const snapshot = buildSnapshot(userId);
        const res = await refreshBackup(snapshot);
        const next = { ...getBindInfo(), lastBackupAt: res.backupAt };
        saveBindInfo(next);
        setBindInfo(next);
      } catch {
        // Silent — next launch or change will retry.
      }
    }, 8000);
  }, []);

  // Gentle bind prompt + auto-backup (only for signed-in, onboarded users).
  useEffect(() => {
    if (!currentUser) return;
    const info = getBindInfo();

    // Auto-backup: bound & online → silent refresh every launch (keeps the
    // cloud copy current even if nothing changed since last time).
    if (info.boundAt && navigator.onLine) {
      const snapshot = buildSnapshot(currentUser);
      refreshBackup(snapshot)
        .then((res) => {
          const next = { ...getBindInfo(), lastBackupAt: res.backupAt };
          saveBindInfo(next);
          setBindInfo(next);
        })
        .catch(() => {});
    }

    // Prompt: ~4s after mount, every session, unless neverAsk / already bound.
    if (info.neverAsk || info.boundAt) return;
    if (!navigator.onLine) return;

    const t = setTimeout(() => {
      setBindInfo(info);
      setBindOpen(true);
    }, 4000);
    return () => clearTimeout(t);
  }, [currentUser]);

  useEffect(() => {
    const p = storage.getProfile();
    const o = storage.isOnboarded();
    const s = storage.getSettings();
    if (p) {
      setProfileState(p);
      if (p.goals) setGoals(p.goals);
    } else {
      setProfileState(null);
      setGoals({ calories: 2000, protein: 130, carbs: 250, fat: 65 });
    }
    setOnboardedState(o);
    setSettingsState(s);
    setGymOnboardedState(storage.isGymOnboarded());
    setRoutine(storage.getGymRoutine());
    setWorkoutLogs(storage.getWorkoutLogs());
    setWalkLogs(storage.getWalkLogs());
    setIsPremium(isPremiumActive());
  }, [currentUser]);

  useEffect(() => {
    const meals = storage.getMeals(dateStr);
    setTodayMeals(meals);
  }, [dateStr, currentUser]);

  const setProfile = useCallback((data) => {
    storage.saveProfile(data);
    setProfileState(data);
    if (data.goals) setGoals(data.goals);
    scheduleAutoBackup();
  }, []);

  const completeOnboarding = useCallback((profileData) => {
    const computed = calculateGoals(profileData);
    const finalProfile = { ...profileData, goals: computed };
    storage.saveProfile(finalProfile);
    storage.setOnboarded();
    setProfileState(finalProfile);
    setGoals(computed);
    setOnboardedState(true);
    scheduleAutoBackup();
  }, []);

  const logMeal = useCallback((meal) => {
    const updated = storage.saveMeal(dateStr, meal);
    if (dateStr === todayStr) setTodayMeals(updated);
    else setTodayMeals(storage.getMeals(dateStr));
    scheduleAutoBackup();
  }, [dateStr, todayStr]);

  const removeMeal = useCallback((mealId) => {
    const updated = storage.deleteMeal(dateStr, mealId);
    setTodayMeals(updated);
    scheduleAutoBackup();
  }, [dateStr]);

  const refreshMeals = useCallback(() => {
    setTodayMeals(storage.getMeals(dateStr));
  }, [dateStr]);

  const updateGoals = useCallback((newGoals) => {
    setGoals(newGoals);
    const p = { ...profile, goals: newGoals };
    storage.saveProfile(p);
    setProfileState(p);
    scheduleAutoBackup();
  }, [profile]);

  const updateSettings = useCallback((s) => {
    storage.saveSettings(s);
    setSettingsState(s);
    scheduleAutoBackup();
  }, []);

  const completeGymOnboarding = useCallback((routineData) => {
    storage.saveGymRoutine(routineData);
    storage.setGymOnboarded(true);
    setRoutine(routineData);
    setGymOnboardedState(true);
    scheduleAutoBackup();
  }, []);

  const saveRoutine = useCallback((newRoutine) => {
    storage.saveGymRoutine(newRoutine);
    setRoutine(newRoutine);
    scheduleAutoBackup();
  }, []);

  const logWorkout = useCallback((log) => {
    const updated = storage.saveWorkoutLog(log);
    setWorkoutLogs(updated);
    scheduleAutoBackup();
  }, []);

  const logWalk = useCallback((log) => {
    const updated = storage.saveWalkLog(log);
    setWalkLogs(updated);
    scheduleAutoBackup();
  }, []);

  const login = useCallback(async () => {
    // Google sign-in is handled by Auth.jsx via authSession.signInWithGoogle();
    // the session callback above sets currentUser. Kept for API compatibility.
  }, []);

  const register = useCallback(async () => {
    // Replaced by Google sign-in (v1.8).
  }, []);

  const logout = useCallback(async () => {
    await authSignOut();
    storage.logoutUser();
    setCurrentUser('');
    setCurrentTab('home');
    setLegacyProfiles(null);
  }, []);

  const openCheckout = useCallback(() => setCheckoutOpen(true), []);
  const closeCheckout = useCallback(() => setCheckoutOpen(false), []);
  const markPremiumActivated = useCallback((orderId, plan) => {
    activatePremium(orderId, plan);
    setIsPremium(true);
  }, []);

  const totals = sumMacros(todayMeals);
  const remaining = {
    calories: Math.max(0, goals.calories - totals.calories),
    protein: Math.max(0, goals.protein - totals.protein),
    carbs: Math.max(0, goals.carbs - totals.carbs),
    fat: Math.max(0, goals.fat - totals.fat),
  };

  const mealsByType = {
    breakfast: todayMeals.filter(m => m.type === 'breakfast'),
    lunch: todayMeals.filter(m => m.type === 'lunch'),
    dinner: todayMeals.filter(m => m.type === 'dinner'),
    snack: todayMeals.filter(m => m.type === 'snack'),
  };

  return (
    <AppContext.Provider value={{
      profile, setProfile, onboarded, completeOnboarding,
      todayMeals, logMeal, removeMeal, refreshMeals, mealsByType,
      goals, updateGoals, totals, remaining,
      settings, updateSettings,
      currentTab, setCurrentTab,
      addFlow, openAddFood, closeAddFood,
      selectedDate, setSelectedDate, dateStr,
      gymOnboarded, completeGymOnboarding, routine, saveRoutine, workoutLogs, logWorkout,
      walkLogs, logWalk,
      currentUser, sessionUser, restoring, login, register, logout,
      bindLegacyProfile, skipLegacyBinding,
      isPremium, openCheckout, closeCheckout, markPremiumActivated,
      bindOpen, openBind, closeBind, bindInfo,
    }}>
      {children}
      {checkoutOpen && <CheckoutModal />}
      {bindOpen && <BindAccountModal mode="prompt" onClose={closeBind} />}
      {legacyProfiles && (
        <LegacyProfilePicker
          profiles={legacyProfiles}
          onSelect={bindLegacyProfile}
          onSkip={skipLegacyBinding}
        />
      )}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
