import React from 'react';
import { useNavigate } from 'react-router-dom';

interface StudioSidebarProps {
  active: string;
  onSelect: (key: string) => void;
}

const groups = [
  {
    title: 'Management',
    items: [
      { key: 'overview', label: 'Overview', path: '/studio?tab=overview' },
      { key: 'orders', label: 'Orders', path: '/studio?tab=orders' },
      { key: 'analytics', label: 'Analytics', path: '/studio?tab=analytics' },
      { key: 'finance', label: 'Finance', path: '/studio?tab=finance' },
      { key: 'settings', label: 'Settings', path: '/studio?tab=settings' },
    ]
  }
];

export const StudioSidebar: React.FC<StudioSidebarProps> = ({ active, onSelect }) => {
  const navigate = useNavigate();

  const handleSelect = (key: string, path: string) => {
    onSelect(key);
    navigate(path);
  };

  return (
    <aside className="hidden md:block fixed left-0 top-16 h-[calc(100vh-64px)] w-[240px] bg-white dark:bg-[#0f0f0f] z-20 overflow-y-auto scrollbar-hide border-r border-gray-100 dark:border-gray-800">
      <div className="py-6 px-3">
        <h2 className="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Studio Management</h2>
        
        <nav className="space-y-1">
          {groups.map((group) => (
            <div key={group.title}>
              <div className="space-y-1">
                {group.items.map(({ key, label, path }) => {
                  const isActive = active === key;
                  // Map keys to emojis
                  const emoji = 
                    key === 'overview' ? '📊' :
                    key === 'orders' ? '📦' :
                    key === 'analytics' ? '📈' :
                    key === 'finance' ? '💰' :
                    key === 'settings' ? '⚙️' : '📄';

                  return (
                    <button
                      key={key}
                      onClick={() => handleSelect(key, path)}
                      className={`w-full text-left px-4 py-2.5 text-sm rounded-xl transition-all duration-200 flex items-center gap-3 ${
                        isActive
                          ? 'bg-black text-white dark:bg-white dark:text-black font-medium shadow-md transform scale-[1.02]' 
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      <span className="text-lg">{emoji}</span>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
};

export default StudioSidebar;
