import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EMPTY_MARKET_FILTERS } from '@/features/market-v2/marketFilterState';
import type { SearchResponse } from '@/types/search';
import { SearchProductRefine } from './SearchProductRefine';

/** What a lexicon product search shows above its results. */

const response = (extra: Partial<SearchResponse>): SearchResponse => ({
  query: 'rde dress',
  normalizedQuery: 'red dress',
  types: ['product'],
  items: [],
  counts: { product: 3 } as SearchResponse['counts'],
  meta: { page: 1, limit: 20, hasNextPage: false },
  availableSorts: ['relevance', 'newest', 'popular', 'price_asc', 'price_desc'],
  ...extra,
});

const state = { filters: EMPTY_MARKET_FILTERS, sort: null, filtersParam: '' };

describe('search product refinements', () => {
  it('shows what the search understood and the spelling it corrected, not guesses it did not apply', () => {
    render(
      <SearchProductRefine
        results={response({
          parsed: {
            attributes: [
              { type: 'color', value: 'red', label: 'Red', confidence: 0.95, applied: true },
              { type: 'category', value: 'dress', label: 'Dresses', confidence: 0.9, applied: true },
              { type: 'size', value: 'm', label: 'Size M', confidence: 0.3, applied: false },
            ],
            residual: '',
            corrections: [{ from: 'rde', to: 'red', applied: true }],
          },
        })}
        state={state}
        total={3}
        updating={false}
        onChange={vi.fn()}
      />,
    );

    const understood = screen.getByRole('list', { name: 'What we understood from your search' });
    expect(within(understood).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Red', 'Dresses']);
    expect(screen.queryByText('Size M')).not.toBeInTheDocument();
    expect(screen.getByText(/Showing results for “red” \(you typed “rde”\)/)).toBeInTheDocument();
  });

  it('offers brand, colour and size groups only when the server sent facets', () => {
    const { rerender } = render(
      <SearchProductRefine results={response({})} state={state} total={3} updating={false} onChange={vi.fn()} />,
    );
    expect(screen.queryByRole('group', { name: 'Brand' })).not.toBeInTheDocument();

    rerender(
      <SearchProductRefine
        results={response({
          facets: {
            color: [{ value: 'red', count: 2 }],
            size: [{ value: 'M', count: 1 }],
            brand: [{ id: 'brand-1', name: 'Nuel', count: 3 }],
            price: null,
          },
        })}
        state={state}
        total={3}
        updating={false}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('group', { name: 'Brand' })).toHaveTextContent('Nuel');
    expect(screen.getByRole('group', { name: 'Colour' })).toHaveTextContent('red');
    expect(screen.getByRole('group', { name: 'Size' })).toHaveTextContent('M');
  });
});
