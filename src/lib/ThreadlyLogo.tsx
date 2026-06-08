import React from 'react';

import { COMPANY_LOGO_PATH, COMPANY_NAME } from '@/lib/brand';
import MediaRenderer from '@/components/media/MediaRenderer';

const WEAZ_MARK_ASPECT_RATIO = 64 / 96;

type ThreadlyLogoProps = {
  size?: number;
  className?: string;
  decorative?: boolean;
};

const ThreadlyLogo: React.FC<ThreadlyLogoProps> = ({
  size = 32,
  className = '',
  decorative = true,
}) => {
  return (
    <MediaRenderer
      kind="image"
      src={COMPANY_LOGO_PATH}
      alt={decorative ? '' : `${COMPANY_NAME} logo`}
      className={`block shrink-0 ${className}`.trim()}
      mediaClassName="h-auto w-full"
      maxHeightClassName=""
      maxWidthClassName=""
      loading="eager"
      imgRef={(node) => {
        if (node) {
          node.width = Math.round(size * WEAZ_MARK_ASPECT_RATIO);
          node.height = size;
        }
      }}
    />
  );
};

export default ThreadlyLogo;
