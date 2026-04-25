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
});
