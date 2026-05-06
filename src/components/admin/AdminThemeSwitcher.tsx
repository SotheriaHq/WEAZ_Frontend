import React from 'react';
import { useSyncedThemePreference } from '@/hooks/useSyncedThemePreference';

const THEME_OPTIONS = [
  { value: 'light' as const, label: 'Light' },
  { value: 'dark' as const, label: 'Dark' },
  { value: 'system' as const, label: 'System' },
];

const AdminThemeSwitcher: React.FC = () => {
  const { themePreference, setThemePreference } = useSyncedThemePreference();

  return (
    <div className="inline-flex items-center gap-1 rounded-xl border surface-control p-1 shadow-sm">
      {THEME_OPTIONS.map((option) => {
        const active = themePreference === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => void setThemePreference(option.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? 'bg-purple-600 text-white'
                : 'text-[color:var(--text-secondary)] surface-interactive-hover'
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
