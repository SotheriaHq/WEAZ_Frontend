import React from 'react';

/**
 * AdminInsightPanel — a compact, inline console panel whose body scrolls inside
 * itself instead of stretching the page (Rule 10).
 *
 * Deliberately borderless on the inside: rows are separated by rhythm and tone,
 * not by rules between every line. Use it anywhere an admin surface needs a
 * titled list/summary block (brand overview, account drill-downs, queues).
 */
export interface AdminInsightPanelProps {
  /** Emoji marker for the section (Rule 5 — no icon libraries). */
  emoji?: string;
  title: string;
  /** Small count/summary chip rendered next to the title. */
  badge?: React.ReactNode;
  /** Right-aligned header slot for a link or control. */
  action?: React.ReactNode;
  /** Tailwind max-height for the scroll body. Defaults to a ~5-row window. */
  maxHeightClass?: string;
  /** Rendered instead of children when there is nothing to show. */
  empty?: React.ReactNode;
  isEmpty?: boolean;
  loading?: boolean;
  className?: string;
  children?: React.ReactNode;
}

const AdminInsightPanel: React.FC<AdminInsightPanelProps> = ({
  emoji,
  title,
  badge,
  action,
  maxHeightClass = 'max-h-56',
  empty,
  isEmpty = false,
  loading = false,
  className,
  children,
}) => (
  <section
    className={`rounded-2xl border border-gray-200/80 bg-white px-4 py-3.5 dark:border-white/10 dark:bg-white/[0.03] ${className ?? ''}`}
  >
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {emoji && (
          <span aria-hidden className="text-sm">
            {emoji}
          </span>
        )}
        <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        {badge !== undefined && badge !== null && (
          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-300">
            {badge}
          </span>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>

    <div className={`mt-2.5 ${maxHeightClass} overflow-y-auto scrollbar-wiez pr-1`}>
      {loading ? (
        <p className="py-2 text-xs text-gray-500 dark:text-gray-400">Loading…</p>
      ) : isEmpty ? (
        <p className="py-2 text-xs text-gray-500 dark:text-gray-400">
          {empty ?? 'Nothing to show.'}
        </p>
      ) : (
        children
      )}
    </div>
  </section>
);

export default AdminInsightPanel;
