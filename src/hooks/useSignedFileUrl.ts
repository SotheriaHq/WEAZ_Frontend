import { useEffect, useState } from 'react';
import { brandApi } from '@/api/BrandApi';

// Re-use the same session-storage cache from ImageWithFallback
const CACHE_KEY = 'threadly_signed_url_cache';
const CACHE_EXPIRY_MS = 14 * 60 * 1000;

interface CacheEntry { url: string; expiresAt: number; }

const getCache = (): Record<string, CacheEntry> => {
  try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}'); } catch { return {}; }
};

const getCachedUrl = (key: string): string | null => {
  const entry = getCache()[key];
  return entry && entry.expiresAt > Date.now() ? entry.url : null;
};

const invalidateCachedUrl = (key: string) => {
  const cache = getCache();
  if (!cache[key]) return;
  delete cache[key];
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* full */ }
};

const setCachedUrl = (key: string, url: string) => {
  const cache = getCache();
  cache[key] = { url, expiresAt: Date.now() + CACHE_EXPIRY_MS };
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* full */ }
};

// In-flight dedup map (shared module-level singleton)
const inflight = new Map<string, Promise<string | null>>();

const dedup = async (
  key: string,
  fetcher: () => Promise<string | null>,
): Promise<string | null> => {
  const cached = getCachedUrl(key);
  if (cached) return cached;
  const existing = inflight.get(key);
  if (existing) return existing;
  const p = fetcher()
    .then((u) => { if (u) setCachedUrl(key, u); return u || null; })
    .catch(() => null)
    .finally(() => { inflight.delete(key); });
  inflight.set(key, p);
  return p;
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

/**
 * Resolve a signed URL for a given fileId with an optional initial fallback URL.
 * Guarantees a stable url string or null, plus loading/error states.
 */
export function useSignedFileUrl(fileId?: string | null, initial?: string | null) {
  const [url, setUrl] = useState<string | null>(() => {
    // Try cache first for instant render
    if (fileId) {
      const cached = getCachedUrl(fileId);
      if (cached) return cached;
    }
    if (initial && isRawStorageKey(initial)) {
      return getCachedUrl(`key:${initial}`) ?? initial;
    }
    if (initial && isS3LikeUrl(initial)) {
      return getCachedUrl(initial) ?? initial;
    }
    return initial ?? null;
  });
  const [loading, setLoading] = useState<boolean>(Boolean(fileId));
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    setError(null);

    // If no stable fileId is available, use initial-url optimization.
    // When fileId exists, prefer resolving by fileId to avoid stale signed URLs.
    if (!fileId && initial && !isS3LikeUrl(initial) && !isRawStorageKey(initial)) {
        setUrl(initial);
        setLoading(false);
        return;
    }

    // Handle S3 URLs (signed or unsigned) by resolving a fresh URL through API.
    if (!fileId && initial && isS3LikeUrl(initial)) {
      setLoading(true);
      dedup(initial, () => brandApi.getSignedS3Url(initial)).then((signed) => {
        if (!cancelled) {
          if (signed) {
            setUrl(signed);
            setLoading(false);
            return;
          }

          // Retry once after short delay for transient auth/network delays.
          retryTimer = setTimeout(() => {
            brandApi.invalidateSignedUrlCache(initial);
            invalidateCachedUrl(initial);
            void dedup(initial, () =>
              brandApi.getSignedS3Url(initial, { forceRefresh: true }),
            ).then((retrySigned) => {
              if (!cancelled) {
                setUrl(retrySigned ?? initial);
                setLoading(false);
              }
            });
          }, 900);
        }
      });
      return () => {
        cancelled = true;
        if (retryTimer) clearTimeout(retryTimer);
      };
    }

    if (!fileId && initial && isRawStorageKey(initial)) {
      const cacheKey = `key:${initial}`;
      setLoading(true);
      dedup(cacheKey, () => brandApi.getSignedS3KeyUrl(initial)).then((signed) => {
        if (!cancelled) {
          if (signed) {
            setUrl(signed);
            setLoading(false);
            return;
          }

          retryTimer = setTimeout(() => {
            brandApi.invalidateSignedUrlCache(initial);
            invalidateCachedUrl(cacheKey);
            void dedup(cacheKey, () =>
              brandApi.getSignedS3KeyUrl(initial, { forceRefresh: true }),
            ).then((retrySigned) => {
              if (!cancelled) {
                setUrl(retrySigned ?? initial);
                setLoading(false);
              }
            });
          }, 900);
        }
      });

      return () => {
        cancelled = true;
        if (retryTimer) clearTimeout(retryTimer);
      };
    }

    if (!fileId) {
      // No fileId, just use initial and mark as not loading
      setUrl(initial ?? null);
      setLoading(false);
      return;
    }

    // Check cache for instant display
    const cached = getCachedUrl(fileId);
    if (cached) {
      setUrl(cached);
      setLoading(false);
      return;
    }

    setLoading(true);
    dedup(fileId, () => brandApi.getSignedFileUrl(fileId)).then((signed) => {
      if (!cancelled) {
        if (signed) {
          setUrl(signed);
          setLoading(false);
          return;
        }

        // Retry once after short delay for transient auth/network delays.
        retryTimer = setTimeout(() => {
          brandApi.invalidateSignedUrlCache(fileId);
          invalidateCachedUrl(fileId);
          void dedup(fileId, () =>
            brandApi.getSignedFileUrl(fileId, { forceRefresh: true }),
          ).then((retrySigned) => {
            if (!cancelled) {
              if (retrySigned) {
                setUrl(retrySigned);
                setError(null);
              } else {
                setError(new Error('Failed to resolve signed URL'));
                setUrl(initial ?? null);
              }
              setLoading(false);
            }
          });
        }, 900);
        return;
      }
    });

    return () => {
      cancelled = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
    };
  }, [fileId, initial]);

  return { url, loading, error } as const;
}

export default useSignedFileUrl;
