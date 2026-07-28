/**
 * One-time spotlight-tour bookkeeping.
 *
 * A tour is a first-run experience: it must appear at most once, and "Skip
 * tour" must be permanent. Two things previously broke that promise:
 *
 *  1. The seen-flag was only written from the tour's close handler. The tour
 *     overlay is non-blocking (the page stays interactive underneath), so a
 *     user could simply start filling the form and navigate away — nothing was
 *     persisted and the tour replayed on the next visit.
 *  2. `localStorage.setItem` throws in Safari private mode and in locked-down
 *     mobile browsers. The throw happened inside the Skip click handler, so the
 *     overlay closed but the flag was never stored.
 *
 * Every access here is guarded, and the flag is written the moment a tour is
 * shown (see `useOneTimeTour`), not only when it is dismissed.
 *
 * Scope: keys are per user id, with the legacy device-wide key kept as a read
 * fallback so anyone who already dismissed a tour never sees it again.
 */

export type TourKey = 'wiez_tour_design_create' | 'wiez_tour_product_create';

const userScopedKey = (tourKey: TourKey, userId?: string | null): string | null => {
  const normalized = String(userId ?? '').trim();
  return normalized ? `${tourKey}:${normalized}` : null;
};

const readFlag = (key: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(window.localStorage.getItem(key));
  } catch {
    // Storage blocked — treat as "not seen" and let the write below no-op.
    return false;
  }
};

const writeFlag = (key: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // Best-effort: a storage failure must never break the tour UI.
  }
};

export const hasSeenTour = (
  tourKey: TourKey,
  userId?: string | null,
): boolean => {
  const scoped = userScopedKey(tourKey, userId);
  if (scoped && readFlag(scoped)) return true;
  // Legacy device-wide flag written before tours were user-scoped.
  return readFlag(tourKey);
};

export const markTourSeen = (
  tourKey: TourKey,
  userId?: string | null,
): void => {
  const scoped = userScopedKey(tourKey, userId);
  if (scoped) {
    writeFlag(scoped);
    return;
  }
  // No resolved user yet — fall back to the device-wide flag so the tour still
  // stops repeating instead of replaying on every mount.
  writeFlag(tourKey);
};
