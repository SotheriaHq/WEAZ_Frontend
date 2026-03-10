import { useMemo } from 'react';
import { useTheme } from '@/context/ThemeContext';

export const useCurrentTheme = (): 'light' | 'dark' => {
  const { theme } = useTheme();

  return useMemo(() => {
    if (theme === 'light' || theme === 'dark') {
      return theme;
    }

    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }

    return 'light';
  }, [theme]);
};
