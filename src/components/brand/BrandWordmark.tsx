import React from 'react';

import ThreadlyLogo from '@/components/ThreadlyLogo';
import { COMPANY_NAME } from '@/lib/brand';

type BrandWordmarkProps = {
  className?: string;
  logoSize?: number;
  logoClassName?: string;
  textClassName?: string;
  showName?: boolean;
};

const BrandWordmark: React.FC<BrandWordmarkProps> = ({
  className = '',
  logoSize = 32,
  logoClassName = '',
  textClassName = '',
  showName = true,
}) => {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`.trim()}>
      <ThreadlyLogo size={logoSize} className={logoClassName} decorative={!showName} />
      {showName ? <span className={textClassName}>{COMPANY_NAME}</span> : null}
    </span>
  );
};

export default BrandWordmark;
