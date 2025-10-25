import React from 'react';
import { clsx } from 'clsx';

export interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'bordered' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  className,
  onClick,
}) => {
  const baseClasses = 'rounded-lg transition-all duration-200';
  
  const variantClasses = {
    default: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700',
    bordered: 'bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600',
    elevated: 'bg-white dark:bg-gray-900 shadow-lg hover:shadow-xl border border-gray-100 dark:border-gray-800',
  };

  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const interactiveClasses = onClick ? 'cursor-pointer hover:shadow-md' : '';

  return (
    <div
      className={clsx(
        baseClasses,
        variantClasses[variant],
        paddingClasses[padding],
        interactiveClasses,
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;
