import React from 'react';

/* ------------------------------------------------------------------ */
/*  ProfileActionsBar                                                  */
/*  A single frosted-glass toolbar that groups every owner-only        */
/*  action for the end-user profile page.                              */
/* ------------------------------------------------------------------ */

export interface ProfileAction {
  /** Unique key for React list rendering */
  key: string;
  /** Emoji or React node rendered as the icon */
  icon: React.ReactNode;
  /** Short accessible label */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Show a pulsing amber ring (e.g. size-fit update reminder) */
  pulse?: boolean;
  /** Hide this action entirely */
  hidden?: boolean;
  /** Render visible text label under icon. Defaults to true. */
  showLabel?: boolean;
}

interface ProfileActionsBarProps {
  actions: ProfileAction[];
}

const ProfileActionsBar: React.FC<ProfileActionsBarProps> = ({ actions }) => {
  const visible = actions.filter((a) => !a.hidden);
  if (visible.length === 0) return null;

  return (
    <nav
      aria-label="Profile actions"
      className="mt-5 flex items-center gap-2 overflow-x-auto scrollbar-hide rounded-full border border-gray-200/70 bg-white/70 px-2 py-2 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5 sm:px-3"
    >
      {visible.map((action) => (
        <button
          key={action.key}
          type="button"
          onClick={action.onClick}
          aria-label={action.label}
          title={action.label}
          className={`group relative inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 sm:text-sm ${
            action.pulse
              ? 'border-amber-300/70 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-300 animate-[pulse_2s_ease-in-out_infinite] motion-reduce:animate-none'
              : 'border-gray-200/80 bg-white/60 text-gray-700 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
          }`}
        >
          <span
            className="text-sm leading-none transition-transform duration-150 group-hover:scale-110 motion-reduce:transition-none"
            aria-hidden="true"
          >
            {action.icon}
          </span>
          {action.showLabel !== false ? (
            <span className="leading-tight">
              {action.label}
            </span>
          ) : (
            <span className="sr-only">{action.label}</span>
          )}
        </button>
      ))}
    </nav>
  );
};

export default ProfileActionsBar;
