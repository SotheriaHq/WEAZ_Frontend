import React from 'react';

import MediaRenderer from '@/components/media/MediaRenderer';
import { COMPANY_LOGO_PATH, COMPANY_NAME } from '@/lib/brand';

// New WIEZ monogram mark (tight-cropped): width/height of the deep-dark art.
// `size` is the rendered height; width follows this ratio.
const WIEZ_MARK_ASPECT_RATIO = 783 / 504;

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
        // The mark art is deep-dark on transparent: it reads correctly on the
        // light (day) theme as-is, and inverts to light on the dark (night)
        // theme so it never disappears against dark surfaces.
        mediaClassName="h-full w-full dark:invert"
        maxHeightClassName="max-h-full"
        maxWidthClassName="max-w-full"
        loading="eager"
      />
    </span>
  );
};

export default WiezLogo;
