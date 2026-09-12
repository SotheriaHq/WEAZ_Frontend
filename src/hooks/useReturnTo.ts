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

/**
 * The same origin, but only when one was actually handed over.
 *
 * `useReturnTo` always answers with its fallback, which is right for a screen
 * that must always offer a way out (an admin detail page). A page reachable
 * from anywhere — a product, a brand catalogue — should show a return pointer
 * ONLY when something sent the reader there, otherwise every visitor gets a
 * "back" control pointing somewhere they have never been.
 */
export function useOptionalReturnTo(): ReturnTarget | null {
  const location = useLocation();

  return useMemo(() => {
    const state = (location.state ?? null) as Record<string, unknown> | null;
    const to = readString(state?.returnTo);
    // Same-origin app paths only — never let route state redirect off-site.
    if (!to || !to.startsWith('/') || to.startsWith('//')) return null;
    return { to, label: readString(state?.returnLabel) ?? 'Back' };
  }, [location.state]);
}

export default useReturnTo;
