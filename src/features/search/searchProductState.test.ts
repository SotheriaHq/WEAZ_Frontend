import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_MARKET_FILTERS } from '@/features/market-v2/marketFilterState';
import type { SearchProductFacets, SearchRequestParams, SearchResponse } from '@/types/search';
import {
  clearSearchProductState,
  readSearchProductState,
  searchFacetsToMarketFacets,
  writeSearchProductState,
} from './searchProductState';

const search = vi.fn<(params: SearchRequestParams, signal?: AbortSignal) => Promise<SearchResponse>>();
vi.mock('@/api/SearchApi', () => ({ default: { search: (...args: Parameters<typeof search>) => search(...args) } }));

const { default: useSearch } = await import('@/hooks/useSearch');

/** Garment types travel by category-type id. */
const GOWN_TYPE_ID = '3f1c2b4a-5d6e-4f70-8a91-b2c3d4e5f607';

describe('product search refinements in the URL', () => {
  it('keeps the entity tab apart from the garment-type filter', () => {
    const base = new URLSearchParams('q=red+dress&type=product');
    const written = writeSearchProductState(base, {
      filters: { ...EMPTY_MARKET_FILTERS, color: ['red'], type: [GOWN_TYPE_ID] },
      sort: 'price_asc',
    });

    expect(written.get('q')).toBe('red dress');
    expect(written.get('type')).toBe('product');
    const read = readSearchProductState(written);
    expect(read.filters.color).toEqual(['red']);
    expect(read.filters.type).toEqual([GOWN_TYPE_ID]);
    expect(read.sort).toBe('price_asc');
    expect(read.filtersParam).not.toBe('');
  });

  it('never reads the tab as a filter, and drops sorts search cannot serve', () => {
    const read = readSearchProductState(new URLSearchParams('q=bag&type=product&sort=trending'));
    expect(read.filters).toEqual(EMPTY_MARKET_FILTERS);
    expect(read.sort).toBeNull();
    expect(read.filtersParam).toBe('');
  });

  it('removes empty refinements and clears them for a new search', () => {
    const base = new URLSearchParams('q=bag&filters=color%3Dred&sort=newest');
    const emptied = writeSearchProductState(base, { filters: EMPTY_MARKET_FILTERS, sort: null });
    expect(emptied.has('filters')).toBe(false);
    expect(emptied.has('sort')).toBe(false);
    expect(clearSearchProductState(base).toString()).toBe('q=bag');
  });
});

describe('search facets in the Market shape', () => {
  const facets: SearchProductFacets = {
    color: [{ value: 'red', count: 4 }],
    size: [{ value: 'M', count: 0 }],
    brand: [{ id: 'brand-1', name: 'Nuel', count: 2 }],
    price: { min: 5000, max: 90000, p30: 12000, p60: 30000 },
  };

  it('labels brands by name, keeps ids as values and disables empty values', () => {
    const market = searchFacetsToMarketFacets(facets)!;
    expect(market.brands).toEqual([{ value: 'brand-1', label: 'Nuel', count: 2, disabled: false, categoryId: null }]);
    expect(market.colors[0]).toMatchObject({ value: 'red', count: 4, disabled: false });
    expect(market.sizes[0]).toMatchObject({ value: 'M', disabled: true });
    expect(market.price).toEqual({ min: 5000, max: 90000, count: 0, bands: [] });
    expect(market.categories).toEqual([]);
    expect(market.fulfilment).toEqual([]);
  });

  it('has nothing to show when the server sent no facets', () => {
    expect(searchFacetsToMarketFacets(undefined)).toBeNull();
  });
});

describe('useSearch with refinements', () => {
  const page = (n: number, extra: Partial<SearchResponse>): SearchResponse => ({
    query: 'red dress',
    normalizedQuery: 'red dress',
    types: ['product'],
    items: [{ id: `p${n}`, type: 'product', title: `Piece ${n}`, href: `/p/${n}`, score: 1 }],
    counts: { product: 2 } as SearchResponse['counts'],
    meta: { page: n, limit: 1, hasNextPage: n === 1 },
    ...extra,
  });

  beforeEach(() => search.mockReset());

  it('asks for facets on the first page only and keeps them while loading more', async () => {
    const facets: SearchProductFacets = { color: [{ value: 'red', count: 2 }], size: [], brand: [], price: null };
    search
      .mockResolvedValueOnce(page(1, { facets, availableSorts: ['relevance', 'newest'] }))
      .mockResolvedValueOnce(page(2, {}));
    const { result } = renderHook(() =>
      useSearch({ query: 'red dress', type: 'product', limit: 1, sort: 'newest', filters: 'color=red', includeFacets: true }),
    );

    await waitFor(() => expect(result.current.results?.items).toHaveLength(1));
    expect(search.mock.calls[0][0]).toMatchObject({ sort: 'newest', filters: 'color=red', includeFacets: '1', page: 1 });

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.results?.items).toHaveLength(2));
    expect(search.mock.calls[1][0]).toMatchObject({ page: 2, sort: 'newest', filters: 'color=red' });
    expect(search.mock.calls[1][0]).not.toHaveProperty('includeFacets');
    expect(result.current.results?.facets).toEqual(facets);
    expect(result.current.results?.availableSorts).toEqual(['relevance', 'newest']);
  });

  it('sends no refinement parameters when none are set', async () => {
    search.mockResolvedValueOnce(page(1, {}));
    renderHook(() => useSearch({ query: 'bag', type: 'all' }));
    await waitFor(() => expect(search).toHaveBeenCalled());
    const params = search.mock.calls[0][0];
    expect(params).not.toHaveProperty('sort');
    expect(params).not.toHaveProperty('filters');
    expect(params).not.toHaveProperty('includeFacets');
  });
});
