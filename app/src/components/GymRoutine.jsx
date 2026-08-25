import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import { Check, Plus, Timer, Edit2, Copy, Trash2, ChevronDown, ChevronUp, Play } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function GymRoutine() {
  const { routine, saveRoutine, logWorkout, workoutLogs } = useApp();
  const [selectedDay, setSelectedDay] = useState(DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]);
  const [workoutStarted, setWorkoutStarted] = useState(false);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [restTimer, setRestTimer] = useState(null);
  const [restTimeLeft, setRestTimeLeft] = useState(0);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newEx, setNewEx] = useState({ name: '', sets: 3, reps: '10-12' });

  const dayRoutine = routine[selectedDay] || { muscles: ['Rest'], exercises: [] };
  const safeExercises = dayRoutine.exercises || [];
  const doneCount = safeExercises.filter(e => e.done).length;
  const totalCount = safeExercises.length;
  const progressPercent = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  useEffect(() => {
    let interval;
    if (workoutStarted) {
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [workoutStarted, startTime]);

  useEffect(() => {
    let interval;
    if (restTimeLeft > 0) {
      interval = setInterval(() => setRestTimeLeft(prev => prev - 1), 1000);
    } else {
      setRestTimer(null);
    }
    return () => clearInterval(interval);
  }, [restTimeLeft]);

  const toggleExercise = (id) => {
    const nextExercises = safeExercises.map(e => {
      if (e.id === id) {
        const isDone = !e.done;
        if (isDone) {
          setRestTimeLeft(60);
          setRestTimer(true);
          if (!workoutStarted) {
            setWorkoutStarted(true);
            setStartTime(Date.now());
          }
        }
        return { ...e, done: isDone };
      }
      return e;
    });
    saveRoutine({ ...routine, [selectedDay]: { ...dayRoutine, exercises: nextExercises } });
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const rs = s % 60;
    return `${m}:${rs.toString().padStart(2, '0')}`;
  };

  const handleComplete = () => {
    logWorkout({
      day: selectedDay,
      muscles: dayRoutine.muscles || ['Rest'],
      exercises: safeExercises,
      duration: elapsed,
      date: new Date().toISOString()
    });
    // Reset exercises for next week but KEEP them in the routine
    const resetExercises = safeExercises.map(e => ({ ...e, done: false }));
    saveRoutine({ ...routine, [selectedDay]: { ...dayRoutine, exercises: resetExercises } });
    setWorkoutStarted(false);
    setElapsed(0);
    alert('Workout Logged! 🏆 Your routine is saved for next week.');
  };

  const addExercise = () => {
    if (!newEx.name) return;
    const nextExercises = [...safeExercises, { ...newEx, id: Date.now().toString(), done: false }];
    saveRoutine({ ...routine, [selectedDay]: { ...dayRoutine, exercises: nextExercises } });
    setShowAddModal(false);
    setNewEx({ name: '', sets: 3, reps: '10-12' });
  };

  const removeExercise = (id) => {
    const nextExercises = safeExercises.filter(e => e.id !== id);
    saveRoutine({ ...routine, [selectedDay]: { ...dayRoutine, exercises: nextExercises } });
  };

  const updateWeight = (id, weight) => {
    const exerciseToUpdate = safeExercises.find(e => e.id === id);
    if (!exerciseToUpdate) return;
    const targetName = exerciseToUpdate.name.toLowerCase().trim();

    const updatedRoutine = { ...routine };
    Object.keys(updatedRoutine).forEach(day => {
      if (updatedRoutine[day]?.exercises) {
        updatedRoutine[day].exercises = updatedRoutine[day].exercises.map(e => {
          if (e.id === id || e.name.toLowerCase().trim() === targetName) {
            return { ...e, weight };
          }
          return e;
        });
      }
    });

    saveRoutine(updatedRoutine);
  };

  const getLastWeight = (exerciseName) => {
    if (!exerciseName) return null;
    const target = exerciseName.toLowerCase().trim();
    for (let i = workoutLogs.length - 1; i >= 0; i--) {
      const log = workoutLogs[i];
      const ex = (log.exercises || []).find(e => e.name.toLowerCase().trim() === target && e.weight);
      if (ex) return ex.weight;
    }
    return null;
  };

  return (
    <div className="slide-up">
      {/* Weekly Strip */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 16, marginBottom: 20 }}>
        {DAYS.map(day => {
          const isSelected = selectedDay === day;
          const isRest = routine[day]?.muscles?.includes('Rest');
          return (
            <button 
              key={day} 
              onClick={() => setSelectedDay(day)}
              style={{ 
                minWidth: 60, 
                padding: '12px 8px', 
                borderRadius: 16, 
                background: isSelected ? '#C6F135' : '#F9FAFB',
                border: isSelected ? 'none' : '1px solid #E5E7EB',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                position: 'relative'
              }}
            >
              <span style={{ fontSize: 10, color: isSelected ? '#1A1A1A' : '#6B7280', fontWeight: 700 }}>{day.slice(0, 3)}</span>
              <span style={{ fontSize: 16 }}>{isRest ? '😴' : '💪'}</span>
              {routine[day]?.exercises?.every(e => e.done) && routine[day]?.exercises?.length > 0 && (
                <div style={{ background: '#C6F135', borderRadius: '50%', padding: 2, position: 'absolute', top: -5, right: -5 }}>
                  <Check size={10} color="#1A1A1A" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Day Header */}
      <div className="card" style={{ marginBottom: 20, position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800 }}>{selectedDay}</h2>
            <p style={{ color: '#6B7280', fontSize: 14 }}>{(dayRoutine.muscles || ['Rest']).join(' + ')}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="food-action"><Edit2 size={16} /></button>
            <button className="food-action"><Copy size={16} /></button>
          </div>
        </div>

        {totalCount > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span>{doneCount} / {totalCount} exercises done</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="progress-bar">
              <div className="fill" style={{ width: `${progressPercent}%`, background: '#C6F135' }} />
            </div>
          </div>
        )}

        {workoutStarted && (
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, color: '#1A1A1A', fontWeight: 700 }}>
            <Timer size={16} color="#C6F135" /> Workout: {formatTime(elapsed)}
          </div>
        )}
      </div>

      {/* Rest Timer Overlay */}
      {restTimer && (
        <div className="fade-in" style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 100, background: '#1A1A1A', color: '#fff', padding: '10px 20px', borderRadius: 30, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#C6F135' }}>{formatTime(restTimeLeft)}</div>
          <div style={{ fontSize: 12 }}>Resting...</div>
          <button onClick={() => setRestTimeLeft(0)} style={{ background: '#333', border: 'none', color: '#fff', borderRadius: 20, padding: '4px 10px', fontSize: 10 }}>Skip</button>
        </div>
      )}

      {/* Exercise List */}
      <div style={{ display: 'grid', gap: 12 }}>
        {safeExercises.map(ex => (
          <div key={ex.id} className="card" style={{ opacity: ex.done ? 0.6 : 1, position: 'relative' }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                onClick={() => toggleExercise(ex.id)}
                style={{ 
                  width: 24, height: 24, borderRadius: 6, 
                  border: ex.done ? 'none' : '2px solid #E5E7EB',
                  background: ex.done ? '#C6F135' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                {ex.done && <Check size={16} color="#1A1A1A" />}
              </button>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <p style={{ fontWeight: 700, textDecoration: ex.done ? 'line-through' : 'none' }}>{ex.name}</p>
                  <button onClick={() => removeExercise(ex.id)} style={{ background: 'none', color: '#9CA3AF' }}><Trash2 size={14} /></button>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <p style={{ fontSize: 12, color: '#6B7280' }}>Target: {ex.sets} × {ex.reps}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {getLastWeight(ex.name) && (
                      <span style={{ fontSize: 10, color: '#C6F135', fontWeight: 700, background: '#1A1A1A', padding: '2px 6px', borderRadius: 4 }}>
                        Prev: {getLastWeight(ex.name)}
                      </span>
                    )}
                    <input 
                      type="number" 
                      placeholder="--" 
                      value={ex.weight || ''}
                      onChange={(e) => updateWeight(ex.id, e.target.value)}
                      style={{ background: '#F3F4F6', border: '1px solid #E5E7EB', padding: '4px 8px', borderRadius: 6, width: 50, fontSize: 12, textAlign: 'center' }}
                    />
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>weight</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        <button 
          className="card" 
          onClick={() => setShowAddModal(true)}
          style={{ border: '2px dashed #E5E7EB', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#6B7280' }}
        >
          <Plus size={18} /> Add Exercise
        </button>

        {/* Add Exercise Modal */}
        {showAddModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
            <div className="slide-up" style={{ width: '100%', background: '#fff', borderRadius: '24px 24px 0 0', padding: 24 }}>
              <p style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Add Exercise</p>
              <div className="form-group">
                <label>Exercise Name</label>
                <input className="input-field" autoFocus value={newEx.name} onChange={e => setNewEx({...newEx, name: e.target.value})} placeholder="e.g. Bench Press" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Sets</label>
                  <input className="input-field" type="number" value={newEx.sets} onChange={e => setNewEx({...newEx, sets: parseInt(e.target.value) || 0})} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Reps</label>
                  <input className="input-field" value={newEx.reps} onChange={e => setNewEx({...newEx, reps: e.target.value})} />
                </div>
              </div>
              <button className="btn-primary" onClick={addExercise}>Add to Routine</button>
              <button style={{ width: '100%', padding: 12, background: 'none', color: '#6B7280' }} onClick={() => setShowAddModal(false)}>Cancel</button>
            </div>
          </div>
        )}

        {doneCount > 0 && (
          <button className="btn-primary" onClick={handleComplete} style={{ marginTop: 20 }}>
            Complete Workout ✓
          </button>
        )}
      </div>
    </div>
  );
}
