declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackPageView(path: string): void {
  const measurementId = String(import.meta.env.VITE_GA_MEASUREMENT_ID ?? '').trim();
  if (!measurementId || typeof window.gtag !== 'function') {
    return;
  }

  window.gtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}