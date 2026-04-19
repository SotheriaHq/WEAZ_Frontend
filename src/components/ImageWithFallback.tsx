import React, { useEffect, useState } from 'react';
import DefaultAvatar from './DefaultAvatar';
import { brandApi } from '@/api/BrandApi';
import MediaRenderer from './media/MediaRenderer';
import { cn } from '@/lib/utils';

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

const invalidateCachedUrl = (key: string) => {
  const cache = getCache();
  if (!cache[key]) return;
  delete cache[key];
  setCache(cache);
};

const isS3LikeUrl = (value?: string | null) => {
  if (!value) return false;
  const lower = value.toLowerCase();
  return lower.includes('.s3.') || lower.includes('amazonaws.com');
};

const isRawStorageKey = (value?: string | null) => {
  if (!value) return false;
  return !/^https?:\/\//i.test(value) && !value.includes('?');
};

const resolveSourceCacheKey = (fileId?: string | null, src?: string | null) => {
  if (fileId) return fileId;
  if (!src) return null;
  if (isRawStorageKey(src)) return `key:${src}`;
  return src;
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
  const sourceCacheKey = resolveSourceCacheKey(fileId, src);
  const [resolved, setResolved] = useState<string | null>(() => {
    // fileId-based: always resolve via cache, never use the raw ID
    if (fileId) return getCachedUrl(fileId) ?? null;
    if (src && isRawStorageKey(src)) return getCachedUrl(`key:${src}`) ?? src;
    // S3-like URLs may be expired signed URLs — check session cache first,
    // never use the raw URL directly (prevents loading expired/private URLs)
    if (src && isS3LikeUrl(src)) return getCachedUrl(src) ?? null;
    // Non-S3 absolute URLs and raw storage keys can be used directly
    return src ?? null;
  });
  const [hadError, setHadError] = useState(false);
  const [loaded, setLoaded] = useState(() => {
    if (fileId) return !!(getCachedUrl(fileId));
    if (src && isRawStorageKey(src)) return !!(getCachedUrl(`key:${src}`));
    if (src && isS3LikeUrl(src)) return !!(getCachedUrl(src));
    return !!src;
  });
  const retryCountRef = React.useRef(0);

  useEffect(() => {
    let mounted = true;
    retryCountRef.current = 0;

    const run = async () => {
      // If src/fileId changed, reset error
      setHadError(false);
      setLoaded(false);

      // When fileId exists, prefer resolving by fileId to avoid stale signed URLs.
      if (!fileId && src && isS3LikeUrl(src)) {
        const url = await resolveSignedUrl(src, () => brandApi.getSignedS3Url(src));
        if (mounted) {
          setResolved(url || src);
        }
        return;
      }

      // Handle storage keys persisted without full host (e.g. "POST_IMAGE/.../file.jpg")
      if (!fileId && src && !src.includes('?') && !/^https?:\/\//i.test(src)) {
        const url = await resolveSignedUrl(`key:${src}`, () =>
          brandApi.getSignedS3KeyUrl(src),
        );
        if (mounted) {
          setResolved(url || src);
        }
        return;
      }

      // Non-S3 absolute URLs and querystring assets can be used directly.
      if (!fileId && src) {
        setResolved(src);
        return;
      }

      if (fileId) {
        // Check cache first
        const cachedUrl = getCachedUrl(fileId);
        if (cachedUrl) {
          setResolved(cachedUrl);
          return; // Use cached URL, no need to fetch
        }

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
      if (!sourceCacheKey) return;
      // If the current URL failed to load, drop any cached mapping for this key
      // so the retry path is forced to request a fresh signed URL.
      invalidateCachedUrl(sourceCacheKey);

      if (fileId) {
        brandApi.invalidateSignedUrlCache(fileId);
      } else if (src && isS3LikeUrl(src)) {
        brandApi.invalidateSignedUrlCache(src);
      } else if (src && isRawStorageKey(src)) {
        brandApi.invalidateSignedUrlCache(src);
      }

      const fetcher = fileId
        ? () => brandApi.getSignedFileUrl(fileId, { forceRefresh: true })
        : src && isS3LikeUrl(src)
          ? () => brandApi.getSignedS3Url(src, { forceRefresh: true })
          : src && !/^https?:\/\//i.test(src)
            ? () => brandApi.getSignedS3KeyUrl(src, { forceRefresh: true })
            : async () => src ?? null;
      resolveSignedUrl(sourceCacheKey, fetcher).then((url) => {
        if (url) setResolved(url);
        else setHadError(true);
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [hadError, fileId, sourceCacheKey, src]);

  // Only treat as "resolving" when there is actually a source to resolve.
  // Without this guard, a null src causes the shimmer to show forever because
  // resolved stays null even after the useEffect completes with no URL.
  const hasSource = !!(fileId || src);
  const isResolving = hasSource && !hadError && !resolved;
  // Shimmer should stay visible until the image is fully loaded, not just until the URL resolves.
  // Without this, there is a white flash between "URL resolved" and "image onLoad" because the
  // <img> is opacity-0 with no background behind it during that window.
  const showShimmer = isResolving || (hasSource && !hadError && !loaded);
  const showFallback = hadError;
  const wrapperClassName = cn(roundClass(rounded), containerClassName);

  return (
    <div className={cn('relative', wrapperClassName)} onClick={onClick}>
      {showShimmer && (
        /* Shimmer skeleton — visible until the signed URL is fetched AND image is fully loaded */
        <div className={cn('absolute inset-0 animate-pulse bg-gray-200 dark:bg-gray-700', roundClass(rounded))} aria-hidden="true" />
      )}
      {showFallback && (
        <DefaultAvatar name={fallbackName ?? alt} className={cn('w-full h-full', roundClass(rounded), className)} />
      )}
      {!isResolving && !showFallback && (
        <MediaRenderer
          kind="image"
          src={resolved ?? ''}
          alt={alt}
          fit={fit}
          onError={() => setHadError(true)}
          onLoad={() => setLoaded(true)}
          loading="eager"
          className="w-full h-full"
          mediaClassName={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className ?? ''}`}
          maxHeightClassName={maxHeightClassName ?? 'max-h-[70vh]'}
          maxWidthClassName="max-w-full"
        />
      )}
    </div>
  );
};

export default ImageWithFallback;
