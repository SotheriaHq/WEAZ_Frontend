import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { env } from '@/config/env';
import { getStoredAccessToken } from '@/api/httpClient';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { wsApplied, incrementCommentCount, decrementCommentCount } from '@/features/engagementSlice';

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
  const socketRef = useRef<Socket | null>(null);
  const threadSubs = useRef<SubscriptionMap<ThreadHandler>>({});
  const commentSubs = useRef<SubscriptionMap<CommentHandler>>({});
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

  // Establish socket
  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token || !userId) {
      const current = socketRef.current;
      if (current) {
        current.removeAllListeners();
        current.disconnect();
        socketRef.current = null;
      }
      clearAllPendingJoins();
      threadSubs.current = {};
      commentSubs.current = {};
      setSocketConnected(false);
      failureCountRef.current = 0;
      degradedRef.current = false;
      setDegraded(false);
      return;
    }

    const url = buildUrl();
    const s = io(url, {
      auth: token ? { token } : undefined,
      transports: ['polling', 'websocket'],
      autoConnect: true,
      timeout: 3000,
      reconnectionAttempts: 3,
      reconnectionDelay: 500,
    });
    socketRef.current = s;
    const onConnect = () => {
      setSocketConnected(true);
      failureCountRef.current = 0;
      degradedRef.current = false;
      setDegraded(false);
      window.dispatchEvent(new CustomEvent('ws:restored'));
    };
    const onDisconnect = () => {
      setSocketConnected(false);
      clearAllPendingJoins();
      threadSubs.current = {};
      commentSubs.current = {};
    };
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    const onConnErr = () => {
      if (degradedRef.current) return;
      failureCountRef.current += 1;
      if (failureCountRef.current >= 3) {
        degradedRef.current = true;
        setDegraded(true);
        try {
          (s.io as any).opts.reconnection = false;
        } catch {
          // Ignore socket adapter errors.
        }
        s.disconnect();
      }
    };
    s.on('connect_error', onConnErr);
    s.on('reconnect_error', onConnErr);
    s.on('reconnect_failed', onConnErr);
    s.on('error', onConnErr);
    return () => {
      s.off('connect', onConnect);
      s.off('connect_error', onConnErr);
      s.off('reconnect_error', onConnErr);
      s.off('reconnect_failed', onConnErr);
      s.off('error', onConnErr);
      s.off('disconnect', onDisconnect);
      s.removeAllListeners();
      s.disconnect();
      clearAllPendingJoins();
      threadSubs.current = {};
      commentSubs.current = {};
      if (socketRef.current === s) {
        socketRef.current = null;
      }
      setSocketConnected(false);
    };
  }, [clearAllPendingJoins, userId]);

  const safeJoin = useCallback((room: string) => {
    if (!room) return;
    // Validate basic room formats to avoid backend errors
    const [type, id] = room.split(':');
    const uuidRe = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!type || !id) return;
    if (type === 'USER') {
      if (!id.trim()) return;
    } else if (type === 'COLLECTION' || type === 'COLLECTION_MEDIA' || type === 'COMMENT') {
      if (!uuidRe.test(id)) return; // discard malformed
    }
    const s = socketRef.current;
    if (!s) return;
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

    s.emit('join', { room, userId });
  }, [clearPendingJoin, userId]);

  const joinCollection = useCallback((collectionId: string) => safeJoin(`COLLECTION:${collectionId}`), [safeJoin]);
  const joinCollectionMedia = useCallback((mediaId: string) => safeJoin(`COLLECTION_MEDIA:${mediaId}`), [safeJoin]);
  const joinUser = useCallback((userId: string) => safeJoin(`USER:${userId}`), [safeJoin]);
  const joinComment = useCallback((commentId: string) => safeJoin(`COMMENT:${commentId}`), [safeJoin]);

  // Generic event router
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
  }, [dispatch]);

  const onThread = useCallback((contentType: string, contentId: string, handler: ThreadHandler) => {
    const room = `${contentType}:${contentId}`;
    if (!threadSubs.current[room]) threadSubs.current[room] = new Set();
    threadSubs.current[room].add(handler);
    if (contentType === 'COLLECTION') {
      joinCollection(contentId);
    } else if (contentType === 'COLLECTION_MEDIA') {
      joinCollectionMedia(contentId);
    }
    return () => {
      threadSubs.current[room]?.delete(handler);
      if (threadSubs.current[room]?.size === 0) delete threadSubs.current[room];
    };
  }, [joinCollection, joinCollectionMedia]);

  const onComment = useCallback((room: string, handler: CommentHandler) => {
    if (!commentSubs.current[room]) commentSubs.current[room] = new Set();
    commentSubs.current[room].add(handler);
    safeJoin(room);
    return () => {
      commentSubs.current[room]?.delete(handler);
      if (commentSubs.current[room]?.size === 0) delete commentSubs.current[room];
    };
  }, [safeJoin]);

  const onNotification = useCallback((handler: (payload: any) => void) => {
    const s = socketRef.current;
    if (!s) return () => void 0;
    s.on('notification.created', handler);
    return () => { s.off('notification.created', handler); };
  }, []);

  const onNotificationDeleted = useCallback((handler: (payload: any) => void) => {
    const s = socketRef.current;
    if (!s) return () => void 0;
    s.on('notification.deleted', handler);
    return () => { s.off('notification.deleted', handler); };
  }, []);

  const value = React.useMemo<RealtimeContextValue>(() => ({
    joinCollection,
    joinCollectionMedia,
    joinUser,
    joinComment,
    onThread,
    onComment,
    onNotification,
    onNotificationDeleted,
    socketConnected,
    degraded,
  }), [joinCollection, joinCollectionMedia, joinUser, joinComment, onThread, onComment, onNotification, onNotificationDeleted, socketConnected, degraded]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};
