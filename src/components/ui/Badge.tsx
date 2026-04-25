import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'outline' | 'brand' | 'primary';
  size?: 'sm' | 'md';
  dot?: boolean;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = '', variant = 'default', size = 'md', dot = false, children, ...props }, ref) => {
    
    const variants = {
      default: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300 border-transparent',
      success: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20',
      warning: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
      error: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20',
      brand: 'bg-brand-primary/10 text-brand-primary border-brand-primary/20',
      primary: 'bg-brand-primary/10 text-brand-primary border-brand-primary/20',
      outline: 'bg-transparent border-gray-200 text-gray-600 dark:text-gray-400',
    };

    const sizes = {
      sm: 'text-[10px] px-2 py-0.5 h-5',
      md: 'text-xs px-2.5 py-0.5 h-6',
    };

    const dotColors = {
      default: 'bg-gray-500',
      success: 'bg-green-500',
      warning: 'bg-yellow-500',
      error: 'bg-red-500',
      brand: 'bg-brand-primary',
      primary: 'bg-brand-primary',
      outline: 'bg-gray-500',
    };

    return (
      <span
        ref={ref}
        className={`inline-flex items-center gap-1.5 rounded-full border font-medium uppercase tracking-wide ${variants[variant]} ${sizes[size]} ${className}`}
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
