import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { brandApi } from '@/api/BrandApi';
import { WIEZ_MEDIA_URL_GC_TIME_MS, WIEZ_QUERY_STALE_TIME_MS } from '@/query/queryClient';
import { queryKeys } from '@/query/queryKeys';
import { clearCachedMediaUrls, resolveCachedMediaUrl } from '@/utils/mediaUrlCache';
import { getMediaUrlExpiryMs, getMediaUrlIdentity, isRenewableMediaUrl, isStorageProviderUrl, isUsableMediaUrl, MEDIA_URL_REFRESH_SKEW_MS } from '@/utils/mediaUrlPolicy';
import { getMediaSessionEpoch, subscribeMediaSession } from '@/utils/mediaUrlSession';

export const clearSignedFileUrlSessionCache = clearCachedMediaUrls;

/** Resolve a capability without letting API/session caches outlive its expiry. */
export function useSignedFileUrl(fileId?: string | null, initial?: string | null) {
  const queryClient = useQueryClient();
  const epoch = useSyncExternalStore(subscribeMediaSession, getMediaSessionEpoch, getMediaSessionEpoch);
  const previousEpoch = useRef(epoch);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const [url, setUrl] = useState<string | null>(() => isUsableMediaUrl(initial) ? initial! : null);
  const [loading, setLoading] = useState(Boolean((fileId || initial) && !isUsableMediaUrl(initial)));
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    const force = revision > 0 || previousEpoch.current !== epoch;
    previousEpoch.current = epoch;
    const identity = initial ? getMediaUrlIdentity(initial) : 'none';
    const cacheKey = `file:${fileId ?? 'none'}:source:${identity}`;
    setError(null);
    if (!force && isUsableMediaUrl(initial)) { setUrl(initial!); setLoading(false); return; }
    if (!fileId && !initial) { setUrl(null); setLoading(false); return; }
    setLoading(true);
    void resolveCachedMediaUrl(cacheKey, async () => {
      if (initial && isRenewableMediaUrl(initial)) {
        const sourceResolver = brandApi.getSignedMediaSourceUrl;
        if (typeof sourceResolver === 'function') {
          const renewed = await sourceResolver.call(brandApi, initial, { forceRefresh: force });
          if (renewed) return renewed;
        }
        // Compatibility with older APIs supports legacy AWS keys only.
        if (!fileId && isStorageProviderUrl(initial) && typeof brandApi.getSignedS3Url === 'function') {
          return brandApi.getSignedS3Url(initial, force ? { forceRefresh: true } : undefined);
        }
      }
      if (!fileId) {
        if (initial && !/^https?:\/\//i.test(initial) && typeof brandApi.getSignedS3KeyUrl === 'function') {
          return brandApi.getSignedS3KeyUrl(initial, force ? { forceRefresh: true } : undefined);
        }
        return isUsableMediaUrl(initial) && !isRenewableMediaUrl(initial) ? initial! : null;
      }
      const publicKey = queryKeys.media.publicUrl(fileId);
      const privateKey = queryKeys.media.signedUrl(fileId);
      const cached = queryClient.getQueryData<string | null>(publicKey);
      const mustRefresh = force || Boolean(cached && !isUsableMediaUrl(cached));
      if (mustRefresh) {
        brandApi.invalidateSignedUrlCache(fileId);
        queryClient.removeQueries({ queryKey: publicKey, exact: true });
        queryClient.removeQueries({ queryKey: privateKey, exact: true });
      }
      const options = mustRefresh ? { forceRefresh: true } : undefined;
      const publicUrl = await queryClient.fetchQuery({
        queryKey: publicKey,
        queryFn: () => options ? brandApi.getPublicFileUrl(fileId, options) : brandApi.getPublicFileUrl(fileId),
        staleTime: mustRefresh ? 0 : WIEZ_QUERY_STALE_TIME_MS, gcTime: WIEZ_MEDIA_URL_GC_TIME_MS, retry: false,
      });
      if (publicUrl && isUsableMediaUrl(publicUrl, Date.now(), 0)) return publicUrl;
      const cachedPrivate = queryClient.getQueryData<string | null>(privateKey);
      if (cachedPrivate && !isUsableMediaUrl(cachedPrivate)) queryClient.removeQueries({ queryKey: privateKey, exact: true });
      return queryClient.fetchQuery({
        queryKey: privateKey,
        queryFn: () => options ? brandApi.getPrivateSignedFileUrl(fileId, options) : brandApi.getPrivateSignedFileUrl(fileId),
        staleTime: mustRefresh ? 0 : WIEZ_QUERY_STALE_TIME_MS, gcTime: WIEZ_MEDIA_URL_GC_TIME_MS, retry: false,
      });
    }, force).then((resolved) => {
      if (cancelled) return;
      setUrl(resolved);
      setError(resolved ? null : new Error('Unable to resolve media URL'));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [epoch, fileId, initial, queryClient, revision]);

  useEffect(() => {
    const expiresAt = getMediaUrlExpiryMs(url);
    if (expiresAt === null) return;
    const timer = setTimeout(refresh, Math.min(2_147_483_647, Math.max(1000, expiresAt - Date.now() - MEDIA_URL_REFRESH_SKEW_MS)));
    return () => clearTimeout(timer);
  }, [refresh, url]);

  useEffect(() => {
    const check = () => { if ((fileId || isRenewableMediaUrl(initial)) && !isUsableMediaUrl(url)) refresh(); };
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', onVisible); };
  }, [fileId, initial, refresh, url]);

  return { url, loading, error, refresh } as const;
}

export default useSignedFileUrl;
