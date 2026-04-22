import React from 'react';
import { Link } from 'react-router-dom';

interface ProfileSettingsEntryProps {
  to: string;
  title?: string;
  description: string;
  icon?: React.ReactNode;
  className?: string;
}

const ProfileSettingsEntry: React.FC<ProfileSettingsEntryProps> = ({
  to,
  title = 'Settings',
  description,
  icon = '⚙️',
  className = '',
}) => {
  return (
    <Link
      to={to}
      className={`group flex items-center justify-between gap-4 rounded-2xl border border-gray-200/80 bg-white/80 px-4 py-3 text-left shadow-sm transition-colors hover:border-[color:var(--brand-primary)]/30 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:border-[color:var(--brand-primary)]/35 dark:hover:bg-white/10 ${className}`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--brand-primary)]/10 text-xl" aria-hidden="true">
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-[color:var(--text-primary)]">{title}</span>
          <span className="mt-0.5 block text-xs text-[color:var(--text-secondary)]">{description}</span>
        </span>
      </span>
      <span className="shrink-0 text-lg text-[color:var(--text-secondary)] transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true">
        ›
      </span>
    </Link>
  );
};

export default ProfileSettingsEntry;