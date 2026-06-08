import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';
import { useRealtime } from '@/realtime';
import { toast } from 'sonner';
import { useNotificationSettingsQuery } from '@/query/queries';
import {
  fetchNotifications,
  fetchUnreadCount,
  ingestRealtime,
  markAllNotificationsRead,
  markNotificationRead,
  removeNotification,
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
  const notificationSettingsQuery = useNotificationSettingsQuery(userId, { enabled: Boolean(userId) });
  const lastFetchRef = useRef<number>(0);
  const pollTimerRef = useRef<number | null>(null);
  const preloadedRef = useRef<Set<string>>(new Set());
  const prevUserRef = useRef<string | undefined>(undefined);
  const messagingPrefsRef = useRef({ desktop: true, sound: false });
  const lastSignalRef = useRef(0);

  const playMessageTone = useCallback(() => {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 920;
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.stop(ctx.currentTime + 0.2);
    window.setTimeout(() => void ctx.close(), 250);
  }, []);

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
      messagingPrefsRef.current = { desktop: true, sound: false };
    }
  }, [userId, initialized, dispatch]);

  useEffect(() => {
    const settings = notificationSettingsQuery.data;
    if (!settings) return;
    messagingPrefsRef.current = {
      desktop: settings?.messaging?.desktop !== false,
      sound: Boolean(settings?.messaging?.sound),
    };
  }, [notificationSettingsQuery.data]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;
    const { joinUser, onNotification, onNotificationDeleted } = realtime;
    joinUser(userId);
    const unsub = onNotification((payload: any) => {
      const now = Date.now();
      dispatch(
        ingestRealtime({
          id: payload.id,
          type: payload.type,
          version: payload.version,
          message: payload.message,
          createdAt: payload.createdAt,
          isRead: payload.isRead,
          actor: payload.actor ?? null,
          target: payload.target ?? payload.payload?.target ?? null,
          subTargetId:
            payload.subTargetId ??
            payload.payload?.subTargetId ??
            payload.payload?.commentId ??
            null,
          payload: payload.payload ?? undefined,
          targetUrl: payload.targetUrl ?? payload.payload?.targetUrl ?? undefined,
        }),
      );
      dispatch(fetchUnreadCount());
      dispatch(fetchNotifications({ limit: 30 }));
      // Show toast for real-time notification
      if (payload.message) {
        toast.info(payload.message);
      }

      const type = String(payload?.type || '').toUpperCase();
      const isMessageSignal = type.includes('MESSAGE');
      const notVisible = document.visibilityState !== 'visible';
      if (!isMessageSignal) {
        return;
      }

      if (now - lastSignalRef.current < 800) {
        return;
      }
      lastSignalRef.current = now;

      if (messagingPrefsRef.current.sound) {
        playMessageTone();
      }

      if (messagingPrefsRef.current.desktop && notVisible && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification('WEAZ message', {
            body: payload.message || 'You have a new order message',
            tag: `WEAZ:${payload.id}`,
          });
        } else if (Notification.permission === 'default') {
          void Notification.requestPermission();
        }
      }
    });
    const unsubDeleted = onNotificationDeleted((payload: any) => {
      if (!payload?.id) return;
      dispatch(removeNotification({ id: payload.id }));
    });
    return () => {
      unsub();
      unsubDeleted();
    };
  }, [userId, realtime, dispatch, playMessageTone]);

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
  // Capped at 200 URLs to prevent unbounded memory growth.
  useEffect(() => {
    if (!items || items.length === 0) return;
    const MAX_PRELOADED = 200;
    for (const n of items) {
      const url = n.actor?.profileImage;
      if (url && !preloadedRef.current.has(url)) {
        // Evict all cached URLs when at capacity
        if (preloadedRef.current.size >= MAX_PRELOADED) {
          preloadedRef.current.clear();
        }
        const img = new Image();
        img.src = url;
        preloadedRef.current.add(url);
      }
    }
  }, [items]);

  // Reset preloaded avatar cache when user changes/logs out.
  useEffect(() => {
    return () => {
      preloadedRef.current.clear();
    };
  }, [userId]);
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
