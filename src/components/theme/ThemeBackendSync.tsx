import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import type { RootState } from '@/store';
import { normalizeThemePreference } from '@/types/theme';
import { useEmbeddedSurface } from '@/hooks/useEmbeddedSurface';

export const ThemeBackendSync = () => {
  const { loading } = useAuth();
  const user = useSelector((state: RootState) => state.user.profile);
  const isAuthenticated = useSelector((state: RootState) => state.user.isAuthenticated);
  const { syncThemePreferenceFromBackend } = useTheme();
  const lastAppliedKeyRef = useRef<string | null>(null);
  const embeddedSurface = useEmbeddedSurface();
  const isEmbeddedMobile = embeddedSurface === 'mobile-app';

  useEffect(() => {
    if (isEmbeddedMobile) {
      return;
    }

    if (loading) {
      return;
    }

    if (!isAuthenticated || !user?.id) {
      lastAppliedKeyRef.current = null;
      return;
    }

    const themePreference = normalizeThemePreference(
      (user as { themePreference?: unknown }).themePreference,
    );
    const appliedKey = `${user.id}:${themePreference}`;

    if (lastAppliedKeyRef.current === appliedKey) {
      return;
    }

    lastAppliedKeyRef.current = appliedKey;
    syncThemePreferenceFromBackend(themePreference);
  }, [isAuthenticated, loading, syncThemePreferenceFromBackend, user]);

  return null;
};
