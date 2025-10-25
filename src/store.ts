import { configureStore } from '@reduxjs/toolkit';
import userReducer from './features/userSlice';
import engagementReducer from './features/engagementSlice';

export const store = configureStore({
  reducer: {
    user: userReducer,
    engagement: engagementReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
