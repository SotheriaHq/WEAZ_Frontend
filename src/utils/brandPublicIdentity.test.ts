import { describe, expect, it } from 'vitest';
import {
  extractUsernameFromProfileUrl,
  resolveBrandDisplayName,
  resolveBrandLocation,
  resolveBrandTags,
  resolveBrandUsername,
  resolvePublicBrandIdentity,
} from './brandPublicIdentity';

describe('brandPublicIdentity', () => {
  it('extracts username from absolute and relative /u/ URLs', () => {
    expect(
      extractUsernameFromProfileUrl('https://weaz.me/u/hovercovers'),
    ).toBe('hovercovers');
    expect(extractUsernameFromProfileUrl('/u/maison-vant?tab=Store')).toBe(
      'maison-vant',
    );
    expect(extractUsernameFromProfileUrl('https://weaz.me/profile/abc')).toBe(
      null,
    );
  });

  it('resolves username from public link when field is missing', () => {
    expect(
      resolveBrandUsername({
        publicProfileUrl: 'https://weaz.me/u/hovercovers',
      }),
    ).toBe('hovercovers');
  });

  it('falls back display name to username when brandFullName is empty', () => {
    expect(
      resolveBrandDisplayName({
        brandFullName: '  ',
        username: 'hovercovers',
      }),
    ).toBe('hovercovers');
  });

  it('builds location from city/state/country when location is null', () => {
    expect(
      resolveBrandLocation({
        location: null,
        city: 'Ikeja',
        state: 'Lagos',
        country: 'Nigeria',
      }),
    ).toBe('Ikeja, Lagos, Nigeria');
  });

  it('normalizes tags from tags or hashtags', () => {
    expect(
      resolveBrandTags({
        tags: ['#Ankara', 'ankara', 'Streetwear'],
        hashtags: [],
      }),
    ).toEqual(['Ankara', 'Streetwear']);
  });

  it('resolvePublicBrandIdentity returns visitor-ready identity', () => {
    expect(
      resolvePublicBrandIdentity({
        brandFullName: 'Hover Covers',
        publicProfileUrl: 'https://weaz.me/u/hovercovers',
        city: 'Lagos',
        country: 'Nigeria',
        tags: ['fashion'],
        description: 'Outerwear',
      }),
    ).toEqual({
      brandName: 'Hover Covers',
      username: 'hovercovers',
      location: 'Lagos, Nigeria',
      tags: ['fashion'],
      description: 'Outerwear',
    });
  });
});
