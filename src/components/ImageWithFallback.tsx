import React, { useEffect, useState } from 'react';
import DefaultAvatar from './DefaultAvatar';
import { brandApi } from '@/api/BrandApi';
import MediaRenderer from './media/MediaRenderer';

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

// Session-storage backed cache for signed URLs to prevent flickering on navigation
const CACHE_KEY = 'threadly_signed_url_cache';
const CACHE_EXPIRY_MS = 3 * 60 * 1000; // 3 minutes (less than signed URL TTL)

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const getCache = (): Record<string, CacheEntry> => {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : {};
  } catch {
    return {};
  }
};

const setCache = (cache: Record<string, CacheEntry>) => {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // SessionStorage might be full or unavailable
  }
};

const getCachedUrl = (fileId: string): string | null => {
  const cache = getCache();
  const entry = cache[fileId];
  if (entry && entry.expiresAt > Date.now()) {
    return entry.url;
  }
  // Clean up expired entry
  if (entry) {
    delete cache[fileId];
    setCache(cache);
  }
  return null;
};

const setCachedUrl = (fileId: string, url: string) => {
  const cache = getCache();
  cache[fileId] = {
    url,
    expiresAt: Date.now() + CACHE_EXPIRY_MS,
  };
  setCache(cache);
};

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  fileId,
  alt,
  className,
  containerClassName,
  rounded = 'md',
  fallbackName,
  draggable: _draggable = false,
  onClick,
}) => {
  const [resolved, setResolved] = useState<string | null>(() => {
    if (src) return src;
    if (fileId) {
      const cached = getCachedUrl(fileId);
      if (cached) return cached;
    }
    return null;
  });
  const [hadError, setHadError] = useState(false);
  const [loaded, setLoaded] = useState(() => {
    // If we have a value initially, assume it might be loaded (browser cache) 
    return !!(src || (fileId && getCachedUrl(fileId)));
  });

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      // If src/fileId changed, reset error
      setHadError(false);

      // Optimization: If src is already a signed URL (has query params), use it directly
      if (src && (src.includes('?') || !src.includes('s3'))) {
        setResolved(src);
        return;
      }

      if (fileId) {
        // Check cache first
        const cachedUrl = getCachedUrl(fileId);
        if (cachedUrl) {
          setResolved(cachedUrl);
          setLoaded(true);
          return; // Use cached URL, no need to fetch
        }

        // No cached URL, need to fetch
        setLoaded(false);

        try {
          const url = await brandApi.getSignedFileUrl(fileId);
          if (mounted && url) {
            setCachedUrl(fileId, url);
            setResolved(url);
          }
        } catch {
          if (mounted) setHadError(true);
        }
      } else {
        setResolved(src ?? null);
        if (!src) setLoaded(true); // Nothing to load
      }
    };
    
    void run();
    
    return () => {
      mounted = false;
    };
  }, [fileId, src]);

  const showFallback = hadError || !resolved;

  return (
    <div className={`${roundClass(rounded)}`} onClick={onClick}>
      {showFallback ? (
        <DefaultAvatar name={fallbackName ?? alt} className={`w-full h-full ${roundClass(rounded)}`} />
      ) : (
        <MediaRenderer
          kind="image"
          src={resolved ?? ''}
          alt={alt}
          onError={() => setHadError(true)}
          onLoad={() => setLoaded(true)}
          className={containerClassName}
          mediaClassName={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className ?? ''}`}
          maxHeightClassName="max-h-[70vh]"
          maxWidthClassName="max-w-full"
        />
      )}
    </div>
  );
};

export default ImageWithFallback;
