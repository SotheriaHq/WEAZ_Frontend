import { useCallback } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { toast } from 'sonner';
import { UserPreferencesApi } from '@/api/UserPreferencesApi';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { patchUser } from '@/features/userSlice';
import type { AppDispatch, RootState } from '@/store';
import type { ThemePreference } from '@/types/theme';

/**
 * Theme preference, applied locally at once and synced to the account.
 *
 * A theme switch must never touch anything else on screen. The account copy
 * is written with `patchUser({ themePreference })` — that one field — and
 * only when it differs. It used to dispatch `setUser({ ...user, ... })` with
 * the profile captured before the request, which put every field of that
 * snapshot back: a store membership created meanwhile disappeared, the
 * brand-setup modal (which needs one) closed, and the user landed on the
 * catalogue mid-edit.
 */
export const useSyncedThemePreference = () => {
  const themeState = useTheme();
  const { loading } = useAuth();
  const dispatch = useDispatch<AppDispatch>();
  const store = useStore<RootState>();
  const userId = useSelector((state: RootState) => state.user.profile?.id ?? null);
  const isAuthenticated = useSelector((state: RootState) => state.user.isAuthenticated);

  const setThemePreference = useCallback(
    async (themePreference: ThemePreference) => {
      themeState.setThemePreference(themePreference);

      if (loading || !isAuthenticated || !userId) {
        return;
      }

      try {
        const updated = await UserPreferencesApi.updateThemePreference(themePreference);
        // Read the profile NOW, not from the render that started the request.
        const current = store.getState().user.profile;
        if (!current || current.id !== userId) return;
        if (current.themePreference === updated.themePreference) return;
        dispatch(patchUser({ id: userId, themePreference: updated.themePreference }));
      } catch (error) {
        console.warn('Theme preference sync failed; keeping local preference.', error);
        toast.error('Theme preference saved locally, but could not sync to your account.');
      }
    },
    [dispatch, isAuthenticated, loading, store, themeState, userId],
  );

  return {
    ...themeState,
    setThemePreference,
    setTheme: setThemePreference,
  };
};
