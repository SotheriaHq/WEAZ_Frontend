import React from 'react';
import { cn } from '../../lib/utils';

export type MediaKind = 'image' | 'video';

export interface MediaRendererProps {
  kind: MediaKind;
  src: string;

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

  /** Optional direct access to the underlying element (for playback control, etc.) */
  imgRef?: React.Ref<HTMLImageElement>;
  videoRef?: React.Ref<HTMLVideoElement>;
}

/**
 * MediaRenderer (global invariant)
 *
 * - Media defines layout (intrinsic aspect ratio; no object-fit boxing).
 * - Container may only cap dimensions (max-*) and allow vertical scrolling.
 * - No backgrounds/padding/letterboxing/cropping should be applied around the media.
 */
export const MediaRenderer: React.FC<MediaRendererProps> = ({
  kind,
  src,
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
  imgRef,
  videoRef,
}) => {
  const frameClassName = cn(
    'media-frame media-frame-cap',
    allowScroll ? 'media-frame-scroll' : undefined,
    maxHeightClassName,
    maxWidthClassName,
    className
  );
  const elementClassName = cn('media-intrinsic', mediaClassName);

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
