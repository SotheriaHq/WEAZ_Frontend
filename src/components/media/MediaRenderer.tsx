import React from 'react';
import { cn } from '../../lib/utils';

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

  /** Optional direct access to the underlying element (for playback control, etc.) */
  imgRef?: React.Ref<HTMLImageElement>;
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
  imgRef,
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

  const normalizedSrc = React.useMemo(
    () => (typeof src === 'string' ? src.trim() : ''),
    [src],
  );
  const [hasLoadError, setHasLoadError] = React.useState(false);

  React.useEffect(() => {
    setHasLoadError(false);
  }, [kind, normalizedSrc]);

  const shouldRenderMedia = normalizedSrc.length > 0 && !hasLoadError;

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
          🖼️
        </div>
      </div>
    );
  }

  if (kind === 'video') {
    return (
      <div className={frameClassName}>
        <video
          ref={videoRef}
          src={normalizedSrc}
          controls={controls}
          autoPlay={autoPlay}
          playsInline={playsInline}
          muted={muted}
          loop={loop}
          preload={preload}
          poster={poster}
          className={elementClassName}
          onLoadedData={onLoadedData}
          onError={() => {
            setHasLoadError(true);
            onError?.();
          }}
        />
      </div>
    );
  }

  return (
    <div className={frameClassName}>
      <img
        ref={imgRef}
        src={normalizedSrc}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt ?? ''}
        className={elementClassName}
        loading={loading}
        onLoad={onLoad}
        onError={() => {
          setHasLoadError(true);
          onError?.();
        }}
      />
    </div>
  );
};

export default MediaRenderer;
