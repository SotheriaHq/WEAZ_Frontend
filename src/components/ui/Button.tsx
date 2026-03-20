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

  const baseClasses = 'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    // Black fill — confident, editorial, fashion-native. Default for all actions.
    primary:   'bg-[#0d0d0d] hover:bg-[#1a1a1a] text-white focus:ring-gray-700 dark:bg-white dark:hover:bg-gray-100 dark:text-[#0d0d0d] dark:focus:ring-gray-300',
    // Purple fill — reserved for brand-owned CTAs (follow, shop, subscribe).
    brand:     'bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-strong)] text-white focus:ring-purple-500',
    // Outline — transparent with border. Supporting action alongside primary.
    secondary: 'bg-transparent border border-[#0d0d0d] text-[#0d0d0d] hover:bg-[#0d0d0d]/5 focus:ring-gray-400 dark:border-white dark:text-white dark:hover:bg-white/10',
    // Ghost — no border. Low-emphasis actions in dense UI.
    ghost:     'bg-transparent hover:bg-gray-100 text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:hover:bg-white/8 dark:text-gray-400 dark:hover:text-white focus:ring-gray-400',
    link:      'bg-transparent hover:underline text-[var(--text-primary)] focus:ring-transparent underline-offset-2',
    danger:    'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
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
      {...props}
    >
      {showLoader && <VLoader size={16} phase="loading" showLabel={false} />}
      {icon && !showLoader && icon}
      {children}
    </button>
  );
};

export default Button;
