import { describe, it, expect } from 'vitest';
import { resolveAccountDisplayName } from './brandAccess';
import type { AuthUserDto } from '@/types/auth';

const base = {
  firstName: 'John',
  lastName: 'Doe',
  username: 'johnd',
} as unknown as AuthUserDto;

describe('resolveAccountDisplayName', () => {
  it('uses the brand name for a brand account, not the creator personal name', () => {
    const brand = {
      ...base,
      type: 'BRAND',
      brandFullName: 'Dean Apparels',
    } as unknown as AuthUserDto;
    expect(resolveAccountDisplayName(brand)).toBe('Dean Apparels');
  });

  it('falls back to the active brand membership name when brandFullName is empty', () => {
    const brand = {
      ...base,
      type: 'BRAND',
      brandFullName: null,
      storeId: 'brand-1',
      brandMemberships: [
        {
          brandId: 'brand-1',
          brandName: 'Hover Covers',
          role: 'OWNER',
          status: 'ACTIVE',
          isOwner: true,
        },
      ],
    } as unknown as AuthUserDto;
    expect(resolveAccountDisplayName(brand)).toBe('Hover Covers');
  });

  it('uses the personal name for a regular account', () => {
    const regular = { ...base, type: 'REGULAR' } as unknown as AuthUserDto;
    expect(resolveAccountDisplayName(regular)).toBe('John Doe');
  });

  it('falls back to username when a brand account has no resolvable brand name', () => {
    const brand = {
      ...base,
      type: 'BRAND',
      brandFullName: '   ',
      firstName: '',
      lastName: '',
    } as unknown as AuthUserDto;
    expect(resolveAccountDisplayName(brand)).toBe('johnd');
  });
});
