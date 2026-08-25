import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { Dumbbell, ChevronRight, Check, ArrowLeft } from 'lucide-react';

const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Glutes', 'Core', 'Cardio', 'Rest'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const PRESETS = {
  'PPL': {
    Monday: ['Chest', 'Shoulders', 'Triceps'],
    Tuesday: ['Back', 'Biceps'],
    Wednesday: ['Legs', 'Glutes'],
    Thursday: ['Chest', 'Shoulders', 'Triceps'],
    Friday: ['Back', 'Biceps'],
    Saturday: ['Legs', 'Glutes'],
    Sunday: ['Rest']
  },
  'Upper/Lower': {
    Monday: ['Chest', 'Back', 'Shoulders'],
    Tuesday: ['Legs', 'Glutes', 'Core'],
    Wednesday: ['Rest'],
    Thursday: ['Chest', 'Back', 'Shoulders'],
    Friday: ['Legs', 'Glutes', 'Core'],
    Saturday: ['Rest'],
    Sunday: ['Rest']
  },
  'Bro Split': {
    Monday: ['Chest'],
    Tuesday: ['Back'],
    Wednesday: ['Shoulders'],
    Thursday: ['Legs'],
    Friday: ['Biceps', 'Triceps'],
    Saturday: ['Rest'],
    Sunday: ['Rest']
  }
};

export default function GymSetup() {
  const { completeGymOnboarding } = useApp();
  const [step, setStep] = useState(1);
  const [selectedPreset, setSelectedPreset] = useState('PPL');
  const [customRoutine, setCustomRoutine] = useState(
    DAYS.reduce((acc, day) => ({ ...acc, [day]: ['Rest'] }), {})
  );

  const handleToggleMuscle = (day, muscle) => {
    setCustomRoutine(prev => {
      const current = prev[day];
      if (muscle === 'Rest') return { ...prev, [day]: ['Rest'] };
      
      let next;
      if (current.includes(muscle)) {
        next = current.filter(m => m !== muscle);
        if (next.length === 0) next = ['Rest'];
      } else {
        next = current.filter(m => m !== 'Rest').concat(muscle);
      }
      return { ...prev, [day]: next };
    });
  };

  const finish = () => {
    const finalRoutine = selectedPreset !== 'Custom' ? PRESETS[selectedPreset] : customRoutine;
    const routineWithExercises = {};
    Object.keys(finalRoutine).forEach(day => {
      const muscles = finalRoutine[day];
      routineWithExercises[day] = {
        muscles,
        exercises: muscles.includes('Rest') ? [] : [
          { id: Math.random().toString(), name: `Initial ${muscles[0]} Exercise`, sets: 3, reps: '10-12', done: false }
        ]
      };
    });
    completeGymOnboarding(routineWithExercises);
  };

  return (
    <div className="page fade-in" style={{ padding: '20px 20px 100px' }}>
      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <div style={{ width: 56, height: 56, background: '#C6F135', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <Dumbbell size={28} color="#1A1A1A" />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>Workout Setup</h1>
        <p style={{ color: '#6B7280', fontSize: 14 }}>Build your weekly workout split</p>
      </div>

      {step === 1 ? (
        <div className="slide-up">
          <p style={{ fontWeight: 700, marginBottom: 12, fontSize: 15 }}>Choose your training style:</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {Object.keys(PRESETS).map(p => (
              <div 
                key={p} 
                className={`card ${selectedPreset === p ? 'active-card' : ''}`}
                style={{ cursor: 'pointer', padding: 12, border: selectedPreset === p ? '2px solid #C6F135' : '1px solid #E5E7EB' }}
                onClick={() => setSelectedPreset(p)}
              >
                <p style={{ fontWeight: 700, fontSize: 14 }}>{p}</p>
                <p style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>{Object.values(PRESETS[p])[0].join(' + ')}</p>
              </div>
            ))}
            <div 
              className={`card ${selectedPreset === 'Custom' ? 'active-card' : ''}`}
              style={{ cursor: 'pointer', padding: 12, border: selectedPreset === 'Custom' ? '2px solid #C6F135' : '1px solid #E5E7EB' }}
              onClick={() => setSelectedPreset('Custom')}
            >
              <p style={{ fontWeight: 700, fontSize: 14 }}>Custom / DIY</p>
              <p style={{ fontSize: 10, color: '#6B7280', marginTop: 2 }}>Build from scratch</p>
            </div>
          </div>
          
          <div style={{ marginTop: 24 }}>
            <button className="btn-primary" onClick={() => setStep(2)}>
              Continue <ChevronRight size={18} />
            </button>
          </div>
        </div>
      ) : (
        <div className="slide-up">
          <button 
            onClick={() => setStep(1)} 
            style={{ background: 'none', display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: '#6B7280', marginBottom: 20 }}
          >
            <ArrowLeft size={16} /> Back to styles
          </button>
          
          <p style={{ fontWeight: 700, marginBottom: 16 }}>{selectedPreset === 'Custom' ? 'Design your split:' : 'Verify your split:'}</p>
          
          {DAYS.map(day => (
            <div key={day} style={{ marginBottom: 20, background: '#F9FAFB', padding: 12, borderRadius: 12 }}>
              <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>{day}</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {MUSCLE_GROUPS.map(m => {
                  const isActive = selectedPreset !== 'Custom' ? PRESETS[selectedPreset][day].includes(m) : customRoutine[day].includes(m);
                  return (
                    <button 
                      key={m} 
                      className={`macro-chip ${isActive ? 'active' : ''}`}
                      style={{ 
                        fontSize: 11,
                        background: isActive ? '#C6F135' : '#fff',
                        color: isActive ? '#1A1A1A' : '#6B7280',
                        border: isActive ? 'none' : '1px solid #E5E7EB',
                        cursor: selectedPreset !== 'Custom' ? 'default' : 'pointer'
                      }}
                      onClick={() => selectedPreset === 'Custom' && handleToggleMuscle(day, m)}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div style={{ marginTop: 24 }}>
            <button className="btn-primary" onClick={finish}>
              Finish & Build Routine <Check size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
