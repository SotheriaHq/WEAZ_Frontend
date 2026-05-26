import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStoreSetupStatus } from '@/hooks/useStoreSetupStatus';
import IslandBottomNav from '@/components/navigation/IslandBottomNav';
import { messagingApi } from '@/api/MessagingApi';
import { useRealtime } from '@/realtime/RealtimeProvider';

interface StudioSidebarProps {
  active: string;
  onSelect: (key: string) => void;
}

const ALL_ITEMS = [
  { key: 'reviews', label: 'Reviews', path: '/studio?tab=reviews', emoji: '⭐', requiresSetup: true },
  { key: 'overview', label: 'Dashboard', path: '/studio', emoji: '📊', requiresSetup: true },
  { key: 'store', label: 'Store', path: '/studio/store', emoji: '🛍️', requiresSetup: false },
  { key: 'orders', label: 'Orders', path: '/studio?tab=orders', emoji: '📦', requiresSetup: true },
  { key: 'messages', label: 'Messages', path: '/studio/messages', emoji: '💬', requiresSetup: true },
  { key: 'staff', label: 'Staff', path: '/studio/staff', emoji: '👥', requiresSetup: true },
  { key: 'customers', label: 'Customers', path: '/studio?tab=customers', emoji: '👥', requiresSetup: true },
  { key: 'analytics', label: 'Analytics', path: '/studio?tab=analytics', emoji: '📈', requiresSetup: true },
  { key: 'finance', label: 'Finance', path: '/studio?tab=finance', emoji: '💰', requiresSetup: true },
];

export const StudioSidebar: React.FC<StudioSidebarProps> = ({ active, onSelect }) => {
  const navigate = useNavigate();
  const storeSetupComplete = useStoreSetupStatus();
  const isSetupLocked = storeSetupComplete === false;
  const groups = [{ title: 'Studio', items: ALL_ITEMS }];
  const [unreadMessages, setUnreadMessages] = useState(0);
  const { onNotification, onMessageEvent } = useRealtime();

  const refreshUnreadCount = useCallback(() => {
    messagingApi.getUnreadCount().then((res) => {
      setUnreadMessages(Number(res?.unreadCount ?? 0));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    messagingApi.getUnreadCount().then((res) => {
      if (!cancelled) setUnreadMessages(Number(res?.unreadCount ?? 0));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Listen to direct socket events (immediate, no worker dependency)
  useEffect(() => {
    const unsub1 = onMessageEvent('message.created', refreshUnreadCount);
    const unsub2 = onMessageEvent('thread.updated', refreshUnreadCount);
    return () => { unsub1(); unsub2(); };
  }, [onMessageEvent, refreshUnreadCount]);

  // Also listen to notification.created as a fallback for missed events
  useEffect(() => {
    const unsub = onNotification((payload: any) => {
      const type = String(payload?.type ?? '');
      if (type === 'MESSAGE_RECEIVED' || type === 'MESSAGE_UNREAD_REMINDER') {
        refreshUnreadCount();
      }
    });
    return unsub;
  }, [onNotification, refreshUnreadCount]);

  const handleSelect = (key: string, path: string) => {
    onSelect(key);
    navigate(path);
  };

  const flatItems = groups.flatMap((group) => group.items);

  return (
    <>
      <aside className="hidden lg:block fixed left-0 top-16 h-[calc(100vh-64px)] w-[220px] z-20 overflow-y-auto scrollbar-hide border-r border-purple-200/20 dark:border-white/10 bg-transparent">
        <div className="py-4 px-2">
          <div className="px-3 mb-4">
            <h2 className="text-sm font-bold text-black dark:text-white uppercase tracking-wider">Studio</h2>
          </div>

          <nav className="space-y-1">
            {groups.map((group) => (
              <div key={group.title}>
                <div className="space-y-1">
                  {group.items.map(({ key, label, path, emoji, requiresSetup }) => {
                    const isActive = active === key;
                    const isLocked = isSetupLocked && requiresSetup;

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
                        <span className="text-sm truncate flex-1">{label}</span>
                        {key === 'messages' && unreadMessages > 0 && (
                          <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 leading-none">
                            {unreadMessages > 99 ? '99+' : unreadMessages}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>

      <IslandBottomNav
        ariaLabel="Studio navigation"
        maxWidthClassName="max-w-[560px]"
        items={flatItems.map(({ key, label, path, emoji, requiresSetup }) => ({
          key,
          label,
          path,
          emoji: key === 'messages' && unreadMessages > 0 ? (
            <span className="relative inline-flex">
              <span>{emoji}</span>
              <span className="absolute -top-1.5 -right-2 min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-0.5 leading-none">
                {unreadMessages > 99 ? '99+' : unreadMessages}
              </span>
            </span>
          ) : emoji,
          active: active === key,
          disabled: Boolean(isSetupLocked && requiresSetup),
        }))}
        onSelect={(item) => {
          if (item.disabled) return;
          handleSelect(item.key, item.path);
        }}
      />
    </>
  );
};

export default StudioSidebar;
