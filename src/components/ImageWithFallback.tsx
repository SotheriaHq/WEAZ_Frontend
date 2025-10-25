import React, { useEffect, useState } from 'react';
import DefaultAvatar from './DefaultAvatar';
import { brandApi } from '@/api/BrandApi';

interface ImageWithFallbackProps {
  src?: string | null;
  fileId?: string | null;
  alt: string;
  className?: string;
  containerClassName?: string;
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  fallbackName?: string;
  draggable?: boolean;
  onClick?: () => void;
}

const roundClass = (rounded: ImageWithFallbackProps['rounded']) => {
  switch (rounded) {
    case 'sm':
      return 'rounded-sm';
    case 'md':
      return 'rounded-md';
    case 'lg':
      return 'rounded-lg';
    case 'xl':
      return 'rounded-xl';
    case 'full':
      return 'rounded-full';
    default:
      return 'rounded-none';
  }
};

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  fileId,
  alt,
  className,
  containerClassName,
  rounded = 'md',
  fallbackName,
  draggable = false,
  onClick,
}) => {
  const [resolved, setResolved] = useState<string | null>(src ?? null);
  const [hadError, setHadError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setHadError(false);
      setLoaded(false);
      if (fileId) {
        const url = await brandApi.getSignedFileUrl(fileId);
        if (mounted) setResolved(url ?? (src ?? null));
      } else {
        setResolved(src ?? null);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [fileId, src]);

  const showFallback = hadError || !resolved;

  return (
    <div className={`overflow-hidden ${roundClass(rounded)} ${containerClassName ?? ''}`} onClick={onClick}>
      {showFallback ? (
        <DefaultAvatar name={fallbackName ?? alt} className={`w-full h-full ${roundClass(rounded)}`} />
      ) : (
        <img
          src={resolved ?? undefined}
          alt={alt}
          draggable={draggable}
          onError={() => setHadError(true)}
          onLoad={() => setLoaded(true)}
          className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className ?? ''}`}
        />
      )}
    </div>
  );
};

export default ImageWithFallback;
