import { useState, useRef, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { getWeekDays, sumMacros } from '../utils/calculations';
import { getDateStr, getMeals } from '../utils/storage';
import { ChevronLeft, Check, Circle } from 'lucide-react';

const TIMELINE_SLOTS = [
  { time: '6:30 AM', label: 'Morning Drink', type: 'snack', color: '#bbf7d0' },
  { time: '8:00 AM', label: 'Breakfast', type: 'breakfast', color: '#93c5fd' },
  { time: '10:30 AM', label: 'Morning Snack', type: 'snack', color: '#fca5a5' },
  { time: '1:30 PM', label: 'Lunch', type: 'lunch', color: '#93c5fd' },
  { time: '4:30 PM', label: 'Evening Snack', type: 'snack', color: '#fdba74' },
  { time: '7:30 PM', label: 'Dinner Snack', type: 'snack', color: '#fca5a5' },
  { time: '9:00 PM', label: 'Dinner', type: 'dinner', color: '#c4b5fd' },
  { time: '9:45 PM', label: 'Night Drink', type: 'snack', color: '#fca5a5' },
];

const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function Activity() {
  const { selectedDate, setSelectedDate } = useApp();
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStripRef = useRef(null);

  // Show today ± 3 days so today is always the physical middle item.
  const today = new Date();
  const weekDays = [];
  for (let i = -3; i <= 3; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i + weekOffset * 7);
    weekDays.push(d);
  }
  const todayStr = getDateStr();
  const selStr = getDateStr(selectedDate);
  const dayMeals = getMeals(selStr);

  // Scroll to center today's day on mount / week change
  useEffect(() => {
    if (weekStripRef.current) {
      requestAnimationFrame(() => {
        const todayIndex = weekDays.findIndex(d => getDateStr(d) === todayStr);
        if (todayIndex >= 0) {
          const items = weekStripRef.current.querySelectorAll('.day-item');
          const todayEl = items[todayIndex];
          const container = weekStripRef.current;
          if (todayEl && container) {
            const containerRect = container.getBoundingClientRect();
            const elRect = todayEl.getBoundingClientRect();
            const containerCenter = containerRect.left + containerRect.width / 2;
            const elCenter = elRect.left + elRect.width / 2;
            container.scrollLeft += elCenter - containerCenter;
          }
        }
      });
    }
  }, [weekDays, todayStr, weekOffset]);

  const mealsByType = {};
  dayMeals.forEach(m => {
    if (!mealsByType[m.type]) mealsByType[m.type] = [];
    mealsByType[m.type].push(m);
  });

  return (
    <div className="page fade-in">
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>Activity</h2>
      </div>

      {/* Week Strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: 'none', padding: 4 }}>
          <ChevronLeft size={20} color="#6B7280" />
        </button>
        <div ref={weekStripRef} className="week-strip">
          {weekDays.map((d, i) => {
            const ds = getDateStr(d);
            const isToday = ds === todayStr;
            const isSelected = ds === selStr;
            return (
              <div key={i} className={`day-item ${isSelected ? 'active' : ''} ${isToday && !isSelected ? 'today' : ''}`} onClick={() => setSelectedDate(new Date(d))}>
                <span className="day-label">{DAY_NAMES[d.getDay()]}</span>
                <div className="day-num">{d.getDate()}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline */}
      <div className="timeline">
        {TIMELINE_SLOTS.map((slot, i) => {
          const slotMeals = mealsByType[slot.type] || [];
          const hasFood = slotMeals.length > 0;
          const slotCals = slotMeals.reduce((s, m) => s + (m.calories || 0), 0);

          return (
            <div key={i} className={`timeline-item ${hasFood ? 'completed' : ''}`} style={{ animationDelay: `${i * 0.05}s` }}>
              <span className="timeline-time">{slot.time}</span>
              <div className="timeline-dot" />
              {i < TIMELINE_SLOTS.length - 1 && <div className="timeline-line" />}
              <div className="timeline-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: slot.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 14 }}>
                      {slot.type === 'breakfast' ? '🥞' : slot.type === 'lunch' ? '🍛' : slot.type === 'dinner' ? '🍽️' : '🍎'}
                    </span>
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 14 }}>{slot.label}</p>
                    <p style={{ fontSize: 12, color: '#6B7280' }}>{hasFood ? `${slotCals} kcal` : '—'}</p>
                  </div>
                </div>
                <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${hasFood ? '#C6F135' : '#E5E7EB'}`, background: hasFood ? '#C6F135' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {hasFood && <Check size={14} color="#1A1A1A" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {dayMeals.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
          <p style={{ fontSize: 40, marginBottom: 8 }}>📋</p>
          <p style={{ fontWeight: 600 }}>No meals logged for this day</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Go to Home to log your first meal!</p>
        </div>
      )}
    </div>
  );
}
