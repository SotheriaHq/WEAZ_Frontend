import { describe, expect, it } from 'vitest';
import {
  isBrandProfileComplete,
  resolveBrandProfileSetupDestination,
} from '../utils/storeSetup';

describe('storeSetup helpers', () => {
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
});