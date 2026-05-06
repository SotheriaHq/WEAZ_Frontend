import { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { UserPreferencesApi } from '@/api/UserPreferencesApi';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { setUser } from '@/features/userSlice';
import type { AppDispatch, RootState } from '@/store';
import type { ThemePreference } from '@/types/theme';

export const useSyncedThemePreference = () => {
  const themeState = useTheme();
  const { loading } = useAuth();
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.user.profile);
  const isAuthenticated = useSelector((state: RootState) => state.user.isAuthenticated);

  const setThemePreference = useCallback(
    async (themePreference: ThemePreference) => {
      themeState.setThemePreference(themePreference);

      if (loading || !isAuthenticated || !user?.id) {
        return;
      }

      try {
        const updated = await UserPreferencesApi.updateThemePreference(themePreference);
        dispatch(
          setUser({
            ...user,
            themePreference: updated.themePreference,
          }),
        );
      } catch (error) {
        console.warn('Theme preference sync failed; keeping local preference.', error);
        toast.error('Theme preference saved locally, but could not sync to your account.');
      }
    },
    [dispatch, isAuthenticated, loading, themeState, user],
  );

  return {
    ...themeState,
    setThemePreference,
    setTheme: setThemePreference,
  };
};
