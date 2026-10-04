import React from 'react';

import { BRAND_ASPECT } from '@/brand/assetSizes';
import { BRAND_ASSETS, LOGO_ACCESSIBILITY_LABEL } from '@/brand/identity';
import { useTheme } from '@/context/ThemeContext';

/**
 * The full WIEZ mark — the W, the muse and the orb.
 *
 * Referenced as a file rather than inlined. It used to have an inline sibling,
 * `WiezOrb`, holding 2,853 traced paths of a logo the brand has since
 * replaced — and it stayed in the repo with no callers, because nothing tied
 * the artwork committed here to the artwork on screen. One cached request
 * instead, and one generated file (`assetSizes.ts`) that says how big it is.
 *
 * Theme-paired rather than tinted. The mark is full-colour artwork now, and no
 * CSS filter turns a light-ground violet ramp into a dark-ground one — the
 * previous `invert(1)` worked only because the old asset was flat black.
 */

type WiezMarkProps = {
  /** Rendered height in px. */
  height?: number;
  className?: string;
  /** Omit to render decoratively when adjacent text already names the brand. */
  title?: string;
};

/**
 * Taken from the generated file, which is SQUARE.
 *
 * The mark is written onto a square canvas so one file serves a favicon, an
 * app icon and this; the artwork sits centred inside it. The literal here said
 * `461 / 430` — the old SVG's viewBox — so the element came out 7% wider than
 * the file and stretched it. The artwork keeps its own proportions; what
 * changes is that the box around it is now the box the file actually has.
 */
const MARK_ASPECT_RATIO = BRAND_ASPECT.mark;

const WiezMark: React.FC<WiezMarkProps> = ({ height = 132, className = '', title }) => {
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
      // On screen during first paint on the auth routes, so never lazy.
      loading="eager"
      decoding="async"
    />
  );
};

export const WIEZ_MARK_ALT = LOGO_ACCESSIBILITY_LABEL;

export default WiezMark;
