import { analyticsPermitted } from '@/privacy/consent';
import { telemetryUrl } from '@/privacy/telemetryUrl';

/**
 * One GA4 page_view per route change (the config sets send_page_view: false).
 * Only the cleaned address leaves the browser: no query string, no tokens,
 * no ids — see privacy/telemetryUrl.
 */
let lastPageLocation = '';

export function trackPageView(path: string): void {
  const measurementId = String(import.meta.env.VITE_GA_MEASUREMENT_ID ?? '').trim();
  // gtag exists only after the visitor allowed analytics; check both anyway.
  if (!measurementId || !analyticsPermitted() || typeof window.gtag !== 'function') {
    return;
  }

  // On a returning visit the analytics loader and the router both report the
  // first page; it counts once. A query-only change cleans to the same address.
  const pageLocation = telemetryUrl(path);
  if (pageLocation === lastPageLocation) return;
  lastPageLocation = pageLocation;

  window.gtag('event', 'page_view', {
    page_location: pageLocation,
    page_title: document.title,
  });
}
