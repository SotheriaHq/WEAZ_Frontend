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

  /*
    Strong Lens glass for every button (owner decision, 15 Nov 2026). Each
    variant keeps its system colour as the glass tint (ink / brand / danger),
    supporting actions are neutral glass, ghost is barely-there glass, link
    stays text. `LiquidGlassLensLayer` refracts them where the browser can.
    Borderless variants stay borderless and outline keeps its 2px box, so no
    button changes size.
  */
  const GLASS = 'wiez-lg-surface wiez-lg-interactive';
  const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
    // High-contrast neutral action (Save, Continue, Confirm)
    primary:   `${GLASS} wiez-lg-regular wiez-lg-borderless wiez-lg-tone-ink`,
    // WIEZ interactive accent (Follow, Add to Bag, Subscribe, Publish)
    brand:     `${GLASS} wiez-lg-regular wiez-lg-borderless wiez-lg-tone-brand`,
    // Supporting action
    secondary: `${GLASS} wiez-lg-regular wiez-lg-borderless`,
    neumorphic: `${GLASS} wiez-lg-regular wiez-lg-borderless`,
    // Bordered low/medium emphasis action (border kept for size; glass edge reads instead)
    outline:   `${GLASS} wiez-lg-regular border-2`,
    // Ghost — minimal action in dense UI
    ghost:     `${GLASS} wiez-lg-subtle wiez-lg-borderless wiez-lg-tone-ghost text-[color:var(--wiez-text-secondary)]`,
    link:      'bg-transparent hover:underline text-[color:var(--wiez-text-primary)] underline-offset-2',
    danger:    `${GLASS} wiez-lg-regular wiez-lg-borderless wiez-lg-tone-danger`,
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
