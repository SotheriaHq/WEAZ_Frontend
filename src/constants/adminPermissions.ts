/**
 * The web-side catalogue of admin permissions.
 *
 * The backend's `admin/constants/permissions.ts` is the authority — it is what
 * the guards actually read. This file exists for the one thing the backend has
 * no reason to carry: the human wording an operator sees when granting a
 * capability. "taxonomy.suggestions.moderate" tells a SuperAdmin nothing about
 * what they are handing over.
 *
 * It is ALSO the single web-side list of codes. There were previously two
 * partial copies — the alias map in `useAdminPermissions` and a hand-written
 * array in `AccountManageModal` — and the array had drifted to 47 of the 55
 * real codes. The eight it omitted (`dashboard.read`, both `contentReview.*`,
 * both `alerts.*`, both `payments.*`, `admin.email_change`) were not grantable
 * through the UI at all, which left the Content Management and Monitoring
 * consoles permanently unreachable for every non-SuperAdmin, with nothing on
 * screen to explain why.
 *
 * `src/__tests__/adminPermissionCatalogue.test.ts` asserts this file agrees with
 * the backend's, code for code, so that drift cannot return silently.
 */

export interface AdminPermissionDefinition {
  /** Stable key used by callers: `hasPermission('USERS_READ')`. */
  key: string;
  /** The wire code persisted in `AdminPermissionGrant.permissionCode`. */
  code: string;
  /** Section heading in the permissions editor. */
  group: string;
  /** What is being granted, in an operator's words. */
  label: string;
  /** One-line expansion, surfaced as a tooltip. */
  description: string;
  /**
   * The backend refuses to grant these to an Admin account
   * (`SUPERADMIN_ONLY_PERMISSIONS`); only SuperAdmin holds them implicitly.
   * Offering them as a checkbox guarantees a 400.
   */
  superAdminOnly?: boolean;
}

const CATALOGUE = [
  {
    key: 'DASHBOARD_READ',
    code: 'dashboard.read',
    group: 'Dashboard',
    label: 'View the admin dashboard',
    description:
      'Open the console landing page and read its platform figures. Every new admin is created with this.',
  },

  {
    key: 'USERS_READ',
    code: 'users.read',
    group: 'Users & accounts',
    label: 'View user accounts',
    description: 'Open the Users console and read account details.',
  },
  {
    key: 'USERS_UPDATE',
    code: 'users.update',
    group: 'Users & accounts',
    label: 'Edit user accounts',
    description: 'Change account details and sensitive access settings.',
  },
  {
    key: 'USERS_DEACTIVATE',
    code: 'users.deactivate',
    group: 'Users & accounts',
    label: 'Suspend or deactivate users',
    description: 'Suspend, deactivate, and reactivate accounts.',
  },
  {
    key: 'USERS_ROLE_ASSIGN_ADMIN',
    code: 'users.role.assign_admin',
    group: 'Users & accounts',
    label: 'Promote a user to admin',
    description: 'Create admin accounts and raise a user to the Admin role.',
    superAdminOnly: true,
  },
  {
    key: 'USERS_ROLE_ASSIGN_USER',
    code: 'users.role.assign_user',
    group: 'Users & accounts',
    label: 'Demote an admin to user',
    description: 'Return an admin account to the ordinary User role.',
    superAdminOnly: true,
  },
  {
    key: 'USERS_DATA_EXPORT',
    code: 'users.data_export',
    group: 'Users & accounts',
    label: 'Export user data',
    description: 'Produce a data export for an account.',
  },
  {
    key: 'USERS_DATA_WIPE',
    code: 'users.data_wipe',
    group: 'Users & accounts',
    label: 'Erase user data',
    description: 'Permanently wipe an account’s data. Not reversible.',
    superAdminOnly: true,
  },

  {
    key: 'BRANDS_READ',
    code: 'brands.read',
    group: 'Brands & stores',
    label: 'View brands',
    description: 'Open the Brands directory and read brand details.',
  },
  {
    key: 'BRANDS_VERIFY',
    code: 'brands.verify',
    group: 'Brands & stores',
    label: 'Approve or reject brand verification',
    description: 'Review verification submissions and decide the outcome.',
  },
  {
    key: 'BRANDS_SUSPEND',
    code: 'brands.suspend',
    group: 'Brands & stores',
    label: 'Suspend brands',
    description: 'Suspend a brand and lift that suspension.',
  },
  {
    key: 'BRANDS_STORE_READ',
    code: 'brands.store_read',
    group: 'Brands & stores',
    label: 'View storefronts',
    description: 'Read a brand’s storefront setup and publication state.',
  },
  {
    key: 'BRANDS_STORE_VERIFY',
    code: 'brands.store_verify',
    group: 'Brands & stores',
    label: 'Verify storefronts',
    description: 'Approve the storefront half of a brand’s verification.',
  },
  {
    key: 'BRANDS_STORE_OVERRIDE',
    code: 'brands.store_override',
    group: 'Brands & stores',
    label: 'Force a storefront open or closed',
    description: 'Override the brand’s own open/closed setting for its store.',
  },

  {
    key: 'PRODUCTS_READ',
    code: 'products.read',
    group: 'Products & content',
    label: 'View products',
    description: 'Open the product catalogue in Content Management.',
  },
  {
    key: 'PRODUCTS_MODERATE',
    code: 'products.moderate',
    group: 'Products & content',
    label: 'Moderate products',
    description: 'Unpublish, restore, or take down a product.',
  },
  {
    key: 'COLLECTIONS_READ',
    code: 'collections.read',
    group: 'Products & content',
    label: 'View designs and collections',
    description: 'Open the designs and store-collections lists.',
  },
  {
    key: 'COLLECTIONS_MODERATE',
    code: 'collections.moderate',
    group: 'Products & content',
    label: 'Moderate designs and collections',
    description: 'Unpublish, restore, or take down a design or collection.',
  },
  {
    key: 'CONTENT_REVIEW_READ',
    code: 'contentReview.read',
    group: 'Products & content',
    label: 'View the content review queue',
    description: 'Read items waiting on a content-integrity decision.',
  },
  {
    key: 'CONTENT_REVIEW_MANAGE',
    code: 'contentReview.manage',
    group: 'Products & content',
    label: 'Action the content review queue',
    description: 'Clear, escalate, or reject items in content review.',
  },
  {
    key: 'FEATURED_MANAGE',
    code: 'featured.manage',
    group: 'Products & content',
    label: 'Manage featured content',
    description: 'Choose what is featured on discovery surfaces.',
  },

  {
    key: 'TAXONOMY_READ',
    code: 'taxonomy.read',
    group: 'Taxonomy & hashtags',
    label: 'View taxonomy',
    description: 'Open the categories, types, and filters console.',
  },
  {
    key: 'TAXONOMY_WRITE',
    code: 'taxonomy.write',
    group: 'Taxonomy & hashtags',
    label: 'Edit taxonomy',
    description: 'Create and change categories, types, and filters.',
  },
  {
    key: 'TAXONOMY_SUGGESTIONS_MODERATE',
    code: 'taxonomy.suggestions.moderate',
    group: 'Taxonomy & hashtags',
    label: 'Moderate category suggestions',
    description: 'Accept or decline categories suggested by brands.',
  },
  {
    key: 'TAGS_READ',
    code: 'tags.read',
    group: 'Taxonomy & hashtags',
    label: 'View hashtags',
    description: 'Open the hashtag moderation console.',
  },
  {
    key: 'TAGS_MODERATE',
    code: 'tags.moderate',
    group: 'Taxonomy & hashtags',
    label: 'Moderate hashtags',
    description: 'Ban, unban, and alias hashtags.',
  },

  {
    key: 'MEASUREMENTS_READ',
    code: 'measurements.read',
    group: 'Measurements',
    label: 'View measurements',
    description: 'Read the measurement catalogue and submissions.',
  },
  {
    key: 'MEASUREMENTS_REVIEW',
    code: 'measurements.review',
    group: 'Measurements',
    label: 'Review measurements',
    description: 'Approve or flag measurement submissions.',
  },

  {
    key: 'PAYOUTS_READ',
    code: 'payouts.read',
    group: 'Payments & payouts',
    label: 'View orders, finance, and payouts',
    description:
      'Open the Orders, Finance, and Payouts consoles and read their records.',
  },
  {
    key: 'PAYOUTS_PROCESS',
    code: 'payouts.process',
    group: 'Payments & payouts',
    label: 'Process payouts',
    description: 'Approve, hold, and release payouts to brands. Moves money.',
  },
  {
    key: 'PAYMENTS_SIMULATE',
    code: 'payments.simulate',
    group: 'Payments & payouts',
    label: 'Simulate payments',
    description: 'Run simulated payment flows against the gateway.',
  },
  {
    key: 'PAYMENTS_RUNTIME_READ',
    code: 'payments.runtime_read',
    group: 'Payments & payouts',
    label: 'View payment runtime health',
    description: 'Read gateway configuration and live payment health.',
  },

  {
    key: 'DISPUTES_READ',
    code: 'disputes.read',
    group: 'Disputes',
    label: 'View disputes',
    description: 'Open the disputes console and read case history.',
  },
  {
    key: 'DISPUTES_RESOLVE',
    code: 'disputes.resolve',
    group: 'Disputes',
    label: 'Resolve disputes',
    description: 'Decide a dispute and apply its outcome. Can move money.',
  },

  {
    key: 'MODERATION_READ',
    code: 'moderation.read',
    group: 'Moderation & messaging',
    label: 'View moderation and custom orders',
    description:
      'Open the moderation queue, reviews, and the admin custom-order queue.',
  },
  {
    key: 'MODERATION_WRITE',
    code: 'moderation.write',
    group: 'Moderation & messaging',
    label: 'Action the moderation queue',
    description: 'Take down, restore, and resolve reported content.',
  },
  {
    key: 'MESSAGING_READ',
    code: 'messaging.read',
    group: 'Moderation & messaging',
    label: 'View reported messages',
    description: 'Read message threads surfaced by reports.',
  },
  {
    key: 'MESSAGING_MODERATE',
    code: 'messaging.moderate',
    group: 'Moderation & messaging',
    label: 'Moderate messages',
    description: 'Remove messages and restrict participants in a thread.',
  },

  {
    key: 'AUDIT_READ',
    code: 'audit.read',
    group: 'Oversight',
    label: 'View the audit log',
    description:
      'Read the record of admin actions, including dashboard recent activity.',
  },
  {
    key: 'ALERTS_READ',
    code: 'alerts.read',
    group: 'Oversight',
    label: 'View system alerts',
    description: 'Open the Monitoring console and read live alerts.',
  },
  {
    key: 'ALERTS_MANAGE',
    code: 'alerts.manage',
    group: 'Oversight',
    label: 'Manage system alerts',
    description: 'Acknowledge, silence, and configure alerts.',
  },
  {
    key: 'NOTIFICATIONS_SEND',
    code: 'notifications.send',
    group: 'Oversight',
    label: 'Send notifications to users',
    description: 'Send platform notifications and emails to accounts.',
  },

  {
    key: 'MARKET_GOVERNANCE_READ',
    code: 'market.governance.read',
    group: 'Market governance',
    label: 'View market governance',
    description: 'Open the market governance console.',
  },
  {
    key: 'MARKET_GOVERNANCE_WRITE',
    code: 'market.governance.write',
    group: 'Market governance',
    label: 'Edit market governance',
    description: 'Change governance settings before release.',
  },
  {
    key: 'MARKET_GOVERNANCE_RELEASE',
    code: 'market.governance.release',
    group: 'Market governance',
    label: 'Release governance changes',
    description: 'Publish pending governance changes to the live market.',
  },
  {
    key: 'MARKET_RANKING_FORMULA_WRITE',
    code: 'market.ranking.formula.write',
    group: 'Market governance',
    label: 'Edit the market ranking formula',
    description: 'Change how the market ranks and surfaces content.',
  },
  {
    key: 'MARKET_RANKING_ROLLBACK',
    code: 'market.ranking.rollback',
    group: 'Market governance',
    label: 'Roll back market ranking',
    description: 'Revert the ranking configuration to a previous version.',
  },
  {
    key: 'MARKET_SUGGESTIONS_WRITE',
    code: 'market.suggestions.write',
    group: 'Market governance',
    label: 'Edit market suggestions',
    description: 'Curate the suggestion rails shown on the market.',
  },

  {
    key: 'SYSTEM_SETTINGS_WRITE',
    code: 'system.settings.write',
    group: 'System',
    label: 'Change system settings',
    description: 'Edit platform-wide configuration.',
    superAdminOnly: true,
  },
  {
    key: 'SYSTEM_SLA_READ',
    code: 'system.sla.read',
    group: 'System',
    label: 'View SLA policies',
    description: 'Read service-level policies and their targets.',
  },
  {
    key: 'SYSTEM_SLA_WRITE',
    code: 'system.sla.write',
    group: 'System',
    label: 'Edit SLA policies',
    description: 'Change service-level policies and their targets.',
    superAdminOnly: true,
  },
  {
    key: 'SYSTEM_DATA_RETENTION_WRITE',
    code: 'system.data_retention.write',
    group: 'System',
    label: 'Change data retention',
    description: 'Set how long platform data is kept before deletion.',
    superAdminOnly: true,
  },
  {
    key: 'SYSTEM_FEATURE_FLAGS_WRITE',
    code: 'system.feature_flags.write',
    group: 'System',
    label: 'Change feature flags',
    description: 'Turn platform features on and off.',
    superAdminOnly: true,
  },
  {
    key: 'ADMIN_EMAIL_CHANGE',
    code: 'admin.email_change',
    group: 'System',
    label: 'Change an admin’s email',
    description: 'Start and confirm an email change on an admin account.',
  },
  {
    key: 'PERMISSIONS_MANAGE',
    code: 'permissions.manage',
    group: 'System',
    label: 'Grant and revoke permissions',
    description: 'Decide what every other admin is allowed to do.',
    superAdminOnly: true,
  },
] as const satisfies readonly AdminPermissionDefinition[];

export const ADMIN_PERMISSION_CATALOGUE: readonly AdminPermissionDefinition[] =
  CATALOGUE;

/** Every permission code the platform knows about. */
export type AdminPermissionCode = (typeof CATALOGUE)[number]['code'];

export const ALL_ADMIN_PERMISSION_CODES = CATALOGUE.map(
  (entry) => entry.code,
) as AdminPermissionCode[];

/** `USERS_READ` → `users.read`, for callers that pass keys. */
export const ADMIN_PERMISSION_CODE_BY_KEY: Record<string, string> =
  Object.fromEntries(CATALOGUE.map((entry) => [entry.key, entry.code]));

const BY_CODE = new Map<string, AdminPermissionDefinition>(
  CATALOGUE.map((entry) => [entry.code, entry]),
);

/** Group headings in catalogue order, deduplicated. */
export const ADMIN_PERMISSION_GROUPS: string[] = CATALOGUE.reduce<string[]>(
  (groups, entry) => {
    if (!groups.includes(entry.group)) groups.push(entry.group);
    return groups;
  },
  [],
);

/**
 * Human wording for a code. Falls back to a readable rendering of the code
 * itself, so a permission the server grows before this file learns about it
 * still reads as words rather than rendering blank.
 */
export function describeAdminPermission(code: string): AdminPermissionDefinition {
  const known = BY_CODE.get(code);
  if (known) return known;
  return {
    key: code,
    code,
    group: 'Other',
    label: code
      .split('.')
      .join(' ')
      .replace(/_/g, ' ')
      .replace(/^./, (char) => char.toUpperCase()),
    description: 'This permission is not in the catalogue yet.',
  };
}

/** True when only a SuperAdmin may hold the code — the API rejects it otherwise. */
export function isSuperAdminOnlyPermission(code: string): boolean {
  return Boolean(BY_CODE.get(code)?.superAdminOnly);
}
