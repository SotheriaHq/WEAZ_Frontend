import React from 'react';
import { clsx } from 'clsx';
import MediaRenderer from '../media/MediaRenderer';

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
    xs: 'max-w-6 max-h-6 text-xs',
    sm: 'max-w-8 max-h-8 text-sm',
    md: 'max-w-10 max-h-10 text-base',
    lg: 'max-w-12 max-h-12 text-lg',
    xl: 'max-w-16 max-h-16 text-xl',
    '2xl': 'max-w-24 max-h-24 text-2xl',
  };

  const baseClasses = 'flex items-center justify-center font-medium';
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
        <MediaRenderer
          kind="image"
          src={src}
          alt={alt}
          maxHeightClassName={sizeClasses[size].split(' ').find((c) => c.startsWith('max-h-')) || 'max-h-10'}
          maxWidthClassName={sizeClasses[size].split(' ').find((c) => c.startsWith('max-w-')) || 'max-w-10'}
          className="rounded-full"
          mediaClassName="rounded-full"
        />
      ) : (
        <div
          className={clsx(
            'rounded-full flex items-center justify-center text-white bg-gradient-to-br from-purple-500 to-pink-500',
            sizeClasses[size]
          )}
        >
          <span>{fallback || getInitials(alt)}</span>
        </div>
      )}
    </div>
  );
};

export default Avatar;
