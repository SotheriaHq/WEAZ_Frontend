import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { brandApi } from '@/api/BrandApi';
import { THREADLY_QUERY_STALE_TIME_MS } from '@/query/queryClient';
import { queryKeys } from '@/query/queryKeys';

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

const isHttpUrl = (value?: string | null) => Boolean(value && /^https?:\/\//i.test(value));

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
  if (!isHttpUrl(value)) return false;
  if (!hasSignedUrlParams(value)) return true;
  const expiresAt = getSignedUrlExpiresAt(value!);
  return Boolean(expiresAt && expiresAt > Date.now() + 30_000);
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
  const queryClient = useQueryClient();
  const [url, setUrl] = useState<string | null>(() => {
    if (isUsableInitialUrl(initial)) {
      return initial ?? null;
    }
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
  const [loading, setLoading] = useState<boolean>(Boolean(fileId && !isUsableInitialUrl(initial)));
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    setError(null);

    if (isUsableInitialUrl(initial)) {
      setUrl(initial ?? null);
      setLoading(false);
      return;
    }

    // Prefer a usable payload URL first; fileId resolution is only needed when
    // the direct URL is missing or close to signed-URL expiry.
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
    dedup(fileId, () =>
      queryClient.fetchQuery({
        queryKey: queryKeys.media.publicUrl(fileId),
        queryFn: () => brandApi.getPublicFileUrl(fileId),
        staleTime: THREADLY_QUERY_STALE_TIME_MS,
      }).then((publicUrl) => {
        if (publicUrl) return publicUrl;
        return queryClient.fetchQuery({
          queryKey: queryKeys.media.signedUrl(fileId),
          queryFn: () => brandApi.getPrivateSignedFileUrl(fileId),
          staleTime: THREADLY_QUERY_STALE_TIME_MS,
          gcTime: THREADLY_QUERY_STALE_TIME_MS,
        });
      }),
    ).then((signed) => {
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
          queryClient.removeQueries({ queryKey: queryKeys.media.publicUrl(fileId), exact: true });
          queryClient.removeQueries({ queryKey: queryKeys.media.signedUrl(fileId), exact: true });
          void dedup(fileId, () =>
            queryClient.fetchQuery({
              queryKey: queryKeys.media.publicUrl(fileId),
              queryFn: () => brandApi.getPublicFileUrl(fileId, { forceRefresh: true }),
              staleTime: THREADLY_QUERY_STALE_TIME_MS,
            }).then((publicUrl) => {
              if (publicUrl) return publicUrl;
              return queryClient.fetchQuery({
                queryKey: queryKeys.media.signedUrl(fileId),
                queryFn: () => brandApi.getPrivateSignedFileUrl(fileId, { forceRefresh: true }),
                staleTime: THREADLY_QUERY_STALE_TIME_MS,
                gcTime: THREADLY_QUERY_STALE_TIME_MS,
              });
            }),
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
  }, [fileId, initial, queryClient]);

  return { url, loading, error } as const;
}

export default useSignedFileUrl;
