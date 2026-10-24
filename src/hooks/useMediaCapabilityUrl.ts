import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { brandApi } from '@/api/BrandApi';
import { resolveCachedMediaUrl } from '@/utils/mediaUrlCache';
import { getMediaUrlExpiryMs, getMediaUrlIdentity, isRenewableMediaUrl, isUsableMediaUrl, MEDIA_URL_REFRESH_SKEW_MS } from '@/utils/mediaUrlPolicy';
import { getMediaSessionEpoch, subscribeMediaSession } from '@/utils/mediaUrlSession';

/** URL-only surfaces renew through server-side metadata authorization. */
export function useMediaCapabilityUrl(source?: string | null, beforeRenew?: () => void) {
  const epoch = useSyncExternalStore(subscribeMediaSession, getMediaSessionEpoch, getMediaSessionEpoch);
  const input = source?.trim() || null;
  const [state, setState] = useState(() => ({ input, epoch, url: isUsableMediaUrl(input) ? input : null }));
  const current = useRef({ input, epoch });
  const mounted = useRef(true);
  const prepare = useRef(beforeRenew);
  // An instance surviving an account change must authorize later payloads too.
  const mountEpoch = useRef(epoch);
  current.current = { input, epoch };
  prepare.current = beforeRenew;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const renew = useCallback(async () => {
    if (!input || !isRenewableMediaUrl(input)) return null;
    prepare.current?.();
    const url = await resolveCachedMediaUrl(`source-only:${getMediaUrlIdentity(input)}`, () => brandApi.getSignedMediaSourceUrl(input, { forceRefresh: true }), true);
    if (!mounted.current || current.current.input !== input || current.current.epoch !== epoch || epoch !== getMediaSessionEpoch()) return null;
    setState({ input, epoch, url });
    return url;
  }, [epoch, input]);

  useEffect(() => {
    const accountChanged = mountEpoch.current !== epoch;
    if (!accountChanged && isUsableMediaUrl(input)) {
      setState((previous) => previous.input === input && previous.epoch === epoch && previous.url === input ? previous : { input, epoch, url: input });
    } else if (input && isRenewableMediaUrl(input)) {
      setState({ input, epoch, url: null });
      void renew();
    } else setState({ input, epoch, url: isUsableMediaUrl(input) ? input : null });
  }, [epoch, input, renew]);

  const url = state.input === input && state.epoch === epoch
    ? state.url
    : mountEpoch.current === epoch && isUsableMediaUrl(input) ? input : null;
  useEffect(() => {
    const expiry = getMediaUrlExpiryMs(url);
    if (expiry === null) return;
    const timer = setTimeout(() => { void renew(); }, Math.min(2_147_483_647, Math.max(1000, expiry - Date.now() - MEDIA_URL_REFRESH_SKEW_MS)));
    return () => clearTimeout(timer);
  }, [renew, url]);

  useEffect(() => {
    const check = () => { if (input && isRenewableMediaUrl(input) && !isUsableMediaUrl(url)) void renew(); };
    const visible = () => { if (document.visibilityState === 'visible') check(); };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', visible);
    return () => { window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', visible); };
  }, [input, renew, url]);
  return { url, refresh: renew, epoch };
}
