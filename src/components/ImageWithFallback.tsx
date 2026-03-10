import React, { useEffect, useState } from 'react';
import DefaultAvatar from './DefaultAvatar';
import { brandApi } from '@/api/BrandApi';
import MediaRenderer from './media/MediaRenderer';

interface ImageWithFallbackProps {
  src?: string | null;
  fileId?: string | null;
  alt: string;
  /** How the image should fit inside its container. Default: contain (no cropping). */
  fit?: 'contain' | 'cover';
  className?: string;
  containerClassName?: string;
  /** Override the max-height constraint. Default: 'max-h-[70vh]' */
  maxHeightClassName?: string;
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
const CACHE_EXPIRY_MS = 14 * 60 * 1000; // 14 minutes (signed URLs typically expire at 15min)

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

// In-flight dedup: prevents concurrent requests for the same fileId/src
const inflight = new Map<string, Promise<string | null>>();

const resolveSignedUrl = async (
  key: string,
  fetcher: () => Promise<string | null>,
): Promise<string | null> => {
  const cached = getCachedUrl(key);
  if (cached) return cached;

  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = fetcher()
    .then((url) => {
      if (url) setCachedUrl(key, url);
      return url || null;
    })
    .catch(() => null)
    .finally(() => { inflight.delete(key); });

  inflight.set(key, promise);
  return promise;
};

export const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  src,
  fileId,
  alt,
  fit = 'contain',
  className,
  containerClassName,
  maxHeightClassName,
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
  const retryCountRef = React.useRef(0);

  useEffect(() => {
    let mounted = true;
    retryCountRef.current = 0;

    const run = async () => {
      // If src/fileId changed, reset error
      setHadError(false);

      // Optimization: If src is already a signed URL (has query params), use it directly
      if (src && (src.includes('?') || !src.includes('s3'))) {
        setResolved(src);
        return;
      }

      // Handle raw unsigned S3 URLs (contain '.s3.' but no '?' query params)
      if (src && src.includes('.s3.') && !src.includes('?')) {
        setLoaded(false);
        const url = await resolveSignedUrl(src, () => brandApi.getSignedS3Url(src));
        if (mounted) {
          setResolved(url || src); // fallback to raw URL
        }
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

        const url = await resolveSignedUrl(fileId, () => brandApi.getSignedFileUrl(fileId));
        if (mounted) {
          if (url) {
            setResolved(url);
          } else {
            if (src) {
              // If file-id signing fails, keep the raw source as a best-effort fallback.
              setResolved(src);
              setHadError(false);
            } else {
              setHadError(true);
            }
          }
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

  // Auto-retry once on error after a short delay
  useEffect(() => {
    if (!hadError || retryCountRef.current >= 1) return;
    retryCountRef.current += 1;
    const timer = setTimeout(() => {
      setHadError(false);
      const key = fileId || src;
      if (!key) return;
      const fetcher = fileId
        ? () => brandApi.getSignedFileUrl(fileId)
        : () => brandApi.getSignedS3Url(src!);
      resolveSignedUrl(key, fetcher).then((url) => {
        if (url) setResolved(url);
        else setHadError(true);
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [hadError, fileId, src]);

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
          fit={fit}
          onError={() => setHadError(true)}
          onLoad={() => setLoaded(true)}
          className={containerClassName}
          mediaClassName={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className ?? ''}`}
          maxHeightClassName={maxHeightClassName ?? 'max-h-[70vh]'}
          maxWidthClassName="max-w-full"
        />
      )}
    </div>
  );
};

export default ImageWithFallback;
