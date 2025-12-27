import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { env } from '@/config/env';
import { getStoredAccessToken } from '@/api/httpClient';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { wsApplied, incrementCommentCount, decrementCommentCount } from '@/features/engagementSlice';

interface LikeEventPayload {
  contentType: string;
  contentId: string;
  userId: string;
  likeCount: number;
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

type LikeHandler = (p: LikeEventPayload) => void;
type CommentHandler = (p: CommentEventPayload) => void;

interface SubscriptionMap<T> { [id: string]: Set<T>; }

interface RealtimeContextValue {
  joinCollection: (collectionId: string) => void;
  joinCollectionMedia: (mediaId: string) => void;
  joinUser: (userId: string) => void;
  joinComment: (commentId: string) => void;
  onLike: (contentType: string, contentId: string, handler: LikeHandler) => () => void;
  onComment: (room: string, handler: CommentHandler) => () => void;
  onNotification: (handler: (payload: any) => void) => () => void;
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
  const likeSubs = useRef<SubscriptionMap<LikeHandler>>({});
  const commentSubs = useRef<SubscriptionMap<CommentHandler>>({});
  const pendingJoins = useRef<Set<string>>(new Set());
  const [socketConnected, setSocketConnected] = useState(false);
  const failureCountRef = useRef(0);
  const degradedRef = useRef(false);
  const [degraded, setDegraded] = useState(false);

  // Establish socket
  useEffect(() => {
    const token = getStoredAccessToken();
    const url = buildUrl();
    const s = io(url, {
      auth: token ? { token } : undefined,
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
    });
    socketRef.current = s;
    s.on('connect', () => setSocketConnected(true));
    s.on('disconnect', () => setSocketConnected(false));

    const onConnErr = () => {
      failureCountRef.current += 1;
      if (failureCountRef.current >= 5 && !degradedRef.current) {
        degradedRef.current = true;
        setDegraded(true);
        try { (s.io as any).opts.reconnection = false; } catch {}
      }
    };
    s.on('reconnect_error', onConnErr);
    s.on('reconnect_failed', onConnErr);
    s.on('error', onConnErr);
    s.on('connect', () => {
      failureCountRef.current = 0;
      degradedRef.current = false;
      setDegraded(false);
      window.dispatchEvent(new CustomEvent('ws:restored'));
    });
    return () => {
      s.off('reconnect_error', onConnErr);
      s.off('reconnect_failed', onConnErr);
      s.off('error', onConnErr);
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

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
    if (pendingJoins.current.has(room)) return;
    pendingJoins.current.add(room);
    const s = socketRef.current;
    if (!s) return;
    s.emit('join', { room, userId });
    const cleanup = () => pendingJoins.current.delete(room);
    s.once('joined', cleanup);
    s.once('join.denied', cleanup);
  }, [userId]);

  const joinCollection = useCallback((collectionId: string) => safeJoin(`COLLECTION:${collectionId}`), [safeJoin]);
  const joinCollectionMedia = useCallback((mediaId: string) => safeJoin(`COLLECTION_MEDIA:${mediaId}`), [safeJoin]);
  const joinUser = useCallback((userId: string) => safeJoin(`USER:${userId}`), [safeJoin]);
  const joinComment = useCallback((commentId: string) => safeJoin(`COMMENT:${commentId}`), [safeJoin]);

  // Generic event router
  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;

    const likeEvents = ['like.created', 'like.removed'] as const;
    for (const ev of likeEvents) {
      s.on(ev, (payload: LikeEventPayload) => {
        const room = `${payload.contentType}:${payload.contentId}`;
        
        // Dispatch Redux action for like count update
        dispatch(wsApplied({ 
          contentType: payload.contentType, 
          contentId: payload.contentId, 
          likeCount: payload.likeCount 
        }));
        
        const handlers = likeSubs.current[room];
        if (handlers) handlers.forEach((h) => h(payload));
      });
    }

    const commentEvents = ['comment.created', 'comment.deleted', 'comment.liked'] as const;
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
      for (const ev of [...likeEvents, ...commentEvents]) {
        s.off(ev);
      }
    };
  }, [dispatch]);

  const onLike = useCallback((contentType: string, contentId: string, handler: LikeHandler) => {
    const room = `${contentType}:${contentId}`;
    if (!likeSubs.current[room]) likeSubs.current[room] = new Set();
    likeSubs.current[room].add(handler);
    if (contentType === 'COLLECTION') {
      joinCollection(contentId);
    } else if (contentType === 'COLLECTION_MEDIA') {
      joinCollectionMedia(contentId);
    }
    return () => {
      likeSubs.current[room]?.delete(handler);
      if (likeSubs.current[room]?.size === 0) delete likeSubs.current[room];
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

  const value = React.useMemo<RealtimeContextValue>(() => ({
    joinCollection,
    joinCollectionMedia,
    joinUser,
    joinComment,
    onLike,
    onComment,
    onNotification,
    socketConnected,
    degraded,
  }), [joinCollection, joinCollectionMedia, joinUser, joinComment, onLike, onComment, onNotification, socketConnected, degraded]);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};
