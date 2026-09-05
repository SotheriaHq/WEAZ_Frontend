import React from 'react';

import { PRODUCT_NAME } from '@/brand/identity';
import WiezOrb from '@/brand/WiezOrb';

/**
 * The brand lockup: the orb beside the name.
 *
 * The orb, not the full mark. Every caller renders this between 22px and 36px —
 * navbar, sidebar, auth headers, the Runway pill — and the muse's face stops
 * reading below roughly 96px. Screens with room for the figure use `WiezMark`
 * directly.
 */

type BrandWordmarkProps = {
  className?: string;
  logoSize?: number;
  logoClassName?: string;
  textClassName?: string;
  /** Drop the name when the lockup sits next to other text that already says it. */
  showName?: boolean;
};

const BrandWordmark: React.FC<BrandWordmarkProps> = ({
  className = '',
  logoSize = 28,
  logoClassName = '',
  textClassName = '',
  showName = true,
}) => (
  <span className={`inline-flex items-center gap-2 ${className}`.trim()}>
    <WiezOrb
      size={logoSize}
      className={logoClassName}
      // Without the name beside it the orb is the only thing identifying the
      // brand, so it has to carry the label itself.
      title={showName ? undefined : PRODUCT_NAME}
    />
    {showName ? <span className={textClassName}>{PRODUCT_NAME}</span> : null}
  </span>
);

export default BrandWordmark;
