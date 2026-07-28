import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Resolve where a "back" affordance should send the user.
 *
 * Detail routes are reachable from more than one place (a finance table, an
 * admin console modal, a notification deep link). Hard-coding one destination
 * strands everyone who arrived from somewhere else, so callers pass the origin
 * as `state: { returnTo, returnLabel }` and the destination honours it, falling
 * back to its own default when there is no origin.
 */
export interface ReturnTarget {
  to: string;
  label: string;
}

const readString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null;

export function useReturnTo(
  fallbackTo: string,
  fallbackLabel: string,
): ReturnTarget {
  const location = useLocation();

  return useMemo(() => {
    const state = (location.state ?? null) as Record<string, unknown> | null;
    const to = readString(state?.returnTo);
    // Only same-origin app paths — never let route state redirect off-site.
    const safeTo = to && to.startsWith('/') && !to.startsWith('//') ? to : null;
    return {
      to: safeTo ?? fallbackTo,
      label: (safeTo ? readString(state?.returnLabel) : null) ?? fallbackLabel,
    };
  }, [fallbackLabel, fallbackTo, location.state]);
}

export default useReturnTo;
