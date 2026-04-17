import React from 'react';
import DefaultAvatar from '../DefaultAvatar';
import VLoader from '../loaders/VLoader';
import ImageWithFallback from '../ImageWithFallback';

interface AvatarCardProps {
  src?: string | null;
  name?: string | null;
  alt?: string;
  size?: 'sm' | 'md' | 'lg';
  editable?: boolean;
  onEdit?: () => void;
  loading?: boolean;
  className?: string;
  onClick?: () => void;
  fallbackInitials?: string; // optional initials to display when image fails
}

const sizeMap: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-20 h-20',
  md: 'w-28 h-28',
  lg: 'w-40 h-40 sm:w-44 sm:h-44 md:w-52 md:h-52',
};

const AvatarCard: React.FC<AvatarCardProps> = ({
  src,
  name,
  alt = 'Profile image',
  size = 'md',
  editable = false,
  onEdit,
  loading = false,
  className = '',
  onClick,
  fallbackInitials,
}) => {
  const clickable = typeof onClick === 'function';

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (!clickable) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-xl ${sizeMap[size]} ${className} ${clickable ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300' : ''}`}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={handleKeyDown}
    >
      {src ? (
        /* ImageWithFallback handles signed URL resolution for private S3 objects,
           shimmer while loading, and DefaultAvatar on error — all in one. */
        <ImageWithFallback
          src={src}
          alt={alt}
          fit="cover"
          containerClassName="w-full h-full"
          rounded="xl"
          fallbackName={fallbackInitials ?? name ?? undefined}
          maxHeightClassName={sizeMap[size].split(' ').find((c) => c.startsWith('max-h-')) || 'max-h-28'}
        />
      ) : (
        <DefaultAvatar name={fallbackInitials ?? name ?? alt ?? 'User'} className="w-full h-full" />
      )}

      {/* Only show the spinner for explicit external operations (e.g. upload in progress),
          not for the image load itself — ImageWithFallback handles that with its shimmer. */}
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 backdrop-blur-sm">
          <VLoader size={44} />
        </div>
      )}

      {editable && (
        <button
          aria-label="Edit profile photo"
          onClick={(event) => {
            event.stopPropagation();
            onEdit?.();
          }}
          className="absolute right-2 bottom-2 z-30 rounded-full bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500 p-2 text-white shadow-lg transition hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 disabled:cursor-not-allowed disabled:opacity-70 dark:shadow-purple-900/40"
          disabled={loading}
          type="button"
        >
          <span aria-hidden="true" className="text-base leading-none">📷</span>
        </button>
      )}
    </div>
  );
};

export default AvatarCard;
