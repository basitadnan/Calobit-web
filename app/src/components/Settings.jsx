import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { calculateGoals } from '../utils/calculations';
import { getTemplates, saveTemplate, deleteTemplate, resetAll } from '../utils/storage';
import { getAiUsage } from '../utils/gemini';
import { scheduleDailyReminder, cancelDailyReminder, REMINDER_IDS } from '../utils/reminders';
import { signInWithGoogle } from '../utils/authSession';
import { getBindInfo } from './BindAccountModal';
import { User, Calculator, Trash2, RotateCcw, Plus, X, Pencil, MapPin, Crown, CloudUpload, ShieldCheck, Loader2 } from 'lucide-react';

export default function Settings() {
  const { profile, setProfile, goals, updateGoals, settings, updateSettings, currentUser, sessionUser, logout, isPremium, openCheckout, openBind, bindInfo } = useApp();
  const [templates, setTemplates] = useState(() => getTemplates());
  const [showReset, setShowReset] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [editGoals, setEditGoals] = useState({ ...goals });
  const [editProfile, setEditProfile] = useState({
    name: profile?.name || '', height: profile?.height || '', weight: profile?.weight || '',
    age: profile?.age || '', sex: profile?.sex || 'male', activity: profile?.activity || 'moderate',
    goal: profile?.goal || 'maintain', pace: profile?.pace || 0.5,
  });
  const [templateName, setTemplateName] = useState('');
  const [templateCals, setTemplateCals] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingGoals, setEditingGoals] = useState(false);

  const handleRecalc = () => {
    const computed = calculateGoals(editProfile);
    setEditGoals(computed);
    updateGoals(computed);
    setProfile({ ...profile, ...editProfile, goals: computed });
  };

  const handleSaveGoals = () => { updateGoals(editGoals); };

  const handleAddTemplate = () => {
    if (!templateName) return;
    saveTemplate({ name: templateName, calories: parseInt(templateCals) || 0 });
    setTemplates(getTemplates());
    setTemplateName(''); setTemplateCals('');
  };

  const handleDeleteTemplate = (id) => {
    deleteTemplate(id);
    setTemplates(getTemplates());
  };

  const handleReset = () => {
    resetAll();
    window.location.reload();
  };

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
      // Web redirects the page; native opens the in-app browser and returns
      // via the deep link. Either way AppContext flips sessionUser.
    } catch (err) {
      console.error('Google sign-in failed:', err.message);
    } finally {
      // On native we stay here until the deep link returns.
      setTimeout(() => setSigningIn(false), 8000);
    }
  };

  // ---- Reminders (local notifications, random times — zero configuration) ----
  const reminders = settings.reminders || {};

  const randTime = (minH, maxH) => {
    const h = minH + Math.floor(Math.random() * (maxH - minH + 1));
    const m = Math.floor(Math.random() * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const updateReminder = async (kind) => {
    const enabled = !reminders[kind]?.enabled;
    // Fresh random times every time a reminder is switched on: meals get two
    // nudges a day (late morning + evening), weigh-ins one morning nudge.
    const times = kind === 'meal' ? [randTime(10, 13), randTime(18, 21)] : [randTime(7, 9)];
    const next = { ...reminders, [kind]: { enabled, times } };
    updateSettings({ ...settings, reminders: next });

    const ids = kind === 'meal' ? [REMINDER_IDS.MEAL, REMINDER_IDS.MEAL2] : [REMINDER_IDS.WEIGH];
    const titles = kind === 'meal' ? ['Lunch check-in 🍽️', 'Dinner check-in 🍽️'] : ['Weekly weigh-in ⚖️'];
    const bodies = kind === 'meal' ? ['Quick log — 10 seconds keeps the streak alive.', 'Log what you ate before the day wraps up.'] : ['Hop on the scale — the weekly report uses your weight.'];
    try {
      for (const id of ids) await cancelDailyReminder(id);
      if (enabled) {
        await scheduleDailyReminder(ids[0], titles[0], bodies[0], times[0]);
        if (times[1]) await scheduleDailyReminder(ids[1], titles[1], bodies[1], times[1]);
      }
    } catch (err) {
      console.warn('reminder scheduling failed:', err);
    }
  };

  return (
    <div className="page fade-in">
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
        <User size={22} style={{ verticalAlign: 'text-bottom', marginRight: 8 }} />Settings
      </h2>

      {/* Account & Backup */}
      <div className="card" style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>Account & Backup</p>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>👤 {profile?.name || 'User'}</p>
            {sessionUser ? (
              <p style={{ fontSize: 12, color: '#4B5563', marginTop: 2 }}>
                Signed in with Google{sessionUser.email ? ` · ${sessionUser.email}` : ''}
              </p>
            ) : (
              <p style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Not signed in — data stays on this device</p>
            )}
            {bindInfo?.boundAt && (
              <p style={{ fontSize: 11, color: '#4B5563', marginTop: 4 }}>
                <ShieldCheck size={12} style={{ verticalAlign: '-2px', marginRight: 4, color: '#5c7017' }} />
                Cloud backup active
              </p>
            )}
          </div>
          {sessionUser ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn-small" onClick={openBind} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CloudUpload size={14} />
                {bindInfo?.boundAt ? 'Back up now' : 'Bind account'}
              </button>
              <button className="btn-small" onClick={logout} style={{ background: '#EF4444', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                Sign Out
              </button>
            </div>
          ) : (
            <button className="btn-small" onClick={handleGoogleSignIn} disabled={signingIn} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1A1A1A', color: '#fff', fontSize: 11 }}>
              {signingIn ? <Loader2 size={14} className="spin" /> : null}
              {signingIn ? 'Opening Google…' : 'Sign in with Google'}
            </button>
          )}
        </div>
        {bindInfo?.boundAt && (
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
            Last backup: {bindInfo.lastBackupAt ? new Date(bindInfo.lastBackupAt).toLocaleDateString() : 'recently'}
          </div>
        )}
      </div>

      {/* Profile */}
      <div className="settings-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Profile</h3>
          <button className="btn-small" onClick={() => setEditingProfile(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Pencil size={12} /> {editingProfile ? 'Cancel' : 'Edit'}
          </button>
        </div>
        {!editingProfile ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              ['Name', editProfile.name || '—'],
              ['Age', editProfile.age ? `${editProfile.age} yrs` : '—'],
              ['Height', editProfile.height ? `${editProfile.height} cm` : '—'],
              ['Weight', editProfile.weight ? `${editProfile.weight} kg` : '—'],
              ['Gender', editProfile.sex === 'female' ? 'Female' : 'Male'],
              ['Goal', editProfile.goal || 'maintain'],
            ].map(([label, value]) => (
              <div key={label} style={{ background: '#F9FAFB', borderRadius: 10, padding: 10 }}>
                <p style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>{label}</p>
                <p style={{ fontSize: 14, fontWeight: 700, textTransform: 'capitalize' }}>{value}</p>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="form-group">
              <label>Name</label>
              <input className="input-field" value={editProfile.name} onChange={e => setEditProfile(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Height (cm)</label>
                <input className="input-field" type="number" value={editProfile.height} onChange={e => setEditProfile(p => ({ ...p, height: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Weight (kg)</label>
                <input className="input-field" type="number" value={editProfile.weight} onChange={e => setEditProfile(p => ({ ...p, weight: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Age</label>
                <input className="input-field" type="number" value={editProfile.age} onChange={e => setEditProfile(p => ({ ...p, age: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Gender</label>
                <div className="toggle-group">
                  <button className={`toggle-opt ${editProfile.sex === 'male' ? 'active' : ''}`} onClick={() => setEditProfile(p => ({ ...p, sex: 'male' }))}>Male</button>
                  <button className={`toggle-opt ${editProfile.sex === 'female' ? 'active' : ''}`} onClick={() => setEditProfile(p => ({ ...p, sex: 'female' }))}>Female</button>
                </div>
              </div>
            </div>
            <button className="btn-primary" onClick={() => { handleRecalc(); setEditingProfile(false); }} style={{ marginTop: 8 }}>
              <Calculator size={16} /> Recalculate Goals
            </button>
          </>
        )}
      </div>

      {/* Daily Goals */}
      <div className="settings-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Daily Goals</h3>
          <button className="btn-small" onClick={() => { setEditGoals({ ...goals }); setEditingGoals(v => !v); }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Pencil size={12} /> {editingGoals ? 'Cancel' : 'Edit'}
          </button>
        </div>
        {!editingGoals ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              ['Calories', goals.calories, 'kcal'],
              ['Protein', goals.protein, 'g'],
              ['Carbs', goals.carbs, 'g'],
              ['Fat', goals.fat, 'g'],
            ].map(([label, value, unit]) => (
              <div key={label} style={{ background: '#F9FAFB', borderRadius: 10, padding: 10 }}>
                <p style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>{label}</p>
                <p style={{ fontSize: 14, fontWeight: 700 }}>{value} <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 400 }}>{unit}</span></p>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="form-row">
              <div className="form-group">
                <label>Calories</label>
                <input className="input-field" type="number" value={editGoals.calories} onChange={e => setEditGoals(g => ({ ...g, calories: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="form-group">
                <label>Protein (g)</label>
                <input className="input-field" type="number" value={editGoals.protein} onChange={e => setEditGoals(g => ({ ...g, protein: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Carbs (g)</label>
                <input className="input-field" type="number" value={editGoals.carbs} onChange={e => setEditGoals(g => ({ ...g, carbs: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="form-group">
                <label>Fat (g)</label>
                <input className="input-field" type="number" value={editGoals.fat} onChange={e => setEditGoals(g => ({ ...g, fat: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <button className="btn-primary" onClick={() => { handleSaveGoals(); setEditingGoals(false); }}>Save Goals</button>
          </>
        )}
      </div>

      {/* Toggles */}
      <div className="settings-group">
        <h3>Preferences</h3>
        <div className="setting-row">
          <label>Units</label>
          <div className="toggle-group">
            <button className={`toggle-opt ${settings.units === 'metric' ? 'active' : ''}`} onClick={() => updateSettings({ ...settings, units: 'metric' })}>Metric</button>
            <button className={`toggle-opt ${settings.units === 'imperial' ? 'active' : ''}`} onClick={() => updateSettings({ ...settings, units: 'imperial' })}>Imperial</button>
          </div>
        </div>
      </div>

      {/* Offline map note */}
      <div className="settings-group">
        <h3>
          <MapPin size={18} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} /> Map Tiles
        </h3>
        <p style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
          Map view works offline for areas you've previously visited with an internet connection.
          Tiles you view online are saved on your phone (up to 100&nbsp;MB) and reused next time —
          outside that, the route is shown without the map.
        </p>
      </div>

      {/* Premium */}
      <PremiumCard isPremium={isPremium} onUpgrade={openCheckout} />

      {/* Reminders */}
      <div className="settings-group">
        <h3>Reminders</h3>
        {[
          ['meal', 'Log my meal', 'Two random nudges a day to keep the streak alive'],
          ['weigh', 'Weekly weigh-in', 'A random morning nudge — feeds the adaptive report'],
        ].map(([kind, label, desc]) => {
          const r = reminders[kind] || { enabled: false, times: [] };
          return (
            <div key={kind} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: kind === 'meal' ? '1px solid #F3F4F6' : 'none' }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>{label}</p>
                <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
                  {r.enabled ? `On — ${r.times.join(' & ')}` : desc}
                </p>
              </div>
              <input type="checkbox" checked={!!r.enabled} onChange={() => updateReminder(kind)} style={{ width: 18, height: 18 }} />
            </div>
          );
        })}
      </div>

      {/* AI Features */}
      <AiUsageCard />

      {/* Meal Templates */}
      <div className="settings-group">
        <h3>Meal Templates</h3>
        {templates.map(t => (
          <div key={t.id} className="setting-row">
            <div>
              <p style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</p>
              <p style={{ fontSize: 12, color: '#6B7280' }}>{t.calories} kcal</p>
            </div>
            <button onClick={() => handleDeleteTemplate(t.id)} style={{ background: 'none', color: '#EF4444' }}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input className="input-field" placeholder="Template name" value={templateName} onChange={e => setTemplateName(e.target.value)} style={{ flex: 1 }} />
          <input className="input-field" placeholder="kcal" type="number" value={templateCals} onChange={e => setTemplateCals(e.target.value)} style={{ width: 80 }} />
          <button className="btn-small" onClick={handleAddTemplate}><Plus size={14} /></button>
        </div>
      </div>

      {/* Reset */}
      <div className="settings-group">
        <h3>Danger Zone</h3>
        {showReset ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={handleReset} style={{ background: '#EF4444', color: '#fff' }}>
              <Trash2 size={16} /> Confirm Reset
            </button>
            <button className="btn-secondary" onClick={() => setShowReset(false)}>
              <X size={16} /> Cancel
            </button>
          </div>
        ) : (
          <button className="btn-secondary" onClick={() => setShowReset(true)} style={{ borderColor: '#EF4444', color: '#EF4444' }}>
            <RotateCcw size={16} /> Reset App
          </button>
        )}
      </div>
    </div>
  );
}

function PremiumCard({ isPremium, onUpgrade }) {
  return (
    <div className="settings-group">
      <h3>
        <Crown size={18} style={{ verticalAlign: 'text-bottom', marginRight: 6, color: '#88a31e' }} /> Premium
      </h3>
      {isPremium ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, background: '#F3F7EC',
          border: '1px solid #dbe6c3', borderRadius: 12, padding: 14,
        }}>
          <Crown size={20} color="#88a31e" />
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#5c7017' }}>Premium is active</p>
            <p style={{ fontSize: 12, color: '#6B7280' }}>Thanks for supporting Calobit — all premium features are unlocked.</p>
          </div>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
            Unlock all premium features for Rs. 100/month. Pay from Easypaisa,
            JazzCash, NayaPay, SadaPay or any bank app — verified automatically.
          </p>
          <button className="btn-primary" onClick={onUpgrade} style={{ width: '100%', justifyContent: 'center' }}>
            <Crown size={16} /> Upgrade to Premium — Rs. 100/month
          </button>
        </>
      )}
    </div>
  );
}

function AiUsageCard() {
  const usage = getAiUsage();

  return (
    <div className="settings-group">
      <h3>AI Features</h3>
      {usage.premium ? (
        <p style={{ fontSize: 12, color: '#6B7280' }}>
          Premium: unlimited AI meal logging & nutrition-label scanning.
        </p>
      ) : (
        <>
          <p style={{ fontSize: 12, color: '#6B7280' }}>
            {usage.remaining} of {usage.limit} free AI calls left this month
            (meal logging & label scanning) — Premium gets unlimited AI.
          </p>
        </>
      )}
    </div>
  );
}

