import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { NotificationsApi } from '@/api/NotificationsApi';

interface RemoteNotificationActor {
  id?: string | null;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  profileImage?: string | null;
}

export interface RemoteNotification {
  id: string;
  type: string;
  version?: 1 | 2; // Schema version: 1 = legacy, 2 = structured
  message: string;
  createdAt: string;
  isRead: boolean;
  actor?: RemoteNotificationActor | null;
  target?: {
    type: 'POST' | 'COLLECTION' | 'COLLECTION_MEDIA' | 'PRODUCT' | 'USER' | 'SYSTEM';
    id: string;
    preview?: string;
  } | null;
  subTargetId?: string | null; // For deep linking (e.g., comment ID)
  payload?: Record<string, unknown>;
  targetUrl?: string;
}

interface LocalNotification {
  id: string;
  message: string;
  createdAt: string;
}

interface NotificationState {
  unreadCount: number;
  isLoading: boolean;
  local: LocalNotification[]; // ephemeral toasts added locally
  items: RemoteNotification[]; // server sourced
  endCursor: string | null;
  hasNextPage: boolean;
  loadingList: boolean;
  loadingMark: boolean;
  error: string | null;
  initialized: boolean; // first fetch done
}

const initialState: NotificationState = {
  unreadCount: 0,
  isLoading: false,
  local: [],
  items: [],
  endCursor: null,
  hasNextPage: false,
  loadingList: false,
  loadingMark: false,
  error: null,
  initialized: false,
};

const SEMANTIC_DEDUPE_WINDOW_MS = 45_000;

const toIsoDate = (value: string | undefined): string => {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const safeLower = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const resolveTargetFromNotification = (
  value: Pick<RemoteNotification, 'target' | 'payload'>,
): { type: string; id: string } | null => {
  if (value.target?.type && value.target?.id) {
    return { type: value.target.type, id: value.target.id };
  }

  const payload = value.payload;
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const nestedTarget = (payload as Record<string, unknown>).target;
  if (
    nestedTarget &&
    typeof nestedTarget === 'object' &&
    !Array.isArray(nestedTarget) &&
    typeof (nestedTarget as Record<string, unknown>).type === 'string' &&
    typeof (nestedTarget as Record<string, unknown>).id === 'string'
  ) {
    return {
      type: String((nestedTarget as Record<string, unknown>).type),
      id: String((nestedTarget as Record<string, unknown>).id),
    };
  }

  const payloadRecord = payload as Record<string, unknown>;
  if (typeof payloadRecord.collectionId === 'string') {
    return { type: 'COLLECTION', id: payloadRecord.collectionId };
  }
  if (typeof payloadRecord.postId === 'string') {
    return { type: 'POST', id: payloadRecord.postId };
  }
  if (typeof payloadRecord.productId === 'string') {
    return { type: 'PRODUCT', id: payloadRecord.productId };
  }

  return null;
};

const resolveSubTargetId = (
  value: Pick<RemoteNotification, 'subTargetId' | 'payload'>,
): string => {
  if (typeof value.subTargetId === 'string') return value.subTargetId;
  const payload = value.payload as Record<string, unknown> | undefined;
  if (!payload || typeof payload !== 'object') return '';
  if (typeof payload.subTargetId === 'string') return payload.subTargetId;
  if (typeof payload.commentId === 'string') return payload.commentId;
  if (typeof payload.parentId === 'string') return payload.parentId;
  return '';
};

const resolveTargetUrl = (value: Pick<RemoteNotification, 'targetUrl' | 'payload'>): string => {
  if (typeof value.targetUrl === 'string') return value.targetUrl;
  const payload = value.payload as Record<string, unknown> | undefined;
  if (payload && typeof payload.targetUrl === 'string') return payload.targetUrl;
  return '';
};

const buildSemanticKey = (
  value: Pick<RemoteNotification, 'type' | 'actor' | 'message' | 'target' | 'subTargetId' | 'payload' | 'targetUrl'>,
): string => {
  const target = resolveTargetFromNotification(value);
  const actorId = value.actor?.id ?? '';
  const subTargetId = resolveSubTargetId(value);
  const targetUrl = resolveTargetUrl(value);
  const message = safeLower(value.message).slice(0, 160);
  return [
    value.type,
    actorId,
    target?.type ?? '',
    target?.id ?? '',
    subTargetId,
    targetUrl,
    message,
  ].join('|');
};

const findSemanticDuplicateIndex = (
  items: RemoteNotification[],
  incoming: RemoteNotification,
): number => {
  const incomingKey = buildSemanticKey(incoming);
  const incomingTs = new Date(incoming.createdAt).getTime();
  const safeIncomingTs = Number.isNaN(incomingTs) ? Date.now() : incomingTs;

  return items.findIndex((existing) => {
    if (buildSemanticKey(existing) !== incomingKey) return false;
    const existingTs = new Date(existing.createdAt).getTime();
    const safeExistingTs = Number.isNaN(existingTs) ? safeIncomingTs : existingTs;
    return Math.abs(safeExistingTs - safeIncomingTs) <= SEMANTIC_DEDUPE_WINDOW_MS;
  });
};

// Thunks
export const fetchUnreadCount = createAsyncThunk('notifications/fetchUnreadCount', async () => {
  const res = await NotificationsApi.getUnreadCount();
  return res.count;
});

export const fetchNotifications = createAsyncThunk(
  'notifications/fetchList',
  async (args: { cursor?: string; limit?: number; type?: string } | undefined) => {
    const res = await NotificationsApi.list(args?.cursor, args?.limit, args?.type);
    return res as { items: any[]; hasNextPage: boolean; endCursor: string | null };
  },
);

export const markNotificationRead = createAsyncThunk(
  'notifications/markRead',
  async (id: string) => {
    const res = await NotificationsApi.markAsRead(id);
    return { id, success: res.success };
  },
);

export const markAllNotificationsRead = createAsyncThunk(
  'notifications/markAllRead',
  async () => {
    const res = await NotificationsApi.markAllAsRead();
    return { success: res.success };
  },
);

export const deleteNotification = createAsyncThunk(
  'notifications/delete',
  async (id: string) => {
    const res = await NotificationsApi.delete(id);
    return { id: res.id, success: res.success };
  },
);

export const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setUnreadCount: (state, action: PayloadAction<number>) => {
      state.unreadCount = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    incrementUnreadCount: (state) => {
      state.unreadCount += 1;
    },
    decrementUnreadCount: (state) => {
      state.unreadCount = Math.max(0, state.unreadCount - 1);
    },
    resetUnreadCount: (state) => {
      state.unreadCount = 0;
    },
    addLocalNotification: (state, action: PayloadAction<{ id?: string; message: string; createdAt?: string }>) => {
      const id = action.payload.id ?? `local-${Date.now()}`;
      const createdAt = action.payload.createdAt ?? new Date().toISOString();
      state.local = [{ id, message: action.payload.message, createdAt }, ...state.local].slice(0, 50);
      state.unreadCount += 1;
    },
    clearLocalNotifications: (state) => { state.local = []; },
    resetState: () => ({ ...initialState }),
    removeNotification: (state, action: PayloadAction<{ id: string }>) => {
      state.items = state.items.filter((n) => n.id !== action.payload.id);
      state.unreadCount = state.items.filter((n) => !n.isRead).length;
    },
    ingestRealtime: (
      state,
      action: PayloadAction<{
        id: string;
        type: string;
        version?: 1 | 2;
        message: string;
        createdAt: string;
        isRead: boolean;
        actor?: RemoteNotificationActor | null;
        target?: {
          type: 'POST' | 'COLLECTION' | 'COLLECTION_MEDIA' | 'PRODUCT' | 'USER' | 'SYSTEM';
          id: string;
          preview?: string;
        } | null;
        subTargetId?: string | null;
        payload?: any;
        targetUrl?: string;
      }>,
    ) => {
      const incoming: RemoteNotification = {
        id: action.payload.id,
        type: action.payload.type,
        version: action.payload.version,
        message: action.payload.message,
        createdAt: toIsoDate(action.payload.createdAt),
        isRead: action.payload.isRead,
        actor: action.payload.actor ?? null,
        target: action.payload.target ?? action.payload.payload?.target ?? null,
        subTargetId:
          action.payload.subTargetId ??
          action.payload.payload?.subTargetId ??
          action.payload.payload?.commentId ??
          null,
        payload: action.payload.payload,
        targetUrl: action.payload.targetUrl ?? action.payload.payload?.targetUrl,
      };

      const existingIndex = state.items.findIndex((n) => n.id === incoming.id);
      if (existingIndex >= 0) {
        state.items[existingIndex] = {
          ...state.items[existingIndex],
          ...incoming,
        };
        return;
      }

      const semanticDuplicateIndex = findSemanticDuplicateIndex(state.items, incoming);
      if (semanticDuplicateIndex >= 0) {
        const existing = state.items[semanticDuplicateIndex];
        state.items[semanticDuplicateIndex] = {
          ...existing,
          ...incoming,
          id: existing.id,
          isRead: existing.isRead || incoming.isRead,
        };
        return;
      }

      state.items.unshift(incoming);
      state.unreadCount += 1;
      // cap list length
      if (state.items.length > 200) state.items.pop();
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload;
      })
      .addCase(fetchNotifications.pending, (state) => {
        state.loadingList = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loadingList = false;
        const payload = action.payload as any;
        const incoming = Array.isArray(payload.items) ? payload.items : [];
        const hasNextPage = !!payload.hasNextPage;
        const endCursor = typeof payload.endCursor === 'string' || payload.endCursor === null ? payload.endCursor : null;
        for (const n of incoming) {
          if (!(n && typeof n === 'object' && typeof n.id === 'string')) {
            continue;
          }

          const normalizedTarget =
            n.target &&
            typeof n.target === 'object' &&
            typeof n.target.type === 'string' &&
            typeof n.target.id === 'string'
              ? {
                  type: n.target.type,
                  id: n.target.id,
                  preview: typeof n.target.preview === 'string' ? n.target.preview : undefined,
                }
              : undefined;

          const normalizedSubTargetId =
            typeof n.subTargetId === 'string'
              ? n.subTargetId
              : typeof n.payload?.subTargetId === 'string'
                ? n.payload.subTargetId
                : typeof n.payload?.commentId === 'string'
                  ? n.payload.commentId
                  : undefined;

          const normalizedTargetUrl =
            typeof n.targetUrl === 'string'
              ? n.targetUrl
              : typeof n.payload?.targetUrl === 'string'
                ? n.payload.targetUrl
                : undefined;

          const normalized: RemoteNotification = {
            id: n.id,
            type: n.type,
            version: n.version,
            message: n.message,
            createdAt: toIsoDate(
              typeof n.createdAt === 'string'
                ? n.createdAt
                : new Date(n.createdAt).toISOString(),
            ),
            isRead: !!n.isRead,
            actor: n.actor ?? null,
            target: normalizedTarget ?? null,
            subTargetId: normalizedSubTargetId ?? null,
            payload: n.payload,
            targetUrl: normalizedTargetUrl,
          };

          const existingIndex = state.items.findIndex((item) => item.id === n.id);
          if (existingIndex >= 0) {
            const existing = state.items[existingIndex];
            state.items[existingIndex] = {
              ...existing,
              ...normalized,
              actor: normalized.actor ?? existing.actor ?? null,
              target: normalized.target ?? existing.target ?? null,
              subTargetId: normalized.subTargetId ?? existing.subTargetId ?? null,
              payload: normalized.payload ?? existing.payload,
              targetUrl: normalized.targetUrl ?? existing.targetUrl,
            };
            continue;
          }

          const semanticDuplicateIndex = findSemanticDuplicateIndex(state.items, normalized);
          if (semanticDuplicateIndex >= 0) {
            const existing = state.items[semanticDuplicateIndex];
            state.items[semanticDuplicateIndex] = {
              ...existing,
              ...normalized,
              id: existing.id,
              isRead: existing.isRead || normalized.isRead,
              actor: normalized.actor ?? existing.actor ?? null,
              target: normalized.target ?? existing.target ?? null,
              subTargetId: normalized.subTargetId ?? existing.subTargetId ?? null,
              payload: normalized.payload ?? existing.payload,
              targetUrl: normalized.targetUrl ?? existing.targetUrl,
            };
            continue;
          }

          state.items.push(normalized);
        }
        state.items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        state.hasNextPage = hasNextPage;
        state.endCursor = endCursor;
        state.initialized = true;
        const serverUnread = state.items.filter((n) => !n.isRead).length;
        if (serverUnread > state.unreadCount) state.unreadCount = serverUnread;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loadingList = false;
        state.error = action.error.message || 'Failed to load notifications';
      })
      .addCase(markNotificationRead.pending, (state) => {
        state.loadingMark = true;
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        state.loadingMark = false;
        state.items = state.items.map((n) => (n.id === action.payload.id ? { ...n, isRead: true } : n));
        state.unreadCount = state.items.filter((n) => !n.isRead).length;
      })
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.items = state.items.map((n) => ({ ...n, isRead: true }));
        state.unreadCount = 0;
      })
      .addCase(deleteNotification.fulfilled, (state, action) => {
        state.items = state.items.filter((n) => n.id !== action.payload.id);
        state.unreadCount = state.items.filter((n) => !n.isRead).length;
      });
  },
});

export const {
  setUnreadCount,
  setLoading,
  incrementUnreadCount,
  decrementUnreadCount,
  resetUnreadCount,
  addLocalNotification,
  clearLocalNotifications,
  resetState,
  removeNotification,
  ingestRealtime,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;
