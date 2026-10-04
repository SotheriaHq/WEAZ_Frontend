/**
 * Full-page notifications history.
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
 *
 * Unlike the dropdown — which is a peek at the newest few — this page is the
 * archive, so it is grouped into age sections (`notificationSections.ts`) and
 * pages backwards through server history from a single "Show more" at the
 * bottom. That one control does double duty: it first reveals the collapsed
 * tail of the `Older` section, then keeps pulling further pages, so the reader
 * only ever has one thing to press to keep going.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
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
import {
  OLDER_SECTION_INITIAL_COUNT,
  OLDER_SECTION_STEP_COUNT,
  groupNotificationsBySection,
} from '@/utils/notificationSections';
import { hasActiveBrandMembership } from '@/lib/brandAccess';
import { MuseLoader } from '@/components/loaders/MuseLoader';

const NOTIFICATIONS_PAGE_SIZE = 30;

const NotificationsPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const { items, hasNextPage, endCursor, loadingList, unreadCount, error } = useSelector(
    (s: RootState) => s.notifications,
  );
  const currentUser = useSelector((s: RootState) => s.user.profile);
  const isAuthenticated = useSelector((s: RootState) => s.user.isAuthenticated);
  const isAdminConsoleUser =
    currentUser?.role === 'SuperAdmin' || currentUser?.role === 'Admin';

  const [visibleOlderCount, setVisibleOlderCount] = useState(OLDER_SECTION_INITIAL_COUNT);

  /**
   * Back returns to whatever opened this page. `navigate(-1)` is the default so
   * the browser's own Back button and this control stay in step (and so a
   * second Back from the entry screen still leaves the app, as it always did).
   * The explicit `notificationsReturnTo` handed over by the navbar is only used
   * when there is no history to step back through — a deep link straight to
   * /notifications, where `navigate(-1)` would leave the site entirely.
   */
  const returnTo = (location.state as { notificationsReturnTo?: string | null } | null)
    ?.notificationsReturnTo;
  const handleBack = useCallback(() => {
    if (location.key !== 'default') {
      navigate(-1);
      return;
    }
    navigate(returnTo || '/', { replace: true });
  }, [location.key, navigate, returnTo]);

  useEffect(() => {
    if (!isAuthenticated) return;
    dispatch(fetchNotifications({ limit: NOTIFICATIONS_PAGE_SIZE }));
    dispatch(fetchUnreadCount());
  }, [dispatch, isAuthenticated]);

  const normalizedItems = useMemo(
    () =>
      items.map((item) =>
        normalizeNotification(item as unknown as Record<string, unknown>),
      ),
    [items],
  );

  // Bucketing is pinned to the render's clock rather than recomputed per item,
  // so a list cannot straddle midnight mid-pass and place two adjacent rows in
  // sections that disagree about what "now" is.
  const sections = useMemo(
    () => groupNotificationsBySection(normalizedItems, Date.now()),
    [normalizedItems],
  );

  const olderCount = useMemo(
    () => sections.find((section) => section.key === 'older')?.items.length ?? 0,
    [sections],
  );

  const hasCollapsedOlder = olderCount > visibleOlderCount;
  const canShowMore = hasCollapsedOlder || hasNextPage;

  const handleShowMore = useCallback(() => {
    if (hasCollapsedOlder) {
      setVisibleOlderCount((count) => count + OLDER_SECTION_STEP_COUNT);
      return;
    }
    if (!hasNextPage || loadingList) return;
    // Reveal the page we're about to receive as well — otherwise arriving rows
    // land inside the collapsed tail and the reader has to press twice for one
    // batch of history.
    setVisibleOlderCount((count) => count + OLDER_SECTION_STEP_COUNT);
    void dispatch(
      fetchNotifications({ cursor: endCursor || undefined, limit: NOTIFICATIONS_PAGE_SIZE }),
    );
  }, [dispatch, endCursor, hasCollapsedOlder, hasNextPage, loadingList]);

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

  /*
    Hand the destination a way back. Product and catalogue pages are reachable
    from many places, so they read the origin off route state rather than
    guessing — see `useReturnTo`.
  */
  const handleOpenEntity = useCallback(
    (to: string) => {
      navigate(to, {
        state: { returnTo: '/notifications', returnLabel: '👈 Back to notifications' },
      });
    },
    [navigate],
  );

  const handleMarkRead = useCallback(
    (id: string) => {
      const notification = items.find((n) => n.id === id);
      if (!notification || notification.isRead) return;
      void dispatch(markNotificationRead(id));
    },
    [dispatch, items],
  );

  const handleDelete = useCallback(
    (id: string) => {
      void dispatch(deleteNotification(id));
    },
    [dispatch],
  );

  // `loadingList` is also true for the background refresh above, so gate the
  // skeleton on having nothing to show. Otherwise revisiting this page would
  // blank a list that is already on screen.
  const showBlockingLoader = loadingList && normalizedItems.length === 0;

  return (
    <div className="mx-auto w-full max-w-2xl px-2 pb-24 pt-4 sm:px-4 sm:pt-6">
      {/*
        The back control and the unread badge used to live INSIDE the h1, in a
        row that was `justify-between` with the actions. The heading could not
        then shrink below its own content, so on a 360px phone it grew straight
        under "Mark all read" — the badge landed on top of the label. The title
        is now the only thing that flexes, and the actions drop to their own
        right-aligned line until there is room for them beside it.
      */}
      <header className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 sm:px-0">
        <button
          type="button"
          onClick={handleBack}
          className="-ml-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg surface-interactive-hover"
          aria-label="Go back"
        >
          <span aria-hidden="true">←</span>
        </button>
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-[color:var(--text-primary)] sm:text-2xl">
          Notifications
        </h1>
        {unreadCount > 0 ? (
          <span
            className="inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white"
            aria-label={`${unreadCount} unread`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
        <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => void dispatch(markAllNotificationsRead())}
              className="rounded-xl px-2 py-1.5 text-xs font-semibold text-[color:var(--text-secondary)] surface-interactive-hover sm:px-3 sm:text-sm"
            >
              Mark all as read
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => navigate('/settings?tab=notifications')}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm surface-interactive-hover sm:h-9 sm:w-9"
            aria-label="Notification settings"
          >
            <span aria-hidden="true">⚙️</span>
          </button>
        </div>
      </header>

      {showBlockingLoader ? (
        <div className="flex items-center justify-center py-16">
          <MuseLoader size={28} />
        </div>
      ) : error && normalizedItems.length === 0 ? (
        <div className="rounded-2xl border border-theme p-6 text-center">
          <p className="text-sm text-[color:var(--text-secondary)]">
            We couldn&apos;t load your notifications.
          </p>
          <button
            type="button"
            onClick={() =>
              void dispatch(fetchNotifications({ limit: NOTIFICATIONS_PAGE_SIZE }))
            }
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
          {sections.map((section) => {
            const visible =
              section.key === 'older'
                ? section.items.slice(0, visibleOlderCount)
                : section.items;

            return (
              <section key={section.key} className="notification-section">
                <h2 className="notification-section-heading">{section.label}</h2>
                <ul>
                  {visible.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onAvatarClick={handleActorClick}
                      onUsernameClick={handleActorClick}
                      onBodyClick={handleBodyClick}
                      onMarkRead={handleMarkRead}
                      onDelete={handleDelete}
                      onOpenEntity={handleOpenEntity}
                    />
                  ))}
                </ul>
              </section>
            );
          })}

          {canShowMore ? (
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                disabled={loadingList && !hasCollapsedOlder}
                onClick={handleShowMore}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-[color:var(--text-primary)] surface-interactive-hover disabled:opacity-60"
              >
                {loadingList && !hasCollapsedOlder ? 'Loading…' : 'Show more'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
};

export default NotificationsPage;
