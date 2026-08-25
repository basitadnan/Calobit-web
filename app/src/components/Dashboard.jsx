import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { getGreeting, sumMacros } from '../utils/calculations';
import { getWater, saveWater, getDateStr } from '../utils/storage';
import { Bell, Plus, Check, Trash2, Droplets } from 'lucide-react';

const MEAL_ICONS = { breakfast: '🥞', lunch: '🍛', dinner: '🍽️', snack: '🍎' };
const MEAL_COLORS = {
  breakfast: { bg: '#f0fdf4', accent: '#bbf7d0' },
  lunch: { bg: '#f0f9ff', accent: '#bae6fd' },
  dinner: { bg: '#fef7ed', accent: '#fed7aa' },
  snack: { bg: '#fdf4ff', accent: '#f5d0fe' },
};

export default function Dashboard() {
  const { profile, removeMeal, goals, totals, remaining, mealsByType, openAddFood } = useApp();

  const caloriePercent = Math.min((totals.calories / goals.calories) * 100, 100);
  const proteinPercent = Math.min((totals.protein / goals.protein) * 100, 100);
  const carbsPercent = Math.min((totals.carbs / goals.carbs) * 100, 100);
  const fatPercent = Math.min((totals.fat / goals.fat) * 100, 100);
  const allGoalsMet = totals.calories >= goals.calories && totals.protein >= goals.protein;

  const [waterCount, setWaterCount] = useState(() => getWater(getDateStr()));
  const setGlasses = (n) => {
    const next = Math.max(0, Math.min(8, n));
    setWaterCount(next);
    saveWater(getDateStr(), next);
  };


  const arcRadius = 42;
  const arcCircumference = 2 * Math.PI * arcRadius;
  const arcOffset = arcCircumference - (caloriePercent / 100) * arcCircumference;

  return (
    <div className="page fade-in">
      {/* Top Bar */}
      <div className="page-header">
        <div className="greeting">
          <div className="avatar">
            {profile?.name ? profile.name.charAt(0).toUpperCase() : '?'}
          </div>
          <div>
            <p style={{ fontSize: 14, color: '#6B7280' }}>{getGreeting()} 👋</p>
            <p style={{ fontSize: 18, fontWeight: 700 }}>{profile?.name || 'Friend'}</p>
          </div>
        </div>
        <button style={{ background: 'none', padding: 8 }}><Bell size={22} color="#6B7280" /></button>
      </div>

      {/* Hero Calorie Card */}
      <div className="calorie-hero slide-up">
        <p style={{ fontSize: 13, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>Today's Calories</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: 42, fontWeight: 800, lineHeight: 1 }}>
              {totals.calories}
              <span style={{ fontSize: 18, fontWeight: 500, color: '#6B7280' }}> kcal</span>
            </p>
          </div>
          <div style={{ position: 'relative', width: 100, height: 100 }}>
            <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r={arcRadius} fill="none" stroke="#E5E7EB" strokeWidth="8" />
              <circle cx="50" cy="50" r={arcRadius} fill="none" stroke="#C6F135" strokeWidth="8"
                strokeDasharray={arcCircumference} strokeDashoffset={arcOffset}
                strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#1A1A1A' }}>{remaining.calories}</span>
              <span style={{ fontSize: 10, color: '#6B7280' }}>Left</span>
            </div>
          </div>
        </div>

        {/* Macro bars */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          {[
            { label: 'Carbs', icon: '🍞', val: totals.carbs, max: goals.carbs, color: '#C6F135', pct: carbsPercent },
            { label: 'Protein', icon: '🥛', val: totals.protein, max: goals.protein, color: '#14B8A6', pct: proteinPercent },
            { label: 'Fat', icon: '🧈', val: totals.fat, max: goals.fat, color: '#F59E0B', pct: fatPercent },
          ].map(m => (
            <div key={m.label} style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 14 }}>{m.icon}</span>
                <span style={{ fontSize: 12, color: '#6B7280' }}>{m.label}</span>
              </div>
              <p style={{ fontSize: 14, fontWeight: 700 }}>
                {Math.round(m.val)} <span style={{ fontWeight: 400, color: '#9CA3AF' }}>/{m.max}g</span>
              </p>
              <div className="progress-bar" style={{ marginTop: 4 }}>
                <div className="fill" style={{ width: `${m.pct}%`, background: m.val > m.max ? '#EF4444' : m.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Celebration Card */}
      {allGoalsMet && (
        <div className="celebration-card slide-up" style={{ marginBottom: 20 }}>
          <div className="emoji">🎉</div>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>You've crushed your goals today!</h3>
          <p style={{ color: '#6B7280', fontSize: 14 }}>Amazing work — keep it up tomorrow!</p>
        </div>
      )}

      {/* Water */}
      <div className="insight-card slide-up" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
            <Droplets size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} color="#3B82F6" />Water
          </h3>
          <span style={{ fontSize: 13, color: '#6B7280' }}>{waterCount}/8 glasses</span>
        </div>
        <div className="water-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`water-glass ${i < waterCount ? 'filled' : ''}`} onClick={() => setGlasses(i + 1)}>
              💧
            </div>
          ))}
        </div>
      </div>

      {/* Meal Suggest Section */}
      <div className="section-header"><h3>Today's Meals</h3></div>
      {['breakfast', 'lunch', 'dinner', 'snack'].map(type => {
        const meals = mealsByType[type];
        const typeTotal = sumMacros(meals);
        const mealGoal = Math.round(goals.calories / (type === 'snack' ? 6 : 3));
        const left = Math.max(0, mealGoal - typeTotal.calories);
        const pct = Math.min((typeTotal.calories / mealGoal) * 100, 100);

        return (
          <div key={type} className="meal-card" style={{ background: MEAL_COLORS[type].bg, animationDelay: `${0.1}s` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>{MEAL_ICONS[type]}</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15 }}>{type.charAt(0).toUpperCase() + type.slice(1)}</p>
                  <p style={{ fontSize: 12, color: '#6B7280' }}>🔥 {typeTotal.calories} kcal</p>
                </div>
              </div>
              <button className="food-action add" onClick={() => openAddFood({ mealType: type })}>
                <Plus size={16} />
              </button>
            </div>

            {meals.map(m => (
              <div className="food-item" key={m.id}>
                <div className="food-info">
                  <div className="food-icon">{MEAL_ICONS[type]}</div>
                  <div>
                    <p className="food-name">{m.name || m.meal_name}</p>
                    <p className="food-cal">🔥 {m.calories} kcal | 💪 {m.protein_g || 0}g P | 🌾 {m.carbs_g || 0}g C | 🧈 {m.fat_g || 0}g F</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => removeMeal(m.id)} style={{ background: 'none', color: '#EF4444', padding: 4, cursor: 'pointer' }}>
                    <Trash2 size={16} />
                  </button>
                  <div className="food-action done"><Check size={14} color="#fff" /></div>
                </div>
              </div>
            ))}

            {meals.length === 0 && (
              <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: '8px 0' }}>No {type} logged</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <div className="progress-bar" style={{ flex: 1, marginRight: 12 }}>
                <div className="fill" style={{ width: `${pct}%`, background: '#C6F135' }} />
              </div>
              <span style={{ fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>{left} left</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}