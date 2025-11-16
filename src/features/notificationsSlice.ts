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
    return res as { items: RemoteNotification[]; hasNextPage: boolean; endCursor: string | null };
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
    ingestRealtime: (
      state,
      action: PayloadAction<{
        id: string;
        type: string;
        message: string;
        createdAt: string;
        isRead: boolean;
        actor?: RemoteNotificationActor | null;
      }>,
    ) => {
      const exists = state.items.find((n) => n.id === action.payload.id);
      if (!exists) {
        state.items.unshift(action.payload as RemoteNotification);
        state.unreadCount += 1;
        // cap list length
        if (state.items.length > 200) state.items.pop();
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // unread count
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unreadCount = action.payload;
      })
      // list fetch
      .addCase(fetchNotifications.pending, (state) => {
        state.loadingList = true; state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loadingList = false;
        // Merge avoiding duplicates when pagination
        const incoming = action.payload.items;
        const existingIds = new Set(state.items.map((n) => n.id));
        const merged = [...state.items];
        for (const n of incoming) if (!existingIds.has(n.id)) merged.push(n);
        // Sort by createdAt desc
        merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        state.items = merged;
        state.hasNextPage = action.payload.hasNextPage;
        state.endCursor = action.payload.endCursor;
        state.initialized = true;
        // Recompute unread count if server items include isRead states (optional)
        const unreadServer = state.items.filter((n) => !n.isRead).length;
        if (unreadServer > state.unreadCount) state.unreadCount = unreadServer; // don't clobber higher realtime
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.loadingList = false; state.error = action.error.message || 'Failed to load notifications';
      })
      // mark read single
      .addCase(markNotificationRead.pending, (state) => { state.loadingMark = true; })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        state.loadingMark = false;
        state.items = state.items.map((n) => n.id === action.payload.id ? { ...n, isRead: true } : n);
        state.unreadCount = Math.max(0, state.items.filter((n) => !n.isRead).length);
      })
      .addCase(markNotificationRead.rejected, (state) => { state.loadingMark = false; })
      // mark all read
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
  ingestRealtime,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;