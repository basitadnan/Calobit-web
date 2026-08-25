import { useState } from 'react';
import { Scale, TrendingDown, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useApp } from '../contexts/AppContext';
import { getWeights, saveWeight, getDateStr } from '../utils/storage';

export default function WeightCard() {
  const { profile } = useApp();
  const [weights, setWeights] = useState(() => getWeights());
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const todayStr = getDateStr();
  const todayEntry = weights.find((w) => w.date === todayStr);
  const latest = weights.length ? weights[weights.length - 1] : null;
  const first = weights.length ? weights[0] : null;
  const totalChange = latest && first && weights.length > 1 ? latest.weight - first.weight : null;

  const chartData = weights.slice(-14).map((w) => ({
    date: w.date.slice(5),
    weight: w.weight,
  }));

  const save = () => {
    const kg = parseFloat(input);
    setError('');
    if (!kg || kg < 25 || kg > 400) {
      setError('Enter a weight between 25 and 400 kg');
      return;
    }
    setWeights(saveWeight(todayStr, Math.round(kg * 10) / 10));
    setInput('');
  };

  return (
    <div className="insight-card slide-up">
      <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
        <Scale size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />Weight Tracker
      </h3>

      {latest ? (
        <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>
          Latest: <strong style={{ color: '#1A1A1A' }}>{latest.weight} kg</strong>
          {' '}· {totalChange !== null && (
            <>
              {totalChange >= 0 ? <TrendingUp size={13} style={{ verticalAlign: 'text-bottom' }} />
                : <TrendingDown size={13} style={{ verticalAlign: 'text-bottom' }} />}
              {' '}{totalChange > 0 ? '+' : ''}{totalChange.toFixed(1)} kg all-time
            </>
          )}
          {profile?.goal === 'lose' && ' · cutting'}
          {profile?.goal === 'gain' && ' · bulking'}
        </p>
      ) : (
        <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>
          Weigh yourself regularly — the weekly report uses this to adapt your calories.
        </p>
      )}

      {chartData.length >= 2 ? (
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={chartData} margin={{ top: 6, right: 6, bottom: 0, left: -18 }}>
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6B7280' }} />
            <YAxis domain={['dataMin - 1', 'dataMax + 1']} axisLine={false} tickLine={false}
              tick={{ fontSize: 10, fill: '#6B7280' }} />
            <Tooltip
              contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 13 }}
              formatter={(v) => [`${v} kg`, 'Weight']}
            />
            <Line type="monotone" dataKey="weight" stroke="#14B8A6" strokeWidth={2}
              dot={{ r: 3, fill: '#14B8A6' }} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        chartData.length === 1 && (
          <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>
            One weigh-in recorded — log again after a few days to see your trend line.
          </p>
        )
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <input
          className="input-field"
          type="number"
          step="0.1"
          inputMode="decimal"
          placeholder={`Today's weight (kg)${latest ? ` — last: ${latest.weight}` : ''}`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ flex: 1 }}
        />
        <button className="btn-primary" onClick={save} style={{ width: 'auto', padding: '0 18px' }}>
          {todayEntry ? 'Update' : 'Log'}
        </button>
      </div>
      {error && <p style={{ fontSize: 12, color: '#EF4444', marginTop: 6 }}>{error}</p>}
      {todayEntry && !error && (
        <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>Logged for today — weigh in again tomorrow.</p>
      )}
    </div>
  );
}
