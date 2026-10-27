import { analyticsPermitted } from '@/privacy/consent';
import { telemetryUrl } from '@/privacy/telemetryUrl';

/**
 * One GA4 page_view per route change (the config sets send_page_view: false).
 * Only the cleaned address leaves the browser: no query string, no tokens,
 * no ids — see privacy/telemetryUrl.
 */
export function trackPageView(path: string): void {
  const measurementId = String(import.meta.env.VITE_GA_MEASUREMENT_ID ?? '').trim();
  // gtag exists only after the visitor allowed analytics; check both anyway.
  if (!measurementId || !analyticsPermitted() || typeof window.gtag !== 'function') {
    return;
  }

  window.gtag('event', 'page_view', {
    page_location: telemetryUrl(path),
    page_title: document.title,
  });
}
