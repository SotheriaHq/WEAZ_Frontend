import type {
  AuthBrandMembershipDto,
  AuthUserDto,
  BrandMemberRole,
} from '@/types/auth';

export const ACTIVE_BRAND_STORAGE_KEY = 'wiez.activeBrandId';

const ACTIVE_STATUS = 'ACTIVE';

const CATALOG_WRITE_ROLES = new Set<BrandMemberRole>([
  'OWNER',
  'MANAGER',
  'CATALOG_MANAGER',
]);
const ORDERS_READ_ROLES = new Set<BrandMemberRole>([
  'OWNER',
  'MANAGER',
  'ORDER_MANAGER',
  'SUPPORT_AGENT',
  'VIEWER',
]);
const ORDERS_UPDATE_ROLES = new Set<BrandMemberRole>([
  'OWNER',
  'MANAGER',
  'ORDER_MANAGER',
]);
const MESSAGES_READ_ROLES = new Set<BrandMemberRole>([
  'OWNER',
  'MANAGER',
  'SUPPORT_AGENT',
]);
const MESSAGES_REPLY_ROLES = new Set<BrandMemberRole>([
  'OWNER',
  'MANAGER',
  'SUPPORT_AGENT',
]);
const PAYOUTS_READ_ROLES = new Set<BrandMemberRole>(['OWNER']);

const readStoredActiveBrandId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(ACTIVE_BRAND_STORAGE_KEY);
    return value && value.trim().length > 0 ? value : null;
  } catch {
    return null;
  }
};

export const setStoredActiveBrandId = (brandId: string | null): void => {
  if (typeof window === 'undefined') return;
  try {
    if (brandId) {
      window.localStorage.setItem(ACTIVE_BRAND_STORAGE_KEY, brandId);
    } else {
      window.localStorage.removeItem(ACTIVE_BRAND_STORAGE_KEY);
    }
  } catch {
    // Storage availability must not block auth rendering.
  }
};

const getMemberships = (user?: Pick<AuthUserDto, 'brandMemberships'> | null) =>
  Array.isArray(user?.brandMemberships) ? user.brandMemberships : [];

const getActiveMemberships = (user?: Pick<AuthUserDto, 'brandMemberships'> | null) =>
  getMemberships(user).filter((membership) => membership.status === ACTIVE_STATUS);

export function getActiveBrandMembership(
  user?: Pick<AuthUserDto, 'brandMemberships' | 'activeBrandId' | 'storeId' | 'type' | 'brandFullName'> | null,
): AuthBrandMembershipDto | null {
  const activeMemberships = getActiveMemberships(user);
  if (activeMemberships.length === 0) {
    if (user?.type === 'BRAND' && user.storeId) {
      return {
        brandId: user.storeId,
        brandName: user.brandFullName ?? '',
        role: 'OWNER',
        status: 'ACTIVE',
        isOwner: true,
      };
    }
    return null;
  }

  const storedBrandId = readStoredActiveBrandId();
  const backendBrandId = user?.activeBrandId ?? null;
  const selected =
    (storedBrandId && activeMemberships.find((membership) => membership.brandId === storedBrandId)) ||
    (backendBrandId && activeMemberships.find((membership) => membership.brandId === backendBrandId)) ||
    activeMemberships[0];

  if (storedBrandId && !activeMemberships.some((membership) => membership.brandId === storedBrandId)) {
    setStoredActiveBrandId(selected?.brandId ?? null);
  }

  return selected ?? null;
}

export function getActiveBrandId(
  user?: Pick<AuthUserDto, 'brandMemberships' | 'activeBrandId' | 'storeId' | 'type' | 'brandFullName'> | null,
): string | null {
  return getActiveBrandMembership(user)?.brandId ?? user?.activeBrandId ?? user?.storeId ?? null;
}

export function hasActiveBrandMembership(user?: Pick<AuthUserDto, 'brandMemberships' | 'activeBrandId' | 'storeId' | 'type' | 'brandFullName'> | null): boolean {
  return Boolean(getActiveBrandMembership(user));
}

/**
 * Is this account a BRAND — regardless of how far through setup it is?
 *
 * Two different questions were being answered by `hasActiveBrandMembership`,
 * and only one of them is about identity:
 *
 *   CAPABILITY — "can this account manage a store right now?" That is what
 *   `hasActiveBrandMembership` answers, and it is right to answer false for a
 *   brand that has not created a store yet: there is nothing to manage, and
 *   `GlobalModalRouter` relies on that false to show the brand-setup modal.
 *
 *   IDENTITY — "whose UI is this?" A brand that signed up an hour ago and has
 *   not touched store setup is still a brand and must never be shown shopper
 *   UI. `getActiveBrandMembership` synthesizes a membership for a BRAND account
 *   only when `storeId` is set, so a freshly verified brand has no memberships,
 *   no storeId, and reads as a shopper — which is how a brand clicking "go to
 *   your profile" straight after email verification landed on the end-user
 *   profile.
 *
 * Use THIS for identity, and `hasActiveBrandMembership` for capability. Never
 * substitute one for the other: widening the capability predicate would hide
 * the setup flow from the accounts that need it.
 *
 * `type === 'BRAND'` covers the brand owner; the membership check still covers
 * staff, who are REGULAR accounts holding a membership on someone's brand.
 */
export function isBrandAccount(
  user?: Pick<AuthUserDto, 'brandMemberships' | 'activeBrandId' | 'storeId' | 'type' | 'brandFullName'> | null,
): boolean {
  if (!user) return false;
  return user.type === 'BRAND' || hasActiveBrandMembership(user);
}

/**
 * Canonical identity display name for the AUTHENTICATED account (Rule 1 + Rule 28).
 *
 * A brand account (`type === 'BRAND'`) IS the brand: its avatar shows the brand
 * logo, so its name and fallback initials must be the BRAND name — never the
 * personal name of the user who created the brand. Personal (REGULAR) accounts
 * use their own name. Use this everywhere the logged-in account's name or
 * avatar-fallback initials are rendered so identity never diverges per surface.
 */
export function resolveAccountDisplayName(
  user?:
    | Pick<
        AuthUserDto,
        | 'type'
        | 'brandFullName'
        | 'firstName'
        | 'lastName'
        | 'username'
        | 'brandMemberships'
        | 'activeBrandId'
        | 'storeId'
      >
    | null,
): string {
  if (user?.type === 'BRAND') {
    const brandName = (
      user.brandFullName ||
      getActiveBrandMembership(user)?.brandName ||
      ''
    ).trim();
    if (brandName) return brandName;
  }
  const personal = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();
  return personal || (user?.username ?? '').trim();
}

export function isBrandOwner(
  user?: Pick<AuthUserDto, 'brandMemberships' | 'activeBrandId' | 'storeId' | 'type' | 'brandFullName'> | null,
  brandId?: string | null,
): boolean {
  const membership = brandId
    ? getActiveMemberships(user).find((entry) => entry.brandId === brandId)
    : getActiveBrandMembership(user);
  return Boolean(membership?.isOwner || membership?.role === 'OWNER');
}

export function hasBrandRole(
  user: Pick<AuthUserDto, 'brandMemberships' | 'activeBrandId' | 'storeId' | 'type' | 'brandFullName'> | null | undefined,
  roles: Iterable<BrandMemberRole>,
  brandId?: string | null,
): boolean {
  const roleSet = new Set(roles);
  const membership = brandId
    ? getActiveMemberships(user).find((entry) => entry.brandId === brandId)
    : getActiveBrandMembership(user);
  return Boolean(membership && roleSet.has(membership.role));
}

export const canManageCatalog = (user?: AuthUserDto | null, brandId?: string | null) =>
  hasBrandRole(user, CATALOG_WRITE_ROLES, brandId);

export const canReadOrders = (user?: AuthUserDto | null, brandId?: string | null) =>
  hasBrandRole(user, ORDERS_READ_ROLES, brandId);

export const canUpdateOrders = (user?: AuthUserDto | null, brandId?: string | null) =>
  hasBrandRole(user, ORDERS_UPDATE_ROLES, brandId);

export const canReadMessages = (user?: AuthUserDto | null, brandId?: string | null) =>
  hasBrandRole(user, MESSAGES_READ_ROLES, brandId);

export const canReplyMessages = (user?: AuthUserDto | null, brandId?: string | null) =>
  hasBrandRole(user, MESSAGES_REPLY_ROLES, brandId);

export const canReadPayouts = (user?: AuthUserDto | null, brandId?: string | null) =>
  hasBrandRole(user, PAYOUTS_READ_ROLES, brandId);

export const canManageStaff = (user?: AuthUserDto | null, brandId?: string | null) =>
  isBrandOwner(user, brandId);
