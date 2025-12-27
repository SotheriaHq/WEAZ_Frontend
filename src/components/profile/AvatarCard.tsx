import React, { useEffect, useState } from 'react';
import DefaultAvatar from '../DefaultAvatar';
import { FiFeather } from 'react-icons/fi';
import VLoader from '../loaders/VLoader';
import MediaRenderer from '../media/MediaRenderer';

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
  sm: 'max-w-20 max-h-20',
  md: 'max-w-28 max-h-28',
  lg: 'max-w-48 max-h-48',
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
  const [errored, setErrored] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState<boolean>(Boolean(src));
  const showImage = Boolean(src) && !errored;
  const clickable = typeof onClick === 'function';

  useEffect(() => {
    setErrored(false);
    setIsImageLoading(Boolean(src));
  }, [src]);

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
    if (!clickable) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`relative rounded-lg ${sizeMap[size]} ${className} ${clickable ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-00' : ''}`}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={handleKeyDown}
    >
      {showImage ? (
        <MediaRenderer
          kind="image"
          src={src as string}
          alt={alt}
          maxHeightClassName={sizeMap[size].split(' ').find((c) => c.startsWith('max-h-')) || 'max-h-28'}
          maxWidthClassName={sizeMap[size].split(' ').find((c) => c.startsWith('max-w-')) || 'max-w-28'}
          onLoad={() => setIsImageLoading(false)}
          onError={() => {
            setErrored(true);
            setIsImageLoading(false);
          }}
        />
      ) : (
        <DefaultAvatar name={fallbackInitials ?? name ?? alt ?? 'User'} className="w-full h-full" />
      )}

      {(loading || isImageLoading) && (
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
          <FiFeather className="h-5 w-5" />
        </button>
      )}
    </div>
  );
};

export default AvatarCard;
