import React from 'react';

import MediaRenderer from '@/components/media/MediaRenderer';
import { COMPANY_LOGO_PATH, COMPANY_NAME } from '@/lib/brand';

const WIEZ_MARK_ASPECT_RATIO = 152 / 280;

type WiezLogoProps = {
  size?: number;
  className?: string;
  decorative?: boolean;
};

const WiezLogo: React.FC<WiezLogoProps> = ({
  size = 32,
  className = '',
  decorative = true,
}) => {
  const width = Math.round(size * WIEZ_MARK_ASPECT_RATIO);

  return (
    <span
      className={`block shrink-0 ${className}`.trim()}
      style={{
        width: `${width}px`,
        height: `${size}px`,
      }}
    >
      <MediaRenderer
        kind="image"
        src={COMPANY_LOGO_PATH}
        alt={decorative ? '' : `${COMPANY_NAME} logo`}
        className="h-full w-full"
        mediaClassName="h-full w-full"
        maxHeightClassName="max-h-full"
        maxWidthClassName="max-w-full"
        loading="eager"
      />
    </span>
  );
};

export default WiezLogo;
