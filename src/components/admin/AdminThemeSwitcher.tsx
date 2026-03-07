import React from 'react';
import { useTheme } from '@/context/ThemeContext';

const THEME_OPTIONS = [
  { value: 'light' as const, label: 'Light' },
  { value: 'dark' as const, label: 'Dark' },
  { value: 'system' as const, label: 'System' },
];

const AdminThemeSwitcher: React.FC = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200/80 bg-white/80 p-1 shadow-sm dark:border-white/10 dark:bg-white/5">
      {THEME_OPTIONS.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setTheme(option.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? 'bg-purple-600 text-white'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10'
            }`}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default AdminThemeSwitcher;
