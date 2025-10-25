import React from 'react';
import { clsx } from 'clsx';

export interface AvatarProps {
  src?: string;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  fallback?: string;
  className?: string;
  onClick?: () => void;
}

const Avatar: React.FC<AvatarProps> = ({
  src,
  alt,
  size = 'md',
  fallback,
  className,
  onClick,
}) => {
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl',
    '2xl': 'w-24 h-24 text-2xl',
  };

  const baseClasses = 'rounded-full object-cover flex items-center justify-center font-medium bg-gradient-to-br from-purple-500 to-pink-500 text-white';
  const interactiveClasses = onClick ? 'cursor-pointer hover:ring-2 hover:ring-purple-400 transition-all' : '';

  // Generate initials from alt text for fallback
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      className={clsx(
        baseClasses,
        sizeClasses[size],
        interactiveClasses,
        className
      )}
      onClick={onClick}
      title={alt}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className={clsx('w-full h-full rounded-full object-cover')}
        />
      ) : (
        <span>{fallback || getInitials(alt)}</span>
      )}
    </div>
  );
};

export default Avatar;
