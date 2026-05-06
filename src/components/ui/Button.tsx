import React from 'react';
import { clsx } from 'clsx';
import VLoader from '@/components/loaders/VLoader';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  /**
   * primary  — black fill, white text. The default action on any page.
   * brand    — purple fill. Brand-owned CTAs only (follow, shop, subscribe).
   * secondary — transparent with border. Supporting action alongside primary.
   * ghost    — no border. Low-emphasis action in dense UI.
   * link     — inline text action.
   * danger   — destructive action.
   */
  variant?: 'primary' | 'brand' | 'secondary' | 'ghost' | 'link' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  className,
  icon,
  ...props
}) => {
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

  const baseClasses = 'relative inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-0 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    // Black fill — confident, editorial, fashion-native. Default for all actions.
    primary:   'bg-[color:var(--text-primary)] hover:opacity-90 text-[color:var(--surface-primary)]',
    // Purple fill — reserved for brand-owned CTAs (follow, shop, subscribe).
    brand:     'bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-strong)] text-white',
    // Outline — transparent with border. Supporting action alongside primary.
    secondary: 'bg-transparent border border-[color:var(--border-strong)] text-[color:var(--text-primary)] hover:bg-[color:var(--surface-muted)]',
    // Ghost — no border. Low-emphasis actions in dense UI.
    ghost:     'bg-transparent surface-interactive-hover text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
    link:      'bg-transparent hover:underline text-[var(--text-primary)] underline-offset-2',
    danger:    'bg-red-600 hover:bg-red-700 text-white',
  };

  const sizeClasses = {
    sm: 'text-sm px-3 py-1.5',
    md: 'text-base px-4 py-2',
    lg: 'text-lg px-6 py-3',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
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
        {icon && <span className="shrink-0">{icon}</span>}
        <span>{children}</span>
      </span>
      {showLoader ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <VLoader size={16} phase="loading" showLabel={false} />
        </span>
      ) : null}
    </button>
  );
};

export default Button;
