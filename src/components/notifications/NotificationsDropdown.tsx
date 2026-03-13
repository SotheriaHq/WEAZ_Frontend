/**
 * NotificationsDropdown
 *
 * - Portal-based overlay (prevents layout collisions)
 * - Named z-layer usage (no arbitrary z-index values)
 * - Viewport-bounded height with internal scrolling
 * - Keyboard accessible with focus trap
 * - Icon glyphs (lucide)
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';
import { 
  deleteNotification,
  fetchNotifications, 
  fetchUnreadCount, 
  markAllNotificationsRead, 
  markNotificationRead 
} from '@/features/notificationsSlice';
import { useNavigate } from 'react-router-dom';
import { getActorDisplayName, normalizeNotification } from '@/utils/notificationAdapter';
import type { NormalizedNotification } from '@/utils/notificationAdapter';
import { determineActorRoute, determineNotificationRoute } from '@/utils/notificationRouting';
import { trackDropdownOpen, trackDropdownClose, trackMarkAllRead } from '@/utils/notificationTelemetry';
import { NotificationTypes, getActionText } from '@/types/notificationTypes';
import { NotificationIcon } from '@/components/notifications/NotificationIcon';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface Props { 
  open: boolean; 
  onClose: () => void; 
  anchorRef: React.RefObject<HTMLElement>; 
}

// Set to track pending mark-read operations for idempotency
const pendingMarkIds = new Set<string>();
const pendingDeleteIds = new Set<string>();

export const NotificationsDropdown: React.FC<Props> = ({ open, onClose, anchorRef }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { items, hasNextPage, endCursor, loadingList, unreadCount, error } = useSelector(
    (s: RootState) => s.notifications
  );
  const isAuthenticated = useSelector((s: RootState) => s.user.isAuthenticated);
  const currentUser = useSelector((s: RootState) => s.user.profile);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();
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
    const payload = (notification.payload as Record<string, unknown> | undefined) ?? {};
    const payloadOrderId = typeof payload.orderId === 'string' ? payload.orderId : null;
    const route =
      currentUser?.type === 'BRAND' &&
      (notification.type === NotificationTypes.ORDER_PLACED || notification.type === NotificationTypes.ORDER_STATUS_UPDATED) &&
      payloadOrderId
        ? `/studio?tab=orders&orderId=${encodeURIComponent(payloadOrderId)}`
        : determineNotificationRoute(notification);
    navigate(route);
    onClose();
  }, [currentUser?.type, navigate, onClose]);

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

  const handleDelete = useCallback((id: string) => {
    if (pendingDeleteIds.has(id)) return;
    pendingDeleteIds.add(id);
    dispatch(deleteNotification(id))
      .finally(() => {
        pendingDeleteIds.delete(id);
      });
  }, [dispatch]);

  const handleLoadMore = useCallback(() => {
    dispatch(fetchNotifications({ cursor: endCursor || undefined, limit: 30 }));
  }, [dispatch, endCursor]);

  const handleRetry = useCallback(() => {
    dispatch(fetchNotifications({ limit: 30 }));
  }, [dispatch]);

  const handleSettings = useCallback(() => {
    navigate('/settings?tab=notifications');
    onClose();
  }, [navigate, onClose]);

  const handleActorClick = useCallback(
    (notification: NormalizedNotification) => {
      if (!notification.actor?.id) return;
      handleMarkRead(notification.id);
      navigate(determineActorRoute(notification.actor.id));
      onClose();
    },
    [handleMarkRead, navigate, onClose],
  );

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


  const contentTitleFor = (n: NormalizedNotification): string => {
    const payload = (n.payload as Record<string, unknown> | undefined) ?? {};
    const fromTarget = typeof n.target?.preview === 'string' ? n.target.preview.trim() : '';
    if (fromTarget) return fromTarget;

    const fromPayload =
      (typeof payload.collectionTitle === 'string' && payload.collectionTitle) ||
      (typeof payload.collectionName === 'string' && payload.collectionName) ||
      (typeof payload.productName === 'string' && payload.productName) ||
      (typeof payload.title === 'string' && payload.title) ||
      '';
    if (fromPayload.trim()) return String(fromPayload).trim();

    if (n.target?.type === 'PRODUCT') return 'product';
    if (n.target?.type === 'COLLECTION' || n.target?.type === 'COLLECTION_MEDIA') return 'design';
    if (n.target?.type === 'USER') return 'profile';

    return 'content';
  };

  const actionTextFor = (n: NormalizedNotification): string => {
    const action = getActionText(n.type).trim() || 'updated your';
    const title = contentTitleFor(n);
    const payload = (n.payload as Record<string, unknown> | undefined) ?? {};
    const trimmedMessage = (n.message || '').trim();

    if (
      trimmedMessage &&
      (n.type === NotificationTypes.ORDER_PLACED || n.type === NotificationTypes.ORDER_STATUS_UPDATED)
    ) {
      return trimmedMessage;
    }

    const lowerMessage = trimmedMessage.toLowerCase();
    const hasExplicitTitle = lowerMessage.includes(title.toLowerCase());
    if (hasExplicitTitle && trimmedMessage) {
      return trimmedMessage;
    }

    if (
      n.type === NotificationTypes.LOGIN ||
      n.type === NotificationTypes.LOGOUT ||
      n.type === NotificationTypes.LOGOUT_ALL ||
      n.type === NotificationTypes.SIGNUP
    ) {
      const location = typeof payload.location === 'object' && payload.location
        ? [
            (payload.location as Record<string, unknown>).city,
            (payload.location as Record<string, unknown>).region,
            (payload.location as Record<string, unknown>).country,
          ]
            .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
            .join(', ')
        : '';
      if (location) {
        return `${action} ${location}`;
      }
      return action;
    }

    if (!title) return action;
    return `${action} ${title}`;
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
        className="fixed glass-menu border border-white/25 dark:border-white/12 overflow-hidden z-layer-dropdown animate-slideDown flex flex-col outline-none"
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
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex min-w-0 items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[color:var(--brand-primary)]/15 flex items-center justify-center border border-white/20 dark:border-white/10 text-base" aria-hidden="true">🔔</div>
            <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
              Notifications {unreadCount > 0 ? `(${unreadCount})` : ''}
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <button
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0}
              className="text-[11px] font-semibold text-[color:var(--brand-primary)] hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
            >
              <span aria-hidden="true">✅</span>
              Read
            </button>
            <button
              onClick={handleSettings}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Notification settings"
              title="Notification settings"
            >
              <span aria-hidden="true">⚙️</span>
            </button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto sleek-scrollbar px-4 pb-4" aria-live="polite">
        {/* Loading State */}
        {showLoading && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="rounded-xl border border-white/20 dark:border-white/10 bg-white/55 dark:bg-white/5 backdrop-blur p-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/50 dark:bg-white/10" />
                  <div className="flex-1 space-y-2">
                    <div className="h-2.5 w-4/5 rounded bg-black/10 dark:bg-white/10" />
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
            <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center text-white text-xl" aria-hidden="true">
              🔔
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
            <button onClick={handleRetry} className="mt-3 btn-frost-outline btn-tight-sm">Try again</button>
          </div>
        )}

        {/* Items */}
        {!showLoading && !showError && normalizedItems.length > 0 && (
          <ul className="space-y-2" role="list">
            {normalizedItems.map((n) => {
              const isUnread = !n.isRead;
              const actorDisplayName = n.actor ? getActorDisplayName(n) : null;
              const actionText = actionTextFor(n);

              return (
                <li key={n.id} role="listitem">
                  <div
                    className={
                      'group rounded-xl border backdrop-blur p-2.5 cursor-pointer transition ' +
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
                    aria-label={`${isUnread ? 'Unread' : 'Read'} notification: ${actionText}. ${timeAgo(n.createdAt)}`}
                  >
                    <div className="flex gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[color:var(--brand-primary)]/15 flex items-center justify-center shrink-0 border border-white/20 dark:border-white/10">
                        <NotificationIcon type={n.type} size="md" className="text-[color:var(--brand-primary)]" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs text-gray-800 dark:text-gray-200 line-clamp-2 leading-5">
                              {actorDisplayName ? (
                                <button
                                  type="button"
                                  className="font-semibold text-purple-600 dark:text-purple-400 hover:underline underline-offset-2 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleActorClick(n);
                                  }}
                                  aria-label={`View ${actorDisplayName}'s profile`}
                                >
                                  @{actorDisplayName}
                                </button>
                              ) : (
                                <span className="font-semibold text-[color:var(--text-primary)]">System</span>
                              )}
                              <span className="ml-1">{actionText}</span>
                            </p>
                            <p className="mt-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">{timeAgo(n.createdAt)}</p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              className="opacity-70 hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(n.id);
                              }}
                              aria-label="Delete notification"
                              title="Delete notification"
                            >
                              <span className="text-xs" aria-hidden="true">🗑️</span>
                            </button>
                            {isUnread && (
                              <div className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1" aria-hidden="true" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Load More */}
        {hasNextPage && !loadingList && !showLoading && normalizedItems.length > 0 && (
          <div className="pt-2 flex justify-center">
            <button onClick={handleLoadMore} className="btn-frost-ghost btn-tight-sm">
              Load more
            </button>
          </div>
        )}

        {/* Loading more indicator */}
        {loadingList && items.length > 0 && (
          <div className="pt-2 flex items-center justify-center gap-1 text-xs text-[color:var(--text-secondary)]">
            <span className="animate-pulse" aria-hidden="true">⏳</span>
            Loading...
          </div>
        )}
      </div>

      </div>
    </OverlayPortal>
  );
};

export default NotificationsDropdown;
