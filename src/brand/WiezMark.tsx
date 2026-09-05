import React from 'react';

import { BRAND_ASSETS, LOGO_ACCESSIBILITY_LABEL } from '@/brand/identity';
import { useTheme } from '@/context/ThemeContext';

/**
 * The full WIEZ mark — the W, the muse and the orb.
 *
 * Deliberately NOT the small-scale mark. The figure's face turns to mush below
 * roughly 96px, so anything in page chrome uses `WiezOrb` instead; this is for
 * splash, auth heroes and empty states where the artwork has room.
 *
 * Referenced as a file rather than inlined: at 290 KB it would be two thirds of
 * a vendor chunk to serve a logo that appears on a handful of screens. One
 * cached request instead.
 *
 * Theme-paired rather than tinted. The mark is full-colour artwork now, and no
 * CSS filter turns a light-ground violet ramp into a dark-ground one — the
 * previous `invert(1)` worked only because the old asset was flat black.
 */

type WiezMarkProps = {
  /** Rendered height in px. Below ~96 the figure stops reading; use `WiezOrb`. */
  height?: number;
  className?: string;
  /** Omit to render decoratively when adjacent text already names the brand. */
  title?: string;
};

/** Measured from the artwork's own viewBox (212 x 430). */
const MARK_ASPECT_RATIO = 212 / 430;

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
