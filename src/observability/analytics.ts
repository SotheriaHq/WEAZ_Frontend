import { analyticsPermitted } from '@/privacy/consent';

export function trackPageView(path: string): void {
  const measurementId = String(import.meta.env.VITE_GA_MEASUREMENT_ID ?? '').trim();
  // gtag exists only after the visitor allowed analytics; check both anyway.
  if (!measurementId || !analyticsPermitted() || typeof window.gtag !== 'function') {
    return;
  }

  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}