/**
 * One table of "what does this admin path require".
 *
 * The sidebar, the dashboard's cards and link lists, and the router's
 * `RequireAdminPermission` guards all answer the same question, and they used to
 * answer it from three separate hand-maintained lists. That is how an admin ends
 * up looking at a tile they cannot open: the dashboard offered the link, the
 * route bounced them back to the dashboard, and nothing said why.
 *
 * `ADMIN_ROUTE_ACCESS` is matched by longest path prefix, so `/admin/orders/:id`
 * and `/admin/content?tab=products` resolve to the same requirement as their
 * parents without needing their own rows. `/admin` itself is intentionally
 * absent: the dashboard is the landing route for every admin and carries no
 * requirement (the backend agrees — see `AdminDashboardController`).
 */

export interface AdminAccessCheck {
  hasPermission: (code: string) => boolean;
  isSuperAdmin: boolean;
}

export interface AdminRouteAccess {
  /** Path prefix this rule covers, query string excluded. */
  prefix: string;
  /** Any one of these permits the route. */
  permissions?: string[];
  superAdminOnly?: boolean;
}

export const ADMIN_ROUTE_ACCESS: AdminRouteAccess[] = [
  { prefix: '/admin/custom-orders', permissions: ['MODERATION_READ'] },
  // Brands and verification are tabs inside the unified Users console; the old
  // paths redirect there, so they must carry the same requirement or the
  // redirect lands on a guard that bounces straight back out.
  {
    prefix: '/admin/users',
    permissions: ['USERS_READ', 'BRANDS_READ', 'BRANDS_VERIFY'],
  },
  {
    prefix: '/admin/brands',
    permissions: ['USERS_READ', 'BRANDS_READ', 'BRANDS_VERIFY'],
  },
  {
    prefix: '/admin/verification',
    permissions: ['USERS_READ', 'BRANDS_READ', 'BRANDS_VERIFY'],
  },
  {
    prefix: '/admin/content',
    permissions: ['PRODUCTS_READ', 'COLLECTIONS_READ', 'CONTENT_REVIEW_READ'],
  },
  { prefix: '/admin/taxonomy', permissions: ['TAXONOMY_READ'] },
  { prefix: '/admin/tags', permissions: ['TAGS_READ'] },
  { prefix: '/admin/orders', permissions: ['PAYOUTS_READ'] },
  { prefix: '/admin/finance', permissions: ['PAYOUTS_READ'] },
  { prefix: '/admin/payouts', permissions: ['PAYOUTS_READ'] },
  { prefix: '/admin/disputes', permissions: ['DISPUTES_READ'] },
  { prefix: '/admin/messaging', permissions: ['MESSAGING_READ'] },
  { prefix: '/admin/moderation', permissions: ['MODERATION_READ'] },
  { prefix: '/admin/reviews', permissions: ['MODERATION_READ'] },
  { prefix: '/admin/audit', permissions: ['AUDIT_READ'] },
  { prefix: '/admin/monitoring', permissions: ['ALERTS_READ'] },
  { prefix: '/admin/alerts', permissions: ['ALERTS_READ'] },
  {
    prefix: '/admin/market-governance',
    permissions: ['MARKET_GOVERNANCE_READ'],
  },
  {
    prefix: '/admin/settings',
    permissions: [
      'SYSTEM_SLA_READ',
      'SYSTEM_FEATURE_FLAGS_WRITE',
      'SYSTEM_SETTINGS_WRITE',
    ],
    superAdminOnly: true,
  },
];

export interface AdminNavItem {
  key: string;
  label: string;
  path: string;
  emoji: string;
}

/** Sidebar entries, in display order. Access comes from the table above. */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { key: 'dashboard', label: 'Dashboard', path: '/admin', emoji: '📊' },
  { key: 'orders', label: 'Orders', path: '/admin/orders', emoji: '🧾' },
  { key: 'users', label: 'Users', path: '/admin/users', emoji: '👤' },
  {
    key: 'content',
    label: 'Content Management',
    path: '/admin/content',
    emoji: '🧰',
  },
  { key: 'taxonomy', label: 'Taxonomy', path: '/admin/taxonomy', emoji: '🧬' },
  { key: 'tags', label: 'Hashtag moderation', path: '/admin/tags', emoji: '🏷️' },
  { key: 'finance', label: 'Finance', path: '/admin/finance', emoji: '🏦' },
  { key: 'payouts', label: 'Payouts', path: '/admin/payouts', emoji: '💰' },
  { key: 'disputes', label: 'Disputes', path: '/admin/disputes', emoji: '⚖️' },
  { key: 'messaging', label: 'Messaging', path: '/admin/messaging', emoji: '💬' },
  { key: 'moderation', label: 'Moderation', path: '/admin/moderation', emoji: '🛡️' },
  { key: 'reviews', label: 'Reviews', path: '/admin/reviews', emoji: '⭐' },
  { key: 'audit', label: 'Audit', path: '/admin/audit', emoji: '📋' },
  { key: 'settings', label: 'Settings', path: '/admin/settings', emoji: '⚙️' },
  { key: 'monitoring', label: 'Monitoring', path: '/admin/monitoring', emoji: 'MON' },
  {
    key: 'market-governance',
    label: 'Market Governance',
    path: '/admin/market-governance',
    emoji: 'MG',
  },
];

const pathOf = (to: string): string => to.split('?')[0].split('#')[0];

/** The most specific rule covering a path, or null when nothing gates it. */
export function resolveAdminRouteAccess(to: string): AdminRouteAccess | null {
  const path = pathOf(to);
  let match: AdminRouteAccess | null = null;
  for (const rule of ADMIN_ROUTE_ACCESS) {
    if (path !== rule.prefix && !path.startsWith(`${rule.prefix}/`)) continue;
    if (!match || rule.prefix.length > match.prefix.length) match = rule;
  }
  return match;
}

/**
 * Whether this admin can actually open a path. Anything the table does not
 * cover — the dashboard itself — is open to any admin who reached the console.
 */
export function canAccessAdminPath(to: string, access: AdminAccessCheck): boolean {
  const rule = resolveAdminRouteAccess(to);
  if (!rule) return true;
  if (rule.superAdminOnly && !access.isSuperAdmin) return false;
  if (access.isSuperAdmin) return true;
  if (!rule.permissions || rule.permissions.length === 0) return true;
  return rule.permissions.some((code) => access.hasPermission(code));
}
