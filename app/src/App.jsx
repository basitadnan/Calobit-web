import { useApp } from './contexts/AppContext';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import Activity from './components/Activity';
import Insights from './components/Insights';
import Settings from './components/Settings';
import Gym from './components/Gym';
import BottomNav from './components/BottomNav';
import AddFoodFlow from './components/AddFoodFlow';
import UpdateBanner from './components/UpdateBanner';
import Auth from './components/Auth';
import { WifiOff } from 'lucide-react';

function App() {
  const { onboarded, currentTab, currentUser, addFlow, restoring } = useApp();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Wait for the persisted session check so boot never flashes the wrong
  // screen (onboarding/auth) for a split second.
  if (restoring) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB' }}>
        <div style={{ textAlign: 'center' }}>
          <img src="logo.png" alt="CaloBit" style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 14 }} />
          <p style={{ marginTop: 12, fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>CaloBit</p>
        </div>
      </div>
    );
  }

  // New users set up their profile first, then sign in with Google (the
  // onboarding data carries over via the guest-data migration on sign-in).
  if (!onboarded) return <Onboarding />;

  if (!currentUser) {
    return <Auth />;
  }

  const renderTab = () => {
    switch (currentTab) {
      case 'home': return <Dashboard />;
      case 'activity': return <Activity />;
      case 'insights': return <Insights />;
      case 'gym': return <Gym />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <>
      {!isOnline ? (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          background: '#FEF3C7', borderBottom: '1px solid #F59E0B',
          padding: '6px 12px', fontSize: 12, fontWeight: 600,
          color: '#92400E', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 6
        }}>
          <WifiOff size={14} /> You're offline — local data works, cloud features paused
        </div>
      ) : null}
      {renderTab()}
      <BottomNav />
      {addFlow.open && <AddFoodFlow />}
      <UpdateBanner />
    </>
  );
}

export default App;
