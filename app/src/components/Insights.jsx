import { useState, useMemo } from 'react';
import { useApp } from '../contexts/AppContext';
import { getAllMeals, getWater, saveWater, getDateStr } from '../utils/storage';
import { sumMacros, getWeekDays } from '../utils/calculations';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip } from 'recharts';
import { Flame, Droplets, Plus, Minus, Trophy } from 'lucide-react';
import WeeklyReport from './WeeklyReport';
import WeightCard from './WeightCard';

export default function Insights() {
  const { goals } = useApp();
  const todayStr = getDateStr();
  const [waterCount, setWaterCount] = useState(() => getWater(todayStr));

  const allMeals = getAllMeals();
  const weekDays = getWeekDays();

  const weekData = useMemo(() => {
    return weekDays.map(d => {
      const ds = getDateStr(d);
      const meals = allMeals[ds] || [];
      const t = sumMacros(meals);
      return {
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        calories: t.calories,
        protein: t.protein >= goals.protein,
        carbs: t.carbs >= goals.carbs,
        fat: t.fat >= goals.fat,
        date: ds,
      };
    });
  }, [allMeals, weekDays, goals]);

  // Streak calculation
  const streak = useMemo(() => {
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const ds = getDateStr(d);
      const meals = allMeals[ds] || [];
      const t = sumMacros(meals);
      if (t.calories >= goals.calories * 0.8) count++;
      else break;
    }
    return count;
  }, [allMeals, goals]);

  // Top foods
  const topFoods = useMemo(() => {
    const counts = {};
    Object.values(allMeals).flat().forEach(m => {
      const name = m.name || m.meal_name || 'Unknown';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [allMeals]);

  const updateWater = (delta) => {
    const next = Math.max(0, Math.min(8, waterCount + delta));
    setWaterCount(next);
    saveWater(todayStr, next);
  };

  return (
    <div className="page fade-in">
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>Insights</h2>

      {/* Weekly adaptive report + weight tracker */}
      <WeeklyReport />
      <WeightCard />

      {/* Streak */}
      <div className="insight-card slide-up" style={{ textAlign: 'center' }}>
        <div className="streak-badge" style={{ margin: '0 auto 8px' }}>
          <Flame size={20} color="#EF4444" /> {streak} day streak!
        </div>
        <p style={{ fontSize: 13, color: '#6B7280' }}>Days in a row hitting your calorie goal</p>
      </div>

      {/* Weekly Chart */}
      <div className="insight-card slide-up" style={{ animationDelay: '0.1s' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Weekly Calories</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={weekData} barCategoryGap="20%">
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6B7280' }} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 13 }}
              formatter={(v) => [`${v} kcal`, 'Calories']}
            />
            <ReferenceLine y={goals.calories} stroke="#9CA3AF" strokeDasharray="4 4" />
            <Bar dataKey="calories" fill="#C6F135" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <div style={{ width: 16, height: 2, background: '#9CA3AF', borderTop: '2px dashed #9CA3AF' }} />
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>Daily goal: {goals.calories} kcal</span>
        </div>
      </div>

      {/* Macro Heatmap */}
      <div className="insight-card slide-up" style={{ animationDelay: '0.15s' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Macro Consistency</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto repeat(7, 1fr)', gap: 6, alignItems: 'center' }}>
          <div />
          {weekData.map(d => <span key={d.day} style={{ fontSize: 11, textAlign: 'center', color: '#6B7280', fontWeight: 600 }}>{d.day}</span>)}

          <span style={{ fontSize: 12, fontWeight: 600, color: '#14B8A6' }}>Pro</span>
          {weekData.map((d, i) => (
            <div key={`p${i}`} style={{ width: 28, height: 28, borderRadius: 6, background: d.protein ? '#14B8A6' : '#E5E7EB', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {d.protein && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
            </div>
          ))}

          <span style={{ fontSize: 12, fontWeight: 600, color: '#C6F135' }}>Carb</span>
          {weekData.map((d, i) => (
            <div key={`c${i}`} style={{ width: 28, height: 28, borderRadius: 6, background: d.carbs ? '#C6F135' : '#E5E7EB', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {d.carbs && <span style={{ color: '#1A1A1A', fontSize: 10 }}>✓</span>}
            </div>
          ))}

          <span style={{ fontSize: 12, fontWeight: 600, color: '#F59E0B' }}>Fat</span>
          {weekData.map((d, i) => (
            <div key={`f${i}`} style={{ width: 28, height: 28, borderRadius: 6, background: d.fat ? '#F59E0B' : '#E5E7EB', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {d.fat && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Top Foods */}
      <div className="insight-card slide-up" style={{ animationDelay: '0.2s' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
          <Trophy size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />Top Foods This Week
        </h3>
        {topFoods.length === 0 ? (
          <p style={{ color: '#9CA3AF', fontSize: 13 }}>No meals logged yet</p>
        ) : topFoods.map(([name, count], i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < topFoods.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{i + 1}. {name}</span>
            <span style={{ fontSize: 13, color: '#6B7280' }}>{count}x</span>
          </div>
        ))}
      </div>

      {/* Water Tracker */}
      <div className="insight-card slide-up" style={{ animationDelay: '0.25s' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
          <Droplets size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} color="#3B82F6" />Water Intake
        </h3>
        <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>{waterCount}/8 glasses today</p>

        <div className="water-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`water-glass ${i < waterCount ? 'filled' : ''}`} onClick={() => { setWaterCount(i + 1); saveWater(todayStr, i + 1); }}>
              💧
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 8 }}>
          <button className="btn-secondary" onClick={() => updateWater(-1)} style={{ width: 44, padding: 8 }}>
            <Minus size={18} />
          </button>
          <button className="btn-primary" onClick={() => updateWater(1)} style={{ width: 44, padding: 8 }}>
            <Plus size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
