/**
 * Full-page notifications list.
 *
 * `/notifications` was declared in `seoPaths.ts` but never actually built, so
 * the ONLY way to read a notification was the bell dropdown — which was
 * `hidden sm:flex`. On a phone that left no reachable surface at all: no bell,
 * no island-dock entry, no profile-menu entry, no route. A brand could be told
 * by an admin to change a submitted product and never see it.
 *
 * This is the destination for the profile-menu entry and for any deep link that
 * wants "the list" rather than a specific target. It shares
 * `resolveNotificationClickRoute` with the dropdown so tapping the same
 * notification lands in the same place on both surfaces.
 */
import React, { useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { AppDispatch, RootState } from '@/store';
import {
  deleteNotification,
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/features/notificationsSlice';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { normalizeNotification } from '@/utils/notificationAdapter';
import type { NormalizedNotification } from '@/utils/notificationAdapter';
import {
  determineActorRoute,
  resolveNotificationClickRoute,
} from '@/utils/notificationRouting';
import { hasActiveBrandMembership } from '@/lib/brandAccess';
import VLoader from '@/components/loaders/VLoader';

const NotificationsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { items, hasNextPage, endCursor, loadingList, unreadCount, error } = useSelector(
    (s: RootState) => s.notifications,
  );
  const currentUser = useSelector((s: RootState) => s.user.profile);
  const isAuthenticated = useSelector((s: RootState) => s.user.isAuthenticated);
  const isAdminConsoleUser =
    currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin';

  useEffect(() => {
    if (!isAuthenticated) return;
    dispatch(fetchNotifications({ limit: 30 }));
    dispatch(fetchUnreadCount());
  }, [dispatch, isAuthenticated]);

  const normalizedItems = useMemo(
    () =>
      items.map((item) =>
        normalizeNotification(item as unknown as Record<string, unknown>),
      ),
    [items],
  );

  const handleBodyClick = useCallback(
    (notification: NormalizedNotification) => {
      navigate(
        resolveNotificationClickRoute(notification, {
          isBrand: hasActiveBrandMembership(currentUser),
          isAdminConsoleUser,
        }),
      );
    },
    [currentUser, isAdminConsoleUser, navigate],
  );

  const handleActorClick = useCallback(
    (actorId: string) => {
      const route = determineActorRoute(actorId);
      navigate(isAdminConsoleUser && route.startsWith('/profile') ? '/admin' : route);
    },
    [isAdminConsoleUser, navigate],
  );

  const handleMarkRead = useCallback(
    (id: string) => {
      const notification = items.find((n) => n.id === id);
      if (!notification || notification.isRead) return;
      void dispatch(markNotificationRead(id));
    },
    [dispatch, items],
  );

  // `loadingList` is also true for the background refresh above, so gate the
  // skeleton on having nothing to show. Otherwise revisiting this page would
  // blank a list that is already on screen.
  const showBlockingLoader = loadingList && normalizedItems.length === 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-4 sm:pt-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-[color:var(--text-primary)] sm:text-2xl">
          Notifications
          {unreadCount > 0 ? (
            <span className="ml-2 inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white align-middle">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => void dispatch(markAllNotificationsRead())}
              className="rounded-xl px-3 py-1.5 text-sm font-semibold text-[color:var(--text-secondary)] surface-interactive-hover"
            >
              Mark all read
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => navigate('/settings?tab=notifications')}
            className="rounded-xl px-3 py-1.5 text-sm font-semibold text-[color:var(--text-secondary)] surface-interactive-hover"
            aria-label="Notification settings"
          >
            <span aria-hidden="true">⚙️</span>
          </button>
        </div>
      </div>

      {showBlockingLoader ? (
        <div className="flex items-center justify-center py-16">
          <VLoader size={28} phase="loading" showLabel={false} />
        </div>
      ) : error && normalizedItems.length === 0 ? (
        <div className="rounded-2xl border border-theme p-6 text-center">
          <p className="text-sm text-[color:var(--text-secondary)]">
            We couldn&apos;t load your notifications.
          </p>
          <button
            type="button"
            onClick={() => void dispatch(fetchNotifications({ limit: 30 }))}
            className="mt-3 rounded-xl px-4 py-2 text-sm font-semibold text-[color:var(--text-primary)] surface-interactive-hover"
          >
            Try again
          </button>
        </div>
      ) : normalizedItems.length === 0 ? (
        <div className="rounded-2xl border border-theme p-8 text-center">
          <div className="text-3xl" aria-hidden="true">
            🔔
          </div>
          <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
            You&apos;re all caught up. Updates about your content, orders and
            messages will show up here.
          </p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-[color:var(--border-subtle)] rounded-2xl border border-theme overflow-hidden">
            {normalizedItems.map((notification) => (
              <li key={notification.id} className="relative">
                <NotificationItem
                  notification={notification}
                  onAvatarClick={handleActorClick}
                  onUsernameClick={handleActorClick}
                  onBodyClick={handleBodyClick}
                  onMarkRead={handleMarkRead}
                />
                <button
                  type="button"
                  onClick={() => void dispatch(deleteNotification(notification.id))}
                  className="absolute right-2 top-2 rounded-lg px-2 py-1 text-xs text-[color:var(--text-secondary)] surface-interactive-hover"
                  aria-label="Delete notification"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </li>
            ))}
          </ul>

          {hasNextPage ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                disabled={loadingList}
                onClick={() =>
                  void dispatch(
                    fetchNotifications({ cursor: endCursor || undefined, limit: 30 }),
                  )
                }
                className="rounded-xl px-4 py-2 text-sm font-semibold text-[color:var(--text-primary)] surface-interactive-hover disabled:opacity-60"
              >
                {loadingList ? 'Loading…' : 'Load more'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

export default NotificationsPage;
