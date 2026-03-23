import { createContext, useContext, useLayoutEffect, useState, useMemo, useEffect } from 'react';
import type { ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeProviderState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function ThemeProvider({ 
  children, 
  defaultTheme = 'system', 
  storageKey = 'vite-ui-theme', 
  ...props 
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  useLayoutEffect(() => {
    const root = window.document.documentElement;
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const newClass = isDark ? 'dark' : 'light';

    // Only gate the transition when the theme actually changes class
    const wasLight = root.classList.contains('light');
    const wasDark = root.classList.contains('dark');
    const isChanging = (newClass === 'dark' && wasLight) || (newClass === 'light' && wasDark);

    if (isChanging) {
      root.classList.add('theme-transitioning');
    }

    root.classList.remove('light', 'dark');
    root.classList.add(newClass);

    if (isChanging) {
      const timer = setTimeout(() => root.classList.remove('theme-transitioning'), 300);
      return () => clearTimeout(timer);
    }
  }, [theme]);

  // Sync when system theme changes (only when theme is 'system') and across tabs
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handleMql = () => {
      if (theme === 'system') {
        const root = window.document.documentElement;
        root.classList.add('theme-transitioning');
        root.classList.remove('light', 'dark');
        root.classList.add(mql.matches ? 'dark' : 'light');
        setTimeout(() => root.classList.remove('theme-transitioning'), 300);
      }
    };
    mql.addEventListener?.('change', handleMql);

    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue) {
        const incoming = e.newValue as Theme;
        if (incoming !== theme) {
          setTheme(incoming);
        }
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      mql.removeEventListener?.('change', handleMql);
      window.removeEventListener('storage', onStorage);
    };
  }, [theme, storageKey]);

  const value = useMemo(() => ({
    theme,
    setTheme: (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme);
      setTheme(newTheme);
    },
  }), [theme, storageKey]);

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


