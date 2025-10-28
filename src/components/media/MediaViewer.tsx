import React from 'react';
import type { MarketMedia } from '@/types/market';

type Props = {
  media: MarketMedia;
  className?: string;
  rounded?: boolean;
  controls?: boolean;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
};

const MediaViewer: React.FC<Props> = ({ media, className, rounded = true, controls = true, objectFit = 'contain' }) => {
  const isVideo = Boolean(media.type?.toUpperCase().includes('VIDEO'));
  const radius = rounded ? 'rounded-xl' : '';
  const fitClass = `object-${objectFit}`;

  if (isVideo) {
    return (
      <video
        className={`block w-full h-full ${fitClass} bg-black ${radius} ${className ?? ''}`}
        controls={controls}
        preload="metadata"
        poster={media.previewUrl ?? undefined}
      >
        <source src={media.url ?? undefined} />
      </video>
    );
  }

  return (
    <img
      src={media.url ?? undefined}
      alt="Content"
      className={`block w-full h-full ${fitClass} bg-black ${radius} ${className ?? ''}`}
      loading="lazy"
      onError={(e) => {
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';
      }}
    />
  );
};

export default MediaViewer;
