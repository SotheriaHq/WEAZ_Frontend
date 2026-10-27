import { trackPageView } from '@/observability/analytics';
import { enableSentryTracing } from '@/observability/sentry';
import { analyticsPermitted, subscribeConsent } from './consent';
import { telemetryUrl } from './telemetryUrl';

/**
 * The only place optional third-party code may start. Each loader runs once,
 * and only after the visitor allowed its purpose. Essential services the
 * visitor asks for directly (a Paystack payment, Google sign-in on click) load
 * where they are used, not here.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    [gaDisableFlag: `ga-disable-${string}`]: boolean | undefined;
  }
}

const GA_MEASUREMENT_ID = String(import.meta.env.VITE_GA_MEASUREMENT_ID ?? '').trim();
const CF_WEB_ANALYTICS_TOKEN = String(import.meta.env.VITE_CF_WEB_ANALYTICS_TOKEN ?? '').trim();

let analyticsLoadedThisPage = false;

const appendScript = (src: string, attributes: Record<string, string> = {}) => {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  for (const [name, value] of Object.entries(attributes)) {
    script.setAttribute(name, value);
  }
  document.head.appendChild(script);
};

const loadGoogleAnalytics = () => {
  if (!GA_MEASUREMENT_ID) return;
  window[`ga-disable-${GA_MEASUREMENT_ID}`] = false;
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag() {
      // gtag reads `arguments`, not a spread array.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
  // Consent state first, before any command that sends data (Google's ordering
  // rule). Only analytics was agreed to; nothing advertising-related ever is.
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted',
  });
  appendScript(
    `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`,
  );
  window.gtag('js', new Date());
  // Page views are sent by the router with a cleaned address, so Google never
  // sends one by itself or sees a raw URL from this config.
  window.gtag('config', GA_MEASUREMENT_ID, {
    send_page_view: false,
    page_location: telemetryUrl(window.location.href),
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  // The page the visitor accepted on counts once; later routes come from SeoHead.
  trackPageView(window.location.href);
};

const loadCloudflareWebAnalytics = () => {
  if (!CF_WEB_ANALYTICS_TOKEN) return;
  appendScript('https://static.cloudflareinsights.com/beacon.min.js', {
    'data-cf-beacon': JSON.stringify({ token: CF_WEB_ANALYTICS_TOKEN }),
  });
};

/** Expire analytics cookies on this host and every parent domain. */
const clearAnalyticsCookies = () => {
  const names = document.cookie
    .split(';')
    .map((part) => part.split('=')[0]?.trim() ?? '')
    .filter((name) => /^(_ga|_gid|_gat|_gcl)/.test(name));
  if (!names.length) return;
  const labels = window.location.hostname.split('.');
  const domains = [''];
  for (let index = 0; index < labels.length - 1; index += 1) {
    domains.push(`; domain=.${labels.slice(index).join('.')}`);
  }
  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain}`;
    }
  }
};

const applyAnalytics = (allowed: boolean) => {
  if (allowed) {
    if (analyticsLoadedThisPage) return;
    analyticsLoadedThisPage = true;
    loadGoogleAnalytics();
    loadCloudflareWebAnalytics();
    enableSentryTracing();
    return;
  }
  if (GA_MEASUREMENT_ID) window[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
  clearAnalyticsCookies();
  // First-party discovery signals and the browser id they use are analytics too.
  void import('@/services/marketSignalQueue')
    .then(({ clearWebMarketSignalQueue }) => clearWebMarketSignalQueue())
    .catch(() => undefined);
  // Scripts already running cannot be unloaded; a fresh page starts without them.
  if (analyticsLoadedThisPage) window.location.reload();
};

let initialized = false;

export const initConsentEffects = () => {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  let previous = analyticsPermitted();
  applyAnalytics(previous);
  subscribeConsent(() => {
    const next = analyticsPermitted();
    if (next !== previous) applyAnalytics(next);
    previous = next;
  });
};

export const hasAnalyticsLoaded = () => analyticsLoadedThisPage;
