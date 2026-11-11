import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, useCallback, useSyncExternalStore } from 'react';
import { io, Socket } from 'socket.io-client';
import { env } from '@/config/env';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { wsApplied, incrementCommentCount, decrementCommentCount } from '@/features/engagementSlice';
import { getApiSecurityIdentity, subscribeAccessToken } from '@/api/httpClient';
import { bindWebSessionSocket } from './webSessionSocket';

interface ThreadEventPayload {
  contentType: string;
  contentId: string;
  userId: string;
  threadCount: number;
  ts: number;
  version: number;
}
interface CommentEventPayload {
  contentType?: string;
  contentId?: string;
  commentId?: string;
  ts: number;
  version: number;
  [key: string]: any;
}

type ThreadHandler = (p: ThreadEventPayload) => void;
type CommentHandler = (p: CommentEventPayload) => void;

interface SubscriptionMap<T> { [id: string]: Set<T>; }
interface PendingJoinListeners {
  socket: Socket;
  onJoined: (payload?: { room?: string }) => void;
  onJoinDenied: (payload?: { room?: string }) => void;
}

interface RealtimeContextValue {
  joinCollection: (collectionId: string) => void;
  joinCollectionMedia: (mediaId: string) => void;
  joinUser: (userId: string) => void;
  joinComment: (commentId: string) => void;
  onThread: (contentType: string, contentId: string, handler: ThreadHandler) => () => void;
  onComment: (room: string, handler: CommentHandler) => () => void;
  onNotification: (handler: (payload: any) => void) => () => void;
  onNotificationDeleted: (handler: (payload: any) => void) => () => void;
  onMessageEvent: (event: string, handler: (payload: any) => void) => () => void;
  socketConnected: boolean;
  degraded: boolean;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export const useRealtime = () => {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used within RealtimeProvider');
  return ctx;
};

// Room naming mirrors backend: COLLECTION:{id}, COLLECTION_MEDIA:{id}, USER:{id}
// Fallback derive WS endpoint from axios baseURL config.
const buildUrl = () => {
  const raw = (env.api.defaultConfig.baseURL || '').trim();
  if (!raw) return 'ws://localhost:3000';
  return raw.startsWith('https')
    ? raw.replace(/^https/, 'wss')
    : raw.replace(/^http/, 'ws');
};

export const RealtimeProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const dispatch = useDispatch();
  const userId = useSelector((state: RootState) => state.user.profile?.id);
  const identity = useSyncExternalStore(subscribeAccessToken, getApiSecurityIdentity, () => null);
  const previousUserId = useRef<string | undefined>(undefined);
  const socketRef = useRef<Socket | null>(null);
  const threadSubs = useRef<SubscriptionMap<ThreadHandler>>({});
  const commentSubs = useRef<SubscriptionMap<CommentHandler>>({});
  // Every room ever requested this session; re-emitted on each (re)connect
  // because the server forgets memberships on disconnect.
  const desiredRooms = useRef<Set<string>>(new Set());
  const pendingJoins = useRef<Set<string>>(new Set());
  const pendingJoinTimeouts = useRef<Map<string, number>>(new Map());
  const pendingJoinListeners = useRef<Map<string, PendingJoinListeners>>(new Map());
  const [socketConnected, setSocketConnected] = useState(false);
  const failureCountRef = useRef(0);
  const degradedRef = useRef(false);
  const [degraded, setDegraded] = useState(false);

  const clearPendingJoin = useCallback((room: string) => {
    pendingJoins.current.delete(room);
    const listeners = pendingJoinListeners.current.get(room);
    if (listeners) {
      listeners.socket.off('joined', listeners.onJoined);
      listeners.socket.off('join.denied', listeners.onJoinDenied);
      pendingJoinListeners.current.delete(room);
    }
    const timeoutId = pendingJoinTimeouts.current.get(room);
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      pendingJoinTimeouts.current.delete(room);
    }
  }, []);

  const clearAllPendingJoins = useCallback(() => {
    pendingJoins.current.clear();
    for (const listeners of pendingJoinListeners.current.values()) {
      listeners.socket.off('joined', listeners.onJoined);
      listeners.socket.off('join.denied', listeners.onJoinDenied);
    }
    pendingJoinListeners.current.clear();
    for (const timeoutId of pendingJoinTimeouts.current.values()) {
      window.clearTimeout(timeoutId);
    }
    pendingJoinTimeouts.current.clear();
  }, []);

  // Clear the previous account before child passive subscription effects bind
  // the new account. Ordinary token rotation keeps the existing subscriptions.
  useLayoutEffect(() => {
    if (previousUserId.current && previousUserId.current !== userId) {
      desiredRooms.current.clear(); threadSubs.current = {}; commentSubs.current = {};
    }
    previousUserId.current = userId;
  }, [userId]);

  // Establish socket
  useEffect(() => {
    if (!userId) {
      const current = socketRef.current;
      if (current) {
        current.removeAllListeners();
        current.disconnect();
        socketRef.current = null;
      }
      clearAllPendingJoins();
      desiredRooms.current.clear();
      threadSubs.current = {};
      commentSubs.current = {};
      setSocketConnected(false);
      failureCountRef.current = 0;
      degradedRef.current = false;
      setDegraded(false);
      return;
    }
    // Persisted profile state may precede cookie restoration. Never connect as
    // another tab's cookie identity while this tab still shows the old user.
    if (!identity || identity.split(':')[0] !== userId) return;

    // Drop any other user's room from a previous session on this tab.
    for (const room of [...desiredRooms.current]) {
      if (room.startsWith('USER:') && room !== `USER:${userId}`) {
        desiredRooms.current.delete(room);
      }
    }

    const url = buildUrl();
    // Reconnection must survive mobile-browser life: tabs get backgrounded,
    // radios drop, servers restart. The previous config (3 attempts, 500ms
    // apart, then a permanent "degraded" latch that disabled reconnection)
    // meant ANY blip killed realtime for the rest of the session — approval
    // status updates, notifications, everything.
    const s = io(url, {
      withCredentials: true,
      transports: ['polling', 'websocket'],
      autoConnect: false,
      timeout: 10000,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
      randomizationFactor: 0.5,
    });
    socketRef.current = s;
    const unbindSession = bindWebSessionSocket(s);
    const onConnect = () => {
      setSocketConnected(true);
      failureCountRef.current = 0;
      degradedRef.current = false;
      setDegraded(false);
      // Server-side room membership is lost on every disconnect; rejoin all
      // rooms components still care about, then let listeners catch up on
      // anything missed while offline.
      clearAllPendingJoins();
      for (const room of desiredRooms.current) {
        s.emit('join', { room });
      }
      window.dispatchEvent(new CustomEvent('ws:restored'));
    };
    const onDisconnect = () => {
      setSocketConnected(false);
      clearAllPendingJoins();
    };
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    const onConnErr = () => {
      failureCountRef.current += 1;
      // Degraded is a UI signal only; reconnection keeps running with
      // exponential backoff, and connectivity events below nudge it.
      if (failureCountRef.current >= 5 && !degradedRef.current) {
        degradedRef.current = true;
        setDegraded(true);
      }
    };
    s.on('connect_error', onConnErr);
    s.on('reconnect_error', onConnErr);
    s.on('reconnect_failed', onConnErr);
    s.on('error', onConnErr);

    s.connect();

    return () => {
      unbindSession();
      s.off('connect', onConnect);
      s.off('connect_error', onConnErr);
      s.off('reconnect_error', onConnErr);
      s.off('reconnect_failed', onConnErr);
      s.off('error', onConnErr);
      s.off('disconnect', onDisconnect);
      s.removeAllListeners();
      s.disconnect();
      clearAllPendingJoins();
      if (socketRef.current === s) {
        socketRef.current = null;
      }
      setSocketConnected(false);
    };
  }, [clearAllPendingJoins, userId, identity]);

  const safeJoin = useCallback((room: string) => {
    if (!room || room.length > 64) return;
    // Validate basic room formats to avoid backend errors
    const [type, id, extra] = room.split(':');
    const uuidRe = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (extra || !['USER', 'POST', 'COLLECTION', 'COLLECTION_MEDIA', 'DESIGN', 'PRODUCT', 'COMMENT'].includes(type) || !uuidRe.test(id)) return;
    // Record intent even while disconnected: the connect handler flushes
    // desired rooms, so a join requested during an outage still lands.
    desiredRooms.current.add(room);
    const s = socketRef.current;
    if (!s || !s.connected) return;
    if (pendingJoins.current.has(room)) return;

    pendingJoins.current.add(room);

    const removeRoomTracking = () => {
      clearPendingJoin(room);
    };

    const onJoined = (payload?: { room?: string }) => {
      if (payload?.room && payload.room !== room) return;
      removeRoomTracking();
    };

    const onJoinDenied = (payload?: { room?: string }) => {
      if (payload?.room && payload.room !== room) return;
      removeRoomTracking();
    };

    s.on('joined', onJoined);
    s.on('join.denied', onJoinDenied);
    pendingJoinListeners.current.set(room, { socket: s, onJoined, onJoinDenied });

    const timeoutId = window.setTimeout(() => {
      removeRoomTracking();
    }, 10000);
    pendingJoinTimeouts.current.set(room, timeoutId);

    s.emit('join', { room });
  }, [clearPendingJoin]);

  const joinCollection = useCallback((collectionId: string) => safeJoin(`COLLECTION:${collectionId}`), [safeJoin]);
  const joinCollectionMedia = useCallback((mediaId: string) => safeJoin(`COLLECTION_MEDIA:${mediaId}`), [safeJoin]);
  const joinUser = useCallback((userId: string) => safeJoin(`USER:${userId}`), [safeJoin]);
  const joinComment = useCallback((commentId: string) => safeJoin(`COMMENT:${commentId}`), [safeJoin]);
  const releaseRoom = useCallback((room: string) => {
    if (threadSubs.current[room]?.size || commentSubs.current[room]?.size) return;
    desiredRooms.current.delete(room); clearPendingJoin(room);
    if (socketRef.current?.connected) socketRef.current.emit('leave', { room });
  }, [clearPendingJoin]);

  // Generic event router.
  // Keyed to `socketConnected` for the same reason as the on* subscribers above:
  // this effect used to run once, before the socket existed, bail on the null
  // check, and never re-run — so comment/thread fan-out was dead on arrival.
  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;

    const threadEvents = ['thread.created', 'thread.removed'] as const;
    for (const ev of threadEvents) {
      s.on(ev, (payload: ThreadEventPayload) => {
        const room = `${payload.contentType}:${payload.contentId}`;
        
        // Dispatch Redux action for thread count update
        dispatch(wsApplied({ 
          contentType: payload.contentType, 
          contentId: payload.contentId, 
          threadCount: payload.threadCount 
        }));
        
        const handlers = threadSubs.current[room];
        if (handlers) handlers.forEach((h) => h(payload));
      });
    }

    const commentEvents = ['comment.created', 'comment.deleted', 'comment.threaded'] as const;
    for (const ev of commentEvents) {
      s.on(ev, (payload: CommentEventPayload & { room?: string; targetType?: string; targetId?: string }) => {
        // Normalize keys and compute room
        const normType = (payload.contentType || payload.targetType) as string | undefined;
        const normId = (payload.contentId || payload.targetId) as string | undefined;
        const room = payload.room || (normType && normId ? `${normType}:${normId}` : undefined);
        if (!room) return;
        const enriched = { ...payload, event: ev, contentType: normType, contentId: normId } as any;

        // Dispatch Redux actions for comment count updates
        if (ev === 'comment.created' && normType && normId) {
          dispatch(incrementCommentCount({ contentType: normType, contentId: normId }));
        } else if (ev === 'comment.deleted' && normType && normId) {
          dispatch(decrementCommentCount({ contentType: normType, contentId: normId }));
        }

        const handlers = commentSubs.current[room];
        if (handlers) handlers.forEach((h) => h(enriched));
      });
    }

    return () => {
      for (const ev of [...threadEvents, ...commentEvents]) {
        s.off(ev);
      }
    };
  }, [dispatch, socketConnected, identity]);

  const onThread = useCallback((contentType: string, contentId: string, handler: ThreadHandler) => {
    if (!userId) return () => undefined;
    const room = `${contentType}:${contentId}`;
    if (!threadSubs.current[room]) threadSubs.current[room] = new Set();
    threadSubs.current[room].add(handler);
    safeJoin(room);
    return () => {
      threadSubs.current[room]?.delete(handler);
      if (threadSubs.current[room]?.size === 0) delete threadSubs.current[room];
      releaseRoom(room);
    };
  }, [safeJoin, releaseRoom, userId]);

  const onComment = useCallback((room: string, handler: CommentHandler) => {
    if (!userId) return () => undefined;
    if (!commentSubs.current[room]) commentSubs.current[room] = new Set();
    commentSubs.current[room].add(handler);
    safeJoin(room);
    return () => {
      commentSubs.current[room]?.delete(handler);
      if (commentSubs.current[room]?.size === 0) delete commentSubs.current[room];
      releaseRoom(room);
    };
  }, [safeJoin, releaseRoom, userId]);

  // These three read socketRef at call time and no-op when it is still null.
  // Child effects run BEFORE the provider's own socket effect on first mount, so
  // with empty dep arrays their identity never changed and a consumer that
  // subscribed on mount silently never attached a listener for the whole
  // session. Keying them to `socketConnected` makes the identity change once the
  // socket exists, which re-runs consumer effects and lands the subscription.
  const onNotification = useCallback((handler: (payload: any) => void) => {
    const s = socketRef.current;
    if (!s) return () => void 0;
    s.on('notification.created', handler);
    return () => { s.off('notification.created', handler); };
    // socketConnected is the intentional resubscribe trigger; the rule cannot
    // see the socketRef read that makes it load-bearing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketConnected, identity]);

  const onNotificationDeleted = useCallback((handler: (payload: any) => void) => {
    const s = socketRef.current;
    if (!s) return () => void 0;
    s.on('notification.deleted', handler);
    return () => { s.off('notification.deleted', handler); };
    // socketConnected is the intentional resubscribe trigger; the rule cannot
    // see the socketRef read that makes it load-bearing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketConnected, identity]);

  const onMessageEvent = useCallback((event: string, handler: (payload: any) => void) => {
    const s = socketRef.current;
    if (!s) return () => void 0;
    s.on(event, handler);
    return () => { s.off(event, handler); };
    // socketConnected is the intentional resubscribe trigger; the rule cannot
    // see the socketRef read that makes it load-bearing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socketConnected, identity]);

  const value = React.useMemo<RealtimeContextValue>(() => ({
    joinCollection,
    joinCollectionMedia,
    joinUser,
    joinComment,
    onThread,
    onComment,
    onNotification,
    onNotificationDeleted,
    onMessageEvent,
    socketConnected,
    degraded,
  }), [joinCollection, joinCollectionMedia, joinUser, joinComment, onThread, onComment, onNotification, onNotificationDeleted, onMessageEvent, socketConnected, degraded]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};
