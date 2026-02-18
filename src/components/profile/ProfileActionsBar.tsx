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
      className="mt-5 flex items-stretch gap-1 overflow-x-auto scrollbar-hide rounded-2xl border border-white/30 bg-white/60 px-2 py-2 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5 sm:gap-2 sm:px-3"
    >
      {visible.map((action) => (
        <button
          key={action.key}
          type="button"
          onClick={action.onClick}
          aria-label={action.label}
          className={`
            group relative flex min-w-[4rem] flex-col items-center gap-1 rounded-xl px-3 py-2
            text-gray-700 transition-colors duration-150
            hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
            dark:text-gray-200 dark:hover:bg-white/10
            sm:min-w-[4.5rem] sm:px-4
            ${action.pulse ? 'ring-2 ring-amber-400/60 ring-offset-1 animate-[pulse_2s_ease-in-out_infinite] motion-reduce:animate-none' : ''}
          `}
        >
          <span
            className="text-xl leading-none transition-transform duration-150 group-hover:scale-110 motion-reduce:transition-none"
            aria-hidden="true"
          >
            {action.icon}
          </span>
          <span className="whitespace-nowrap text-[10px] font-medium leading-tight text-gray-500 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white sm:text-[11px]">
            {action.label}
          </span>
        </button>
      ))}
    </nav>
  );
};

export default ProfileActionsBar;
