import { createContext, useContext, useLayoutEffect, useState, useMemo, useEffect } from 'react';
import type { ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

const THEME_TRANSITION_DURATION_MS = 300;
const LIGHT_THEME_COLOR = '#ffffff';
const DARK_THEME_COLOR = '#0a0a0a';
const EMBEDDED_SURFACE_SESSION_KEY = 'threadly.studio.embeddedSurface';
const EMBEDDED_THEME_SESSION_KEY = 'threadly.studio.embeddedTheme';

const isTheme = (value: unknown): value is Theme =>
  value === 'light' || value === 'dark' || value === 'system';

const getEmbeddedTheme = (): Theme | null => {
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

const resolveTheme = (candidate: unknown, fallback: Theme): Theme =>
  isTheme(candidate) ? candidate : fallback;

interface ThemeProviderState {
  theme: Theme;
  systemScheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const initialState: ThemeProviderState = {
  theme: 'system',
  systemScheme: 'light',
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

const syncThemeToDocument = (root: HTMLElement, theme: Theme) => {
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const resolvedClass = isDark ? 'dark' : 'light';

  root.classList.remove('light', 'dark');
  root.classList.add(resolvedClass);
  root.dataset.themePreference = theme;
  root.style.colorScheme = resolvedClass;

  const themeColorMeta = window.document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute('content', resolvedClass === 'dark' ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
  }

  return resolvedClass;
};

export function ThemeProvider({ 
  children, 
  defaultTheme = 'system', 
  storageKey = 'vite-ui-theme', 
  ...props 
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return defaultTheme;

    const embeddedTheme = getEmbeddedTheme();
    if (embeddedTheme) return embeddedTheme;

    const preloadedPreference = window.document.documentElement.dataset.themePreference;
    if (isTheme(preloadedPreference)) return preloadedPreference;

    try {
      return resolveTheme(window.localStorage.getItem(storageKey), defaultTheme);
    } catch {
      return defaultTheme;
    }
  });
  const [embeddedTheme] = useState<Theme | null>(() => getEmbeddedTheme());
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') {
      return 'light';
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useLayoutEffect(() => {
    const root = window.document.documentElement;
    const newClass = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark'
      : 'light';

    // Only gate the transition when the theme actually changes class
    const wasLight = root.classList.contains('light');
    const wasDark = root.classList.contains('dark');
    const isChanging = (newClass === 'dark' && wasLight) || (newClass === 'light' && wasDark);

    if (isChanging) {
      root.classList.add('theme-transitioning');
    }

    syncThemeToDocument(root, theme);

    if (isChanging) {
      const timer = window.setTimeout(
        () => root.classList.remove('theme-transitioning'),
        THEME_TRANSITION_DURATION_MS,
      );
      return () => clearTimeout(timer);
    }
  }, [theme]);

  // Sync when system theme changes (only when theme is 'system') and across tabs
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    let transitionTimer: number | null = null;

    const handleMql = () => {
      setSystemScheme(mql.matches ? 'dark' : 'light');

      if (theme === 'system') {
        const root = window.document.documentElement;
        root.classList.add('theme-transitioning');
        syncThemeToDocument(root, 'system');
        if (transitionTimer !== null) {
          window.clearTimeout(transitionTimer);
        }
        transitionTimer = window.setTimeout(
          () => root.classList.remove('theme-transitioning'),
          THEME_TRANSITION_DURATION_MS,
        );
      }
    };
    mql.addEventListener?.('change', handleMql);

    const onStorage = (e: StorageEvent) => {
      if (embeddedTheme || e.key !== storageKey) return;

      const incoming = resolveTheme(e.newValue, defaultTheme);
      if (incoming !== theme) {
        setThemeState(incoming);
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      mql.removeEventListener?.('change', handleMql);
      window.removeEventListener('storage', onStorage);
      if (transitionTimer !== null) {
        window.clearTimeout(transitionTimer);
      }
    };
  }, [defaultTheme, embeddedTheme, storageKey, theme]);

  const value = useMemo(() => ({
    theme,
    systemScheme,
    setTheme: (newTheme: Theme) => {
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
    },
  }), [theme, storageKey, systemScheme]);

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


