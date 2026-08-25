import { useState } from 'react';
import { useApp } from '../contexts/AppContext';
import GymSetup from './GymSetup';
import GymRoutine from './GymRoutine';
import GymProgress from './GymProgress';
import GymInsights from './GymInsights';
import GymWalk from './GymWalk';
import { Dumbbell, LineChart, Sparkles, Footprints } from 'lucide-react';

export default function Gym() {
  const { gymOnboarded } = useApp();
  const [subTab, setSubTab] = useState(gymOnboarded ? 'routine' : 'walk');

  return (
    <div className="page fade-in" style={{ paddingBottom: 100 }}>
      {/* Sub Tabs */}
      <div className="pill-tabs" style={{ marginBottom: 20, position: 'sticky', top: 0, zIndex: 10, background: '#fff', padding: '10px 0' }}>
        <button 
          className={`pill-tab ${subTab === 'routine' ? 'active' : ''}`} 
          onClick={() => setSubTab('routine')}
        >
          <Dumbbell size={16} /> Routine
        </button>
        <button 
          className={`pill-tab ${subTab === 'progress' ? 'active' : ''}`} 
          onClick={() => setSubTab('progress')}
        >
          <LineChart size={16} /> Progress
        </button>
        <button 
          className={`pill-tab ${subTab === 'insights' ? 'active' : ''}`} 
          onClick={() => setSubTab('insights')}
        >
          <Sparkles size={16} /> Insights
        </button>
        <button 
          className={`pill-tab ${subTab === 'walk' ? 'active' : ''}`} 
          onClick={() => setSubTab('walk')}
        >
          <Footprints size={16} /> Walk/Run
        </button>
      </div>

      {!gymOnboarded && subTab !== 'walk' ? (
        <GymSetup />
      ) : (
        <>
          {subTab === 'routine' && <GymRoutine />}
          {subTab === 'progress' && <GymProgress />}
          {subTab === 'insights' && <GymInsights />}
          {subTab === 'walk' && <GymWalk />}
        </>
      )}
    </div>
  );
}
