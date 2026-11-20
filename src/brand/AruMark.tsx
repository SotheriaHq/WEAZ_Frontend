import React from 'react';

import { BRAND_ASPECT } from '@/brand/assetSizes';
import { BRAND_ASSETS, LOGO_ACCESSIBILITY_LABEL } from '@/brand/identity';
import { useTheme } from '@/context/ThemeContext';

export type AruMarkProps = {
  /** Rendered height in px. */
  height?: number;
  className?: string;
  /** Omit to render decoratively when adjacent text already names the brand. */
  title?: string;
};

const MARK_ASPECT_RATIO = BRAND_ASPECT.mark;

export const AruMark: React.FC<AruMarkProps> = ({ height = 132, className = '', title }) => {
  const { resolvedTheme } = useTheme();
  const src = resolvedTheme === 'dark' ? BRAND_ASSETS.markDark : BRAND_ASSETS.markLight;

  return (
    <img
      src={src}
      width={Math.round(height * MARK_ASPECT_RATIO)}
      height={height}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      className={`block shrink-0 ${className}`.trim()}
      loading="eager"
      decoding="async"
    />
  );
};

export const ARU_MARK_ALT = LOGO_ACCESSIBILITY_LABEL;
export const WiezMark = AruMark;
export const WIEZ_MARK_ALT = LOGO_ACCESSIBILITY_LABEL;

export default AruMark;
