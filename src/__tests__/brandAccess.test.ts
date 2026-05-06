import { beforeEach, describe, expect, it } from 'vitest';
import {
  canManageCatalog,
  canReadMessages,
  canReadOrders,
  canReadPayouts,
  canUpdateOrders,
  getActiveBrandId,
  hasActiveBrandMembership,
  setStoredActiveBrandId,
} from '@/lib/brandAccess';

const baseUser = {
  id: 'user_1',
  type: 'REGULAR',
  storeId: null,
  brandFullName: null,
  activeBrandId: null,
  brandMemberships: [],
} as any;

describe('brandAccess UI helpers', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('uses the backend active brand membership when available', () => {
    const user = {
      ...baseUser,
      activeBrandId: 'brand_1',
      brandMemberships: [
        {
          brandId: 'brand_1',
          brandName: 'Brand One',
          role: 'CATALOG_MANAGER',
          status: 'ACTIVE',
          isOwner: false,
        },
      ],
    };

    expect(getActiveBrandId(user)).toBe('brand_1');
    expect(hasActiveBrandMembership(user)).toBe(true);
    expect(canManageCatalog(user)).toBe(true);
    expect(canReadOrders(user)).toBe(false);
  });

  it('denies inactive memberships for staff UI actions', () => {
    const user = {
      ...baseUser,
      activeBrandId: 'brand_1',
      brandMemberships: [
        {
          brandId: 'brand_1',
          brandName: 'Brand One',
          role: 'MANAGER',
          status: 'SUSPENDED',
          isOwner: false,
        },
      ],
    };

    expect(hasActiveBrandMembership(user)).toBe(false);
    expect(canManageCatalog(user)).toBe(false);
    expect(canReadMessages(user)).toBe(false);
  });

  it('validates locally selected brand ids against active memberships', () => {
    const user = {
      ...baseUser,
      activeBrandId: 'brand_1',
      brandMemberships: [
        {
          brandId: 'brand_1',
          brandName: 'Brand One',
          role: 'ORDER_MANAGER',
          status: 'ACTIVE',
          isOwner: false,
        },
        {
          brandId: 'brand_2',
          brandName: 'Brand Two',
          role: 'SUPPORT_AGENT',
          status: 'ACTIVE',
          isOwner: false,
        },
      ],
    };

    setStoredActiveBrandId('brand_2');

    expect(getActiveBrandId(user)).toBe('brand_2');
    expect(canReadOrders(user)).toBe(true);
    expect(canUpdateOrders(user)).toBe(false);
    expect(canReadMessages(user)).toBe(true);
  });

  it('keeps legacy brand owner fallback for older auth responses', () => {
    const user = {
      ...baseUser,
      type: 'BRAND',
      storeId: 'brand_legacy',
      brandFullName: 'Legacy Brand',
    };

    expect(getActiveBrandId(user)).toBe('brand_legacy');
    expect(hasActiveBrandMembership(user)).toBe(true);
    expect(canReadPayouts(user)).toBe(true);
  });
});
