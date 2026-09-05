import React from 'react';

import WiezOrb from '@/brand/WiezOrb';

/**
 * The app's loading vocabulary. Every wait on the web renders one of these two.
 *
 * It replaced `VLoader`, which drew a purple ring around a **thread emoji**
 * (🧵, swapping to ✅ on completion) — the brand mark appeared in no loading
 * state anywhere in the product. The orb here is the same artwork as the chrome
 * logo, inlined once and shared.
 *
 * ## Why two components and not one with flags
 *
 * `VLoader` took `phase` and `showLabel`, and 60-odd of its 73 call sites
 * passed `showLabel={false}`. The dozen that did not were rendering "Winding
 * thread — 47% complete" over an **invented** number: with no `progress` prop
 * the old component ran a timer that crawled toward 92% and stopped. Deleting
 * that is a correctness fix, not a visual one.
 *
 * So: `MuseLoader` is indeterminate and never claims a number.
 * `MuseProgress` requires a real one.
 */

const SPIN_CLASS =
  'absolute inset-0 motion-safe:animate-wiez-spin motion-reduce:animate-wiez-breathe';

/**
 * Ring weight has to grow as the loader shrinks or it disappears; the arc has
 * to shorten too, or at 16px it reads as a closed circle rather than a spinner.
 */
function ringGeometry(size: number) {
  if (size <= 24) return { width: 11, dash: '148 142' };
  if (size <= 40) return { width: 9, dash: '158 132' };
  return { width: 7, dash: '168 122' };
}

type MuseLoaderProps = {
  /** Rendered edge length in px. Reads down to 16. */
  size?: number;
  className?: string;
  /** Announced to screen readers. Defaults to a plain "Loading". */
  label?: string;
};

/**
 * Indeterminate. The orb holds still and one arc turns around it at constant
 * speed — no easing curve, so there is no stutter at the loop seam, and the
 * only animated properties are transform and opacity.
 */
export const MuseLoader: React.FC<MuseLoaderProps> = ({
  size = 32,
  className = '',
  label = 'Loading',
}) => {
  const ring = ringGeometry(size);

  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`relative inline-block shrink-0 align-middle ${className}`.trim()}
      style={{ width: size, height: size }}
    >
      {/* The wrapper spins, not the <svg>: animating an SVG element forces
          layout work per frame that a transformed div does not. */}
      <span className={SPIN_CLASS}>
        <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" focusable="false">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="var(--wiez-ring)"
            strokeLinecap="round"
            strokeWidth={ring.width}
            strokeDasharray={ring.dash}
          />
        </svg>
      </span>
      <span className="absolute inset-[21%] motion-safe:animate-wiez-breathe">
        <WiezOrb size={Math.round(size * 0.58)} />
      </span>
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
 * Determinate. The ring fills to the value given, and the percentage is shown
 * because here it means something.
 */
export const MuseProgress: React.FC<MuseProgressProps> = ({
  progress,
  size = 64,
  className = '',
  label = 'Uploading',
}) => {
  const clamped = Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0;
  const ring = ringGeometry(size);
  // Circumference of r=45 in the 100-unit viewBox.
  const circumference = 2 * Math.PI * 45;
  const filled = (clamped / 100) * circumference;

  return (
    <span
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`inline-flex flex-col items-center justify-center ${className}`.trim()}
    >
      <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
        <svg
          viewBox="0 0 100 100"
          width={size}
          height={size}
          className="absolute inset-0 -rotate-90"
          aria-hidden="true"
          focusable="false"
        >
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="var(--wiez-ring-track)"
            strokeWidth={ring.width}
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="var(--wiez-ring)"
            strokeLinecap="round"
            strokeWidth={ring.width}
            strokeDasharray={`${filled} ${circumference}`}
            className="transition-[stroke-dasharray] duration-300 ease-out"
          />
        </svg>
        <span className="absolute inset-[21%]">
          <WiezOrb size={Math.round(size * 0.58)} />
        </span>
      </span>
      <span className="mt-2 text-sm font-semibold tabular-nums text-[color:var(--wiez-ring)]">
        {Math.round(clamped)}%
      </span>
    </span>
  );
};

export default MuseLoader;
