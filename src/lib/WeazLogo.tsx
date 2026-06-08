import React from 'react';

import { COMPANY_LOGO_PATH, COMPANY_NAME } from '@/lib/brand';

const WEAZ_MARK_ASPECT_RATIO = 152 / 280;

type WeazLogoProps = {
  size?: number;
  className?: string;
  decorative?: boolean;
};

const WeazLogo: React.FC<WeazLogoProps> = ({
  size = 32,
  className = '',
  decorative = true,
}) => {
  const width = Math.round(size * WEAZ_MARK_ASPECT_RATIO);

  return (
    <img
      src={COMPANY_LOGO_PATH}
      alt={decorative ? '' : `${COMPANY_NAME} logo`}
      className={`block shrink-0 ${className}`.trim()}
      style={{
        width: `${width}px`,
        height: `${size}px`,
      }}
      loading="eager"
    />
  );
};

export default WeazLogo;
