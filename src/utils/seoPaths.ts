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
];

export function isSeoNoindexClientPath(pathname: string): boolean {
  return PRIVATE_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}