import { describe, expect, it } from 'vitest';
import { getProfileOrHomeUrl } from '../lib/navigation';

describe('getProfileOrHomeUrl', () => {
  it('routes admin users to admin console', () => {
    expect(getProfileOrHomeUrl({ role: 'Admin', type: 'BRAND' })).toBe('/admin');
    expect(getProfileOrHomeUrl({ role: 'SuperAdmin', type: 'REGULAR' })).toBe('/admin');
  });

  it('routes non-admin authenticated users to profile', () => {
    expect(getProfileOrHomeUrl({ role: 'User', type: 'BRAND' })).toBe('/profile');
    expect(getProfileOrHomeUrl({ role: 'User', type: 'REGULAR' })).toBe('/profile');
  });

  it('falls back to home for unauthenticated or malformed user objects', () => {
    expect(getProfileOrHomeUrl(null)).toBe('/');
    expect(getProfileOrHomeUrl(undefined)).toBe('/');
    expect(getProfileOrHomeUrl({ role: 'User' })).toBe('/');
  });
});
