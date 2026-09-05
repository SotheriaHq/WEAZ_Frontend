import React from 'react';

import {
  WIEZ_ORB_PATHS,
  WIEZ_ORB_TONES,
  WIEZ_ORB_VIEW_BOX,
  WIEZ_PATH_SCALE,
} from '@/brand/wiezOrbArtwork';

/**
 * The WIEZ orb — the sphere from the logo.
 *
 * This is the app's whole small-scale brand vocabulary: the chrome mark and the
 * loader are the same artwork, inlined once. It replaced a `<img>` onto
 * `wiez-logo-mark.png`, which was a black serif "W" that had to be
 * `invert(1)`-ed on the dark theme while `wiez-logo-mark.svg` — a completely
 * different gold figure — went to the favicon, the og card and every email.
 *
 * Inlined rather than fetched for three reasons: it is on screen during first
 * paint and must not flash, it appears inside spinners where a late-arriving
 * image would jump, and its colours come from the live theme. 42 KB, ~13 KB
 * over the wire.
 *
 * Colours resolve from CSS custom properties so a single copy serves both
 * themes. `index.css` defines `--wiez-t0`…`--wiez-t7`; the literals here are
 * only the fallback for a context that has not set them.
 */

/**
 * Static — the geometry never changes, so this subtree is built once for the
 * module rather than on every render of every spinner on the page.
 */
const ORB_PATHS = WIEZ_ORB_PATHS.map((d, index) => (
  <path key={d.length + ':' + index} d={d} fill={`var(--wiez-t${WIEZ_ORB_TONES[index]})`} />
));

const ORB_BODY = (
  <g transform={`scale(${WIEZ_PATH_SCALE})`}>{ORB_PATHS}</g>
);

type WiezOrbProps = {
  /** Rendered edge length in px. Legible down to 16. */
  size?: number;
  className?: string;
  /** Give the orb a name when it is the only thing identifying the brand. */
  title?: string;
};

const WiezOrb: React.FC<WiezOrbProps> = ({ size = 32, className = '', title }) => (
  <svg
    viewBox={WIEZ_ORB_VIEW_BOX}
    width={size}
    height={size}
    className={`block shrink-0 ${className}`.trim()}
    role={title ? 'img' : 'presentation'}
    aria-label={title}
    aria-hidden={title ? undefined : true}
    focusable="false"
  >
    {ORB_BODY}
  </svg>
);

export default WiezOrb;
