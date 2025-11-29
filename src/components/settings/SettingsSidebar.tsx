import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface SettingsSidebarProps {
  active: string;
  onSelect: (key: string) => void;
}

const groups = [
  {
    title: 'Account',
    items: [
      { key: 'account', label: 'Account', path: '/settings' },
      { key: 'notifications', label: 'Notifications', path: '/settings' },
      { key: 'playback', label: 'Playback and performance', path: '/settings' },
      { key: 'downloads', label: 'Downloads', path: '/settings' },
      { key: 'privacy', label: 'Privacy', path: '/settings' },
      { key: 'connected', label: 'Connected apps', path: '/settings' },
      { key: 'billing', label: 'Billing & payments', path: '/settings' },
      { key: 'advanced', label: 'Advanced settings', path: '/settings' },
    ]
  },
  {
    title: 'Brand Management',
    items: [
      { key: 'brand-profile', label: 'Brand Profile', path: '/settings' },
      { key: 'patches', label: 'Brand Patches', path: '/settings' },
      { key: 'subscriptions', label: 'Subscriptions', path: '/settings' },
    ]
  }
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

  return (
    <aside className="hidden md:block fixed left-0 top-16 h-[calc(100vh-64px)] w-[240px] bg-white dark:bg-[#0f0f0f] z-20 overflow-y-auto scrollbar-hide">
      <div className="py-4">
        <h2 className="px-4 text-xl font-semibold text-gray-900 dark:text-white mb-4">Settings</h2>
        
        <nav className="space-y-6">
          {groups.map((group) => (
            <div key={group.title}>
              <div className="space-y-0">
                {group.items.map(({ key, label, path }) => {
                  const isActive = active === key;
                  return (
                    <button
                      key={key}
                      onClick={() => handleSelect(key, path)}
                      className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                        isActive
                          ? 'font-medium text-primary border-l-4 border-primary bg-primary/10' // Primary color active state
                          : 'text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="border-t border-gray-200 dark:border-gray-800 my-2 mx-4" />
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
};

export default SettingsSidebar;
