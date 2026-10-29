const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const headersPath = path.join(root, 'public', '_headers');
const vercelPath = path.join(root, 'vercel.json');

const appBaseUrl = String(process.env.VITE_APP_URL ?? 'https://weaz.me')
  .trim()
  .replace(/\/+$/, '');

const apiBaseUrl = String(process.env.VITE_API_BASE_URL ?? 'https://api.weaz.me')
  .trim()
  .replace(/\/+$/, '');

const gaMeasurementId = String(process.env.VITE_GA_MEASUREMENT_ID ?? '').trim();
// Analytics origins are allowed only when that analytics is configured; the
// app then loads it only after the visitor accepts (src/privacy). Without a
// token, the CSP also blocks a beacon Cloudflare injects at the edge.
const cfWebAnalyticsToken = String(process.env.VITE_CF_WEB_ANALYTICS_TOKEN ?? '').trim();

// This script runs under plain node, which does not load .env like Vite does.
// The Sentry DSN normally lives only in .env, so fall back to reading it there
// to keep the CSP in sync with the bundle Vite produces.
const readDotEnvValue = (key) => {
  try {
    const text = fs.readFileSync(path.join(root, '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && match[1] === key) {
        return match[2].replace(/^['"]|['"]$/g, '');
      }
    }
  } catch {
    // no .env — env var only
  }
  return '';
};

const r2Origin = new URL(process.env.VITE_R2_STORAGE_ORIGIN || readDotEnvValue('VITE_R2_STORAGE_ORIGIN') || 'https://d203d3dfbba40e2429de72a848154d3e.r2.cloudflarestorage.com').origin;
if (!/^https:\/\/[a-f0-9]{32}(?:\.(?:eu|us|fedramp))?\.r2\.cloudflarestorage\.com$/i.test(r2Origin)) throw new Error('VITE_R2_STORAGE_ORIGIN must identify an R2 account API origin');
const mediaGatewayUrl = new URL(process.env.VITE_MEDIA_GATEWAY_BASE_URL || readDotEnvValue('VITE_MEDIA_GATEWAY_BASE_URL') || 'https://wiez-sit-media-gateway.sotheria-hq.workers.dev');
if (mediaGatewayUrl.protocol !== 'https:' || mediaGatewayUrl.username || mediaGatewayUrl.password || mediaGatewayUrl.port || mediaGatewayUrl.search || mediaGatewayUrl.hash || /(?:^|\.)(?:amazonaws\.com(?:\.cn)?|cloudfront\.net|r2\.cloudflarestorage\.com|r2\.dev)$/i.test(mediaGatewayUrl.hostname)) throw new Error('VITE_MEDIA_GATEWAY_BASE_URL must identify an authenticated HTTPS media gateway');
const mediaGatewayOrigin = mediaGatewayUrl.origin;

const sentryDsn = String(process.env.VITE_SENTRY_DSN ?? readDotEnvValue('VITE_SENTRY_DSN')).trim();
let sentryIngestOrigin = '';
if (sentryDsn) {
  try {
    sentryIngestOrigin = new URL(sentryDsn).origin;
  } catch {
    console.warn('VITE_SENTRY_DSN is not a valid URL; Sentry host left out of CSP connect-src');
  }
}

const apiWsBaseUrl = apiBaseUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');

const buildConnectSrc = () => {
  const sources = new Set([
    "'self'",
    'https://accounts.google.com',
    // Location lists come from the API (/locations/*), not third parties.
    'http://localhost:3040',
    'http://127.0.0.1:3040',
    'ws://localhost:3040',
    'ws://127.0.0.1:3040',
    apiBaseUrl,
    apiWsBaseUrl,
    r2Origin,
    mediaGatewayOrigin,
    'https://api.paystack.co',
    'https://checkout.paystack.com',
    'https://standard.paystack.co',
    'https://js.paystack.co',
    ...(gaMeasurementId
      ? [
          'https://www.googletagmanager.com',
          'https://www.google-analytics.com',
          'https://region1.google-analytics.com',
        ]
      : []),
    // Cloudflare Web Analytics beacon posts RUM data here.
    ...(cfWebAnalyticsToken ? ['https://cloudflareinsights.com'] : []),
  ]);
  if (sentryIngestOrigin) {
    sources.add(sentryIngestOrigin);
  }
  return Array.from(sources).join(' ');
};

const scriptSrc = [
  "'self'",
  'https://accounts.google.com',
  'https://js.paystack.co',
  'https://checkout.paystack.com',
  'https://standard.paystack.co',
  ...(cfWebAnalyticsToken ? ['https://static.cloudflareinsights.com'] : []),
  ...(gaMeasurementId ? ['https://www.googletagmanager.com'] : []),
].join(' ');

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  // Current R2 account and authenticated media Worker only.
  `img-src 'self' data: blob: ${apiBaseUrl} ${r2Origin} ${mediaGatewayOrigin} https://res.cloudinary.com https://images.unsplash.com https://lh3.googleusercontent.com https://unavatar.io https://checkout.paystack.com https://standard.paystack.co`,
  "font-src 'self' data: https://fonts.gstatic.com",
  `connect-src ${buildConnectSrc()}`,
  // Private verification documents remain on authorized R2 capabilities.
  `frame-src https://accounts.google.com https://checkout.paystack.com https://standard.paystack.co https://js.paystack.co ${r2Origin}`,
  `media-src 'self' blob: ${r2Origin} ${mediaGatewayOrigin}`,
  "form-action 'self' https://checkout.paystack.com https://standard.paystack.co",
  "worker-src 'self' blob:",
  'upgrade-insecure-requests',
].join('; ');

const headersTemplate = `# Generated by scripts/generate-security-headers.cjs — do not hand-edit connect-src API host.
# Browsers keep hashed assets for a year; Cloudflare's EDGE revalidates hourly.
# INCIDENT 2026-07-10 / 2026-07-31: during a deploy race the SPA fallback
# (index.html) was served at /assets/*.js and stamped with this immutable
# header, so browsers AND the edge cached HTML under the JS URL → module
# MIME failures ("Expected a JavaScript-or-Wasm module script but the server
# responded with a MIME type of text/html"). Bounded edge TTL limits blast
# radius but does NOT stop browser disk cache (still max-age=1y). Real fix
# lives in functions/_middleware.ts: HTML-for-/assets/* → 404 no-store.
/assets/*
  Cache-Control: public, max-age=31536000, immutable
  Cloudflare-CDN-Cache-Control: public, max-age=3600

# Content-hashed WOFF2 filenames; policy/manifest documents stay revalidatable.
/fonts/wiez-web/*.woff2
  Cache-Control: public, max-age=31536000, immutable

# HTML stays no-cache (every navigation revalidates, deploys land instantly)
# but NOT no-store: no-store on the document disqualifies the page from the
# back/forward cache, making every back-tap a full reload.
/
  Cache-Control: no-cache, must-revalidate
/index.html
  Cache-Control: no-cache, must-revalidate
# Boot scripts pair with index.html (CSP forbids inline scripts) and contain
# the stale-cache self-heal — they must never be served stale themselves.
/boot/theme-init.js
  Cache-Control: no-cache, no-store, must-revalidate
/boot/boot-splash.js
  Cache-Control: no-cache, no-store, must-revalidate
/boot/*
  Cache-Control: no-cache, no-store, must-revalidate
# Build version manifest drives live stale-session detection — never cache.
/version.json
  Cache-Control: no-cache, no-store, must-revalidate

/*
  Content-Security-Policy: ${csp}
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  X-Content-Type-Options: nosniff
`;

fs.writeFileSync(headersPath, headersTemplate, 'utf8');

const vercelConfig = {
  headers: [
    {
      source: '/',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      ],
    },
    {
      source: '/index.html',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      ],
    },
    {
      source: '/boot/(.*)',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      ],
    },
    {
      source: '/version.json',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
      ],
    },
    {
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
      ],
    },
  ],
};

fs.writeFileSync(vercelPath, `${JSON.stringify(vercelConfig, null, 2)}\n`, 'utf8');

// Analytics no longer boot from public/: they start from the app, and only
// after the visitor accepts them (src/privacy/thirdPartyLoaders.ts). Remove a
// copy an older build generated, so it can never ship and load early again.
const analyticsBootPath = path.join(root, 'public', 'boot', 'analytics.js');
if (fs.existsSync(analyticsBootPath)) fs.unlinkSync(analyticsBootPath);

// Early flight: start the primary market data fetches DURING JS boot so the
// payloads are downloading in parallel with the bundle instead of after it
// (measured: data fetches previously started ~6s into a cold visit).
// Anonymous visitors only — logged-in responses can differ per user.
const userStorageKey = String(
  process.env.VITE_USER_STORAGE_KEY ??
    readDotEnvValue('VITE_USER_STORAGE_KEY') ??
    '',
).trim() || 'THREADLY_USER';
const earlyDataBootPath = path.join(root, 'public', 'boot', 'early-data.js');
const earlyDataBoot = `// Generated by scripts/generate-security-headers.cjs
(function () {
  try {
    var API = ${JSON.stringify(apiBaseUrl)};
    if (!API) return;
    try {
      if (localStorage.getItem(${JSON.stringify(userStorageKey)})) return;
    } catch (_e) {}
    var opts = { credentials: 'omit', headers: { Accept: 'application/json' } };
    var early = {};
    var path = window.location.pathname;
    if (path === '/' || path === '/runway') {
      early['feed:combined'] = fetch(API + '/collections/market?counts=combined&feedKey=explore', opts);
    }
    if (path === '/market' || path === '/market-place') {
      early['sections'] = fetch(API + '/market/sections', opts);
    }
    for (var key in early) {
      if (early[key] && early[key].catch) early[key].catch(function () {});
      window.__WIEZ_EARLY__ = early;
      break;
    }
  } catch (_e) {}
})();
`;
fs.writeFileSync(earlyDataBootPath, earlyDataBoot, 'utf8');

console.log(`Generated security headers with API host ${apiBaseUrl} and app URL ${appBaseUrl}`);
