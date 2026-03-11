import React from 'react';
import { useNavigate } from 'react-router-dom';

interface StudioSidebarProps {
  active: string;
  onSelect: (key: string) => void;
}

const groups = [
  {
    title: 'Studio',
    items: [
      { key: 'overview', label: 'Dashboard', path: '/studio', emoji: '📊' },
      { key: 'store', label: 'Store', path: '/studio/store', emoji: '🛍️' },
      { key: 'orders', label: 'Orders', path: '/studio?tab=orders', emoji: '📦' },
      { key: 'customers', label: 'Customers', path: '/studio?tab=customers', emoji: '👥' },
      { key: 'analytics', label: 'Analytics', path: '/studio?tab=analytics', emoji: '📈' },
      { key: 'finance', label: 'Finance', path: '/studio?tab=finance', emoji: '💰' },
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
    <aside className="hidden md:block fixed left-0 top-16 h-[calc(100vh-64px)] w-[200px] z-20 overflow-y-auto scrollbar-hide border-r border-purple-200/20 dark:border-white/10 bg-transparent">
      <div className="py-4 px-2">
        <div className="px-3 mb-4">
          <h2 className="text-sm font-bold text-black dark:text-white uppercase tracking-wider">Studio</h2>
        </div>
        
        <nav className="space-y-1">
          {groups.map((group) => (
            <div key={group.title}>
              <div className="space-y-1">
                {group.items.map(({ key, label, path, emoji }) => {
                  const isActive = active === key;

                  return (
                    <button
                      key={key}
                      onClick={() => handleSelect(key, path)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-150 flex items-center gap-2 group ${
                        isActive
                          ? 'font-medium text-primary border-l-4 border-primary bg-primary/10' 
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <span className="text-base">{emoji}</span>
                      <span className="text-sm">{label}</span>
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
