/**
 * RUNWAY FIT POLICY (web) — the single rule shared by mobile web and native.
 *
 * The native twin lives at
 * `threadly-mobile/src/features/feed/media/runwayMediaStrategy.ts` and MUST stay
 * numerically identical. They are separate git repos, so the duplicate is
 * deliberate; change both or the two surfaces drift apart again.
 *
 * That drift is exactly what this module replaces. Web used to decide with one
 * viewport-blind line — `aspect >= 1.05 ? contain : cover` — while native
 * measured the real crop percentage against the real viewport. The same 3:4
 * photo therefore rendered full-bleed (41% of the design cropped away) in a
 * phone browser and letterboxed in the app.
 *
 * The rule is stated in terms of IMAGE SHAPE, not crop percentage:
 *
 *   • Tall/vertical shots (9:16, 2:3)      → FILL the screen edge to edge.
 *   • Square-favouring (3:4, 4:5, 1:1)     → CONTAIN on the matte. Never
 *   • Landscape / wide                       stretched, never cropped — the
 *                                            whole design stays viewable.
 */

/** See the native twin for the full rationale. 0.72 sits between 2:3 (fills)
 *  and 3:4 (contained). This is the tuning knob; nothing else needs to move. */
export const RUNWAY_FILL_MAX_ASPECT = 0.72;

/** Any shape may fill when cover would crop essentially nothing (landscape
 *  media on a landscape viewport). */
export const RUNWAY_SAFE_COVER_CROP_TOLERANCE = 0.12;

/** Backstop for pathological geometry — a tall image on an even taller
 *  viewport. Never fires at normal phone aspect ratios. */
export const RUNWAY_MAX_FILL_CROP = 0.45;

const isPositiveFinite = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

export function getCoverCropFraction(imageAspect: number, viewportAspect: number): number {
  if (!isPositiveFinite(imageAspect) || !isPositiveFinite(viewportAspect)) return 1;
  return imageAspect >= viewportAspect
    ? 1 - viewportAspect / imageAspect
    : 1 - imageAspect / viewportAspect;
}

export function shouldRunwayMediaFill(aspect: number | null | undefined): boolean {
  return isPositiveFinite(aspect) && aspect < RUNWAY_FILL_MAX_ASPECT;
}

export type RunwayMediaFit = {
  fit: 'cover' | 'contain';
  objectClass: 'object-cover' | 'object-contain';
};

const FILL: RunwayMediaFit = { fit: 'cover', objectClass: 'object-cover' };
const PAD: RunwayMediaFit = { fit: 'contain', objectClass: 'object-contain' };

/**
 * @param aspect         image width / height
 * @param viewportAspect stage width / height, when known. Omitted before the
 *                       stage is measured — the shape decision alone is used so
 *                       first paint matches the settled state (no visible re-fit).
 */
export function resolveRunwayMediaFit(
  aspect: number | null | undefined,
  viewportAspect?: number | null,
): RunwayMediaFit {
  // Unknown dimensions: pad. Cropping something we cannot measure risks hiding
  // the design; padding only costs matte.
  if (!isPositiveFinite(aspect)) return PAD;

  const fillsByShape = shouldRunwayMediaFill(aspect);
  if (!isPositiveFinite(viewportAspect)) return fillsByShape ? FILL : PAD;

  const crop = getCoverCropFraction(aspect, viewportAspect);
  const fills =
    crop <= RUNWAY_SAFE_COVER_CROP_TOLERANCE || (fillsByShape && crop <= RUNWAY_MAX_FILL_CROP);
  return fills ? FILL : PAD;
}
