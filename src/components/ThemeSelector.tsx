import React from 'react';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, Monitor } from 'lucide-react';

export const ThemeSelector: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const themes = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
  ];

  return (
    <div className="flex items-center space-x-2 bg-gray-100 dark:bg-[#000000] rounded-lg p-1">
      {themes.map((t) => {
        const isActive = theme === t.value;
        return (
          <button
            key={t.value}
            onClick={() => setTheme(t.value)}
            className={`flex items-center space-x-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
              isActive
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700/50'
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
