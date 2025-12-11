import { configureStore } from '@reduxjs/toolkit';
import userReducer from './features/userSlice';
import engagementReducer from './features/engagementSlice';
import notificationsReducer from './features/notificationsSlice';
import patchesReducer from './features/patchesSlice';
import uiReducer from './features/uiSlice';
import cartReducer from './features/cartSlice';
import wishlistReducer from './features/wishlistSlice';

export const store = configureStore({
  reducer: {
    user: userReducer,
    engagement: engagementReducer,
    notifications: notificationsReducer,
    patches: patchesReducer,
    ui: uiReducer,
    cart: cartReducer,
    wishlist: wishlistReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore Set serialization warnings for wishlist
        ignoredPaths: ['wishlist.wishlistedIds'],
        ignoredActions: ['wishlist/fetchWishlist/fulfilled'],
      },
    }),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

