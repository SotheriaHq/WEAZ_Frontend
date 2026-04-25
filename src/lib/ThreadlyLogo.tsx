import React from 'react';

import { COMPANY_LOGO_PATH, COMPANY_NAME } from '@/lib/brand';

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
    <img
      src={COMPANY_LOGO_PATH}
      alt={decorative ? '' : `${COMPANY_NAME} logo`}
      aria-hidden={decorative ? true : undefined}
      width={size}
      height={size}
      className={`block shrink-0 ${className}`.trim()}
      loading="eager"
      decoding="async"
    />
  );
};

export default ThreadlyLogo;
