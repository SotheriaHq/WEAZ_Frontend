import React from 'react';

import { BRAND_ASPECT } from '@/brand/assetSizes';
import { BRAND_ASSETS, PRODUCT_NAME } from '@/brand/identity';
import { useTheme } from '@/context/ThemeContext';

/**
 * The WIEZ wordmark — the drawn name, with the muse standing in for the "I".
 *
 * This is why nothing pairs a mark with the letters: **the logo is inside the
 * name.** Putting `WiezMark` beside this would show the muse twice. Anywhere
 * the product's name appears, this is the whole lockup; anywhere only the
 * symbol is wanted, `WiezMark` goes alone.
 *
 * It replaced `PRODUCT_NAME` rendered as bold text next to a small mark, which
 * meant the brand's actual lettering appeared nowhere in the product.
 *
 * A file rather than inline paths: at 644 KB of geometry it would dominate the
 * bundle, and it is the same asset on every screen, so one cached request
 * serves all of them. Theme-paired rather than tinted — full-colour artwork has
 * no filter that turns a light-ground ramp into a dark-ground one.
 */

type WiezWordmarkProps = {
  /** Rendered height in px. Legible down to about 18. */
  height?: number;
  className?: string;
  /**
   * Set false only when visible text immediately beside this already says
   * "WIEZ" — otherwise the name must reach a screen reader from here.
   */
  labelled?: boolean;
};

/**
 * Measured from the file, not remembered.
 *
 * This was `792 / 531` — the viewBox of the SVG the wordmark used to be — while
 * the PNG it actually renders is 720 x 461. With a width and a height both set,
 * the browser does not letterbox the difference, it STRETCHES to the box: the
 * name came out 4.5% narrow, which a reader sees as the letters losing their
 * spacing rather than as a scaling bug.
 */
const WORDMARK_ASPECT_RATIO = BRAND_ASPECT.wordmark;

const WiezWordmark: React.FC<WiezWordmarkProps> = ({
  height = 28,
  className = '',
  labelled = true,
}) => {
  const { resolvedTheme } = useTheme();
  const src =
    resolvedTheme === 'dark' ? BRAND_ASSETS.wordmarkDark : BRAND_ASSETS.wordmarkLight;

  return (
    <img
      src={src}
      width={Math.round(height * WORDMARK_ASPECT_RATIO)}
      height={height}
      alt={labelled ? PRODUCT_NAME : ''}
      aria-hidden={labelled ? undefined : true}
      className={`block shrink-0 ${className}`.trim()}
      // In the navbar on first paint, so never lazy.
      loading="eager"
      decoding="async"
    />
  );
};

export default WiezWordmark;
