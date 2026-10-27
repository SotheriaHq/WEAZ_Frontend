import React from 'react';

/**
 * Status Badge Primitive (Non-interactive)
 *
 * Dedicated to system status, indicators, and metadata tags:
 * Verified, New, Sold, Pending, Draft, Active.
 *
 * Separated from interactive selection chips (Tag, SegmentChips, FilterSelector).
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'outline' | 'brand' | 'primary';
  size?: 'sm' | 'md';
  dot?: boolean;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = '', variant = 'default', size = 'md', dot = false, children, ...props }, ref) => {
    
    const variants: Record<NonNullable<BadgeProps['variant']>, string> = {
      default: 'bg-[color:var(--wiez-surface-subtle)] text-[color:var(--wiez-text-secondary)] border-transparent',
      success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
      warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25',
      error:   'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/25',
      brand:   'bg-[color:var(--wiez-brand-subtle)] text-[color:var(--wiez-brand-accent)] border-[color:var(--wiez-brand-border)]',
      primary: 'bg-[color:var(--wiez-brand-subtle)] text-[color:var(--wiez-brand-accent)] border-[color:var(--wiez-brand-border)]',
      outline: 'bg-transparent border-[color:var(--wiez-border-default)] text-[color:var(--wiez-text-secondary)]',
    };

    const sizes = {
      sm: 'text-[10px] px-2 py-0.5 h-5',
      md: 'text-xs px-2.5 py-0.5 h-6',
    };

    const dotColors: Record<NonNullable<BadgeProps['variant']>, string> = {
      default: 'bg-[color:var(--wiez-text-muted)]',
      success: 'bg-emerald-500',
      warning: 'bg-amber-500',
      error:   'bg-red-500',
      brand:   'bg-[color:var(--wiez-brand-accent)]',
      primary: 'bg-[color:var(--wiez-brand-accent)]',
      outline: 'bg-[color:var(--wiez-text-muted)]',
    };

    return (
      <span
        ref={ref}
        className={`inline-flex items-center gap-1.5 rounded-full border font-medium uppercase tracking-wide select-none ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]} animate-pulse`} />}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export default Badge;
