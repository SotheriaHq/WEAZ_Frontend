import React, { useEffect, useState } from 'react';
import DefaultAvatar from '../DefaultAvatar';
import { FiFeather } from 'react-icons/fi';
import VLoader from '../loaders/VLoader';

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
}

const sizeMap: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-20 h-20',  
  md: 'w-28 h-28',
  lg: 'w-48 h-48',
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
      className={`relative overflow-hidden rounded-lg ${sizeMap[size]} ${className} ${clickable ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-00' : ''}`}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={handleKeyDown}
    >
      {showImage ? (
        <img
          src={src as string}
          alt={alt}
          className="h-full w-full object-contain bg-slate-900"
          onLoad={() => setIsImageLoading(false)}
          onError={() => {
            setErrored(true);
            setIsImageLoading(false);
          }}
        />
      ) : (
        // Default avatar uses the name (falls back to alt)
        <DefaultAvatar name={name ?? alt ?? 'User'} className="w-full h-full" />
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
