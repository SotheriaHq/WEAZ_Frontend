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

  const refresh = useCallback(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }
    messagingApi
      .getUnreadCount()
      .then((res) => {
        if (mountedRef.current) setUnreadCount(Number(res?.unreadCount ?? 0));
      })
      .catch(() => {
        /* badge is decorative; never surface a toast for it */
      });
  }, [userId]);

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
