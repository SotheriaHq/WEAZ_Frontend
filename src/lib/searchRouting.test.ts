import { describe, expect, it } from 'vitest';
import {
  buildRunwayPinnedHref,
  buildSearchHref,
  resolveSearchIntent,
  resolveSearchResultRoute,
} from './searchRouting';
import type { SearchItem } from '@/types/search';

const makeItem = (overrides: Partial<SearchItem>): SearchItem => ({
  id: 'id_1',
  type: 'design',
  title: 'A design',
  href: '/collections/id_1',
  score: 1,
  ...overrides,
});

describe('searchRouting', () => {
  it('routes @-prefixed queries to profile search', () => {
    expect(resolveSearchIntent('@nike')).toEqual({ query: '@nike', type: 'profile' });
    expect(buildSearchHref('@nike')).toBe('/search?q=%40nike&type=profile');
  });

  it('routes slash-prefixed queries to tag search', () => {
    expect(resolveSearchIntent('/summer')).toEqual({ query: '/summer', type: 'tag' });
    expect(buildSearchHref('/summer')).toBe('/search?q=%2Fsummer&type=tag');
  });

  it('keeps plain queries in the global all-search mode', () => {
    expect(resolveSearchIntent('linen shirt')).toEqual({ query: 'linen shirt', type: 'all' });
    expect(buildSearchHref('linen shirt')).toBe('/search?q=linen+shirt');
  });

  describe('resolveSearchResultRoute', () => {
    it('routes a design result to Runway pinned mode with the design as anchor', () => {
      const route = resolveSearchResultRoute(
        makeItem({ id: 'design_9', type: 'design' }),
        'male wears',
      );
      expect(route.kind).toBe('runwayPinned');
      expect(route.to).toBe(buildRunwayPinnedHref('male wears', 'design_9'));
      expect(route.to).toContain('feedMode=searchPinned');
      expect(route.to).toContain('anchorDesignId=design_9');
      expect(route.state).toMatchObject({ anchorDesignId: 'design_9' });
    });

    it('routes a product-only result to the owning brand store', () => {
      const route = resolveSearchResultRoute(
        makeItem({
          id: 'prod_1',
          type: 'product',
          href: '/p/some-slug',
          metadata: { brandOwnerId: 'owner_7' },
        }),
        'gown',
      );
      expect(route.kind).toBe('brandStore');
      expect(route.to).toBe('/profile/owner_7');
      expect(route.state).toMatchObject({ returnTo: '/market' });
    });

    it('falls back to the product href when no brand owner is known', () => {
      const route = resolveSearchResultRoute(
        makeItem({ id: 'prod_2', type: 'product', href: '/p/slug-2', metadata: {} }),
        'gown',
      );
      expect(route.to).toBe('/p/slug-2');
    });

    it('keeps profile and brand identity results on their existing href', () => {
      const profile = resolveSearchResultRoute(
        makeItem({ id: 'u1', type: 'profile', href: '/profile/u1' }),
        'avery',
      );
      expect(profile.kind).toBe('identity');
      expect(profile.to).toBe('/profile/u1');

      const tag = resolveSearchResultRoute(
        makeItem({ id: 't1', type: 'tag', href: '/search?q=ankara&type=tag' }),
        'ankara',
      );
      expect(tag.kind).toBe('default');
      expect(tag.to).toBe('/search?q=ankara&type=tag');
    });
  });
});
