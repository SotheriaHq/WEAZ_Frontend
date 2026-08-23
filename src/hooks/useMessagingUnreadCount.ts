import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { messagingApi } from '@/api/MessagingApi';
import { useRealtime } from '@/realtime/RealtimeProvider';
import type { RootState } from '@/store';

/** Notification types that mean the messaging unread total may have moved. */
const MESSAGE_NOTIFICATION_TYPES = new Set([
  'MESSAGE_RECEIVED',
  'MESSAGE_MODERATED',
  'MESSAGE_UNREAD_REMINDER',
  'MESSAGE_THREAD_REOPENED',
]);

/** Slow safety net; realtime is the primary path. */
const POLL_INTERVAL_MS = 60_000;

/**
 * Floor between two actual requests for the badge, shared by every caller.
 *
 * The slow poll was never the problem — it is 60s and the hook mounts twice
 * (SideBar and StudioSidebar), so polling alone accounts for two requests a
 * minute. The volume came from the EVENT paths: `message.created`,
 * `thread.updated`, `message.read`, `notification.created`, the local
 * `messaging:read` event and `ws:restored` all call `refresh()` directly, once
 * per mounted hook. A socket that reconnects in a loop — which is exactly what
 * happens once the API starts shedding load — turns every restore into another
 * pair of requests, and the badge starts driving the outage it is reacting to.
 * 714 `GET /messaging/unread-count` against 79 `GET /messaging/inbox` in one log
 * window is that feedback loop.
 *
 * Coalescing lives at module scope, not in the hook, because two instances of a
 * per-hook limiter would still allow double the traffic. A badge that is at most
 * a few seconds stale is indistinguishable from a live one.
 */
const MIN_REFRESH_INTERVAL_MS = 5_000;

let lastUnreadFetchAt = 0;
let inflightUnreadFetch: Promise<number | null> | null = null;
let trailingRefreshTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * One request per window, one in flight at a time, and a trailing call so the
 * last event in a burst is never the one that gets dropped.
 */
function fetchUnreadCountCoalesced(): Promise<number | null> {
  if (inflightUnreadFetch) return inflightUnreadFetch;

  const promise = messagingApi
    .getUnreadCount()
    .then((res) => Number(res?.unreadCount ?? 0))
    .catch(() => null)
    .finally(() => {
      lastUnreadFetchAt = Date.now();
      inflightUnreadFetch = null;
    });

  inflightUnreadFetch = promise;
  return promise;
}

/**
 * Live messaging unread total for nav badges.
 *
 * Kept deliberately separate from the general notification unread count — the
 * backend exposes `GET /messaging/unread-count` precisely so the Messages badge
 * does not inherit likes/follows/order noise (see messaging context card).
 *
 * Refreshes on `message.created` / `thread.updated` (new mail arrives) AND on
 * `message.read` (mail is read — including from another tab or the mobile app,
 * which is what left the "new message" dot stuck after the thread was opened).
 * `notification.created` is the fallback path when a socket frame is missed, and
 * a slow poll covers a fully degraded socket.
 */
export function useMessagingUnreadCount(): { unreadCount: number; refresh: () => void } {
  const userId = useSelector((state: RootState) => state.user.profile?.id);
  const [unreadCount, setUnreadCount] = useState(0);
  const { onMessageEvent, onNotification } = useRealtime();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const applyCount = useCallback((value: number | null) => {
    if (value == null) return; // badge is decorative; never surface a failure
    if (mountedRef.current) setUnreadCount(value);
  }, []);

  const refresh = useCallback(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    const sinceLast = Date.now() - lastUnreadFetchAt;
    if (sinceLast >= MIN_REFRESH_INTERVAL_MS || inflightUnreadFetch) {
      void fetchUnreadCountCoalesced().then(applyCount);
      return;
    }

    // Inside the window: schedule ONE trailing fetch for the end of it rather
    // than dropping the event. Re-arming a single shared timer means a burst of
    // fifty events still resolves to a single request.
    if (trailingRefreshTimer) return;
    trailingRefreshTimer = setTimeout(() => {
      trailingRefreshTimer = null;
      void fetchUnreadCountCoalesced().then(applyCount);
    }, MIN_REFRESH_INTERVAL_MS - sinceLast);
  }, [applyCount, userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    const unsubs = [
      onMessageEvent('message.created', refresh),
      onMessageEvent('thread.updated', refresh),
      onMessageEvent('message.read', refresh),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [onMessageEvent, refresh, userId]);

  useEffect(() => {
    if (!userId) return;
    return onNotification((payload: any) => {
      if (MESSAGE_NOTIFICATION_TYPES.has(String(payload?.type ?? ''))) refresh();
    });
  }, [onNotification, refresh, userId]);

  // A read elsewhere in this same tab (opening a thread) should clear the badge
  // without waiting for the server round-trip to echo back.
  useEffect(() => {
    if (!userId) return;
    const onLocalRead = () => refresh();
    window.addEventListener('messaging:read', onLocalRead);
    window.addEventListener('ws:restored', onLocalRead);
    return () => {
      window.removeEventListener('messaging:read', onLocalRead);
      window.removeEventListener('ws:restored', onLocalRead);
    };
  }, [refresh, userId]);

  useEffect(() => {
    if (!userId) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [refresh, userId]);

  return { unreadCount, refresh };
}

/** Fired by the messages screen after it marks a thread read. */
export function notifyMessagingRead(): void {
  window.dispatchEvent(new CustomEvent('messaging:read'));
}

export default useMessagingUnreadCount;
