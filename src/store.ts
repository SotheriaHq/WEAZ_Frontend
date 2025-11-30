import { configureStore } from '@reduxjs/toolkit';
import userReducer from './features/userSlice';
import engagementReducer from './features/engagementSlice';
import notificationsReducer from './features/notificationsSlice';
import patchesReducer from './features/patchesSlice';
import uiReducer from './features/uiSlice';

export const store = configureStore({
  reducer: {
    user: userReducer,
    engagement: engagementReducer,
    notifications: notificationsReducer,
    patches: patchesReducer,
    ui: uiReducer,
  },
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

