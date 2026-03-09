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

  if (kind === 'video') {
    return (
      <div className={frameClassName}>
        <video
          ref={videoRef}
          src={src}
          controls={controls}
          autoPlay={autoPlay}
          playsInline={playsInline}
          muted={muted}
          loop={loop}
          preload={preload}
          poster={poster}
          className={elementClassName}
          onLoadedData={onLoadedData}
          onError={onError}
        />
      </div>
    );
  }

  return (
    <div className={frameClassName}>
      <img
        ref={imgRef}
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt ?? ''}
        className={elementClassName}
        loading="lazy"
        onLoad={onLoad}
        onError={onError}
      />
    </div>
  );
};

export default MediaRenderer;
