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
  message: string;
  createdAt: string;
  isRead: boolean;
  actor?: RemoteNotificationActor | null;
  payload?: any;
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
    ingestRealtime: (
      state,
      action: PayloadAction<{
        id: string;
        type: string;
        message: string;
        createdAt: string;
        isRead: boolean;
        actor?: RemoteNotificationActor | null;
        payload?: any;
        targetUrl?: string;
      }>,
    ) => {
      const exists = state.items.find((n) => n.id === action.payload.id);
      if (!exists) {
        const incoming: RemoteNotification = {
          id: action.payload.id,
          type: action.payload.type,
          message: action.payload.message,
          createdAt: action.payload.createdAt,
          isRead: action.payload.isRead,
          actor: action.payload.actor ?? null,
          payload: action.payload.payload,
          targetUrl: action.payload.targetUrl ?? action.payload.payload?.targetUrl,
        };
        state.items.unshift(incoming);
        state.unreadCount += 1;
        // cap list length
        if (state.items.length > 200) state.items.pop();
      }
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
        const existingIds = new Set(state.items.map((n) => n.id));
        for (const n of incoming) {
          if (n && typeof n === 'object' && typeof n.id === 'string' && !existingIds.has(n.id)) {
            state.items.push({
              id: n.id,
              type: n.type,
              message: n.message,
              createdAt: typeof n.createdAt === 'string' ? n.createdAt : new Date(n.createdAt).toISOString(),
              isRead: !!n.isRead,
              actor: n.actor ?? null,
              payload: n.payload,
              targetUrl: n.targetUrl ?? n.payload?.targetUrl,
            });
          }
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
  ingestRealtime,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;