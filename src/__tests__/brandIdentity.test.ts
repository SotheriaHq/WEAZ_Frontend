import { describe, expect, it } from 'vitest';

import {
  hasActiveBrandMembership,
  isBrandAccount,
} from '../lib/brandAccess';

/**
 * The distinction these tests exist to protect: CAPABILITY ("can this account
 * manage a store right now?") versus IDENTITY ("whose UI is this?").
 *
 * Collapsing them is what sent a freshly verified brand to the shopper profile.
 * Widening the capability predicate instead would have hidden the store-setup
 * modal from exactly the accounts that need it, so both must keep their own
 * answer.
 */
const brandWithNoStoreYet = {
  type: 'BRAND',
  storeId: null,
  activeBrandId: null,
  brandMemberships: [],
  brandFullName: 'Nuel\'s Cotour',
} as any;

const brandWithStore = {
  type: 'BRAND',
  storeId: 'brand-1',
  activeBrandId: 'brand-1',
  brandMemberships: [],
  brandFullName: 'Nuel\'s Cotour',
} as any;

const shopper = {
  type: 'REGULAR',
  storeId: null,
  activeBrandId: null,
  brandMemberships: [],
} as any;

const staffOnSomeoneElsesBrand = {
  type: 'REGULAR',
  storeId: null,
  activeBrandId: 'brand-9',
  brandMemberships: [
    {
      brandId: 'brand-9',
      brandName: 'Abi\'s Lines',
      role: 'STAFF',
      status: 'ACTIVE',
      isOwner: false,
    },
  ],
} as any;

describe('isBrandAccount — identity', () => {
  it('is true for a brand that has NOT finished store setup', () => {
    // The reported bug: this account signed up, verified its email, clicked
    // "Go to Profile", and was shown the end-user profile.
    expect(isBrandAccount(brandWithNoStoreYet)).toBe(true);
  });

  it('is true for a brand with a store', () => {
    expect(isBrandAccount(brandWithStore)).toBe(true);
  });

  it('is true for staff on someone else\'s brand', () => {
    expect(isBrandAccount(staffOnSomeoneElsesBrand)).toBe(true);
  });

  it('is false for a shopper', () => {
    expect(isBrandAccount(shopper)).toBe(false);
  });

  it('is false with no account', () => {
    expect(isBrandAccount(null)).toBe(false);
    expect(isBrandAccount(undefined)).toBe(false);
  });
});

describe('hasActiveBrandMembership — capability, deliberately narrower', () => {
  it('stays FALSE for a brand with no store', () => {
    // GlobalModalRouter shows the brand-setup modal on this false. Making it
    // true would hide setup from every new brand.
    expect(hasActiveBrandMembership(brandWithNoStoreYet)).toBe(false);
  });

  it('is true once a store exists', () => {
    expect(hasActiveBrandMembership(brandWithStore)).toBe(true);
  });

  it('is true for staff with an active membership', () => {
    expect(hasActiveBrandMembership(staffOnSomeoneElsesBrand)).toBe(true);
  });

  it('is false for a shopper', () => {
    expect(hasActiveBrandMembership(shopper)).toBe(false);
  });
});

describe('the two answers differ exactly where it matters', () => {
  it('only a brand mid-setup separates them', () => {
    expect(isBrandAccount(brandWithNoStoreYet)).not.toBe(
      hasActiveBrandMembership(brandWithNoStoreYet),
    );

    for (const account of [brandWithStore, shopper, staffOnSomeoneElsesBrand]) {
      expect(isBrandAccount(account)).toBe(hasActiveBrandMembership(account));
    }
  });
});
