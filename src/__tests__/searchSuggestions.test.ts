import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SearchBarWithSuggestions from '@/components/search/SearchBarWithSuggestions';
import { flattenSuggestionEntries } from '@/components/search/SearchSuggestionDropdown';
import type { SearchSuggestionResponse } from '@/types/search';

const { storeRecentSearchMock, useSearchSuggestionsMock } = vi.hoisted(() => ({
  storeRecentSearchMock: vi.fn(),
  useSearchSuggestionsMock: vi.fn(),
}));

vi.mock('@/hooks/useSearchSuggestions', () => ({
  default: useSearchSuggestionsMock,
}));

vi.mock('@/lib/searchHistory', () => ({
  getRecentSearches: vi.fn(() => []),
  storeRecentSearch: storeRecentSearchMock,
}));

const profileSuggestions: SearchSuggestionResponse = {
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
};

const renderSearchBar = ({
  onNavigate = vi.fn(),
  onSubmitQuery,
}: {
  onNavigate?: (href: string) => void;
  onSubmitQuery?: (query: string) => void;
} = {}) => {
  render(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(SearchBarWithSuggestions, {
        collapsible: false,
        onNavigate,
        onSubmitQuery,
      }),
    ),
  );
  return {
    input: screen.getByRole('combobox', { name: 'Global search' }),
    onNavigate,
  };
};

describe('SearchBarWithSuggestions keyboard behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSearchSuggestionsMock.mockReturnValue({
      suggestions: profileSuggestions,
      isLoading: false,
      error: null,
    });
  });

  it('keeps the combobox aria-expanded state aligned when Escape closes the listbox', async () => {
    const user = userEvent.setup();
    const { input } = renderSearchBar();

    await user.type(input, 'cotour');

    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Search for "cotour"/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Avery Cotour/i })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).not.toHaveAttribute('aria-controls');
    expect(input).not.toHaveAttribute('aria-activedescendant');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('routes the active profile suggestion when Enter is pressed', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const { input } = renderSearchBar({ onNavigate });

    await user.type(input, 'cotour');
    await user.keyboard('{ArrowDown}{ArrowDown}');

    const profileOption = screen.getByRole('option', { name: /Avery Cotour/i });
    await waitFor(() => {
      expect(profileOption).toHaveAttribute('aria-selected', 'true');
    });
    expect(input).toHaveAttribute('aria-activedescendant', profileOption.id);

    await user.keyboard('{Enter}');

    expect(onNavigate).toHaveBeenCalledWith('/profile/user-1');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('submits the generic search when Enter is pressed without a selected suggestion', async () => {
    const user = userEvent.setup();
    const onSubmitQuery = vi.fn();
    const { input } = renderSearchBar({ onSubmitQuery });

    await user.type(input, 'cotour');
    await user.keyboard('{Enter}');

    expect(onSubmitQuery).toHaveBeenCalledWith('cotour');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('keeps profile suggestions clickable without blur closing the dropdown first', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderSearchBar({ onNavigate });

    await user.type(screen.getByRole('combobox', { name: 'Global search' }), 'cotour');
    await user.click(screen.getByRole('option', { name: /Avery Cotour/i }));

    expect(onNavigate).toHaveBeenCalledWith('/profile/user-1');
  });
});

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

  it('keeps the fallback search action when legacy suggestion payloads omit profile sections', () => {
    const entries = flattenSuggestionEntries(
      {
        query: 'cotour',
        normalizedQuery: 'cotour',
        recent: [],
        trending: [],
        products: { items: [], total: 0 },
        brands: { items: [], total: 0 },
        designs: { items: [], total: 0 },
        storeCollections: { items: [], total: 0 },
        tags: [],
      } as unknown as SearchSuggestionResponse,
      [],
      'cotour',
    );

    expect(entries).toEqual([
      expect.objectContaining({
        kind: 'search',
        label: 'Search for "cotour"',
        href: '/search?q=cotour',
      }),
    ]);
  });
});
