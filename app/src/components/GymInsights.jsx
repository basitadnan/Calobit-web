import { useApp } from '../contexts/AppContext';
import { Sparkles, AlertCircle, BarChart2 } from 'lucide-react';

export default function GymInsights() {
  const { routine } = useApp();

  // Simple logic to detect missing muscles for now
  const allTrained = Object.values(routine).flatMap(d => d.muscles || []);
  const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Glutes', 'Core', 'Cardio'];
  const missing = MUSCLE_GROUPS.filter(m => !allTrained.includes(m));

  return (
    <div className="slide-up">
      {/* Muscle Balance Card */}
      <div className="card" style={{ marginBottom: 20, background: '#1A1A1A', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <BarChart2 size={18} color="#C6F135" />
          <span style={{ fontWeight: 700 }}>Weekly Muscle Balance</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ position: 'relative', width: 80, height: 80 }}>
            <svg width="80" height="80" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#333" strokeWidth="8" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="#C6F135" strokeWidth="8" 
                strokeDasharray="251.2" strokeDashoffset={251.2 * (1 - (allTrained.length / (MUSCLE_GROUPS.length * 2)))}
                strokeLinecap="round"
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800 }}>
              {Math.min(10, Math.round((allTrained.length / 10) * 10))}/10
            </div>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700 }}>Balanced Coverage</p>
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>You're hitting {allTrained.filter(m => m !== 'Rest').length} muscle groups this week.</p>
          </div>
        </div>
      </div>

      {/* Missing Muscles Alert */}
      {missing.length > 0 && (
        <div className="card" style={{ marginBottom: 20, border: '1px solid #FED7AA', background: '#FFF7ED' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <AlertCircle size={20} color="#F59E0B" />
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, color: '#92400E' }}>Missing Muscle Groups</p>
              <p style={{ fontSize: 12, color: '#B45309', marginTop: 2 }}>
                You're not training **{missing.join(', ')}** this week.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
