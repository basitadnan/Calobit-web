import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { scaleFoodNutrition } from '../utils/calculations';
import { X } from 'lucide-react';

const QUICK_PORTIONS = [50, 100, 150, 200, 250, 300];
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

/**
 * Shared drawer for logging a selected food at a chosen portion size and
 * meal time. Used by the Dashboard search card and the Add Food flow.
 */
export default function FoodLogDrawer({ food, onClose, onLogged, initialMealType = 'breakfast' }) {
  const { logMeal } = useApp();
  const [grams, setGrams] = useState(100);
  const [mealType, setMealType] = useState(initialMealType);

  const scaled = scaleFoodNutrition(food, grams);

  const handleLog = () => {
    if (!food) return;
    const name = `${grams}g ${food.name}`;
    logMeal({
      name,
      meal_name: name,
      calories: scaled.calories,
      protein_g: scaled.protein,
      carbs_g: scaled.carbs,
      fat_g: scaled.fat,
      type: mealType,
      items: [{
        name,
        calories: scaled.calories,
        protein_g: scaled.protein,
        carbs_g: scaled.carbs,
        fat_g: scaled.fat,
      }],
    });
    if (onLogged) onLogged();
    onClose();
  };

  if (!food) return null;

  return (
    <div className="fade-in" style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20
    }}>
      <div className="card slide-up" style={{
        width: '100%', maxWidth: 400, background: '#fff', borderRadius: 16,
        padding: 20, position: 'relative'
      }}>
        <button onClick={onClose} style={{ position: 'absolute', right: 16, top: 16, background: 'none', border: 'none', cursor: 'pointer' }}>
          <X size={20} color="#6B7280" />
        </button>

        <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Log Food</p>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#4B5563', marginBottom: 16 }}>{food.name}</p>

        <div className="form-group">
          <label style={{ fontSize: 12, fontWeight: 600 }}>Portion Size (grams)</label>
          <input
            className="input-field"
            type="number"
            value={grams}
            onChange={e => setGrams(Math.max(1, parseInt(e.target.value) || 0))}
          />
        </div>

        {/* Quick Portions */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {QUICK_PORTIONS.map(g => (
            <button
              key={g}
              onClick={() => setGrams(g)}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 8,
                border: '1px solid #E5E7EB',
                background: grams === g ? '#C6F135' : '#F9FAFB',
                fontSize: 12, fontWeight: 600, cursor: 'pointer'
              }}
            >
              {g}g
            </button>
          ))}
        </div>

        {/* Calculated Preview */}
        <div style={{ background: '#F9FAFB', borderRadius: 12, padding: 12, marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 }}>
            Calculated Nutrition ({grams}g)
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
            <div>🔥 <b>{scaled.calories}</b> kcal</div>
            <div>💪 <b>{scaled.protein}</b>g protein</div>
            <div>🌾 <b>{scaled.carbs}</b>g carbs</div>
            <div>🧈 <b>{scaled.fat}</b>g fat</div>
          </div>
        </div>

        <div className="pill-tabs" style={{ marginBottom: 16 }}>
          {MEAL_TYPES.map(t => (
            <button
              key={t}
              className={`pill-tab ${mealType === t ? 'active' : ''}`}
              onClick={() => setMealType(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        <button className="btn-primary" onClick={handleLog}>Log Meal ✓</button>
      </div>
    </div>
  );
}