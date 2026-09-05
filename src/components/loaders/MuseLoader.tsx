import React from 'react';

import { BRAND_ASSETS } from '@/brand/identity';
import { useTheme } from '@/context/ThemeContext';

/**
 * The app's loading vocabulary. Every wait on the web renders one of these two.
 *
 * **The logo is the loader.** A dim copy of the mark is the track, and a lit
 * copy is revealed from the bottom up — so the thing that fills IS the brand,
 * not a ring around a fragment of it.
 *
 * Two shapes it is deliberately NOT:
 * - a ring orbiting the orb. That drew a spinner around one PIECE of the logo,
 *   which reads as a loading widget that happens to have a ball in it.
 * - a thread emoji in a purple ring, which is what `VLoader` drew at all 63
 *   call sites — the brand mark appeared in no loading state in the product.
 *
 * ## Why two components instead of one with flags
 *
 * `VLoader` took `phase` and `showLabel`, and 60-odd of its call sites passed
 * `showLabel={false}`. The dozen that did not rendered "Winding thread — 47%
 * complete" over an **invented** number: with no `progress` prop the old
 * component ran a timer that crawled toward 92% and stopped. Deleting that is a
 * correctness fix, not a visual one.
 *
 * So: `MuseLoader` is indeterminate and never claims a number.
 * `MuseProgress` requires a real one.
 */

/** From the mark's own viewBox (461 x 430). */
const MARK_ASPECT_RATIO = 461 / 430;

/**
 * A 192px raster, not the 381 KB vector.
 *
 * These appear a dozen at a time on a form, at 12-16px. The vector would be a
 * fresh fetch on any screen that has buttons but no logo, and rasterising 2853
 * paths per size buys nothing at that scale.
 */
function useMarkSource() {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === 'dark'
    ? BRAND_ASSETS.loaderMarkDark
    : BRAND_ASSETS.loaderMarkLight;
}

const LAYER_CLASS = 'absolute inset-0 h-full w-full object-contain';

type MuseLoaderProps = {
  /** Rendered height in px. Width follows the mark's aspect. */
  size?: number;
  className?: string;
  /** Announced to screen readers. Defaults to a plain "Loading". */
  label?: string;
};

/**
 * Indeterminate. Light rises through the mark and clears, on a loop — no
 * easing at the seam, so there is no stutter where it repeats.
 */
export const MuseLoader: React.FC<MuseLoaderProps> = ({
  size = 32,
  className = '',
  label = 'Loading',
}) => {
  const src = useMarkSource();

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`relative inline-block shrink-0 align-middle ${className}`.trim()}
      style={{ width: Math.round(size * MARK_ASPECT_RATIO), height: size }}
    >
      <img src={src} alt="" aria-hidden="true" className={`${LAYER_CLASS} opacity-20`} />
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className={`${LAYER_CLASS} motion-safe:animate-wiez-rise motion-reduce:animate-wiez-breathe`}
      />
    </span>
  );
};

type MuseProgressProps = {
  /** 0-100, and it must be a real measurement. */
  progress: number;
  size?: number;
  className?: string;
  label?: string;
};

/**
 * Determinate. The mark fills to the value given, and the percentage is shown
 * because here it means something.
 */
export const MuseProgress: React.FC<MuseProgressProps> = ({
  progress,
  size = 64,
  className = '',
  label = 'Uploading',
}) => {
  const src = useMarkSource();
  const clamped = Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0;

  return (
    <span
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`inline-flex flex-col items-center justify-center ${className}`.trim()}
    >
      <span
        className="relative inline-block shrink-0"
        style={{ width: Math.round(size * MARK_ASPECT_RATIO), height: size }}
      >
        <img src={src} alt="" aria-hidden="true" className={`${LAYER_CLASS} opacity-20`} />
        <img
          src={src}
          alt=""
          aria-hidden="true"
          className={`${LAYER_CLASS} transition-[clip-path] duration-300 ease-out`}
          // Revealed from the bottom, so the fill rises as the number climbs.
          style={{ clipPath: `inset(${100 - clamped}% 0 0 0)` }}
        />
      </span>
      <span className="mt-2 text-sm font-semibold tabular-nums text-[color:var(--wiez-ring)]">
        {Math.round(clamped)}%
      </span>
    </span>
  );
};

export default MuseLoader;
