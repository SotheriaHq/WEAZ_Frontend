export interface PagesEnv {
  VITE_API_BASE_URL?: string;
}

const CRAWLER_UA_PATTERN =
  /googlebot|bingbot|duckduckbot|slurp|facebookexternalhit|twitterbot|linkedinbot|whatsapp|applebot|yandexbot|baiduspider|semrushbot|ahrefsbot|mj12bot|rogerbot|embedly|pinterest|slackbot/i;

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
  if (PRIVATE_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }
  return true;
};