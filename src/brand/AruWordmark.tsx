import React from 'react';

import { BRAND_ASPECT } from '@/brand/assetSizes';
import { BRAND_ASSETS, PRODUCT_NAME } from '@/brand/identity';
import { useTheme } from '@/context/ThemeContext';

export type AruWordmarkProps = {
  /** Rendered height in px. Legible down to about 18. */
  height?: number;
  className?: string;
  /**
   * Set false only when visible text immediately beside this already says
   * the brand name — otherwise the name must reach a screen reader from here.
   */
  labelled?: boolean;
};

const WORDMARK_ASPECT_RATIO = BRAND_ASPECT.wordmark;

export const AruWordmark: React.FC<AruWordmarkProps> = ({
  height = 28,
  className = '',
  labelled = true,
}) => {
  const { resolvedTheme } = useTheme();
  const src =
    resolvedTheme === 'dark' ? BRAND_ASSETS.wordmarkDark : BRAND_ASSETS.wordmarkLight;
  const sources = resolvedTheme === 'dark'
    ? [BRAND_ASSETS.wordmarkDark160, BRAND_ASSETS.wordmarkDark320, BRAND_ASSETS.wordmarkDark]
    : [BRAND_ASSETS.wordmarkLight160, BRAND_ASSETS.wordmarkLight320, BRAND_ASSETS.wordmarkLight];

  return (
    <img
      src={src}
      srcSet={`${sources[0]} 160w, ${sources[1]} 320w, ${sources[2]} 720w`}
      sizes={`${Math.round(height * WORDMARK_ASPECT_RATIO)}px`}
      width={Math.round(height * WORDMARK_ASPECT_RATIO)}
      height={height}
      alt={labelled ? PRODUCT_NAME : ''}
      aria-hidden={labelled ? undefined : true}
      className={`block shrink-0 ${className}`.trim()}
      loading="eager"
      decoding="async"
    />
  );
};

export const WiezWordmark = AruWordmark;
export default AruWordmark;
