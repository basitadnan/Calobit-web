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

function App() {
  const { onboarded, currentTab, currentUser, addFlow } = useApp();

  if (!currentUser) {
    return <Auth />;
  }

  if (!onboarded) return <Onboarding />;

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
      {renderTab()}
      <BottomNav />
      {addFlow.open && <AddFoodFlow />}
      <UpdateBanner />
    </>
  );
}

export default App;
