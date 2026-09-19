import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import type { RootState } from '@/store';
import { hasSeenTour, markTourSeen, type TourKey } from '@/utils/tourPreferences';

interface UseOneTimeTourOptions {
  /** Only auto-start when true (e.g. create mode, not edit mode). */
  enabled: boolean;
  /** Delay before the spotlight appears so the page can finish laying out. */
  delayMs?: number;
}

/**
 * Drives a spotlight tour that must run at most once per user.
 *
 * The seen-flag is persisted as soon as the tour is SHOWN — not only when the
 * user closes it. The overlay leaves the page interactive, so a user who
 * ignores it and navigates away must still never see it again; writing on
 * close alone is what made the tour repeat on every visit.
 */
export function useOneTimeTour(
  tourKey: TourKey,
  { enabled, delayMs = 800 }: UseOneTimeTourOptions,
) {
  const userId = useSelector((state: RootState) => state.user.profile?.id);
  const [isActive, setIsActive] = useState(false);
  // Guards a second auto-start within the same mount (user id resolves late).
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled || startedRef.current) return;
    if (hasSeenTour(tourKey, userId)) {
      startedRef.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      startedRef.current = true;
      markTourSeen(tourKey, userId);
      setIsActive(true);
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [enabled, tourKey, userId, delayMs]);

  const close = useCallback(() => {
    setIsActive(false);
    // Re-assert on close: covers the case where the id resolved after start.
    markTourSeen(tourKey, userId);
  }, [tourKey, userId]);

  return { isActive, close };
}
