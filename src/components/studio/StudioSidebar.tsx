import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStoreSetupStatus } from '@/hooks/useStoreSetupStatus';
import IslandBottomNav from '@/components/navigation/IslandBottomNav';
import { useMessagingUnreadCount } from '@/hooks/useMessagingUnreadCount';

interface StudioSidebarProps {
  active: string;
  onSelect: (key: string) => void;
}

const ALL_ITEMS = [
  { key: 'overview', label: 'Dashboard', path: '/studio', emoji: '📊', requiresSetup: true },
  { key: 'store', label: 'Store', path: '/studio/store', emoji: '🛍️', requiresSetup: false },
  { key: 'reviews', label: 'Reviews', path: '/studio?tab=reviews', emoji: '⭐', requiresSetup: true },
  { key: 'orders', label: 'Orders', path: '/studio?tab=orders', emoji: '📦', requiresSetup: true },
  { key: 'messages', label: 'Messages', path: '/studio/messages', emoji: '💬', requiresSetup: true },
  { key: 'staff', label: 'Staff', path: '/studio/staff', emoji: '👥', requiresSetup: true },
  { key: 'customers', label: 'Customers', path: '/studio?tab=customers', emoji: '👥', requiresSetup: true },
  { key: 'analytics', label: 'Analytics', path: '/studio?tab=analytics', emoji: '📈', requiresSetup: true },
  { key: 'finance', label: 'Finance', path: '/studio?tab=finance', emoji: '💰', requiresSetup: true },
];

/**
 * Studio sections that only earn a slot on the desktop sidebar.
 *
 * `ALL_ITEMS` drives two very different surfaces: a 220px vertical `<aside>`
 * with room for nine labelled rows, and the island dock — a single phone-width
 * strip where every extra chip shrinks the ones that matter. Reviews and Staff
 * are deliberate, low-frequency, read-mostly destinations a brand opens from a
 * desk; they are not what anyone reaches for one-handed mid-task.
 *
 * They stay in the aside untouched. This list only withholds them where
 * horizontal space is the binding constraint.
 */
const DESKTOP_ONLY_ITEM_KEYS = new Set(['reviews', 'staff']);

export const StudioSidebar: React.FC<StudioSidebarProps> = ({ active, onSelect }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const storeSetupComplete = useStoreSetupStatus();
  /**
   * Being ON a setup route is proof that setup is unfinished, and it needs no
   * network to know it.
   *
   * `useStoreSetupStatus` is the right general signal but it cannot lock
   * anything while it is undecided: it returns `null` in flight and `true` on
   * error (deliberately — a failed /store/status must never strand a live
   * store). Both leave `=== false` unmet, so during the exact window a brand
   * is working through setup on a slow or flaky connection, every nav item
   * stayed clickable and they could wander out of the flow into sections that
   * have nothing to show yet.
   *
   * The route removes that window. `RequireStoreSetup` would only bounce them
   * back anyway; this stops the trip being offered.
   */
  const isOnSetupRoute = location.pathname.startsWith('/studio/store/setup')
    || location.pathname.startsWith('/studio/store/essentials');
  const isSetupLocked = storeSetupComplete === false || isOnSetupRoute;
  const groups = [{ title: 'Studio', items: ALL_ITEMS }];
  // Shared with the main SideBar so both badges move together — and so the
  // count also DROPS on `message.read`, which the local copy never listened for.
  const { unreadCount: unreadMessages } = useMessagingUnreadCount();

  const handleSelect = (key: string, path: string, options?: { replace?: boolean }) => {
    onSelect(key);
    navigate(path, options);
  };

  // Dock-only list. The aside above still renders `groups` in full.
  const flatItems = groups
    .flatMap((group) => group.items)
    .filter((item) => !DESKTOP_ONLY_ITEM_KEYS.has(item.key));

  return (
    <>
      <aside className="hidden lg:block fixed left-0 top-20 z-20 h-[calc(100vh-5rem)] w-[220px] overflow-y-auto scrollbar-hide border-r border-purple-200/20 dark:border-white/10 bg-[color:var(--surface-primary)]">
        <div className="py-4">
          <div className="px-4 mb-4">
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
                        className={`group flex w-full items-center gap-2.5 border-l-[3px] px-4 py-2.5 text-left text-sm transition-colors ${
                          isLocked
                            ? 'cursor-not-allowed border-transparent opacity-50'
                            : isActive
                              ? 'border-primary bg-primary/10 font-medium text-primary'
                              : 'border-transparent text-gray-700 hover:bg-gray-100 hover:text-black dark:text-gray-300 dark:hover:bg-white/5 dark:hover:text-white'
                        }`}
                        title={isLocked ? 'Complete store setup to unlock this section' : label}
                      >
                        <span className="shrink-0 text-base leading-none">{emoji}</span>
                        <span className="flex-1 truncate">{label}</span>
                        {key === 'messages' && unreadMessages > 0 && (
                          <span className="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
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
          // Dock tab switches replace history — phone/tablet back should exit
          // quickly, not replay every tab hop.
          handleSelect(item.key, item.path, { replace: true });
        }}
      />
    </>
  );
};

export default StudioSidebar;
