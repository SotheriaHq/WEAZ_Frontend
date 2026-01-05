/**
 * NotificationsDropdown
 *
 * - Portal-based overlay (prevents layout collisions)
 * - Named z-layer usage (no arbitrary z-index values)
 * - Viewport-bounded height with internal scrolling
 * - Keyboard accessible with focus trap
 * - Emoji glyphs (per design request)
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';
import { 
  fetchNotifications, 
  fetchUnreadCount, 
  markAllNotificationsRead, 
  markNotificationRead 
} from '@/features/notificationsSlice';
import { useNavigate } from 'react-router-dom';
import { normalizeNotification } from '@/utils/notificationAdapter';
import type { NormalizedNotification } from '@/utils/notificationAdapter';
import { determineNotificationRoute } from '@/utils/notificationRouting';
import { trackDropdownOpen, trackDropdownClose, trackMarkAllRead } from '@/utils/notificationTelemetry';
import { getTrackingCategory, NotificationTypes } from '@/types/notificationTypes';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface Props { 
  open: boolean; 
  onClose: () => void; 
  anchorRef: React.RefObject<HTMLElement>; 
}

// Set to track pending mark-read operations for idempotency
const pendingMarkIds = new Set<string>();

export const NotificationsDropdown: React.FC<Props> = ({ open, onClose, anchorRef }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { items, hasNextPage, endCursor, loadingList, unreadCount, error } = useSelector(
    (s: RootState) => s.notifications
  );
  const user = useSelector((s: RootState) => s.user.profile);
  const isAuthenticated = useSelector((s: RootState) => s.user.isAuthenticated);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'all' | 'orders' | 'social' | 'store'>('all');
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number }>({
    top: 72,
    left: 12,
    width: 420,
  });

  useEffect(() => {
    triggerRef.current = (anchorRef.current as unknown as HTMLElement | null) ?? null;
  }, [anchorRef]);

  useFocusTrap({
    active: open,
    containerRef,
    onEscape: onClose,
    restoreFocusTo: triggerRef,
  });

  // Normalize notifications for the new component model
  const normalizedItems = useMemo(() => {
    return items.map(item => normalizeNotification(item as unknown as Record<string, unknown>));
  }, [items]);

  // Reset view state when opening
  useEffect(() => {
    if (open) setActiveTab('all');
  }, [open]);

  // Compute placement below the bell, clamped within viewport
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const anchorEl = anchorRef.current;

      const padding = 12;
      const viewportW = window.innerWidth;
      const desiredWidth = Math.min(420, Math.max(280, viewportW - padding * 2));

      if (!anchorEl) {
        setPanelPos({ top: 72, left: padding, width: desiredWidth });
        return;
      }

      const rect = anchorEl.getBoundingClientRect();
      const top = Math.round(rect.bottom + 10);
      const leftAlignedRight = rect.right - desiredWidth;
      const left = Math.round(Math.min(Math.max(padding, leftAlignedRight), viewportW - desiredWidth - padding));

      setPanelPos({
        top: Math.max(padding, top),
        left,
        width: desiredWidth,
      });
    };

    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, anchorRef]);

  // Initial fetch when opening - also track telemetry
  useEffect(() => { 
    if (open && isAuthenticated) { 
      dispatch(fetchNotifications({ limit: 30 })); 
      dispatch(fetchUnreadCount());
      trackDropdownOpen();
    } 
  }, [open, isAuthenticated, dispatch]);

  // Track close
  useEffect(() => {
    if (!open) {
      trackDropdownClose();
    }
  }, [open]);

  // Outside click handler
  useEffect(() => { 
    if (!open) return; 
    
    const handler = (e: MouseEvent) => { 
      if (!containerRef.current) return; 
      if (containerRef.current.contains(e.target as Node)) return; 
      if (anchorRef.current && anchorRef.current.contains(e.target as Node)) return; 
      onClose(); 
    }; 
    
    document.addEventListener('mousedown', handler); 
    return () => document.removeEventListener('mousedown', handler); 
  }, [open, onClose, anchorRef]);

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleBodyClick = useCallback((notification: NormalizedNotification) => {
    const route = determineNotificationRoute(notification);
    navigate(route);
    onClose();
  }, [navigate, onClose]);

  const handleMarkRead = useCallback((id: string) => {
    // Idempotency guard
    if (pendingMarkIds.has(id)) return;
    
    const notification = items.find(n => n.id === id);
    if (!notification || notification.isRead) return;
    
    pendingMarkIds.add(id);
    dispatch(markNotificationRead(id))
      .finally(() => {
        pendingMarkIds.delete(id);
      });
  }, [dispatch, items]);

  const handleMarkAllRead = useCallback(() => {
    trackMarkAllRead(unreadCount);
    dispatch(markAllNotificationsRead());
  }, [dispatch, unreadCount]);

  const handleLoadMore = useCallback(() => {
    dispatch(fetchNotifications({ cursor: endCursor || undefined, limit: 30 }));
  }, [dispatch, endCursor]);

  const handleRetry = useCallback(() => {
    dispatch(fetchNotifications({ limit: 30 }));
  }, [dispatch]);

  const handleSettings = useCallback(() => {
    // Keep consistent with existing settings tabs (store-notifications)
    navigate('/settings?tab=store-notifications');
    onClose();
  }, [navigate, onClose]);

  type NotifTab = 'all' | 'orders' | 'social' | 'store';

  const categoryFor = useCallback((n: NormalizedNotification): NotifTab => {
    const cat = getTrackingCategory(n.type);
    if (cat === 'order') return 'orders';
    if (cat === 'engagement') return 'social';
    // Store/brand/admin-ish notifications: access + content + security
    return 'store';
  }, []);

  const filteredItems = useMemo(() => {
    if (activeTab === 'all') return normalizedItems;
    return normalizedItems.filter((n) => categoryFor(n) === activeTab);
  }, [activeTab, normalizedItems, categoryFor]);

  const unreadByTab = useMemo(() => {
    const counts: Record<NotifTab, number> = { all: 0, orders: 0, social: 0, store: 0 };
    for (const n of normalizedItems) {
      if (!n.isRead) {
        counts.all += 1;
        counts[categoryFor(n)] += 1;
      }
    }
    return counts;
  }, [normalizedItems, categoryFor]);

  const totalCountByTab = useMemo(() => {
    const counts: Record<NotifTab, number> = { all: 0, orders: 0, social: 0, store: 0 };
    for (const n of normalizedItems) {
      counts.all += 1;
      counts[categoryFor(n)] += 1;
    }
    return counts;
  }, [normalizedItems, categoryFor]);

  const tabLabel = (tab: NotifTab) => {
    switch (tab) {
      case 'all': return 'All';
      case 'orders': return 'Orders';
      case 'social': return 'Social';
      case 'store': return 'Store';
    }
  };

  const timeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const emojiFor = (n: NormalizedNotification): string => {
    switch (getTrackingCategory(n.type)) {
      case 'order':
        return '🛍️';
      case 'engagement':
        return '💬';
      case 'security':
        return '🔒';
      case 'access':
        return '🔑';
      case 'content':
      default:
        return '✨';
    }
  };

  const titleFor = (n: NormalizedNotification): string => {
    switch (n.type) {
      case NotificationTypes.ORDER_PLACED:
        return 'New order received';
      case NotificationTypes.ORDER_STATUS_UPDATED:
        return 'Order updated';
      case NotificationTypes.FOLLOW:
        return 'New follower';
      case NotificationTypes.LIKE:
        return 'New like';
      case NotificationTypes.COMMENT:
        return 'New comment';
      case NotificationTypes.PRIVATE_ACCESS_REQUESTED:
        return 'Access request pending';
      case NotificationTypes.PRIVATE_ACCESS_APPROVED:
        return 'Access granted';
      case NotificationTypes.PRIVATE_ACCESS_REJECTED:
        return 'Access request declined';
      case NotificationTypes.BRAND_PATCH_REQUEST:
        return 'Patch request';
      case NotificationTypes.CONTRIBUTION_REQUEST:
        return 'Contribution request';
      default:
        return n.message || 'Notification';
    }
  };

  const primaryActionLabel = (n: NormalizedNotification): string | null => {
    switch (n.type) {
      case NotificationTypes.ORDER_PLACED:
      case NotificationTypes.ORDER_STATUS_UPDATED:
        return 'View Order';
      case NotificationTypes.FOLLOW:
        return 'View Profile';
      case NotificationTypes.PRIVATE_ACCESS_REQUESTED:
      case NotificationTypes.BRAND_PATCH_REQUEST:
      case NotificationTypes.CONTRIBUTION_REQUEST:
        return 'View Request';
      case NotificationTypes.LOGIN:
      case NotificationTypes.LOGOUT:
      case NotificationTypes.LOGOUT_ALL:
        return 'Security Settings';
      default:
        return null;
    }
  };

  if (!open) return null;

  // Determine display state
  const showLoading = loadingList && items.length === 0;
  const showEmpty = items.length === 0 && !loadingList && !error;
  const showError = error && items.length === 0;

  return (
    <OverlayPortal>
      <div
        ref={containerRef}
        className="fixed glass-menu overflow-hidden z-layer-dropdown animate-slideDown flex flex-col outline-none"
        style={{
          top: panelPos.top,
          left: panelPos.left,
          width: panelPos.width,
          maxHeight: 'calc(100vh - var(--app-header-height) - 24px)',
        }}
        role="dialog"
        aria-modal="false"
        aria-label="Notifications"
        tabIndex={-1}
      >
      {/* Header */}
      <div className="glass-menu-soft px-5 py-4 border-b border-white/20 dark:border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-[color:var(--brand-primary)]/15 flex items-center justify-center border border-white/20 dark:border-white/10">
                <span className="text-lg" aria-hidden="true">🔔</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[color:var(--text-primary)]">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="bg-[color:var(--brand-primary)] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[color:var(--text-secondary)] truncate">Stay updated with your activity</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              className="text-xs font-semibold text-[color:var(--brand-primary)] hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ✅ Mark all as read
            </button>

            <button
              onClick={handleSettings}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Notification settings"
            >
              <span aria-hidden="true">⚙️</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 mt-3 overflow-x-auto pb-1 scrollbar-hide">
          {(['all', 'orders', 'social', 'store'] as const).map((tab) => {
            const active = activeTab === tab;
            const badge = unreadByTab[tab];
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={
                  active
                    ? 'relative whitespace-nowrap py-2.5 text-sm font-semibold text-[color:var(--text-primary)]'
                    : 'relative whitespace-nowrap py-2.5 text-sm font-medium text-[color:var(--text-secondary)] hover:opacity-90'
                }
                aria-pressed={active}
              >
                <span className="inline-flex items-center gap-2">
                  {tabLabel(tab)}
                  {badge > 0 && (
                    <span className="min-w-5 h-5 px-1.5 rounded-full bg-[color:var(--brand-primary)]/15 text-[color:var(--brand-primary)] text-[11px] font-bold inline-flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                </span>
                {active && (
                  <span
                    className="absolute bottom-0 left-0 w-full h-[2px] bg-[color:var(--brand-primary)] rounded-t-full"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto sleek-scrollbar p-4" aria-live="polite">
        {/* Loading State */}
        {showLoading && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/20 dark:border-white/10 bg-white/55 dark:bg-white/5 backdrop-blur p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/50 dark:bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/5 rounded bg-black/10 dark:bg-white/10" />
                    <div className="h-3 w-4/5 rounded bg-black/10 dark:bg-white/10" />
                    <div className="h-2.5 w-1/4 rounded bg-black/10 dark:bg-white/10" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {showEmpty && (
          <div className="rounded-2xl border border-white/20 dark:border-white/10 bg-white/55 dark:bg-white/5 backdrop-blur p-8 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-white">
              <span className="text-2xl" aria-hidden="true">🔕</span>
            </div>
            <h4 className="mt-4 text-sm font-semibold text-[color:var(--text-primary)]">You're all caught up!</h4>
            <p className="mt-1 text-xs text-[color:var(--text-secondary)]">No new notifications</p>
          </div>
        )}

        {/* Error State */}
        {showError && (
          <div className="rounded-2xl border border-white/20 dark:border-white/10 bg-white/55 dark:bg-white/5 backdrop-blur p-6 text-center">
            <p className="text-sm font-medium text-[color:var(--text-primary)]">Failed to load notifications</p>
            <p className="mt-1 text-xs text-[color:var(--text-secondary)]">Please try again.</p>
            <button onClick={handleRetry} className="mt-3 btn-frost-outline btn-tight-sm">🔄 Try again</button>
          </div>
        )}

        {/* Items */}
        {!showLoading && !showError && filteredItems.length > 0 && (
          <ul className="space-y-2" role="list">
            {filteredItems.map((n) => {
              const isUnread = !n.isRead;
              const title = titleFor(n);
              const detail = n.message;
              const action = primaryActionLabel(n);
              const route = determineNotificationRoute(n);

              return (
                <li key={n.id} role="listitem">
                  <div
                    className={
                      'group rounded-2xl border backdrop-blur p-4 cursor-pointer transition ' +
                      (isUnread
                        ? 'border-purple-300/50 dark:border-purple-500/20 bg-purple-50/40 dark:bg-purple-500/5'
                        : 'border-white/20 dark:border-white/10 bg-white/55 dark:bg-white/5 hover:bg-white/70 dark:hover:bg-white/8')
                    }
                    onClick={() => {
                      handleMarkRead(n.id);
                      handleBodyClick(n);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleMarkRead(n.id);
                        handleBodyClick(n);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${isUnread ? 'Unread' : 'Read'} notification: ${detail}. ${timeAgo(n.createdAt)}`}
                  >
                    <div className="flex gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-[color:var(--brand-primary)]/15 flex items-center justify-center shrink-0 border border-white/20 dark:border-white/10">
                        <span className="text-lg" aria-hidden="true">{emojiFor(n)}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[color:var(--text-primary)] truncate">{title}</p>
                            <p className="mt-1 text-xs text-[color:var(--text-secondary)] line-clamp-2">{detail}</p>
                            <p className="mt-2 text-[11px] text-[color:var(--text-secondary)]">{timeAgo(n.createdAt)}</p>
                          </div>

                          {isUnread && (
                            <div className="w-2 h-2 rounded-full bg-purple-500 mt-1 shrink-0" aria-hidden="true" />
                          )}
                        </div>

                        {action && route !== '/notifications' && (
                          <div className="mt-3">
                            <button
                              className="btn-frost-primary btn-tight-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkRead(n.id);
                                navigate(route);
                                onClose();
                              }}
                            >
                              {action === 'View Order' ? `🧾 ${action}` : action}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Load More */}
        {hasNextPage && !loadingList && !showLoading && filteredItems.length > 0 && (
          <div className="pt-2 flex justify-center">
            <button onClick={handleLoadMore} className="btn-frost-ghost btn-tight-sm">
              Load more
            </button>
          </div>
        )}

        {/* Loading more indicator */}
        {loadingList && items.length > 0 && (
          <div className="pt-2 flex items-center justify-center text-xs text-[color:var(--text-secondary)]">
            ⏳ Loading...
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/20 dark:border-white/10 glass-menu-soft">
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <button
            className="w-full sm:w-auto btn-frost-primary btn-tight-md"
            onClick={() => {
              navigate('/notifications');
              onClose();
            }}
          >
            View All Notifications
          </button>
          <button
            className="w-full sm:w-auto btn-frost-outline btn-tight-md"
            onClick={handleSettings}
          >
            Notification Settings
          </button>
          <span className="hidden sm:block ml-auto text-[11px] text-[color:var(--text-secondary)]">
            {user?.username || user?.firstName || 'Account'} • {totalCountByTab[activeTab]} shown
          </span>
        </div>
      </div>
      </div>
    </OverlayPortal>
  );
};

export default NotificationsDropdown;
