import { createContext, useCallback, useContext, useLayoutEffect, useState, useMemo, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  isThemePreference,
  normalizeThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from '@/types/theme';

const THEME_TRANSITION_DURATION_MS = 300;
const LIGHT_THEME_COLOR = '#ffffff';
const DARK_THEME_COLOR = '#0a0a0a';
const EMBEDDED_SURFACE_SESSION_KEY = 'threadly.studio.embeddedSurface';
const EMBEDDED_THEME_SESSION_KEY = 'threadly.studio.embeddedTheme';

const getEmbeddedTheme = (): ResolvedTheme | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const explicitSurface = params.get('surface') === 'mobile-app';
  const sessionSurface =
    !explicitSurface &&
    (() => {
      try {
        return window.sessionStorage.getItem(EMBEDDED_SURFACE_SESSION_KEY) === 'mobile-app';
      } catch {
        return false;
      }
    })();
  if (!explicitSurface && !sessionSurface) return null;
  const theme = params.get('theme');
  if (theme === 'light' || theme === 'dark') {
    try {
      window.sessionStorage.setItem(EMBEDDED_THEME_SESSION_KEY, theme);
    } catch {
      // Storage can be unavailable in restricted WebViews.
    }
    return theme;
  }

  try {
    const sessionTheme = window.sessionStorage.getItem(EMBEDDED_THEME_SESSION_KEY);
    return sessionTheme === 'light' || sessionTheme === 'dark' ? sessionTheme : null;
  } catch {
    return null;
  }
};

interface ThemeProviderState {
  /**
   * Compatibility alias for the saved preference. Prefer `themePreference`
   * in new code so the saved preference is not confused with resolved theme.
   */
  theme: ThemePreference;
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  systemScheme: ResolvedTheme;
  setThemePreference: (theme: ThemePreference) => void;
  syncThemePreferenceFromBackend: (theme: unknown) => void;
  /**
   * Compatibility alias for `setThemePreference`.
   */
  setTheme: (theme: ThemePreference) => void;
}

const initialState: ThemeProviderState = {
  theme: 'system',
  themePreference: 'system',
  resolvedTheme: 'light',
  systemScheme: 'light',
  setThemePreference: () => null,
  syncThemePreferenceFromBackend: () => null,
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: ThemePreference;
  storageKey?: string;
}

const resolveThemePreference = (
  themePreference: ThemePreference,
  systemScheme: ResolvedTheme,
): ResolvedTheme => (themePreference === 'system' ? systemScheme : themePreference);

const getRootResolvedTheme = (root: HTMLElement): ResolvedTheme | null => {
  if (root.dataset.theme === 'light' || root.dataset.theme === 'dark') {
    return root.dataset.theme;
  }

  if (root.classList.contains('dark')) return 'dark';
  if (root.classList.contains('light')) return 'light';
  return null;
};

const applyThemeRootState = (
  root: HTMLElement,
  themePreference: ThemePreference,
  resolvedTheme: ResolvedTheme,
) => {
  root.classList.remove('light', 'dark');
  root.classList.add(resolvedTheme);
  root.dataset.theme = resolvedTheme;
  root.dataset.themePreference = themePreference;
  root.style.colorScheme = resolvedTheme;

  const themeColorMeta = window.document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute(
      'content',
      resolvedTheme === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR,
    );
  }
};

export function ThemeProvider({ 
  children, 
  defaultTheme = 'system', 
  storageKey = 'vite-ui-theme', 
  ...props 
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    if (typeof window === 'undefined') return defaultTheme;

    const embeddedTheme = getEmbeddedTheme();
    if (embeddedTheme) return embeddedTheme;

    const preloadedPreference = window.document.documentElement.dataset.themePreference;
    if (isThemePreference(preloadedPreference)) return preloadedPreference;

    try {
      return normalizeThemePreference(window.localStorage.getItem(storageKey), defaultTheme);
    } catch {
      return defaultTheme;
    }
  });
  const [embeddedTheme] = useState<ResolvedTheme | null>(() => getEmbeddedTheme());
  const [systemScheme, setSystemScheme] = useState<ResolvedTheme>(() => {
    if (typeof window === 'undefined') {
      return 'light';
    }

    const root = window.document.documentElement;
    const preloadedPreference = root.dataset.themePreference;
    const preloadedTheme = root.dataset.theme;
    if (
      preloadedPreference === 'system' &&
      (preloadedTheme === 'light' || preloadedTheme === 'dark')
    ) {
      return preloadedTheme;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const transitionTimerRef = useRef<number | null>(null);
  const resolvedTheme: ResolvedTheme = resolveThemePreference(theme, systemScheme);

  const persistThemePreference = useCallback((newTheme: ThemePreference) => {
    if (embeddedTheme) {
      setThemeState(newTheme);
      return;
    }
    try {
      window.localStorage.setItem(storageKey, newTheme);
    } catch {
      // no-op: localStorage can be unavailable in some browsing contexts
    }
    setThemeState(newTheme);
  }, [embeddedTheme, storageKey]);

  useLayoutEffect(() => {
    const root = window.document.documentElement;
    const previousResolvedTheme = getRootResolvedTheme(root);
    const isChanging =
      previousResolvedTheme !== null && previousResolvedTheme !== resolvedTheme;

    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }

    if (isChanging) {
      root.classList.add('theme-transitioning');
    } else {
      root.classList.remove('theme-transitioning');
    }

    applyThemeRootState(root, theme, resolvedTheme);

    if (isChanging) {
      transitionTimerRef.current = window.setTimeout(
        () => {
          root.classList.remove('theme-transitioning');
          transitionTimerRef.current = null;
        },
        THEME_TRANSITION_DURATION_MS,
      );
    }
  }, [resolvedTheme, theme]);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
      window.document.documentElement.classList.remove('theme-transitioning');
    };
  }, []);

  // Sync when system theme changes (only when theme is 'system') and across tabs
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');

    const handleMql = () => {
      setSystemScheme(mql.matches ? 'dark' : 'light');
    };
    mql.addEventListener?.('change', handleMql);

    const onStorage = (e: StorageEvent) => {
      if (embeddedTheme || e.key !== storageKey) return;

      const incoming = normalizeThemePreference(e.newValue, defaultTheme);
      if (incoming !== theme) {
        setThemeState(incoming);
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      mql.removeEventListener?.('change', handleMql);
      window.removeEventListener('storage', onStorage);
    };
  }, [defaultTheme, embeddedTheme, storageKey, theme]);

  const value = useMemo(() => {
    const setThemePreference = (newTheme: ThemePreference) => {
      persistThemePreference(newTheme);
    };

    return {
      theme,
      themePreference: theme,
      resolvedTheme,
      systemScheme,
      setThemePreference,
      syncThemePreferenceFromBackend: (backendTheme: unknown) => {
        persistThemePreference(normalizeThemePreference(backendTheme));
      },
      setTheme: setThemePreference,
    };
  }, [persistThemePreference, resolvedTheme, systemScheme, theme]);

  return (
    <ThemeProviderContext.Provider value={value} {...props}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};


