import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
  glass?: boolean;
  variant?: 'default' | 'bordered' | 'elevated';
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
    
    const baseStyles = 'rounded-2xl border';
    
    // "Glass" style vs "Solid" style
    const bgStyles = glass
      ? 'surface-menu backdrop-blur-xl shadow-glass'
      : variant === 'bordered'
        ? 'surface-card shadow-sm'
        : variant === 'elevated'
          ? 'surface-card shadow-md'
          : 'surface-card shadow-sm';

    const hoverStyles = hoverEffect
      ? 'transition-all duration-300 hover:-translate-y-1 hover:shadow-glass-hover hover:border-brand-primary/30' 
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
