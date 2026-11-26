import React from 'react';

export interface MarketNoticeProps {
  emoji: string;
  children: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  tone?: 'info' | 'warning';
}

/**
 * A one-line notice above a list ("Updated", "Prices updated", offline,
 * couldn't refresh). It sits in a polite live region placed by the caller, so
 * screen readers hear it once without losing their place.
 */
export function MarketNotice({ emoji, children, actionLabel, onAction, onDismiss, tone = 'info' }: MarketNoticeProps) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-4 py-2.5 text-sm font-semibold ${
        tone === 'warning'
          ? 'bg-amber-500/15 text-amber-900 dark:text-amber-100'
          : 'bg-purple-500/10 text-[color:var(--wiez-text-primary)]'
      }`}
    >
      <span aria-hidden="true">{emoji}</span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="rounded-full px-2 py-1 text-xs font-bold text-purple-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--wiez-border-focus)] dark:text-purple-300"
        >
          {actionLabel}
        </button>
      ) : null}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="flex h-8 w-8 items-center justify-center rounded-full text-base font-bold hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--wiez-border-focus)] dark:hover:bg-white/10"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export default MarketNotice;
