import React from 'react';
import VLoader from '@/components/loaders/VLoader';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    
    const baseStyles = 'inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 disabled:pointer-events-none disabled:opacity-50 active:scale-95';
    
    const variants = {
      primary: 'bg-brand-primary text-white shadow-lg shadow-brand-primary/25 hover:bg-brand-primary-strong hover:shadow-glow-sm hover:-translate-y-0.5 border border-transparent',
      secondary: 'bg-surface-secondary text-brand-dark hover:bg-white border border-transparent hover:shadow-md',
      outline: 'border border-gray-200 dark:border-white/10 bg-transparent hover:bg-surface-secondary text-brand-dark dark:text-white',
      ghost: 'hover:bg-surface-secondary text-brand-dark dark:text-gray-300 hover:text-brand-primary',
      danger: 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/25',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 py-2 text-sm',
      lg: 'h-12 px-8 text-base',
      icon: 'h-10 w-10',
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <VLoader size={16} phase="loading" showLabel={false} className="mr-2" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
