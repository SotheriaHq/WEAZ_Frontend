import React from 'react';
import type { MarketMedia } from '@/types/market';
import MediaRenderer from './MediaRenderer';

type Props = {
  media: MarketMedia;
  className?: string;
  rounded?: boolean;
  controls?: boolean;
  /** Deprecated: object-fit boxing/cropping violates the global media invariant. */
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
};

const MediaViewer: React.FC<Props> = ({ media, className, rounded = true, controls = true }) => {
  const isVideo = Boolean(media.type?.toUpperCase().includes('VIDEO'));
  const radius = rounded ? 'rounded-xl' : '';

  if (isVideo) {
    return (
      <MediaRenderer
        kind="video"
        src={media.url ?? ''}
        controls={controls}
        poster={media.previewUrl ?? undefined}
        className={`${radius} ${className ?? ''}`}
      />
    );
  }

  return (
    <MediaRenderer
      kind="image"
      src={media.url ?? ''}
      alt="Content"
      className={`${radius} ${className ?? ''}`}
    />
  );
};

export default MediaViewer;
