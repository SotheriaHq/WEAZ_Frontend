/**
 * Addresses as analytics and error reports may see them.
 *
 * Live WIEZ URLs carry secrets: password-reset, email-verification and invite
 * tokens and email addresses in the query, payment references on the return
 * pages, and a resume token in `/custom-orders/resume/:token`. None of that may
 * leave the browser in telemetry. Query strings and fragments are dropped
 * entirely, and path segments that look like ids or opaque tokens become
 * placeholders, so a page is identified without identifying a person or order.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Opaque tokens: long unbroken runs, or very long runs that may contain dashes.
const OPAQUE = /^(?:[A-Za-z0-9_]{24,}|[A-Za-z0-9_-]{40,})$/;
const NUMERIC = /^\d{6,}$/;

export const telemetryPath = (pathname: string): string =>
  pathname
    .split('/')
    .map((segment) => {
      if (!segment) return segment;
      let decoded = segment;
      try {
        decoded = decodeURIComponent(segment);
      } catch {
        return ':token';
      }
      if (UUID.test(decoded)) return ':id';
      if (NUMERIC.test(decoded)) return ':id';
      if (OPAQUE.test(decoded) || decoded.includes('@')) return ':token';
      return segment;
    })
    .join('/');

/** Origin and cleaned path only; empty when the input is not a URL. */
export const telemetryUrl = (href: string | undefined | null): string => {
  if (!href) return '';
  try {
    const url = new URL(href, typeof window === 'undefined' ? 'https://invalid.local' : window.location.origin);
    return `${url.origin}${telemetryPath(url.pathname)}`;
  } catch {
    return '';
  }
};
