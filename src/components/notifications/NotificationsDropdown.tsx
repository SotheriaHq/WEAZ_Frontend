/**
 * NotificationsDropdown - Refactored with Multi-Target Pattern
 * 
 * Features:
 * - Multi-target click zones (avatar, username, body)
 * - Accessibility (ARIA roles, keyboard nav, screen reader)
 * - Telemetry integration
 * - Empty/Loading/Error states
 * - Idempotent mark-as-read
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';
import { 
  fetchNotifications, 
  fetchUnreadCount, 
  markAllNotificationsRead, 
  markNotificationRead 
} from '@/features/notificationsSlice';
import { X, CheckCheck, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NotificationItem } from './NotificationItem';
import { normalizeNotification } from '@/utils/notificationAdapter';
import type { NormalizedNotification } from '@/utils/notificationAdapter';
import { determineNotificationRoute, determineActorRoute } from '@/utils/notificationRouting';
import { trackDropdownOpen, trackDropdownClose, trackMarkAllRead } from '@/utils/notificationTelemetry';
import './NotificationItem.css';

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
  const navigate = useNavigate();

  // Normalize notifications for the new component model
  const normalizedItems = useMemo(() => {
    return items.map(item => normalizeNotification(item as unknown as Record<string, unknown>));
  }, [items]);

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

  // Stable handlers with useCallback for performance
  // Guard: Only navigate if actorId is valid (not system notification)
  const handleAvatarClick = useCallback((actorId: string) => {
    // Guard against system notifications or invalid actorIds
    if (!actorId || actorId === 'system') {
      return; // Don't navigate for system notifications
    }
    const route = determineActorRoute(actorId);
    navigate(route);
    onClose();
  }, [navigate, onClose]);

  // Guard: Only navigate if actorId is valid (not system notification)
  const handleUsernameClick = useCallback((actorId: string) => {
    // Guard against system notifications or invalid actorIds
    if (!actorId || actorId === 'system') {
      return; // Don't navigate for system notifications
    }
    const route = determineActorRoute(actorId);
    navigate(route);
    onClose();
  }, [navigate, onClose]);

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

  if (!open) return null;

  // Determine display state
  const showLoading = loadingList && items.length === 0;
  const showEmpty = items.length === 0 && !loadingList && !error;
  const showError = error && items.length === 0;

  return (
    <div 
      ref={containerRef} 
      className="absolute right-0 mt-2 w-[360px] max-h-[450px] flex flex-col rounded-xl shadow-2xl border border-white/30 dark:border-white/10 bg-white/98 dark:bg-gray-900/98 backdrop-blur-xl overflow-hidden z-[100]"
      role="region"
      aria-label="Notifications"
    >
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between bg-gradient-to-br from-purple-600/90 via-fuchsia-500/80 to-purple-700/90 text-white">
        <div className="flex flex-col">
          <span className="text-xs font-semibold opacity-80">Notifications</span>
          <span className="text-sm font-medium" aria-label="Username">
            {user?.username || user?.firstName || 'Guest'}
          </span>
        </div>
        <button 
          onClick={onClose} 
          className="p-1.5 rounded-lg hover:bg-white/20 transition-colors" 
          aria-label="Close notifications"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Meta bar */}
      <div className="px-3 py-2 flex items-center justify-between border-b border-gray-200/50 dark:border-gray-700/50 text-xs bg-gray-50/50 dark:bg-gray-800/30">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-500/15 text-purple-700 dark:text-purple-300 font-semibold tracking-wide">
          {unreadCount} unread
        </span>
        <button
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0}
          className="px-2 py-1 rounded-md border border-emerald-600/60 text-emerald-700 dark:text-emerald-300 bg-transparent hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition text-[11px] font-semibold flex items-center gap-1"
        >
          <CheckCheck className="w-3.5 h-3.5"/>Mark all read
        </button>
      </div>

      {/* Notifications List */}
      <ul 
        className="flex-1 overflow-y-auto sleek-scrollbar"
        role="list"
        aria-live="polite"
      >
        {/* Loading State */}
        {showLoading && (
          <div className="loading-state">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="notification-skeleton">
                <div className="skeleton-avatar" />
                <div className="skeleton-content">
                  <div className="skeleton-line short" />
                  <div className="skeleton-line long" />
                  <div className="skeleton-line tiny" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {showEmpty && (
          <div className="empty-state">
            <div className="empty-icon">🎉</div>
            <h3>You're all caught up!</h3>
            <p className="text-muted">No new notifications</p>
          </div>
        )}

        {/* Error State */}
        {showError && (
          <div className="error-state">
            <div className="error-icon">⚠️</div>
            <p>Failed to load notifications</p>
            <button onClick={handleRetry} className="retry-button">
              Try again
            </button>
          </div>
        )}

        {/* Notification Items */}
        {normalizedItems.map(n => (
          <NotificationItem
            key={n.id}
            notification={n}
            onAvatarClick={handleAvatarClick}
            onUsernameClick={handleUsernameClick}
            onBodyClick={handleBodyClick}
            onMarkRead={handleMarkRead}
          />
        ))}

        {/* Load More */}
        {hasNextPage && !loadingList && (
          <div className="p-3 flex justify-center border-t border-gray-200/50 dark:border-gray-700/50">
            <button 
              onClick={handleLoadMore} 
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-white/70 dark:bg-white/10 backdrop-blur-md border border-white/30 hover:bg-white/90 dark:hover:bg-white/20 transition"
            >
              Load more
            </button>
          </div>
        )}

        {/* Loading more indicator */}
        {loadingList && items.length > 0 && (
          <div className="p-3 flex items-center justify-center text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin mr-2"/>Loading...
          </div>
        )}
      </ul>
    </div>
  );
};

export default NotificationsDropdown;
