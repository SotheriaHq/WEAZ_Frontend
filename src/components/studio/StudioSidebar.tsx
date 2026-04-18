import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStoreSetupStatus } from '@/hooks/useStoreSetupStatus';

interface StudioSidebarProps {
  active: string;
  onSelect: (key: string) => void;
}

const ALL_ITEMS = [
  { key: 'overview', label: 'Dashboard', path: '/studio', emoji: '📊', requiresSetup: true },
  { key: 'store', label: 'Store', path: '/studio/store', emoji: '🛍️', requiresSetup: false },
  { key: 'orders', label: 'Orders', path: '/studio?tab=orders', emoji: '📦', requiresSetup: false },
  { key: 'messages', label: 'Messages', path: '/studio/messages', emoji: '💬', requiresSetup: true },
  { key: 'customers', label: 'Customers', path: '/studio?tab=customers', emoji: '👥', requiresSetup: false },
  { key: 'analytics', label: 'Analytics', path: '/studio?tab=analytics', emoji: '📈', requiresSetup: false },
  { key: 'finance', label: 'Finance', path: '/studio?tab=finance', emoji: '💰', requiresSetup: false },
];

export const StudioSidebar: React.FC<StudioSidebarProps> = ({ active, onSelect }) => {
  const navigate = useNavigate();
  const storeSetupComplete = useStoreSetupStatus();
  const isSetupLocked = storeSetupComplete === false;
  const groups = [{ title: 'Studio', items: ALL_ITEMS }];

  const handleSelect = (key: string, path: string) => {
    onSelect(key);
    navigate(path);
  };

  const flatItems = groups.flatMap((group) => group.items);

  return (
    <>
      <aside className="hidden xl:block fixed left-0 top-16 h-[calc(100vh-64px)] w-[220px] z-20 overflow-y-auto scrollbar-hide border-r border-purple-200/20 dark:border-white/10 bg-transparent">
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
                    const isLocked = isSetupLocked && ALL_ITEMS.find((item) => item.key === key)?.requiresSetup;

                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={Boolean(isLocked)}
                        onClick={() => {
                          if (!isLocked) {
                            handleSelect(key, path);
                          }
                        }}
                        className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-all duration-150 flex items-center gap-2 group ${
                          isLocked
                            ? 'cursor-not-allowed opacity-50'
                            : isActive
                            ? 'font-medium text-primary border-l-4 border-primary bg-primary/10'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                        title={isLocked ? 'Complete store setup to unlock this section' : label}
                      >
                        <span className="text-base leading-none">{emoji}</span>
                        <span className="text-sm truncate">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>

      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-gray-200/70 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 shadow-[0_-6px_18px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-black/85">
        <div className="mx-auto flex max-w-4xl items-stretch gap-1 overflow-x-auto scrollbar-hide">
          {flatItems.map(({ key, label, path, emoji }) => {
            const isActive = active === key;
            const isLocked = isSetupLocked && ALL_ITEMS.find((item) => item.key === key)?.requiresSetup;
            return (
              <button
                key={key}
                type="button"
                disabled={Boolean(isLocked)}
                onClick={() => {
                  if (!isLocked) {
                    handleSelect(key, path);
                  }
                }}
                className={`flex min-w-[74px] flex-1 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-medium transition-colors ${
                  isLocked
                    ? 'cursor-not-allowed opacity-50'
                    : isActive
                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10'
                }`}
                aria-label={label}
                title={label}
              >
                <span className="text-lg leading-none" aria-hidden="true">{emoji}</span>
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default StudioSidebar;
