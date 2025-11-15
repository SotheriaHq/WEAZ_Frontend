import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface LocalNotification {
  id: string;
  message: string;
  createdAt: string;
}

interface NotificationState {
  unreadCount: number;
  isLoading: boolean;
  local: LocalNotification[];
}

const initialState: NotificationState = {
  unreadCount: 0,
  isLoading: false,
  local: [],
};

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
    clearLocalNotifications: (state) => {
      state.local = [];
    },
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
} = notificationsSlice.actions;

export default notificationsSlice.reducer;