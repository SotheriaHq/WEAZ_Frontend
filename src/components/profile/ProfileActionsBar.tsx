import React from 'react';

/* ------------------------------------------------------------------ */
/*  ProfileActionsBar                                                  */
/*  Premium icon-grid toolbar for owner-only profile actions.          */
/*  Each action renders as a frosted-glass card with large emoji icon  */
/*  and a label — consistent with the design system aesthetic.        */
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
      className="mt-4 flex flex-wrap items-stretch gap-2"
    >
      {visible.map((action) => (
        <button
          key={action.key}
          type="button"
          onClick={action.onClick}
          aria-label={action.label}
          title={action.label}
          className={`group relative flex min-w-[72px] flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border px-3 py-3 text-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 sm:min-w-[80px] sm:py-3.5 ${
            action.pulse
              ? 'border-amber-300/70 bg-amber-50/80 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 animate-[pulse_2s_ease-in-out_infinite] motion-reduce:animate-none'
              : 'border-gray-200/80 bg-white/70 text-gray-700 hover:border-fuchsia-300/60 hover:bg-white hover:shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:border-fuchsia-500/30 dark:hover:bg-white/10 dark:hover:text-white'
          }`}
        >
          {/* Icon */}
          <span
            className="text-xl leading-none transition-transform duration-150 group-hover:scale-110 motion-reduce:transition-none"
            aria-hidden="true"
          >
            {action.icon}
          </span>

          {/* Label */}
          {action.showLabel !== false ? (
            <span className="whitespace-nowrap text-[11px] font-semibold leading-tight tracking-wide">
              {action.label}
            </span>
          ) : (
            <span className="sr-only">{action.label}</span>
          )}

          {/* Pulse ring */}
          {action.pulse && (
            <span
              className="pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-amber-400/60 animate-ping motion-reduce:hidden"
              aria-hidden="true"
            />
          )}
        </button>
      ))}
    </nav>
  );
};

export default ProfileActionsBar;
