import { describe, expect, it } from 'vitest';
import type { StoreStatusResponse } from '@/api/StoreApi';
import {
  getVisibleSettingsGroups,
  resolveSettingsTab,
} from '@/components/settings/SettingsSidebar';

const status = (
  isSetupComplete: boolean,
  overrides: Partial<StoreStatusResponse> = {},
): StoreStatusResponse => ({
  brandId: 'brand-a',
  isStoreOpen: false,
  isSetupComplete,
  missingFields: [],
  profile: { name: 'Brand A', tags: [] },
  ...overrides,
});

const itemKeys = (
  isBrandUser: boolean,
  storeSetupComplete: boolean | null,
  groupId: string,
  isAdmin = false,
) => getVisibleSettingsGroups({ isBrandUser, isAdmin, storeSetupComplete })
  .find((group) => group.id === groupId)?.items.map((item) => item.key) ?? [];

describe('Settings navigation consolidation', () => {
  it('groups Account Security and Privacy Controls together without duplicate Personal entries', () => {
    const security = getVisibleSettingsGroups({
      isBrandUser: false,
      isAdmin: false,
      storeSetupComplete: true,
    }).find((group) => group.id === 'privacy-security');

    expect(security?.label).toBe('Privacy & Security');
    expect(security?.items.map((item) => [item.key, item.label])).toEqual([
      ['account-security', 'Account Security'],
      ['privacy', 'Privacy Controls'],
    ]);
    expect(itemKeys(false, true, 'personal')).not.toContain('account-security');
    expect(itemKeys(false, true, 'personal')).not.toContain('privacy');
  });

  it('keeps Business away from shoppers', () => {
    expect(itemKeys(false, true, 'studio')).toEqual([]);
    expect(itemKeys(false, true, 'personal')).toContain('billing');
  });

  it.each([null, false])(
    'fails closed for store setup state %s while preserving subscriptions',
    (storeSetupComplete) => {
      expect(itemKeys(true, storeSetupComplete, 'studio')).toEqual([
        'subscription-billing',
      ]);
      expect(itemKeys(true, storeSetupComplete, 'personal')).not.toContain('billing');
      expect(itemKeys(true, storeSetupComplete, 'brand')).toEqual([
        'patches',
        'subscriptions',
      ]);
    },
  );

  it('shows all existing Business destinations for a completed paused store', () => {
    expect(itemKeys(true, true, 'studio')).toEqual([
      'store-category-requests',
      'store-customers',
      'subscription-billing',
      'store-general',
      'store-hours',
      'store-social',
      'store-policies',
      'store-team',
      'store-notifications',
      'store-danger',
    ]);
    expect(itemKeys(true, true, 'personal')).toContain('billing');
  });

  it('preserves admin visibility rules independently of store eligibility', () => {
    expect(itemKeys(true, true, 'personal', true)).not.toContain('profile-visibility');
    expect(itemKeys(true, true, 'personal', true)).not.toContain('size-fits');
  });
});

describe('Settings deep-link eligibility', () => {
  it.each(['account', 'security', 'account-security'])(
    'keeps the legacy %s security link on the canonical destination',
    (active) => {
      expect(resolveSettingsTab(active, false, null)).toBe('account-security');
    },
  );

  it.each([null, false])('blocks store forms while setup is %s', (complete) => {
    const storeStatus = complete === null ? null : status(complete);
    expect(resolveSettingsTab('store-general', true, storeStatus)).toBe('account-security');
    expect(resolveSettingsTab('store-customers', true, storeStatus)).toBe('account-security');
    expect(resolveSettingsTab('billing', true, storeStatus)).toBe('account-security');
    expect(resolveSettingsTab('store-payments', true, storeStatus)).toBe('account-security');
  });

  it('allows completed store forms and legacy payout aliases, including paused stores', () => {
    const paused = status(true, { isStoreOpen: false, isPublished: true });
    expect(resolveSettingsTab('store-general', true, paused)).toBe('store-general');
    expect(resolveSettingsTab('billing', true, paused)).toBe('billing');
    expect(resolveSettingsTab('store-payments', true, paused)).toBe('billing');
  });

  it.each([null, false])(
    'preserves subscription access before setup completion when state is %s',
    (complete) => {
      expect(resolveSettingsTab(
        'subscription-billing',
        true,
        complete === null ? null : status(complete),
      )).toBe('subscription-billing');
    },
  );

  it('does not expose Business deep links to shoppers', () => {
    expect(resolveSettingsTab('store-general', false, null)).toBe('account-security');
    expect(resolveSettingsTab('subscription-billing', false, null)).toBe('account-security');
    expect(resolveSettingsTab('billing', false, null)).toBe('billing');
  });

  it('preserves the published-store Working Hours remediation deep link', () => {
    const needsRequiredHours = status(false, {
      isPublished: true,
      workingHoursRequired: true,
      businessHoursConfigured: false,
    });
    expect(resolveSettingsTab('store-hours', true, needsRequiredHours)).toBe('store-hours');
    expect(resolveSettingsTab('store-hours', true, status(false))).toBe('account-security');
  });
});
