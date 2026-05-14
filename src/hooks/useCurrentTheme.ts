import { useTheme } from '@/context/ThemeContext';
import type { ResolvedTheme } from '@/types/theme';

export const useCurrentTheme = (): ResolvedTheme => {
  const { resolvedTheme } = useTheme();

  return resolvedTheme;
};
