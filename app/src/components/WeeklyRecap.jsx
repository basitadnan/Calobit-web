import { useMemo, useRef, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { getAllMeals, getWalkLogs, getDateStr } from '../utils/storage';
import { sumMacros } from '../utils/calculations';
import { Crown, Lock, Sparkles } from 'lucide-react';

const DAYS = 7;

function dayStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return getDateStr(d);
}

function fmtRange(startStr, endStr) {
  const f = (s) => new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  try { return `${f(startStr)} – ${f(endStr)}`; } catch { return ''; }
}

/**
 * Weekly "Wrapped" recap — a full-screen, swipe-only story that summarizes
 * the last 7 days and (for free users) ends on the premium upsell.
 */
export default function WeeklyRecap({ onClose }) {
  const { goals, isPremium, openCheckout } = useApp();
  const [idx, setIdx] = useState(0);
  const startX = useRef(null);

  const data = useMemo(() => {
    const allMeals = getAllMeals();
    const g = goals || { calories: 2000, protein: 130 };
    let totalKcal = 0, daysLogged = 0, proteinHit = 0, sumP = 0, sumC = 0, sumF = 0;
    for (let i = DAYS - 1; i >= 0; i--) {
      const ds = dayStr(i);
      const meals = allMeals[ds] || [];
      const t = sumMacros(meals);
      if (meals.length > 0) {
        daysLogged++;
        totalKcal += t.calories;
        if (t.protein >= g.protein) proteinHit++;
        sumP += t.protein; sumC += t.carbs; sumF += t.fat;
      }
    }
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const meals = allMeals[dayStr(i)] || [];
      if (sumMacros(meals).calories >= g.calories * 0.8) streak++;
      else break;
    }
    const weekStart = dayStr(DAYS - 1);
    const walk = getWalkLogs().filter((w) => (w.date || w.timestamp || '').slice(0, 10) >= weekStart);
    const walkSteps = walk.reduce((a, w) => a + (w.steps || 0), 0);
    const walkKm = Math.round(walk.reduce((a, w) => a + (w.distanceKm || 0), 0) * 10) / 10;
    const avg = daysLogged ? Math.round(totalKcal / daysLogged) : 0;
    return {
      g,
      totalKcal,
      avg,
      daysLogged,
      proteinHit,
      avgP: daysLogged ? Math.round(sumP / daysLogged) : 0,
      avgC: daysLogged ? Math.round(sumC / daysLogged) : 0,
      avgF: daysLogged ? Math.round(sumF / daysLogged) : 0,
      streak,
      walkSteps,
      walkKm,
      range: fmtRange(weekStart, dayStr(0)),
    };
  }, [goals]);

  const cards = [
    {
      emoji: '🎉',
      title: 'Your Week, Wrapped',
      body: data.range,
      sub: 'Swipe to see your week',
    },
    {
      emoji: '🔥',
      title: `${data.totalKcal.toLocaleString()} calories`,
      body: `You logged ${data.daysLogged} of ${DAYS} days — averaging ${data.avg} kcal/day.`,
      sub: `Goal: ${data.g.calories} kcal/day`,
    },
    {
      emoji: '💪',
      title: `Protein: ${data.proteinHit}/${DAYS} days`,
      body: `You hit your protein target on ${data.proteinHit} day${data.proteinHit === 1 ? '' : 's'}.`,
      sub: `Avg — P ${data.avgP}g · C ${data.avgC}g · F ${data.avgF}g`,
    },
    {
      emoji: '🚶',
      title: data.walkSteps > 0 ? `${data.walkSteps.toLocaleString()} steps` : 'No walks logged',
      body: data.walkSteps > 0 ? `You covered ${data.walkKm} km this week.` : 'Start a walk session to track your movement.',
      sub: data.walkSteps > 0 ? 'Keep moving!' : 'Tap the 🚶 tab on the home screen',
    },
    {
      emoji: '🏅',
      title: `${data.streak}-day streak`,
      body: `You logged on ${data.daysLogged} of the last ${DAYS} days.`,
      sub: 'Consistency beats intensity',
    },
  ];

  const isLast = idx >= cards.length;
  const onPointerDown = (e) => { startX.current = e.clientX; };
  const onPointerUp = (e) => {
    if (startX.current === null) return;
    const dx = e.clientX - startX.current;
    if (dx < -60) setIdx((i) => Math.min(i + 1, cards.length));
    startX.current = null;
  };

  const finish = () => { if (onClose) onClose(); };

  const renderEndCard = () => {
    if (isPremium) {
      return (
        <div style={{ textAlign: 'center', padding: '0 10px' }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>👑</div>
          <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 800, color: '#C6F135' }}>You're Premium!</h2>
          <p style={{ margin: '0 0 28px', fontSize: 14, color: '#9CA3AF' }}>
            Thanks for supporting CaloBit — see you next week.
          </p>
          <button className="btn-primary" onClick={finish} style={{ width: '100%' }}>
            Done
          </button>
        </div>
      );
    }
    return (
      <div style={{ textAlign: 'center', padding: '0 10px' }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>💎</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 800 }}>Go Premium</h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: '#9CA3AF' }}>
          Unlock everything CaloBit has to offer — just Rs. 100/month.
        </p>
        <div style={{ textAlign: 'left', fontSize: 13, color: '#D1D5DB', marginBottom: 24 }}>
          {[
            ['Unlimited AI', 'meal logging & label scanning'],
            ['Adaptive calories', 'auto-tuned from your weigh-ins'],
            ['Weekly AI coach', 'personalized insight every week'],
            ['This recap', 'every single week'],
          ].map(([t, d]) => (
            <div key={t} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <Crown size={16} color="#C6F135" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <b style={{ color: '#fff' }}>{t}</b>
                <div style={{ color: '#9CA3AF' }}>{d}</div>
              </div>
            </div>
          ))}
        </div>
        <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { finish(); openCheckout(); }}>
          <Crown size={16} /> Upgrade to Premium
        </button>
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1300,
        background: '#171A21', color: '#fff', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        touchAction: 'pan-y',
      }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {/* Progress dots */}
      <div style={{ position: 'absolute', top: 18, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
        {[...cards, { end: true }].map((_, i) => (
          <div key={i} style={{
            width: i === Math.min(idx, cards.length) ? 18 : 6, height: 6, borderRadius: 3,
            background: i <= idx ? '#C6F135' : 'rgba(255,255,255,0.2)',
            transition: 'all 0.3s',
          }} />
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 28px' }}>
        <div key={idx} className="recap-in" style={{ width: '100%', maxWidth: 420 }}>
          {!isLast ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 72, marginBottom: 16 }}>{cards[idx].emoji}</div>
              <h2 style={{ margin: '0 0 10px', fontSize: 28, fontWeight: 800 }}>{cards[idx].title}</h2>
              <p style={{ margin: '0 0 8px', fontSize: 16, color: '#D1D5DB' }}>{cards[idx].body}</p>
              <p style={{ margin: 0, fontSize: 12, color: '#6B7280' }}>{cards[idx].sub}</p>
            </div>
          ) : (
            renderEndCard()
          )}
        </div>
      </div>

      {/* Swipe hint */}
      <div style={{ padding: '0 0 24px', textAlign: 'center', fontSize: 12, color: '#6B7280' }}>
        {isLast
          ? (isPremium ? 'You\'re all set 🎉' : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Lock size={12} /> Premium unlocks this every week</span>)
          : <span>← Swipe left to continue →</span>}
      </div>
    </div>
  );
}
