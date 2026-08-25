import { useState, useEffect } from 'react';
import { Sparkles, Lock, Check } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { getAllMeals, getWeights, getAiReport, saveAiReport } from '../utils/storage';
import { computeWeeklyReport, reportToText, MIN_WINDOW_DAYS } from '../utils/body';
import { getWeeklyCoachText } from '../utils/gemini';

// The AI phrasing is cached for the current week (Monday-start) so the
// premium coach costs one request per week, not one per render.
function weekStartStr() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d.toISOString().split('T')[0];
}

export default function WeeklyReport() {
  const { goals, profile, updateGoals, isPremium } = useApp();
  const [report] = useState(() =>
    computeWeeklyReport({
      allMeals: getAllMeals(),
      goals,
      profile,
      weights: getWeights(),
    })
  );
  const [coachText, setCoachText] = useState(null);
  const [coachBusy, setCoachBusy] = useState(false);
  const [applied, setApplied] = useState(false);

  const weekStart = weekStartStr();
  const cached = getAiReport();

  useEffect(() => {
    if (!isPremium || !report) return;
    if (cached && cached.weekStart === weekStart && cached.text) {
      setCoachText(cached.text);
      return;
    }
    setCoachBusy(true);
    getWeeklyCoachText({
      daysLogged: `${report.week.daysLogged}/${report.week.days}`,
      avgDailyKcal: report.week.avgDaily,
      goalKcal: report.week.goalCalories,
      tdee: goals?.tdee ?? null,
      predictedChangeKg: report.week.predictedChange,
      actualChangeKg: report.actual ? report.actual.change : null,
      suggestion: report.suggestion,
    })
      .then((text) => {
        setCoachText(text);
        saveAiReport({ weekStart, text });
      })
      .catch(() => setCoachText(reportToText(report)))
      .finally(() => setCoachBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium]);

  if (!report) return null;

  const { week, actual, suggestion, onTrack } = report;
  const pred = week.predictedChange !== null ? week.predictedChange.toFixed(2) : null;

  return (
    <div className="insight-card slide-up" style={{ borderColor: '#C6F13555' }}>
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
        <Sparkles size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6, color: '#88a31e' }} />
        Weekly Report
      </h3>
      <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>Last {week.days} days</p>

      {/* Core numbers — visible to everyone */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 10 }}>
          <p style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>DAYS LOGGED</p>
          <p style={{ fontSize: 18, fontWeight: 800 }}>{week.daysLogged}<span style={{ fontSize: 12, color: '#9CA3AF' }}>/{week.days}</span></p>
        </div>
        <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 10 }}>
          <p style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>AVG INTAKE</p>
          <p style={{ fontSize: 18, fontWeight: 800 }}>{week.avgDaily}<span style={{ fontSize: 12, color: '#9CA3AF' }}> kcal</span></p>
        </div>
        <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 10 }}>
          <p style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>PREDICTED CHANGE</p>
          <p style={{ fontSize: 18, fontWeight: 800 }}>
            {pred === null ? '—' : `${pred > 0 ? '+' : ''}${pred}`}
            <span style={{ fontSize: 12, color: '#9CA3AF' }}> kg</span>
          </p>
        </div>
        <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 10 }}>
          <p style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>SCALE SAYS</p>
          <p style={{ fontSize: 18, fontWeight: 800 }}>
            {actual ? `${actual.change > 0 ? '+' : ''}${actual.change.toFixed(2)}` : '—'}
            <span style={{ fontSize: 12, color: '#9CA3AF' }}> kg</span>
          </p>
        </div>
      </div>

      {pred === null && (
        <p style={{ fontSize: 12, color: '#9CA3AF' }}>
          Log meals to unlock the prediction — it compares your intake against your burn.
        </p>
      )}
      {pred !== null && !actual && (
        <p style={{ fontSize: 12, color: '#9CA3AF' }}>
          Weigh in on at least two days, {MIN_WINDOW_DAYS}+ days apart, to compare the prediction with reality.
        </p>
      )}

      {/* On track */}
      {onTrack && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F0FDF4', borderRadius: 10, padding: 12 }}>
          <Check size={16} color="#16A34A" />
          <p style={{ fontSize: 13, color: '#16A34A', fontWeight: 600 }}>
            The scale matches the math — your plan is working. No changes.
          </p>
        </div>
      )}

      {/* Adaptive suggestion (premium) */}
      {suggestion && (
        <div style={{ background: '#FEF9C3', borderRadius: 10, padding: 12, marginTop: actual ? 0 : 12 }}>
          <p style={{ fontSize: 13, color: '#854D0E', lineHeight: 1.6 }}>
            Over {suggestion.days} days the scale moved <strong>{actual.change > 0 ? '+' : ''}{actual.change.toFixed(2)} kg</strong> but
            the math predicted <strong>{week.predictedChange > 0 ? '+' : ''}{week.predictedChange.toFixed(2)} kg</strong>.
            {isPremium ? (
              <>
                {' '}Your real burn is different from the estimate — suggested goal:{' '}
                <strong>{suggestion.suggested} kcal/day</strong> ({suggestion.direction === 'increase' ? '+' : '−'}{suggestion.adjustment}).
              </>
            ) : (
              <> Your calories need adjusting — <strong>Premium</strong> unlocks the exact number.</>
            )}
          </p>
          {isPremium && (
            <button
              className="btn-primary"
              style={{ width: '100%', marginTop: 10, justifyContent: 'center' }}
              onClick={() => {
                updateGoals({ ...goals, calories: suggestion.suggested });
                setApplied(true);
              }}
              disabled={applied}
            >
              {applied ? <><Check size={16} /> Goal updated to {suggestion.suggested} kcal</> : `Apply ${suggestion.suggested} kcal/day goal`}
            </button>
          )}
        </div>
      )}

      {/* AI coach text (premium) */}
      {isPremium && (
        <div style={{ marginTop: 12, background: '#F9FAFB', borderRadius: 10, padding: 12 }}>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
            {coachBusy ? '✨ Writing your weekly coaching…' : coachText || reportToText(report)}
          </p>
        </div>
      )}
      {!isPremium && pred !== null && (
        <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Lock size={12} /> Weekly AI coaching is a Premium feature.
        </p>
      )}
    </div>
  );
}
