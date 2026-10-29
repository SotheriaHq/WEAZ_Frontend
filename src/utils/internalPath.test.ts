import { describe, expect, it } from 'vitest';
import { toInternalPath } from './internalPath';

describe('toInternalPath', () => {
  it('keeps paths on this site', () => {
    expect(toInternalPath('/profile')).toBe('/profile');
    expect(toInternalPath(' /orders/abc?tab=open#top ')).toBe('/orders/abc?tab=open#top');
    expect(toInternalPath('/a/../profile')).toBe('/profile');
    // Encoded characters stay encoded: still a path on this site.
    expect(toInternalPath('/%2F%2Fevil.com')).toBe('/%2F%2Fevil.com');
  });

  it('refuses everything a browser would open on another site', () => {
    for (const attack of [
      '//evil.com',
      '///evil.com',
      '/\\evil.com',
      '/\\/evil.com',
      '/\t/evil.com',
      '/\n/evil.com',
      '/\r/evil.com',
      'https://evil.com/profile',
      'http://evil.com',
      'javascript:alert(1)',
      'evil.com',
      '',
    ]) {
      expect(toInternalPath(attack)).toBeNull();
    }
  });

  it('refuses non-strings and returns the fallback', () => {
    expect(toInternalPath(null)).toBeNull();
    expect(toInternalPath(undefined, '/')).toBe('/');
    expect(toInternalPath(['/profile'], '/')).toBe('/');
    expect(toInternalPath('//evil.com', '/profile')).toBe('/profile');
  });
});
