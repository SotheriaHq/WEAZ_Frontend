import { useTheme } from '@/context/ThemeContext';

export const useCurrentTheme = (): 'light' | 'dark' => {
  const { theme, systemScheme } = useTheme();

  if (theme === 'light' || theme === 'dark') {
    return theme;
  }

  return systemScheme;
};
