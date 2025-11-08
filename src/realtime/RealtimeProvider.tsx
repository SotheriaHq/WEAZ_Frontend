import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { env } from '@/config/env';
import { getStoredAccessToken } from '@/api/httpClient';

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
  onLike: (contentType: string, contentId: string, handler: LikeHandler) => () => void;
  onComment: (room: string, handler: CommentHandler) => () => void;
  onNotification: (handler: (payload: any) => void) => () => void;
  socketConnected: boolean;
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
  const socketRef = useRef<Socket | null>(null);
  const likeSubs = useRef<SubscriptionMap<LikeHandler>>({});
  const commentSubs = useRef<SubscriptionMap<CommentHandler>>({});
  const pendingJoins = useRef<Set<string>>(new Set());
  const [socketConnected, setSocketConnected] = useState(false);

  // Establish socket
  useEffect(() => {
    const token = getStoredAccessToken();
    const url = buildUrl();
    const s = io(url, {
      auth: token ? { token } : undefined,
      transports: ['websocket'],
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
    });
    socketRef.current = s;
    s.on('connect', () => setSocketConnected(true));
    s.on('disconnect', () => setSocketConnected(false));
    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, []);

  const safeJoin = useCallback((room: string) => {
    if (!room) return;
    if (pendingJoins.current.has(room)) return;
    pendingJoins.current.add(room);
    const s = socketRef.current;
    if (!s) return;
    s.emit('join', { room });
    const cleanup = () => pendingJoins.current.delete(room);
    s.once('joined', cleanup);
    s.once('join.denied', cleanup);
  }, []);

  const joinCollection = useCallback((collectionId: string) => safeJoin(`COLLECTION:${collectionId}`), [safeJoin]);
  const joinCollectionMedia = useCallback((mediaId: string) => safeJoin(`COLLECTION_MEDIA:${mediaId}`), [safeJoin]);
  const joinUser = useCallback((userId: string) => safeJoin(`USER:${userId}`), [safeJoin]);

  // Generic event router
  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;

    const likeEvents = ['like.created', 'like.removed'] as const;
    for (const ev of likeEvents) {
      s.on(ev, (payload: LikeEventPayload) => {
        const room = `${payload.contentType}:${payload.contentId}`;
        const handlers = likeSubs.current[room];
        if (handlers) handlers.forEach((h) => h(payload));
      });
    }

    const commentEvents = ['comment.created', 'comment.deleted', 'comment.liked'] as const;
    for (const ev of commentEvents) {
      s.on(ev, (payload: CommentEventPayload & { room?: string }) => {
        const room = payload.room || (payload.contentType && payload.contentId ? `${payload.contentType}:${payload.contentId}` : undefined);
        if (!room) return;
        const handlers = commentSubs.current[room];
        if (handlers) handlers.forEach((h) => h(payload));
      });
    }

    return () => {
      for (const ev of [...likeEvents, ...commentEvents]) {
        s.off(ev);
      }
    };
  }, []);

  const onLike = useCallback((contentType: string, contentId: string, handler: LikeHandler) => {
    const room = `${contentType}:${contentId}`;
    if (!likeSubs.current[room]) likeSubs.current[room] = new Set();
    likeSubs.current[room].add(handler);
    joinCollection(contentType === 'COLLECTION' ? contentId : ''); // only auto join collection if needed
    return () => {
      likeSubs.current[room]?.delete(handler);
      if (likeSubs.current[room]?.size === 0) delete likeSubs.current[room];
    };
  }, [joinCollection]);

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

  const value: RealtimeContextValue = {
    joinCollection,
    joinCollectionMedia,
    joinUser,
    onLike,
    onComment,
    onNotification,
    socketConnected,
  };

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
};
