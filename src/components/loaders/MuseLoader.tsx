import React from 'react';

import { BRAND_ASSETS } from '@/brand/identity';
import { useTheme } from '@/context/ThemeContext';

/**
 * The app's loading vocabulary. Every wait on the web renders one of these two.
 *
 * **An empty vessel in the shape of the mark, filling with the brand colour.**
 * Like a phone charging while it is switched off: you see the outline of the
 * thing, and a level rising inside it.
 *
 * ## What this replaced, and why
 *
 * It used to be two copies of the full-colour ARTWORK — a dim one behind and a
 * lit one revealed bottom-up. That does not read as filling. It reads as a
 * picture downloading over a slow connection: the grey version is what a
 * half-loaded image looks like, and uncovering it strip by strip is exactly
 * the progressive-JPEG effect. The brand appeared to be broken rather than
 * busy.
 *
 * The fix is that the mark becomes a MASK rather than a picture. Nothing here
 * paints the artwork's own violet-and-gold; the shape is cut out of a flat
 * fill of `--wiez-ring`, the app's system colour. So the empty state is a
 * recognisable silhouette holding nothing, and the full state is the same
 * silhouette holding solid colour, with the level in between meaning what it
 * looks like it means.
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

/** From the mark's own artwork (538 x 498). */
const MARK_ASPECT_RATIO = 538 / 498;

/**
 * A 192px raster, not a vector.
 *
 * These appear a dozen at a time on a form, at 12-16px. It is used as a MASK,
 * so only its alpha matters — the two theme files are identical silhouettes
 * and either would do, but the pair is kept so the mask follows the same
 * naming as every other brand asset.
 */
function useMaskSource() {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === 'dark'
    ? BRAND_ASSETS.loaderMarkDark
    : BRAND_ASSETS.loaderMarkLight;
}

/**
 * The mark, cut out of whatever is painted behind it.
 *
 * `contain` + `center` so the silhouette keeps its proportions at every size,
 * and both the prefixed and unprefixed properties because Safari still wants
 * `-webkit-`.
 */
const maskStyle = (src: string): React.CSSProperties => ({
  WebkitMaskImage: `url(${src})`,
  maskImage: `url(${src})`,
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskPosition: 'center',
  maskPosition: 'center',
  WebkitMaskSize: 'contain',
  maskSize: 'contain',
});

const LAYER_CLASS = 'pointer-events-none absolute inset-0 h-full w-full';

/**
 * Empty and full are the SAME colour at two strengths, not two colours.
 *
 * That is what makes a part-filled state legible: at 30% the eye compares one
 * ink against itself across a hard horizontal edge, so "some of it is filled
 * and some of it is not" is obvious without reading a number. A faint track in
 * a different hue reads as a shadow behind a logo instead of as an empty
 * vessel, which is what the first pass at this looked like.
 */
const EMPTY_OPACITY = 0.2;

type MuseLoaderProps = {
  /** Rendered height in px. Width follows the mark's aspect. */
  size?: number;
  className?: string;
  /** Announced to screen readers. Defaults to a plain "Loading". */
  label?: string;
};

/**
 * Indeterminate. The level rises through the mark and clears, on a loop — no
 * easing at the seam, so there is no stutter where it repeats.
 */
export const MuseLoader: React.FC<MuseLoaderProps> = ({
  size = 32,
  className = '',
  label = 'Loading',
}) => {
  const src = useMaskSource();
  const mask = maskStyle(src);

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`relative inline-block shrink-0 align-middle ${className}`.trim()}
      style={{ width: Math.round(size * MARK_ASPECT_RATIO), height: size }}
    >
      {/* The empty vessel: the whole silhouette, holding nothing. */}
      <span
        aria-hidden="true"
        className={LAYER_CLASS}
        style={{ ...mask, background: 'var(--wiez-ring)', opacity: EMPTY_OPACITY }}
      />
      {/* The level. Solid system colour, clipped to a height. */}
      <span
        aria-hidden="true"
        className={`${LAYER_CLASS} motion-safe:animate-wiez-rise motion-reduce:animate-wiez-breathe`}
        style={{ ...mask, background: 'var(--wiez-ring)' }}
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
  const src = useMaskSource();
  const mask = maskStyle(src);
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
        <span
          aria-hidden="true"
          className={LAYER_CLASS}
          style={{ ...mask, background: 'var(--wiez-ring)', opacity: EMPTY_OPACITY }}
        />
        <span
          aria-hidden="true"
          className={`${LAYER_CLASS} transition-[clip-path] duration-300 ease-out`}
          style={{
            ...mask,
            background: 'var(--wiez-ring)',
            // Filled from the bottom, so the level rises as the number climbs.
            clipPath: `inset(${100 - clamped}% 0 0 0)`,
          }}
        />
      </span>
      <span className="mt-2 text-sm font-semibold tabular-nums text-[color:var(--wiez-ring)]">
        {Math.round(clamped)}%
      </span>
    </span>
  );
};

export default MuseLoader;
