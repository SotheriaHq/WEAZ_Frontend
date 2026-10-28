import React from 'react';
import { clsx } from 'clsx';
import { MuseLoader } from '@/components/loaders/MuseLoader';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  /**
   * primary   — high-contrast neutral action. The default for Save, Confirm, Continue.
   * brand     — WIEZ interactive accent (violet). Brand-owned CTAs (follow, bag, subscribe).
   * secondary — tactile paper / neutral supporting action alongside primary.
   * outline   — bordered low/medium emphasis action.
   * ghost     — no border, minimal action in dense UI.
   * link      — inline text action.
   * danger    — destructive action.
   * neumorphic — compatibility alias for tactile secondary action.
   */
  variant?: 'primary' | 'brand' | 'secondary' | 'outline' | 'ghost' | 'link' | 'danger' | 'neumorphic';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  className,
  icon,
  leftIcon,
  rightIcon,
  ...props
}, ref) => {
  const collectText = (node: React.ReactNode): string => {
    if (typeof node === 'string' || typeof node === 'number') {
      return String(node);
    }
    if (Array.isArray(node)) {
      return node.map((item) => collectText(item)).join(' ');
    }
    if (React.isValidElement(node)) {
      const element = node as React.ReactElement<{ children?: React.ReactNode }>;
      return collectText(element.props?.children);
    }
    return '';
  };

  const inferredText = collectText(children).trim();
  const inferredLoading = /\b(saving|loading|submitting|uploading|signing)\b/i.test(inferredText);
  const showLoader = loading || Boolean(disabled && inferredLoading);

  const baseClasses = 'relative inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--wiez-border-focus)] focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] active:translate-y-[1px]';

  const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
    // High-contrast neutral action (Save, Continue, Confirm)
    primary:   'bg-[color:var(--wiez-action-primary)] hover:bg-[color:var(--wiez-action-primary-hover)] text-[color:var(--wiez-action-primary-text)] active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.35)]',
    // WIEZ interactive accent (Follow, Add to Bag, Subscribe, Publish)
    brand:     'bg-[color:var(--wiez-action-brand)] hover:bg-[color:var(--wiez-action-brand-hover)] active:bg-[color:var(--wiez-action-brand-pressed)] text-white active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.35)]',
    // Tactile secondary supporting action (pure approved .neu-pressed-button)
    secondary: 'neu-pressed-button',
    neumorphic: 'neu-pressed-button',
    // Bordered low/medium emphasis action
    outline:   'border-2 border-[color:var(--wiez-border-default)] bg-transparent text-[color:var(--wiez-text-primary)] hover:bg-[color:var(--wiez-surface-card)] hover:border-[color:var(--wiez-border-strong)] active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.20)]',
    // Ghost — minimal action in dense UI
    ghost:     'bg-transparent text-[color:var(--wiez-text-secondary)] hover:text-[color:var(--wiez-text-primary)] hover:bg-[color:var(--wiez-surface-subtle)]',
    link:      'bg-transparent hover:underline text-[color:var(--wiez-text-primary)] underline-offset-2',
    danger:    'bg-[color:var(--wiez-action-danger)] hover:opacity-90 active:bg-[color:var(--wiez-action-danger-active)] text-white active:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.35)]',
  };

  const sizeClasses = {
    sm: 'text-sm px-3 py-1.5',
    md: 'text-base px-4 py-2',
    lg: 'text-lg px-6 py-3',
  };

  const widthClass = fullWidth ? 'w-full' : '';
  const effectiveLeadingIcon = leftIcon ?? icon;

  return (
    <button
      ref={ref}
      className={clsx(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        widthClass,
        className
      )}
      disabled={disabled || loading}
      aria-busy={showLoader ? true : undefined}
      {...props}
    >
      <span className={clsx('inline-flex items-center gap-2', showLoader && 'invisible')}>
        {effectiveLeadingIcon && <span className="shrink-0">{effectiveLeadingIcon}</span>}
        <span>{children}</span>
        {rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </span>
      {showLoader ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <MuseLoader size={16} />
        </span>
      ) : null}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;
