/**
 * Client-side paths that must never be indexable in the SPA shell.
 * Keep aligned with `bwiez/src/seo/seo.config.ts` SEO_DISALLOWED_PATH_PREFIXES.
 */
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
  '/change-email',
  '/account',
  '/settings',
  '/notifications',
  '/diagnostics',
  '/search',
  '/store/create',
  '/store/essentials',
  '/store/my',
  '/store/dashboard',
  '/store/payouts',
  '/custom-orders',
  '/products/create',
  '/designs/create',
  '/collections/create',
  '/accept-invite',
  '/trouble',
];

export function isSeoNoindexClientPath(pathname: string): boolean {
  return PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
