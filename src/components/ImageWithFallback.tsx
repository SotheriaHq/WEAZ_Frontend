import { getCachedMediaUrl as getCachedUrl, invalidateCachedMediaUrl as invalidateCachedUrl, mediaSessionCacheKey, resolveCachedMediaUrl as resolveSignedUrl } from '@/utils/mediaUrlCache';
import { getMediaUrlExpiryMs, getMediaUrlIdentity, isRenewableMediaUrl, isStorageProviderUrl, isUsableMediaUrl, MEDIA_URL_REFRESH_SKEW_MS } from '@/utils/mediaUrlPolicy';
import { getMediaSessionEpoch, subscribeMediaSession } from '@/utils/mediaUrlSession';
import React, { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';
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
  /**
   * Native <img> loading hint. Defaults to 'eager' to preserve existing
   * behavior. Pass 'lazy' for grid/feed cards in a DOCUMENT-scrolled layout so
   * off-screen images defer instead of all firing at once and queuing behind
   * the browser's ~6-connection cap (the "cards render one at a time" symptom).
   * Do NOT use 'lazy' inside a custom overflow-scroll container.
   */
  loading?: 'lazy' | 'eager';
  /** Fetch priority hint forwarded to the underlying <img>. */
  fetchPriority?: 'high' | 'low' | 'auto';
  /** Optional stable surface used while a first-time image is decoding. */
  loadingPlaceholderClassName?: string;
  /**
   * Hold a newly introduced source behind its placeholder until final decode.
   * Opt-in because document/grid callers retain their established eager paint;
   * full-screen swipe media needs the stricter no-progressive-paint guarantee.
   */
  waitForDecode?: boolean;
  /**
   * Fires when the resolved image has actually painted. Lets a caller hold a
   * local preview underneath until the real one is on screen, so the swap is a
   * crossfade instead of a gap.
   */
  onLoaded?: () => void;
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

const isS3LikeUrl = isRenewableMediaUrl;

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

const isUsableInitialUrl = isUsableMediaUrl;

const isRawStorageKey = (value?: string | null) => {
  if (!value) return false;
  if (/^(https?:|data:|blob:)/i.test(value) || value.includes('?')) return false;
  const normalized = value.replace(/^\/+/, '').toUpperCase();
  return STORAGE_KEY_PREFIXES.some((prefix) => normalized.startsWith(`${prefix}/`));
};

const shouldPreferFileIdResolution = (value?: string | null, fileId?: string | null) => {
  if (!value || !fileId) return false;
  // Market rails and catalog cards often ship a freshly signed URL alongside
  // a fileId. Prefer the usable signed src so we don't re-hit /public-url
  // (which 400s for some product images and blanks the card).
  if (isUsableInitialUrl(value)) return false;
  return isS3LikeUrl(value);
};

const canUseSourceDirectly = (src?: string | null, fileId?: string | null) =>
  isUsableInitialUrl(src) && !shouldPreferFileIdResolution(src, fileId);

const resolveSourceCacheKey = (fileId?: string | null, src?: string | null) => {
  if (fileId) return `${fileId}:${src ? getMediaUrlIdentity(src) : 'none'}`;
  if (!src) return null;
  if (isRawStorageKey(src)) return `key:${src}`;
  return getMediaUrlIdentity(src);
};

const lastGoodUrlCache = new Map<string, string>();
function rememberLastGood(key: string, value: string) {
  lastGoodUrlCache.set(mediaSessionCacheKey(key), value);
  while (lastGoodUrlCache.size > 256) lastGoodUrlCache.delete(lastGoodUrlCache.keys().next().value!);
}
function previousGood(key: string): string | null {
  const value = lastGoodUrlCache.get(mediaSessionCacheKey(key));
  return value && isUsableMediaUrl(value) ? value : null;
}

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
  loading = 'eager',
  fetchPriority,
  loadingPlaceholderClassName,
  waitForDecode = false,
  onLoaded,
}) => {
  const sessionEpoch = useSyncExternalStore(subscribeMediaSession, getMediaSessionEpoch, getMediaSessionEpoch);
  const previousEpoch = React.useRef(sessionEpoch);
  const mountEpoch = React.useRef(sessionEpoch);
  const [resolutionRevision, setResolutionRevision] = useState(0);
  const handledRevision = React.useRef(resolutionRevision);
  const sourceCacheKey = resolveSourceCacheKey(fileId, src);
  const cachedLastGoodUrl = sourceCacheKey ? previousGood(sourceCacheKey) ?? null : null;
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
  // Sticky "this source has failed at least once" flag. After a first failure we
  // keep the stable fallback avatar visible during the silent retry instead of
  // re-flashing the shimmer, which produced the jarring
  // skeleton -> initials -> skeleton -> initials sequence on market cards.
  const [everErrored, setEverErrored] = useState(false);
  // A URL being known is not evidence that its pixels are decoded. The stricter
  // runway path holds it transparent until `onLoad`, preventing progressive
  // JPEG/AVIF paint from appearing as a 10% → 100% image build during a swipe.
  // Cache hits are promoted synchronously by the layout effect below, before
  // first paint. Other callers retain the existing eager-paint behavior.
  const [loaded, setLoaded] = useState(() => {
    if (waitForDecode) return !src && !fileId;
    if (canUseSourceDirectly(src, fileId)) return true;
    if (fileId) return !!(getCachedUrl(fileId));
    if (src && isRawStorageKey(src)) return !!(getCachedUrl(`key:${src}`));
    if (src && isS3LikeUrl(src)) return !!getCachedUrl(src);
    return !!src;
  });
  const [lastGoodUrl, setLastGoodUrl] = useState<string | null>(() =>
    cachedLastGoodUrl ?? (loaded ? resolved : null),
  );
  /**
   * True when the image was already decoded at mount, so it needs no fade.
   *
   * A cache hit and a cold network fetch look identical to `loaded` — both end
   * up true. Only one of them should animate.
   */
  const [instant, setInstant] = useState(false);
  const retryCountRef = React.useRef(0);
  const imgRef = React.useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    let mounted = true;
    const accountChanged = previousEpoch.current !== sessionEpoch;
    const forceRefresh = resolutionRevision !== handledRevision.current || accountChanged || mountEpoch.current !== sessionEpoch;
    handledRevision.current = resolutionRevision;
    previousEpoch.current = sessionEpoch;
    if (accountChanged) { setLastGoodUrl(null); setResolved(null); }
    retryCountRef.current = 0;

    const run = async () => {
      // If src/fileId changed, reset error state (new image starts fresh, so it
      // is allowed to show the shimmer again).
      setHadError(false);
      setEverErrored(false);
      setInstant(false);
      if (sourceCacheKey) {
        const cachedLastGood = previousGood(sourceCacheKey);
        if (cachedLastGood) {
          setLastGoodUrl(cachedLastGood);
        }
      }

      const cachedFileUrl = fileId ? getCachedUrl(fileId) : null;
      const cachedSourceUrl =
        !fileId && src && isRawStorageKey(src)
          ? getCachedUrl(`key:${src}`)
          : !fileId && src && isS3LikeUrl(src)
            ? getCachedUrl(src)
            : null;
      const hasInstantSource =
        canUseSourceDirectly(src, fileId) ||
        Boolean(cachedFileUrl) ||
        Boolean(cachedSourceUrl) ||
        Boolean(sourceCacheKey && previousGood(sourceCacheKey));
      const hasPreviouslyPaintedSource = Boolean(sourceCacheKey && previousGood(sourceCacheKey));

      if ((waitForDecode && !hasPreviouslyPaintedSource) || (!waitForDecode && !hasInstantSource)) {
        setLoaded(false);
      }

      if (!forceRefresh && canUseSourceDirectly(src, fileId)) {
        setResolved(src ?? null);
        if (!waitForDecode) setLoaded(true);
        return;
      }

      if (src && isS3LikeUrl(src)) {
        const url = await resolveSignedUrl(sourceCacheKey ?? src, async () => {
          if (typeof brandApi.getSignedMediaSourceUrl === 'function') {
            const renewed = await brandApi.getSignedMediaSourceUrl(src, { forceRefresh });
            if (renewed) return renewed;
          }
          if (fileId) return forceRefresh ? brandApi.getSignedFileUrl(fileId, { forceRefresh: true }) : brandApi.getSignedFileUrl(fileId);
          return isStorageProviderUrl(src) ? (forceRefresh ? brandApi.getSignedS3Url(src, { forceRefresh: true }) : brandApi.getSignedS3Url(src)) : null;
        }, forceRefresh);
        if (mounted) { setResolved(url); if (!url) setHadError(true); }
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
      if (!fileId && src && isUsableInitialUrl(src)) {
        setResolved(src);
        return;
      }

      if (fileId) {
        // Check cache first
        const cachedUrl = getCachedUrl(fileId);
        if (cachedUrl) {
          setResolved(cachedUrl);
          if (!waitForDecode) setLoaded(true);
          return; // Use cached URL, no need to fetch
        }

        const url = await resolveSignedUrl(fileId, () => brandApi.getSignedFileUrl(fileId));
        if (mounted) {
          if (url) {
            setResolved(url);
          } else {
            if (canUseSourceDirectly(src, fileId)) {
              // If file-id signing fails, keep the raw source as a best-effort fallback.
              setResolved(src ?? null);
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
  }, [fileId, sourceCacheKey, src, waitForDecode, sessionEpoch, resolutionRevision]);

  useEffect(() => {
    if (hadError) setEverErrored(true);
  }, [hadError]);

  // Auto-retry once on error after a short delay
  useEffect(() => {
    if (!hadError || retryCountRef.current >= 1) return;
    retryCountRef.current += 1;
    let mounted = true;
    const timer = setTimeout(() => {
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

      /*
       * On retry, ask for a SIGNED url — not the public one that just failed.
       *
       * `getSignedFileUrl` tries `/uploads/public-url` first and only falls
       * through to the signed endpoint when the public one returns nothing. A
       * public url that RESOLVES but cannot be fetched defeats that: the server
       * keeps handing back the same string, the <img> keeps 403ing, and the
       * retry re-runs the identical request. The image is then permanently the
       * initials fallback, unchanged by a reload — which is exactly what a
       * misconfigured MEDIA_PUBLIC_BASE_URL produces, since the code builds
       * `${base}/${key}` and returns it without ever checking it is readable.
       *
       * The signed endpoint is the authoritative path and is what the fallback
       * existed for. Going straight there turns a hard outage into one slow
       * frame.
       */
      const fetcher = src && isRenewableMediaUrl(src) && typeof brandApi.getSignedMediaSourceUrl === 'function'
        ? async () => (await brandApi.getSignedMediaSourceUrl(src, { forceRefresh: true }))
          ?? (fileId ? (await brandApi.getPrivateSignedFileUrl(fileId, { forceRefresh: true }))
            ?? (await brandApi.getPublicFileUrl(fileId, { forceRefresh: true })) : null)
        : fileId
        ? async () =>
            /*
             * Private FIRST, public as the fallback — not private alone.
             *
             * Going straight to the signed endpoint fixes the case where a
             * public url resolves but cannot be fetched. On its own it breaks a
             * different one: `/uploads/signed-url/:id` authorises by ownership,
             * so viewing SOMEONE ELSE'S avatar or a brand's catalogue image
             * would fail closed and stick on the initials. Trying both, in the
             * order that inverts the primary path, covers both cases.
             */
            (await brandApi.getPrivateSignedFileUrl(fileId, { forceRefresh: true })) ??
            (await brandApi.getPublicFileUrl(fileId, { forceRefresh: true }))
        : src && isS3LikeUrl(src)
          ? () => brandApi.getSignedS3Url(src, { forceRefresh: true })
          : src && !/^https?:\/\//i.test(src)
            ? () => brandApi.getSignedS3KeyUrl(src, { forceRefresh: true })
            : async () => src ?? null;
      resolveSignedUrl(sourceCacheKey, fetcher, true).then((url) => {
        if (!mounted) return;
        if (url) {
          setResolved(url);
          setLoaded(false);
          setHadError(false);
        }
        else setHadError(true);
      });
    }, 2000);
    return () => { mounted = false; clearTimeout(timer); };
  }, [hadError, fileId, sourceCacheKey, src]);

  useEffect(() => {
    const expiresAt = getMediaUrlExpiryMs(resolved);
    if (expiresAt === null) return;
    const timeout = setTimeout(() => setResolutionRevision((value) => value + 1),
      Math.min(2_147_483_647, Math.max(1000, expiresAt - Date.now() - MEDIA_URL_REFRESH_SKEW_MS)));
    return () => clearTimeout(timeout);
  }, [resolved]);

  useEffect(() => {
    const check = () => {
      if (isRenewableMediaUrl(resolved ?? src) && !isUsableMediaUrl(resolved)) setResolutionRevision((value) => value + 1);
    };
    const visible = () => { if (document.visibilityState === 'visible') check(); };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', visible);
    return () => { window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', visible); };
  }, [resolved, src]);

  // Only treat as "resolving" when there is actually a source to resolve.
  // Without this guard, a null src causes the shimmer to show forever because
  // resolved stays null even after the useEffect completes with no URL.
  const hasSource = !!(fileId || src);
  const isKnownUnavailableSource = isKnownUnavailableSeedMediaUrl(resolved ?? src);
  const isResolving = hasSource && !hadError && !resolved;
  // Shimmer should stay visible until the image is fully loaded, not just until the URL resolves.
  // Without this, there is a white flash between "URL resolved" and "image onLoad" because the
  // <img> is opacity-0 with no background behind it during that window.
  const showFallback = !hasSource || hadError || isKnownUnavailableSource;
  // Once a source has errored, a silent retry may be in flight (hadError back to
  // false while a fresh signed URL loads). Keep the stable fallback painted
  // during that window instead of re-showing the shimmer.
  const showRetryFallback = everErrored && !showFallback && !loaded;
  const showPreviousImage =
    keepPreviousOnReload && Boolean(lastGoodUrl) && !showFallback && hasSource && (isResolving || !loaded);
  const showShimmer =
    !showPreviousImage &&
    !showFallback &&
    !showRetryFallback &&
    !everErrored &&
    (isResolving || (hasSource && !hadError && !loaded));
  const wrapperClassName = cn('overflow-hidden', roundClass(rounded), containerClassName);

  /*
   * Cached images must paint instantly — no shimmer, no fade.
   *
   * This was a `useEffect`, which runs AFTER the browser paints. So an image
   * already in the browser cache went: paint one frame at `opacity-0` with the
   * shimmer over it, THEN flip `loaded`, THEN fade in over 300ms. Every card
   * that remounted while scrolling replayed that, which is the "it settles and
   * then flickers and re-settles" report — and why the feed never feels as
   * still as a native app's, where a cached image simply appears.
   *
   * `useLayoutEffect` runs after the DOM is attached but BEFORE paint, so
   * `image.complete` is already true for a cache hit and the state flip is
   * flushed synchronously. The opacity-0 frame is never painted.
   *
   * `instant` then suppresses the transition. Without it the class flip still
   * animates from 0 to 1 even though nothing was ever waiting on the network.
   */
  useLayoutEffect(() => {
    if (loaded || showFallback || isResolving) return;
    const image = imgRef.current;
    if (!image) return;
    if (image.complete && image.naturalWidth > 0) {
      setInstant(true);
      setLoaded(true);
      onLoaded?.();
      if (resolved) {
        setLastGoodUrl(resolved);
        if (sourceCacheKey) {
          rememberLastGood(sourceCacheKey, resolved);
        }
      }
    }
    // `onLoaded` is deliberately absent: callers pass an inline closure, and
    // depending on it would re-run this cache-warming effect every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResolving, loaded, resolved, showFallback, sourceCacheKey]);

  const handleImageLoaded = () => {
    setLoaded(true);
    onLoaded?.();
    if (resolved) {
      setLastGoodUrl(resolved);
      if (sourceCacheKey) {
        rememberLastGood(sourceCacheKey, resolved);
      }
    }
  };

  return (
    <div className={cn('relative', wrapperClassName)} onClick={onClick}>
      {showShimmer && (
        /* Shimmer skeleton — visible until the signed URL is fetched AND image is fully loaded */
        <div className={cn('absolute inset-0 animate-pulse bg-gray-200 dark:bg-gray-700', roundClass(rounded), loadingPlaceholderClassName)} aria-hidden="true" />
      )}
      {showFallback && (
        <DefaultAvatar name={fallbackName ?? alt} className={cn('w-full h-full', roundClass(rounded), className)} />
      )}
      {showRetryFallback && (
        /* Silent-retry placeholder: overlay the fallback so the reloading image
           can mount underneath and swap in on load — no shimmer re-flash. */
        <DefaultAvatar name={fallbackName ?? alt} className={cn('absolute inset-0 w-full h-full', roundClass(rounded), className)} />
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
          loading={loading}
          fetchPriority={fetchPriority}
          className="w-full h-full"
          mediaClassName={`${instant ? '' : 'transition-opacity duration-300'} ${loaded ? 'opacity-100' : 'opacity-0'} ${className ?? ''}`}
          maxHeightClassName={maxHeightClassName ?? 'max-h-[70vh]'}
          maxWidthClassName="max-w-full"
        />
      )}
    </div>
  );
};

export default ImageWithFallback;
