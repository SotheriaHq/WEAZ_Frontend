import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
  glass?: boolean;
  variant?: 'default' | 'surface' | 'bordered' | 'elevated' | 'recessed' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({
    className = '',
    hoverEffect = false,
    glass = false,
    variant = 'default',
    padding = 'none',
    children,
    ...props
  }, ref) => {
    
    const baseStyles = 'rounded-2xl transition-all duration-200';
    
    // Semantic surface mapping
    const bgStyles = glass
      ? 'surface-menu backdrop-blur-xl shadow-glass border border-[color:var(--wiez-border-subtle)]'
      : variant === 'bordered'
        ? 'bg-[color:var(--wiez-surface-card)] border border-[color:var(--wiez-border-subtle)] shadow-sm'
        : variant === 'elevated'
          ? 'bg-[color:var(--wiez-surface-elevated)] border border-[color:var(--wiez-border-subtle)] shadow-md'
          : variant === 'surface'
            ? 'bg-[color:var(--wiez-surface-card)] border border-[color:var(--wiez-border-subtle)]'
            : variant === 'interactive'
              ? 'bg-[color:var(--wiez-surface-card)] border border-[color:var(--wiez-border-subtle)] hover:border-[color:var(--wiez-border-strong)] cursor-pointer'
              : 'neu-recessed-card';

    const hoverStyles = hoverEffect || variant === 'interactive'
      ? 'hover:-translate-y-0.5 hover:shadow-md hover:border-[color:var(--wiez-border-strong)]' 
      : '';

    const paddingStyles =
      padding === 'sm' ? 'p-3' :
      padding === 'md' ? 'p-4' :
      padding === 'lg' ? 'p-6' :
      '';

    return (
      <div
        ref={ref}
        className={`${baseStyles} ${bgStyles} ${paddingStyles} ${hoverStyles} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;
