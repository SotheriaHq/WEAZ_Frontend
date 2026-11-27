import type { MarketFacetOption, MarketFacets } from '@/api/MarketV2Api';
import {
  EMPTY_MARKET_FILTERS,
  marketFiltersKey,
  parseMarketUrlState,
  type MarketFilters,
  type MarketSort,
} from '@/features/market-v2/marketFilterState';
import type { SearchProductFacets } from '@/types/search';

/**
 * Product search refinements on `/search`.
 *
 * The search page already uses `type` for its entity tab, which is also a
 * catalogue filter key, so the filters travel in ONE `filters` parameter
 * holding the exact canonical encoding the search API takes. `sort` is its
 * own parameter; no sort means the server's relevance order.
 */

/** Search sorts the Market sort menu can show; relevance is the default. */
export const SEARCH_PRODUCT_SORTS: readonly MarketSort[] = ['newest', 'popular', 'price_asc', 'price_desc'];

export const SEARCH_RELEVANCE_LABEL = 'Best match';

export interface SearchProductState {
  readonly filters: MarketFilters;
  readonly sort: MarketSort | null;
  /** Canonical encoding for the API; empty when nothing is filtered. */
  readonly filtersParam: string;
}

export function readSearchProductState(params: URLSearchParams): SearchProductState {
  const raw = params.get('filters');
  const filters = raw ? parseMarketUrlState(new URLSearchParams(raw)).filters : EMPTY_MARKET_FILTERS;
  const rawSort = params.get('sort');
  const sort = rawSort && SEARCH_PRODUCT_SORTS.includes(rawSort as MarketSort) ? (rawSort as MarketSort) : null;
  return { filters, sort, filtersParam: marketFiltersKey(filters) };
}

/** Writes the refinements into `base`, keeping `q`, `type` and anything else. */
export function writeSearchProductState(
  base: URLSearchParams,
  next: { filters: MarketFilters; sort: MarketSort | null },
): URLSearchParams {
  const params = new URLSearchParams(base);
  const encoded = marketFiltersKey(next.filters);
  if (encoded) params.set('filters', encoded);
  else params.delete('filters');
  if (next.sort) params.set('sort', next.sort);
  else params.delete('sort');
  return params;
}

export function clearSearchProductState(base: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(base);
  params.delete('filters');
  params.delete('sort');
  return params;
}

const option = (value: string, label: string, count: number): MarketFacetOption => ({
  value,
  label,
  count,
  disabled: count === 0,
  categoryId: null,
});

/**
 * Search facets in the Market facet shape, so the Market toolbar and filter
 * groups render them. Search counts colour, size, brand and price only; the
 * other groups stay empty and are not shown.
 */
export function searchFacetsToMarketFacets(facets: SearchProductFacets | undefined): MarketFacets | null {
  if (!facets) return null;
  return {
    audience: [],
    categories: [],
    categoryTypes: [],
    brands: facets.brand.map((brand) => option(brand.id, brand.name, brand.count)),
    tags: [],
    colors: facets.color.map((color) => option(color.value, color.value, color.count)),
    sizes: facets.size.map((size) => option(size.value, size.value, size.count)),
    fulfilment: [],
    onSale: [],
    inStockOnly: [],
    dimensions: [],
    price: facets.price ? { min: facets.price.min, max: facets.price.max, count: 0, bands: [] } : null,
    customFitCount: null,
  };
}
