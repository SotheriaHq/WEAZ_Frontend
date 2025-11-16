import { useCallback, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';
import { useRealtime } from '@/realtime';
import {
  fetchNotifications,
  fetchUnreadCount,
  ingestRealtime,
  markAllNotificationsRead,
  markNotificationRead,
  resetUnreadCount,
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
  const preloadedRef = useRef<Set<string>>(new Set());
  const prevUserRef = useRef<string | undefined>(undefined);

  // Initial fetch when authenticated
  useEffect(() => {
    if (userId) {
      // Fetch on first mount for this user or if user changed
      const userChanged = prevUserRef.current && prevUserRef.current !== userId;
      if (!initialized || userChanged) {
        dispatch(fetchUnreadCount());
        dispatch(fetchNotifications({ limit: 30 }));
      }
      prevUserRef.current = userId;
    } else {
      // User logged out; reset unread count locally
      dispatch(resetUnreadCount());
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
        }),
      );
    });
    return () => { unsub(); };
  }, [userId, realtime, dispatch]);

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
  const dispatch = useDispatch();
  const markRead = useCallback((id: string) => { dispatch(markNotificationRead(id)); }, [dispatch]);
  const markAll = useCallback(() => { dispatch(markAllNotificationsRead()); }, [dispatch]);
  const loadMore = useCallback((cursor?: string) => {
    dispatch(fetchNotifications({ cursor, limit: 30 }));
  }, [dispatch]);
  return { markRead, markAll, loadMore };
}
