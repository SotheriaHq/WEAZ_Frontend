import React from 'react';
import DefaultAvatar from '../DefaultAvatar';
import VLoader from '../loaders/VLoader';
import ImageWithFallback from '../ImageWithFallback';

interface AvatarCardProps {
  src?: string | null;
  fileId?: string | null;
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
  fileId,
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
      {src || fileId ? (
        /* ImageWithFallback handles signed URL resolution for private S3 objects,
           shimmer while loading, and DefaultAvatar on error — all in one. */
        <ImageWithFallback
          src={src}
          fileId={fileId}
          alt={alt}
          fit="cover"
          containerClassName="w-full h-full bg-gray-100 dark:bg-white/10"
          rounded="xl"
          fallbackName={fallbackInitials ?? name ?? undefined}
          maxHeightClassName="max-h-full"
          keepPreviousOnReload
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
          className="absolute right-2 bottom-2 z-30 rounded-full bg-purple-600 p-2 text-white shadow-sm transition hover:scale-105 hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 disabled:cursor-not-allowed disabled:opacity-70"
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
