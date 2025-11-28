import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';
import { useRealtime } from '@/realtime';
import { toast } from 'react-toastify';
import {
  fetchNotifications,
  fetchUnreadCount,
  ingestRealtime,
  markAllNotificationsRead,
  markNotificationRead,
  resetState,
} from '@/features/notificationsSlice';

/**
 * Central hook wiring realtime + REST notification flow.
 * Mount once at app root (e.g., inside Navbar or Layout).
 */
export function useNotificationsBootstrap() {
  const dispatch = useDispatch<AppDispatch>();
  const userId = useSelector((s: RootState) => s.user.profile?.id);
  const initialized = useSelector((s: RootState) => s.notifications.initialized);
  const items = useSelector((s: RootState) => s.notifications.items);
  const realtime = useRealtime();
  const lastFetchRef = useRef<number>(0);
  const pollTimerRef = useRef<number | null>(null);
  const preloadedRef = useRef<Set<string>>(new Set());
  const prevUserRef = useRef<string | undefined>(undefined);

  // Initial fetch when authenticated
  useEffect(() => {
    if (userId) {
      // Fetch on first mount for this user or if user changed
      const userChanged = prevUserRef.current && prevUserRef.current !== userId;
      // Always refresh unread count on login/identity change
      if (!prevUserRef.current || userChanged) {
        dispatch(fetchUnreadCount());
      }
      if (!initialized || userChanged) {
        dispatch(fetchNotifications({ limit: 30 }));
      }
      prevUserRef.current = userId;
    } else {
      // User logged out; fully reset notifications state so next login re-fetches
      dispatch(resetState());
      prevUserRef.current = undefined;
    }
  }, [userId, initialized, dispatch]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;
    const { joinUser, onNotification } = realtime;
    joinUser(userId);
    const unsub = onNotification((payload: any) => {
      dispatch(
        ingestRealtime({
          id: payload.id,
            type: payload.type,
            message: payload.message,
            createdAt: payload.createdAt,
            isRead: payload.isRead,
            actor: payload.actor ?? null,
            payload: payload.payload ?? undefined,
            targetUrl: payload.payload?.targetUrl ?? undefined,
        }),
      );
      // Show toast for real-time notification
      if (payload.message) {
        toast.info(payload.message);
      }
    });
    return () => { unsub(); };
  }, [userId, realtime, dispatch]);

  // Lightweight debounce for unread fetches
  const maybeFetchUnread = useCallback(() => {
    if (!userId) return;
    const now = Date.now();
    if (now - lastFetchRef.current < 10000) return; // 10s throttle window
    lastFetchRef.current = now;
    dispatch(fetchUnreadCount());
  }, [dispatch, userId]);

  // Polling fallback when websocket is disconnected or degraded
  useEffect(() => {
    if (!userId) return;
    const shouldPoll = !realtime.socketConnected || realtime.degraded;
    if (shouldPoll && pollTimerRef.current == null) {
      // Immediate fetch once when entering degraded state
      maybeFetchUnread();
      const id = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          maybeFetchUnread();
        }
      }, 30000); // 30s polling interval
      pollTimerRef.current = id as unknown as number;
    }
    if (!shouldPoll && pollTimerRef.current != null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    return () => {
      if (pollTimerRef.current != null) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [realtime.socketConnected, realtime.degraded, userId, maybeFetchUnread]);

  // Refresh unread count when tab becomes visible or WS is restored
  useEffect(() => {
    if (!userId) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        maybeFetchUnread();
      }
    };
    const onWsRestored = () => { maybeFetchUnread(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('ws:restored', onWsRestored as EventListener);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('ws:restored', onWsRestored as EventListener);
    };
  }, [userId, maybeFetchUnread]);

  // Preload actor profile images for smoother avatar rendering.
  useEffect(() => {
    if (!items || items.length === 0) return;
    for (const n of items) {
      const url = n.actor?.profileImage;
      if (url && !preloadedRef.current.has(url)) {
        const img = new Image();
        img.src = url;
        preloadedRef.current.add(url);
      }
    }
  }, [items]);
}

export function useNotificationsActions() {
  const dispatch = useDispatch<AppDispatch>();
  const markRead = useCallback((id: string) => { dispatch(markNotificationRead(id)); }, [dispatch]);
  const markAll = useCallback(() => { dispatch(markAllNotificationsRead()); }, [dispatch]);
  const loadMore = useCallback((cursor?: string) => {
    dispatch(fetchNotifications({ cursor, limit: 30 }));
  }, [dispatch]);
  return { markRead, markAll, loadMore };
}
