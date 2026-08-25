import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Trophy, TrendingUp, History, Dumbbell } from 'lucide-react';

export default function GymProgress() {
  const { workoutLogs } = useApp();

  const capitalize = (str) => str.replace(/\b\w/g, l => l.toUpperCase());

  const allExercises = Array.from(new Set(
    workoutLogs.flatMap(log => log.exercises.filter(e => e.weight).map(e => e.name.toLowerCase().trim()))
  )).map(capitalize);

  const [selectedEx, setSelectedEx] = useState(allExercises[0] || '');

  const chartData = workoutLogs.map(log => {
    const ex = log.exercises.find(e => e.name.toLowerCase().trim() === selectedEx.toLowerCase().trim() && e.weight);
    if (!ex) return null;
    return {
      date: new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      weight: parseFloat(ex.weight)
    };
  }).filter(Boolean);

  return (
    <div className="slide-up">
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={18} color="#C6F135" />
            <span style={{ fontWeight: 700 }}>Progression</span>
          </div>
          {allExercises.length > 0 && (
            <select 
              value={selectedEx} 
              onChange={e => setSelectedEx(e.target.value)}
              style={{ padding: '4px 8px', borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12, outline: 'none' }}
            >
              {allExercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}
            </select>
          )}
        </div>
        <div style={{ height: 200, width: '100%' }}>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} style={{ fontSize: 10 }} />
                <YAxis hide domain={['dataMin - 5', 'dataMax + 5']} />
                <Tooltip 
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  itemStyle={{ color: '#C6F135', fontWeight: 700 }}
                  formatter={(val) => [`${val} weight`, 'Hit']}
                />
                <Line 
                  type="monotone" 
                  dataKey="weight" 
                  stroke="#C6F135" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#C6F135', strokeWidth: 2, stroke: '#fff' }} 
                  activeDot={{ r: 6, fill: '#1A1A1A' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 14 }}>
              <Dumbbell size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
              Log weights to see progression
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <Trophy size={24} color="#F59E0B" style={{ margin: '0 auto 8px' }} />
          <p style={{ fontSize: 12, color: '#6B7280' }}>Personal Bests</p>
          <p style={{ fontSize: 20, fontWeight: 800 }}>12</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <History size={24} color="#14B8A6" style={{ margin: '0 auto 8px' }} />
          <p style={{ fontSize: 12, color: '#6B7280' }}>Sessions</p>
          <p style={{ fontSize: 20, fontWeight: 800 }}>{workoutLogs.length}</p>
        </div>
      </div>

      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Recent History</h3>
      <div style={{ display: 'grid', gap: 12 }}>
        {workoutLogs.length > 0 ? [...workoutLogs].reverse().map(log => (
          <div key={log.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 700 }}>{log.day} Workout</span>
              <span style={{ fontSize: 12, color: '#6B7280' }}>{new Date(log.timestamp).toLocaleDateString()}</span>
            </div>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 8 }}>
              {log.muscles.join(' + ')} • {Math.floor(log.duration / 60)} min
            </p>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
              {log.exercises.slice(0, 3).map((ex, i) => (
                <span key={i} style={{ background: '#F3F4F6', padding: '4px 8px', borderRadius: 8, fontSize: 11, whiteSpace: 'nowrap' }}>
                  {ex.name}
                </span>
              ))}
              {log.exercises.length > 3 && <span style={{ fontSize: 11, color: '#9CA3AF' }}>+{log.exercises.length - 3} more</span>}
            </div>
          </div>
        )) : (
          <p style={{ textAlign: 'center', color: '#9CA3AF', padding: '20px 0' }}>No workouts logged yet.</p>
        )}
      </div>
    </div>
  );
}
