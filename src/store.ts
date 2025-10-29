import { configureStore } from '@reduxjs/toolkit';
import userReducer from './features/userSlice';
import engagementReducer from './features/engagementSlice';
import notificationsReducer from './features/notificationsSlice';

export const store = configureStore({
  reducer: {
    user: userReducer,
    engagement: engagementReducer,
    notifications: notificationsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
