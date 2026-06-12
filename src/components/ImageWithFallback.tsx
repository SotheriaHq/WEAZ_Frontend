import React, { useEffect, useState } from 'react';
import DefaultAvatar from './DefaultAvatar';
import { brandApi } from '@/api/BrandApi';
import MediaRenderer from './media/MediaRenderer';
import { cn } from '@/lib/utils';
import { isKnownUnavailableSeedMediaUrl } from '@/utils/mediaSource';

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
  keepPreviousOnReload?: boolean;
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

const STORAGE_KEY_PREFIXES = [
  'PROFILE_IMAGE',
  'BANNER_IMAGE',
  'POST_IMAGE',
  'POST_VIDEO',
  'REVIEW_IMAGE',
  'REVIEW_VIDEO',
  'DOCUMENT',
  'BRAND_VERIFICATION',
  'MESSAGE_IMAGE',
  'MESSAGE_DOCUMENT',
] as const;

const hasSignedUrlParams = (value?: string | null) => {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return Boolean(
      parsed.searchParams.get('X-Amz-Signature') ||
        parsed.searchParams.get('Signature') ||
        parsed.searchParams.get('Expires') ||
        parsed.searchParams.get('expires') ||
        parsed.searchParams.get('token'),
    );
  } catch {
    return false;
  }
};

const parseCompactAmzDate = (value: string) => {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  return Number.isFinite(timestamp) ? timestamp : null;
};

const getSignedUrlExpiresAt = (value: string) => {
  try {
    const parsed = new URL(value);
    const unixExpires = parsed.searchParams.get('Expires') ?? parsed.searchParams.get('expires');
    if (unixExpires) {
      const timestamp = Number(unixExpires) * 1000;
      if (Number.isFinite(timestamp)) return timestamp;
    }

    const amzDate = parsed.searchParams.get('X-Amz-Date');
    const amzExpires = Number(parsed.searchParams.get('X-Amz-Expires'));
    const amzStartedAt = amzDate ? parseCompactAmzDate(amzDate) : null;
    if (amzStartedAt && Number.isFinite(amzExpires)) {
      return amzStartedAt + amzExpires * 1000;
    }
  } catch {
    return null;
  }

  return null;
};

const isUsableInitialUrl = (value?: string | null) => {
  if (!value || !/^https?:\/\//i.test(value)) return false;
  if (isS3LikeUrl(value) && !hasSignedUrlParams(value)) return false;
  if (!hasSignedUrlParams(value)) return true;
  const expiresAt = getSignedUrlExpiresAt(value);
  return Boolean(expiresAt && expiresAt > Date.now() + 30_000);
};

const isRawStorageKey = (value?: string | null) => {
  if (!value) return false;
  if (/^(https?:|data:|blob:)/i.test(value) || value.includes('?')) return false;
  const normalized = value.replace(/^\/+/, '').toUpperCase();
  return STORAGE_KEY_PREFIXES.some((prefix) => normalized.startsWith(`${prefix}/`));
};

const shouldPreferFileIdResolution = (value?: string | null, fileId?: string | null) => {
  if (!value || !fileId) return false;
  return isS3LikeUrl(value);
};

const canUseSourceDirectly = (value?: string | null, fileId?: string | null) =>
  isUsableInitialUrl(value) && !shouldPreferFileIdResolution(value, fileId);

const resolveSourceCacheKey = (fileId?: string | null, src?: string | null) => {
  if (fileId) return fileId;
  if (!src) return null;
  if (isRawStorageKey(src)) return `key:${src}`;
  return src;
};

// In-flight dedup: prevents concurrent requests for the same fileId/src
const inflight = new Map<string, Promise<string | null>>();
const lastGoodUrlCache = new Map<string, string>();

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
  keepPreviousOnReload = false,
}) => {
  const sourceCacheKey = resolveSourceCacheKey(fileId, src);
  const cachedLastGoodUrl = sourceCacheKey ? lastGoodUrlCache.get(sourceCacheKey) ?? null : null;
  const [resolved, setResolved] = useState<string | null>(() => {
    if (canUseSourceDirectly(src, fileId)) return src ?? null;
    // fileId-based: always resolve via cache, never use the raw ID
    if (fileId) return getCachedUrl(fileId) ?? null;
    if (src && isRawStorageKey(src)) return getCachedUrl(`key:${src}`) ?? null;
    // S3-like URLs may be expired or unsigned; never render them until the
    // permission-gated signer returns a usable URL.
    if (src && isS3LikeUrl(src)) return getCachedUrl(src) ?? null;
    // Non-S3 absolute URLs and local app assets can be used directly.
    return src ?? null;
  });
  const [hadError, setHadError] = useState(false);
  const [loaded, setLoaded] = useState(() => {
    if (canUseSourceDirectly(src, fileId)) return true;
    if (fileId) return !!(getCachedUrl(fileId));
    if (src && isRawStorageKey(src)) return !!(getCachedUrl(`key:${src}`));
    if (src && isS3LikeUrl(src)) return !!getCachedUrl(src);
    return !!src;
  });
  const [lastGoodUrl, setLastGoodUrl] = useState<string | null>(() =>
    cachedLastGoodUrl ?? (loaded ? resolved : null),
  );
  const retryCountRef = React.useRef(0);
  const imgRef = React.useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    let mounted = true;
    retryCountRef.current = 0;

    const run = async () => {
      // If src/fileId changed, reset error
      setHadError(false);
      if (sourceCacheKey) {
        const cachedLastGood = lastGoodUrlCache.get(sourceCacheKey);
        if (cachedLastGood) {
          setLastGoodUrl(cachedLastGood);
        }
      }
      setLoaded(false);

      if (canUseSourceDirectly(src, fileId)) {
        setResolved(src ?? null);
        setLoaded(true);
        return;
      }

      if (!fileId && src && isS3LikeUrl(src)) {
        const url = await resolveSignedUrl(src, () => brandApi.getSignedS3Url(src));
        if (mounted) {
          if (url) {
            setResolved(url);
          } else {
            setResolved(null);
            setHadError(true);
          }
        }
        return;
      }

      // Handle storage keys persisted without full host (e.g. "POST_IMAGE/.../file.jpg").
      if (!fileId && src && isRawStorageKey(src)) {
        const url = await resolveSignedUrl(`key:${src}`, () =>
          brandApi.getSignedS3KeyUrl(src),
        );
        if (mounted) {
          if (url) {
            setResolved(url);
          } else {
            setResolved(null);
            setHadError(true);
          }
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
            if (canUseSourceDirectly(src, fileId)) {
              // If file-id signing fails, keep the raw source as a best-effort fallback.
              setResolved(src);
              setHadError(false);
            } else {
              if (import.meta.env.DEV) {
                console.warn('[ImageWithFallback] Failed to resolve persisted media URL', {
                  hasFileId: Boolean(fileId),
                  sourceType: src && isS3LikeUrl(src) ? 's3-url' : 'file-id',
                });
              }
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
  }, [fileId, sourceCacheKey, src]);

  // Auto-retry once on error after a short delay
  useEffect(() => {
    if (!hadError || retryCountRef.current >= 1) return;
    retryCountRef.current += 1;
    const timer = setTimeout(() => {
      setHadError(false);
      setLoaded(false);
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
        if (url) {
          setResolved(url);
          setLoaded(false);
        }
        else setHadError(true);
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [hadError, fileId, sourceCacheKey, src]);

  // Only treat as "resolving" when there is actually a source to resolve.
  // Without this guard, a null src causes the shimmer to show forever because
  // resolved stays null even after the useEffect completes with no URL.
  const hasSource = !!(fileId || src);
  const isKnownUnavailableSource = isKnownUnavailableSeedMediaUrl(resolved ?? src);
  const isResolving = hasSource && !hadError && !resolved;
  // Shimmer should stay visible until the image is fully loaded, not just until the URL resolves.
  // Without this, there is a white flash between "URL resolved" and "image onLoad" because the
  // <img> is opacity-0 with no background behind it during that window.
  const showFallback = hadError || isKnownUnavailableSource;
  const showPreviousImage =
    keepPreviousOnReload && Boolean(lastGoodUrl) && !showFallback && hasSource && (isResolving || !loaded);
  const showShimmer = !showPreviousImage && !showFallback && (isResolving || (hasSource && !hadError && !loaded));
  const wrapperClassName = cn('overflow-hidden', roundClass(rounded), containerClassName);

  useEffect(() => {
    if (loaded || showFallback || isResolving) return;
    const image = imgRef.current;
    if (!image) return;
    if (image.complete && image.naturalWidth > 0) {
      setLoaded(true);
      if (resolved) {
        setLastGoodUrl(resolved);
        if (sourceCacheKey) {
          lastGoodUrlCache.set(sourceCacheKey, resolved);
        }
      }
    }
  }, [isResolving, loaded, resolved, showFallback, sourceCacheKey]);

  const handleImageLoaded = () => {
    setLoaded(true);
    if (resolved) {
      setLastGoodUrl(resolved);
      if (sourceCacheKey) {
        lastGoodUrlCache.set(sourceCacheKey, resolved);
      }
    }
  };

  return (
    <div className={cn('relative', wrapperClassName)} onClick={onClick}>
      {showShimmer && (
        /* Shimmer skeleton — visible until the signed URL is fetched AND image is fully loaded */
        <div className={cn('absolute inset-0 animate-pulse bg-gray-200 dark:bg-gray-700', roundClass(rounded))} aria-hidden="true" />
      )}
      {showFallback && (
        <DefaultAvatar name={fallbackName ?? alt} className={cn('w-full h-full', roundClass(rounded), className)} />
      )}
      {showPreviousImage && lastGoodUrl ? (
        <MediaRenderer
          kind="image"
          src={lastGoodUrl}
          alt=""
          fit={fit}
          loading="eager"
          className="absolute inset-0 w-full h-full"
          mediaClassName={cn('opacity-100', className)}
          maxHeightClassName={maxHeightClassName ?? 'max-h-[70vh]'}
          maxWidthClassName="max-w-full"
        />
      ) : null}
      {!isResolving && !showFallback && (
        <MediaRenderer
          kind="image"
          src={resolved ?? ''}
          alt={alt}
          fit={fit}
          imgRef={imgRef}
          onError={() => setHadError(true)}
          onLoad={handleImageLoaded}
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
