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

// Simple in-memory cache for signed URLs to prevent flickering on navigation
const urlCache: Record<string, string> = {};

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
  const [resolved, setResolved] = useState<string | null>(() => {
    if (src) return src;
    if (fileId && urlCache[fileId]) return urlCache[fileId];
    return null;
  });
  const [hadError, setHadError] = useState(false);
  const [loaded, setLoaded] = useState(() => {
    // If we have a value initially, assume it might be loaded (browser cache) 
    // or we want to show it immediately. 
    // But for smooth transition, we usually wait for onLoad.
    // However, if it's from our cache, we can try to show it.
    return !!(src || (fileId && urlCache[fileId]));
  });

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      // If src/fileId changed, reset error
      setHadError(false);

      // Optimization: If src is already a signed URL, use it.
      if (src && (src.includes('?') || !src.includes('s3'))) {
          setResolved(src);
          if (src !== resolved) setLoaded(false);
          return;
      }

      if (fileId) {
        // Check cache first
        if (urlCache[fileId]) {
            setResolved(urlCache[fileId]);
            // Don't reset loaded here, keep previous state or let it be true
            if (!resolved) setLoaded(true); 
        } else {
            setLoaded(false);
        }

        try {
            const url = await brandApi.getSignedFileUrl(fileId);
            if (mounted && url) {
                urlCache[fileId] = url;
                setResolved(url);
            }
        } catch (e) {
            if (mounted) setHadError(true);
        }
      } else {
        setResolved(src ?? null);
        if (!src) setLoaded(true); // Nothing to load
      }
    };
    
    // Only run if inputs actually changed
    if (src !== resolved && (!fileId || urlCache[fileId] !== resolved)) {
        void run();
    }
    
    return () => {
      mounted = false;
    };
  }, [fileId, src]); // eslint-disable-line react-hooks/exhaustive-deps

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
