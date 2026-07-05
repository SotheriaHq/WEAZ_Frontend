export interface PagesEnv {
  VITE_API_BASE_URL?: string;
}

/**
 * Crawlers that should receive server-rendered bot HTML.
 * Covers: search engines, social/link-preview unfurlers, and AI crawlers
 * (industry-standard set as of 2026). Keep lowercase-insensitive.
 */
const CRAWLER_UA_PATTERN =
  /googlebot|google-inspectiontool|googleother|storebot-google|bingbot|duckduckbot|slurp|yandexbot|baiduspider|applebot|facebookexternalhit|meta-externalagent|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|slackbot|pinterest|embedly|semrushbot|ahrefsbot|mj12bot|rogerbot|gptbot|oai-searchbot|chatgpt-user|claudebot|claude-web|anthropic-ai|perplexitybot|amazonbot|bytespider|ccbot|cohere-ai|youbot/i;

const PRIVATE_PATH_PREFIXES = [
  '/studio',
  '/admin',
  '/checkout',
  '/bag',
  '/orders',
  '/messages',
  '/dashboard',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/search',
  '/custom-orders',
  '/assets/',
];

/**
 * Requests for real files (images, scripts, fonts, manifests…) must NEVER be
 * answered with bot HTML — a crawler fetching /brand/logo.svg needs the SVG,
 * not an HTML page, or image/favicon indexing breaks.
 */
const STATIC_FILE_EXTENSION_PATTERN =
  /\.(?:js|mjs|css|map|json|xml|txt|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|mp4|webm|mp3|wasm|pdf|zip|webmanifest)$/i;

export const resolveApiBaseUrl = (env: PagesEnv): string => {
  const configured = String(env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
  return configured || 'https://api.weaz.me';
};

export const isCrawlerRequest = (userAgent: string): boolean =>
  CRAWLER_UA_PATTERN.test(userAgent);

export const shouldServeBotHtml = (pathname: string): boolean => {
  if (pathname === '/robots.txt' || pathname === '/sitemap.xml') {
    return false;
  }
  if (STATIC_FILE_EXTENSION_PATTERN.test(pathname)) {
    return false;
  }
  if (PRIVATE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }
  return true;
};

/** Fetch with a hard timeout so a slow origin can never hang an edge request. */
export const fetchWithTimeout = (
  url: string,
  init: RequestInit,
  timeoutMs = 5_000,
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
};
