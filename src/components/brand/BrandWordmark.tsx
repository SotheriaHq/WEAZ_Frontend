import React from 'react';

import { PRODUCT_NAME } from '@/brand/identity';
import WiezMark from '@/brand/WiezMark';
import WiezWordmark from '@/brand/WiezWordmark';

/**
 * The brand lockup.
 *
 * Two shapes, and which one you get is the whole point:
 *
 * - **With the name** — the drawn wordmark, alone. The muse IS the "I", so the
 *   logo is already inside the name; setting a mark beside it draws the muse
 *   twice.
 * - **Without the name** — the mark alone, for chrome too tight for lettering.
 *
 * Before this it rendered a small logo image plus `PRODUCT_NAME` as bold text,
 * so the brand's own lettering appeared nowhere in the product while the muse
 * appeared twice wherever the two sat together.
 *
 * `textClassName` is gone with the text it styled; the wordmark is artwork, and
 * its weight and tracking are drawn rather than set.
 */

type BrandWordmarkProps = {
  className?: string;
  /** Rendered height in px, for whichever artwork is shown. */
  logoSize?: number;
  logoClassName?: string;
  /** False renders the mark alone; the caller must then name the brand itself. */
  showName?: boolean;
};

const BrandWordmark: React.FC<BrandWordmarkProps> = ({
  className = '',
  logoSize = 28,
  logoClassName = '',
  showName = true,
}) => (
  <span className={`inline-flex items-center ${className}`.trim()}>
    {showName ? (
      <WiezWordmark height={logoSize} className={logoClassName} />
    ) : (
      <WiezMark height={logoSize} className={logoClassName} title={PRODUCT_NAME} />
    )}
  </span>
);

export default BrandWordmark;
