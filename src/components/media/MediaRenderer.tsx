import React from 'react';
import { cn } from '../../lib/utils';
import { isKnownUnavailableSeedMediaUrl } from '@/utils/mediaSource';
import { isPreviewUnavailableDataUrl } from '@/utils/imagePreview';
import { useMediaCapabilityUrl } from '@/hooks/useMediaCapabilityUrl';
import { getMediaUrlIdentity, isRenewableMediaUrl } from '@/utils/mediaUrlPolicy';

export type MediaKind = 'image' | 'video';

export interface MediaRendererProps {
  kind: MediaKind;
  src: string;

  /**
   * How the media should fit inside its container.
   * Default is `contain` to ensure media is always fully visible (no cropping).
   */
  fit?: 'contain' | 'cover';

  /** Required for images that convey information. Use "" for decorative. */
  alt?: string;

  /** Wrapper className. Avoid background/padding here to preserve the invariant. */
  className?: string;

  /** Applied to the underlying <img>/<video>. */
  mediaClassName?: string;

  /** Constrain height only; allows tall media to scroll instead of letterboxing. */
  maxHeightClassName?: string;

  /** Constrain width only; avoids huge wide media breaking layouts. */
  maxWidthClassName?: string;

  /** Opt-in vertical scrolling for very tall media (default: false). */
  allowScroll?: boolean;

  /** Video options (ignored for images). */
  controls?: boolean;
  autoPlay?: boolean;
  playsInline?: boolean;
  muted?: boolean;
  loop?: boolean;
  preload?: 'auto' | 'metadata' | 'none';
  poster?: string;

  /** Event hooks */
  onLoad?: () => void;
  onLoadedData?: () => void;
  onError?: () => void;

  /** Optional responsive image descriptors for optimized variants. */
  srcSet?: string;
  sizes?: string;

  /**
   * Native browser loading hint for images.
   * Default is omitted (browser default: eager).
   * Only pass "lazy" for images that are definitely below the fold in a document-scroll layout.
   * Avoid "lazy" in SPA routes — the IntersectionObserver used by the browser targets the
   * document viewport, not custom scroll containers, so it silently skips visible images.
   */
  loading?: 'lazy' | 'eager';

  /**
   * Priority hint for the image fetch. "high" for above-the-fold hero/first-row
   * media; "low" for off-screen or preload-only images so they don't contend
   * with visible content on the (browser-capped) connection pool.
   */
  fetchPriority?: 'high' | 'low' | 'auto';

  /** Optional direct access to the underlying element (for playback control, etc.) */
  imgRef?: React.Ref<HTMLImageElement>;
  draggable?: boolean;
  mediaStyle?: React.CSSProperties;
  videoRef?: React.Ref<HTMLVideoElement>;
}

/**
 * MediaRenderer (global invariant)
 *
 * - Media should always be fully visible by default (no cropping).
 * - Container may cap dimensions (max-*) and optionally allow vertical scrolling.
 * - Cropping is only allowed via an explicit `fit="cover"` opt-in.
 */
export const MediaRenderer: React.FC<MediaRendererProps> = ({
  kind,
  src,
  fit = 'contain',
  alt,
  className,
  mediaClassName,
  maxHeightClassName = 'max-h-[70vh]',
  maxWidthClassName = 'max-w-full',
  allowScroll = false,
  controls = true,
  autoPlay = false,
  playsInline = true,
  muted,
  loop,
  preload = 'metadata',
  poster,
  onLoad,
  onLoadedData,
  onError,
  srcSet,
  sizes,
  loading,
  fetchPriority,
  imgRef,
  draggable,
  mediaStyle,
  videoRef,
}) => {
  // For 'contain' mode: use intrinsic sizing with max constraints - no cropping
  // For 'cover' mode: fill container and crop overflow (avatars, banners)
  const isCover = fit === 'cover';

  const frameClassName = cn(
    isCover ? undefined : 'media-frame',
    allowScroll ? 'media-frame-scroll' : undefined,
    allowScroll ? maxHeightClassName : undefined,
    allowScroll ? maxWidthClassName : undefined,
    className
  );
  
  // For contain: use intrinsic sizing classes that scale proportionally
  // For cover: use object-cover with full dimensions
  const elementClassName = cn(
    isCover ? 'w-full h-full object-cover' : 'media-intrinsic',
    !isCover && maxHeightClassName,
    !isCover && maxWidthClassName,
    mediaClassName
  );

  const inputSrc = React.useMemo(
    () => (typeof src === 'string' ? src.trim() : ''),
    [src],
  );
  const localVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const playback = React.useRef<{ identity: string; time: number; playing: boolean } | null>(null);
  const rememberPlayback = React.useCallback(() => {
    const element = localVideoRef.current;
    if (element && element.currentTime > 0) playback.current = { identity: getMediaUrlIdentity(inputSrc), time: element.currentTime, playing: !element.paused };
  }, [inputSrc]);
  const capability = useMediaCapabilityUrl(inputSrc, rememberPlayback);
  const posterCapability = useMediaCapabilityUrl(poster);
  const normalizedSrc = capability.url ?? '';
  const mediaIdentity = getMediaUrlIdentity(inputSrc);
  const activeMedia = React.useRef({ identity: mediaIdentity, epoch: capability.epoch });
  const mounted = React.useRef(true);
  activeMedia.current = { identity: mediaIdentity, epoch: capability.epoch };
  React.useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const retry = React.useRef({ identity: mediaIdentity, used: false });
  if (retry.current.identity !== mediaIdentity) retry.current = { identity: mediaIdentity, used: false };
  const setVideoRef = React.useCallback((element: HTMLVideoElement | null) => {
    localVideoRef.current = element;
    if (typeof videoRef === 'function') videoRef(element);
    else if (videoRef) videoRef.current = element;
  }, [videoRef]);
  const isKnownUnavailableSource = React.useMemo(
    () =>
      isKnownUnavailableSeedMediaUrl(normalizedSrc) ||
      isPreviewUnavailableDataUrl(normalizedSrc),
    [normalizedSrc],
  );
  const [hasLoadError, setHasLoadError] = React.useState(false);

  React.useEffect(() => {
    setHasLoadError(false);
  }, [kind, normalizedSrc]);

  const handleError = () => {
    if (isRenewableMediaUrl(inputSrc) && !retry.current.used) {
      retry.current.used = true;
      void capability.refresh().then((url) => {
        if (!mounted.current || activeMedia.current.identity !== mediaIdentity || activeMedia.current.epoch !== capability.epoch) return;
        if (url && url !== normalizedSrc) return;
        setHasLoadError(true);
        onError?.();
      });
      return;
    }
    setHasLoadError(true);
    onError?.();
  };

  const shouldRenderMedia =
    normalizedSrc.length > 0 &&
    !hasLoadError &&
    !isKnownUnavailableSource;

  if (!shouldRenderMedia) {
    return (
      <div className={frameClassName}>
        <div
          className={cn(
            'flex w-full items-center justify-center text-sm',
            isCover ? 'h-full bg-gray-200/70 dark:bg-white/10' : 'min-h-[6rem] bg-gray-100 dark:bg-white/5',
            !isCover && maxHeightClassName,
            !isCover && maxWidthClassName,
          )}
          role="img"
          aria-label={alt && alt.trim().length > 0 ? alt : 'Media unavailable'}
        >
          <span className="px-4 text-center text-theme-secondary">
            {isPreviewUnavailableDataUrl(normalizedSrc)
              ? 'Preview unavailable on this device'
              : '🖼️'}
          </span>
        </div>
      </div>
    );
  }

  if (kind === 'video') {
    return (
      <div className={frameClassName}>
        <video
          ref={setVideoRef}
          src={normalizedSrc}
          controls={controls}
          autoPlay={autoPlay}
          playsInline={playsInline}
          muted={muted}
          loop={loop}
          preload={preload}
          poster={posterCapability.url ?? undefined}
          className={elementClassName}
          onLoadedData={onLoadedData}
          onTimeUpdate={rememberPlayback}
          onPause={rememberPlayback}
          onPlay={rememberPlayback}
          onLoadedMetadata={() => {
            const saved = playback.current;
            const element = localVideoRef.current;
            if (saved?.identity === mediaIdentity && element && saved.time > 0) {
              element.currentTime = Number.isFinite(element.duration) ? Math.min(saved.time, element.duration) : saved.time;
              if (saved.playing) void element.play().catch(() => undefined);
            }
          }}
          onError={handleError}
        />
      </div>
    );
  }

  return (
    <div className={frameClassName}>
      <img
        ref={imgRef}
        draggable={draggable}
        style={mediaStyle}
        src={normalizedSrc}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt ?? ''}
        className={elementClassName}
        loading={loading}
        // Decode off the main thread so a large image swapping in never blocks
        // paint/scroll (a key cause of the "cards render one at a time" feel and
        // the frozen-swipe stutter when flipping through gallery images).
        decoding="async"
        fetchPriority={fetchPriority}
        onLoad={onLoad}
        onError={handleError}
      />
    </div>
  );
};

export default MediaRenderer;
