import React from 'react';
import { useSyncedThemePreference } from '@/hooks/useSyncedThemePreference';
import { Sun, Moon, Monitor } from 'lucide-react';

export const ThemeSelector: React.FC = () => {
  const { themePreference, setThemePreference } = useSyncedThemePreference();

  const themes = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
  ];

  return (
    <div className="flex items-center space-x-2 rounded-lg surface-control p-1">
      {themes.map((t) => {
        const isActive = themePreference === t.value;
        return (
          <button
            key={t.value}
            onClick={() => void setThemePreference(t.value)}
            className={`flex items-center space-x-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
              isActive
                ? 'surface-card text-[color:var(--text-primary)] shadow-sm'
                : 'text-[color:var(--text-secondary)] surface-interactive-hover'
            }`}
            aria-pressed={isActive}
          >
            <t.icon className={`w-4 h-4 transition-colors ${isActive ? 'text-blue-500' : ''}`} />
            <span className="capitalize">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
};
