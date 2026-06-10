import { describe, expect, it } from 'vitest';
import { flattenSuggestionEntries } from '@/components/search/SearchSuggestionDropdown';

describe('search suggestion entries', () => {
  it('prepends an explicit search action for non-empty queries', () => {
    const entries = flattenSuggestionEntries(null, [], 'brown');

    expect(entries[0]).toEqual(
      expect.objectContaining({
        kind: 'search',
        label: 'Search for "brown"',
        href: '/search?q=brown',
        query: 'brown',
      }),
    );
  });

  it('does not add a search action for blank queries', () => {
    const entries = flattenSuggestionEntries(null, [], '');

    expect(entries).toHaveLength(0);
  });

  it('includes profile suggestion entries when returned by the backend', () => {
    const entries = flattenSuggestionEntries(
      {
        query: 'cotour',
        normalizedQuery: 'cotour',
        recent: [],
        trending: [],
        profiles: {
          items: [
            {
              id: 'user-1',
              type: 'profile',
              title: 'Avery Cotour',
              subtitle: '@averycotour',
              href: '/profile/user-1',
              score: 900,
            },
          ],
          total: 1,
        },
        products: { items: [], total: 0 },
        brands: { items: [], total: 0 },
        designs: { items: [], total: 0 },
        storeCollections: { items: [], total: 0 },
        tags: [],
      },
      [],
      'cotour',
    );

    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'profile:user-1',
          label: 'Avery Cotour',
          section: 'Profiles',
          href: '/profile/user-1',
        }),
      ]),
    );
  });
});
