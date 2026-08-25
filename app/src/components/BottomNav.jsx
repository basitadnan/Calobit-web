import { useApp } from '../contexts/AppContext';
import { Home, CalendarDays, Plus, Dumbbell, User } from 'lucide-react';

const LEFT_TABS = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'activity', icon: CalendarDays, label: 'Activity' },
];

const RIGHT_TABS = [
  { id: 'gym', icon: Dumbbell, label: 'Workout' },
  { id: 'settings', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  const { currentTab, setCurrentTab, openAddFood } = useApp();

  const renderTab = tab => {
    const Icon = tab.icon;
    const active = currentTab === tab.id;
    return (
      <button key={tab.id} className={`nav-item ${active ? 'active' : ''}`} onClick={() => setCurrentTab(tab.id)}>
        <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
        <span>{tab.label}</span>
      </button>
    );
  };

  return (
    <nav className="bottom-nav">
      {LEFT_TABS.map(renderTab)}
      <button className="nav-center-btn" onClick={() => openAddFood()} aria-label="Add food">
        <Plus size={24} color="#1A1A1A" strokeWidth={2.5} />
      </button>
      {RIGHT_TABS.map(renderTab)}
    </nav>
  );
}