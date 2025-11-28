import React from 'react';
import { User, Bell, Shield, CreditCard, SlidersHorizontal, FolderLock } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface SettingsSidebarProps {
  active: string;
  onSelect: (key: string) => void;
}

const items = [
  { key: 'account', label: 'Account', icon: User, path: '/settings' },
  { key: 'collections', label: 'Collections', icon: FolderLock, path: '/settings/collections' },
  { key: 'notifications', label: 'Notifications', icon: Bell, path: '/settings' },
  { key: 'privacy', label: 'Privacy', icon: Shield, path: '/settings' },
  { key: 'billing', label: 'Billing & payments', icon: CreditCard, path: '/settings' },
  { key: 'advanced', label: 'Advanced', icon: SlidersHorizontal, path: '/settings' },
];

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({ active, onSelect }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleSelect = (key: string, path: string) => {
    if (key === 'collections') {
      navigate(path);
    } else {
      onSelect(key);
    }
  };

  // Determine active based on current path for collections
  const getActive = (key: string, path: string) => {
    if (key === 'collections' && location.pathname === '/settings/collections') {
      return true;
    }
    return active === key;
  };

  return (
    <aside className="hidden md:block fixed left-0 top-16 h-[calc(100vh-64px)] w-[280px] bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-white/10 z-20 lg:left-[64px] pt-4 lg:pt-0">
      <div className="px-4 py-6 border-b border-gray-200 dark:border-white/10">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Settings</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Manage your account and preferences</p>
      </div>
      <nav className="px-2 py-4 space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
        {items.map(({ key, label, icon: Icon, path }) => {
          const isActive = getActive(key, path);
          return (
            <button
              key={key}
              onClick={() => handleSelect(key, path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-br from-purple-600/70 via-fuchsia-600/60 to-indigo-600/70 text-white shadow-md backdrop-blur-md'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
};

export default SettingsSidebar;
