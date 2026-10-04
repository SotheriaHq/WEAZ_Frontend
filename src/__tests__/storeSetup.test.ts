import { beforeEach, describe, expect, it } from 'vitest';
import {
  hasSeenBrandSettlementNote,
  isBrandProfileComplete,
  markBrandSettlementNoteSeen,
  resolveBrandProfileSetupDestination,
  resolveStoreSetupDestination,
  sanitizeSingleSocialLink,
  saveStoreProgressLocally,
} from '../utils/storeSetup';

describe('storeSetup helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('requires the brand profile onboarding fields before store setup', () => {
    expect(
      isBrandProfileComplete({
        type: 'BRAND',
        brandDescription: 'Short bio',
        brandTags: ['fashion'],
        brandCountry: 'NG',
      }),
    ).toBe(false);

    expect(
      isBrandProfileComplete({
        type: 'BRAND',
        brandDescription: 'A valid brand description with enough detail.',
        brandTags: ['fashion'],
        brandState: 'Lagos',
      }),
    ).toBe(true);
  });

  it('builds a safe return destination for profile completion', () => {
    expect(
      resolveBrandProfileSetupDestination('/studio/store/setup?step=2'),
    ).toBe('/profile?modal=brand-setup&next=%2Fstudio%2Fstore%2Fsetup%3Fstep%3D2');
  });

  it('only treats current-version essentials progress as setup-ready', () => {
    saveStoreProgressLocally(
      {
        essentialsComplete: true,
        categories: ['womenswear'],
      },
      'user-1',
    );

    expect(resolveStoreSetupDestination('user-1')).toBe('/studio/store/essentials');

    saveStoreProgressLocally(
      {
        essentialsComplete: true,
        setupWizardVersion: 2,
        categories: ['womenswear'],
      },
      'user-1',
    );

    expect(resolveStoreSetupDestination('user-1')).toBe('/studio/store/setup');
  });

  it('tracks brand settlement note as seen once per user', () => {
    expect(hasSeenBrandSettlementNote('brand-1')).toBe(false);
    markBrandSettlementNoteSeen('brand-1');
    expect(hasSeenBrandSettlementNote('brand-1')).toBe(true);
    expect(hasSeenBrandSettlementNote('brand-2')).toBe(false);
  });

  it('keeps only one connected social profile', () => {
    expect(
      sanitizeSingleSocialLink({
        instagram: 'brand_a',
        tiktok: 'brand_b',
        twitter: '',
      }),
    ).toEqual({
      instagram: 'brand_a',
      tiktok: '',
      twitter: '',
    });
  });
});
