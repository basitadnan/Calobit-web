import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as storage from '../utils/storage';
import { calculateGoals, sumMacros } from '../utils/calculations';
import { isPremiumActive, activatePremium } from '../utils/premium';
import CheckoutModal from '../components/CheckoutModal';

const AppContext = createContext();

export function AppProvider({ children }) {
  const [profile, setProfileState] = useState(null);
  const [onboarded, setOnboardedState] = useState(false);
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

  // Premium / checkout
  const [isPremium, setIsPremium] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

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
  }, []);

  const completeOnboarding = useCallback((profileData) => {
    const computed = calculateGoals(profileData);
    const finalProfile = { ...profileData, goals: computed };
    storage.saveProfile(finalProfile);
    storage.setOnboarded();
    setProfileState(finalProfile);
    setGoals(computed);
    setOnboardedState(true);
  }, []);

  const logMeal = useCallback((meal) => {
    const updated = storage.saveMeal(dateStr, meal);
    if (dateStr === todayStr) setTodayMeals(updated);
    else setTodayMeals(storage.getMeals(dateStr));
  }, [dateStr, todayStr]);

  const removeMeal = useCallback((mealId) => {
    const updated = storage.deleteMeal(dateStr, mealId);
    setTodayMeals(updated);
  }, [dateStr]);

  const refreshMeals = useCallback(() => {
    setTodayMeals(storage.getMeals(dateStr));
  }, [dateStr]);

  const updateGoals = useCallback((newGoals) => {
    setGoals(newGoals);
    const p = { ...profile, goals: newGoals };
    storage.saveProfile(p);
    setProfileState(p);
  }, [profile]);

  const updateSettings = useCallback((s) => {
    storage.saveSettings(s);
    setSettingsState(s);
  }, []);

  const completeGymOnboarding = useCallback((routineData) => {
    storage.saveGymRoutine(routineData);
    storage.setGymOnboarded(true);
    setRoutine(routineData);
    setGymOnboardedState(true);
  }, []);

  const saveRoutine = useCallback((newRoutine) => {
    storage.saveGymRoutine(newRoutine);
    setRoutine(newRoutine);
  }, []);

  const logWorkout = useCallback((log) => {
    const updated = storage.saveWorkoutLog(log);
    setWorkoutLogs(updated);
  }, []);

  const logWalk = useCallback((log) => {
    const updated = storage.saveWalkLog(log);
    setWalkLogs(updated);
  }, []);

  const login = useCallback((username, password) => {
    const user = storage.authenticateUser(username, password);
    if (user) {
      setCurrentUser(user.username);
      return true;
    }
    return false;
  }, []);

  const register = useCallback((name, username, password) => {
    const success = storage.registerUser(name, username, password);
    if (success) {
      storage.authenticateUser(username, password);
      setCurrentUser(username);
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    storage.logoutUser();
    setCurrentUser('');
    setCurrentTab('home');
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
      currentUser, login, register, logout,
      isPremium, openCheckout, closeCheckout, markPremiumActivated,
    }}>
      {children}
      {checkoutOpen && <CheckoutModal />}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
