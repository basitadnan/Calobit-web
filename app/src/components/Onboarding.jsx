import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { calculateGoals } from '../utils/calculations';
import { Leaf, Zap, ChevronRight, ChevronLeft } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const GOALS = [
  { id: 'lose', icon: '🔥', title: 'Lose Weight', desc: 'Burn fat and get lean' },
  { id: 'maintain', icon: '⚖️', title: 'Maintain Weight', desc: 'Stay at your current weight' },
  { id: 'gain', icon: '💪', title: 'Gain Muscle / Weight', desc: 'Build mass and strength' },
];

const ACTIVITIES = [
  { id: 'sedentary', icon: '🛋️', title: 'Sedentary', desc: 'Desk job, no exercise' },
  { id: 'light', icon: '🚶', title: 'Lightly Active', desc: '1–3 days/week' },
  { id: 'moderate', icon: '🏃', title: 'Moderately Active', desc: '3–5 days/week' },
  { id: 'very', icon: '🏋️', title: 'Very Active', desc: '6–7 days/week' },
  { id: 'extra', icon: '⚡', title: 'Extra Active', desc: 'Physical job + daily training' },
];

const PACE_LABELS = {
  lose: { 0.25: 'Mild', 0.5: 'Moderate', 1: 'Aggressive' },
  gain: { 0.25: 'Lean Bulk', 0.5: 'Moderate', 1: 'Fast Bulk' },
};

export default function Onboarding() {
  const { completeOnboarding } = useApp();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '', height: '', weight: '', age: '', sex: 'male',
    heightUnit: 'cm', weightUnit: 'kg',
    goal: '', pace: 0.5, activity: '',
  });
  const [goals, setLocalGoals] = useState(null);

  const update = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const canNext = () => {
    if (step === 1) return form.name && form.height && form.weight && form.age;
    if (step === 2) return form.goal;
    if (step === 3) return form.activity;
    return true;
  };

  const goNext = () => {
    if (step === 3) {
      let h = parseFloat(form.height);
      let w = parseFloat(form.weight);
      if (form.heightUnit === 'ft') h = h * 30.48;
      if (form.weightUnit === 'lbs') w = w * 0.4536;
      const profileData = { ...form, height: h, weight: w };
      const computed = calculateGoals(profileData);
      setLocalGoals(computed);
    }
    if (step < 4) setStep(step + 1);
  };

  const handleFinish = () => {
    let h = parseFloat(form.height);
    let w = parseFloat(form.weight);
    if (form.heightUnit === 'ft') h = h * 30.48;
    if (form.weightUnit === 'lbs') w = w * 0.4536;
    const finalGoals = goals || calculateGoals({ ...form, height: h, weight: w });
    completeOnboarding({ ...form, height: h, weight: w, goals: finalGoals });
  };

  const donutData = goals ? [
    { name: 'Protein', value: goals.protein * 4, color: '#14B8A6' },
    { name: 'Carbs', value: goals.carbs * 4, color: '#C6F135' },
    { name: 'Fat', value: goals.fat * 9, color: '#F59E0B' },
  ] : [];

  return (
    <div className="onboarding">
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        <img src="/logo.png" alt="CaloBit" style={{ width: 36, height: 36, objectFit: 'contain', borderRadius: 8 }} />
        <span style={{ fontWeight: 700, fontSize: 20 }}>CaloBit</span>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 600 }}>Step {step} of 4</span>
      </div>
      <div className="onboarding-progress">
        <div className="fill" style={{ width: `${(step / 4) * 100}%` }} />
      </div>

      {/* Step 1 - Basic Info */}
      {step === 1 && (
        <div className="fade-in" style={{ flex: 1 }}>
          <h2>Let's get to know you</h2>
          <p className="sub">We'll use this to personalize your experience</p>

          <div className="form-group">
            <label>Your Name</label>
            <input className="input-field" placeholder="e.g. Ahmed" value={form.name} onChange={e => update('name', e.target.value)} />
          </div>

          <div className="form-group">
            <label>Height</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input-field" type="number" placeholder={form.heightUnit === 'cm' ? '175' : '5.9'} value={form.height} onChange={e => update('height', e.target.value)} style={{ flex: 1 }} />
              <div className="toggle-group" style={{ flexShrink: 0 }}>
                <button className={`toggle-opt ${form.heightUnit === 'cm' ? 'active' : ''}`} onClick={() => update('heightUnit', 'cm')}>cm</button>
                <button className={`toggle-opt ${form.heightUnit === 'ft' ? 'active' : ''}`} onClick={() => update('heightUnit', 'ft')}>ft</button>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Weight</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input-field" type="number" placeholder={form.weightUnit === 'kg' ? '75' : '165'} value={form.weight} onChange={e => update('weight', e.target.value)} style={{ flex: 1 }} />
              <div className="toggle-group" style={{ flexShrink: 0 }}>
                <button className={`toggle-opt ${form.weightUnit === 'kg' ? 'active' : ''}`} onClick={() => update('weightUnit', 'kg')}>kg</button>
                <button className={`toggle-opt ${form.weightUnit === 'lbs' ? 'active' : ''}`} onClick={() => update('weightUnit', 'lbs')}>lbs</button>
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Age</label>
              <input className="input-field" type="number" placeholder="25" value={form.age} onChange={e => update('age', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Gender</label>
              <div className="toggle-group">
                <button className={`toggle-opt ${form.sex === 'male' ? 'active' : ''}`} onClick={() => update('sex', 'male')}>Male</button>
                <button className={`toggle-opt ${form.sex === 'female' ? 'active' : ''}`} onClick={() => update('sex', 'female')}>Female</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2 - Goal */}
      {step === 2 && (
        <div className="fade-in" style={{ flex: 1 }}>
          <h2>What's your goal?</h2>
          <p className="sub">We'll adjust your calories accordingly</p>
          <div className="card-selector">
            {GOALS.map(g => (
              <div key={g.id} className={`selector-card ${form.goal === g.id ? 'selected' : ''}`} onClick={() => update('goal', g.id)}>
                <span className="icon">{g.icon}</span>
                <div className="info">
                  <h4>{g.title}</h4>
                  <p>{g.desc}</p>
                </div>
              </div>
            ))}
          </div>
          {(form.goal === 'lose' || form.goal === 'gain') && (
            <div className="form-group fade-in" style={{ marginTop: 24 }}>
              <label>Pace: <strong>{PACE_LABELS[form.goal]?.[form.pace] || 'Moderate'}</strong> ({form.pace} kg/week)</label>
              <input type="range" min="0.25" max="1" step="0.25" value={form.pace} onChange={e => update('pace', parseFloat(e.target.value))} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                <span>0.25 kg/wk</span><span>1 kg/wk</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3 - Activity */}
      {step === 3 && (
        <div className="fade-in" style={{ flex: 1 }}>
          <h2>How active are you?</h2>
          <p className="sub">This helps us calculate your daily needs</p>
          <div className="card-selector">
            {ACTIVITIES.map(a => (
              <div key={a.id} className={`selector-card ${form.activity === a.id ? 'selected' : ''}`} onClick={() => update('activity', a.id)}>
                <span className="icon">{a.icon}</span>
                <div className="info">
                  <h4>{a.title}</h4>
                  <p>{a.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 4 - Personalized Goals */}
      {step === 4 && goals && (
        <div className="fade-in" style={{ flex: 1 }}>
          <h2>Your personalized goals</h2>
          <p className="sub">Adjust these anytime in Settings</p>

          <div className="donut-container">
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                  {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            {donutData.map(d => (
              <span key={d.name} className="macro-chip">
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, display: 'inline-block' }} />
                {d.name}
              </span>
            ))}
          </div>

          <div className="form-group">
            <label>Daily Calories (kcal)</label>
            <input className="input-field" type="number" value={goals.calories} onChange={e => setLocalGoals(g => ({ ...g, calories: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Protein (g)</label>
              <input className="input-field" type="number" value={goals.protein} onChange={e => setLocalGoals(g => ({ ...g, protein: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="form-group">
              <label>Carbs (g)</label>
              <input className="input-field" type="number" value={goals.carbs} onChange={e => setLocalGoals(g => ({ ...g, carbs: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="form-group">
              <label>Fat (g)</label>
              <input className="input-field" type="number" value={goals.fat} onChange={e => setLocalGoals(g => ({ ...g, fat: parseInt(e.target.value) || 0 }))} />
            </div>
          </div>

          <div style={{ background: '#f0fdf4', padding: 14, borderRadius: 12, marginBottom: 20 }}>
            <p style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}>
              📊 BMR: <strong>{goals.bmr} kcal</strong> · TDEE: <strong>{goals.tdee} kcal</strong>
            </p>
            <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>These are your starting targets. You can change them anytime in Settings.</p>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div style={{ display: 'flex', gap: 12, marginTop: 'auto', paddingTop: 20 }}>
        {step > 1 && (
          <button className="btn-secondary" onClick={() => setStep(step - 1)} style={{ flex: 0, minWidth: 48 }}>
            <ChevronLeft size={20} />
          </button>
        )}
        {step < 4 ? (
          <button className="btn-primary" onClick={goNext} disabled={!canNext()} style={{ opacity: canNext() ? 1 : 0.5 }}>
            Continue <ChevronRight size={18} />
          </button>
        ) : (
          <button className="btn-primary" onClick={handleFinish}>
            Let's Go <Zap size={18} /> →
          </button>
        )}
      </div>
    </div>
  );
}
