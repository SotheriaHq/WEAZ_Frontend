import { useCallback, useId, useMemo, useState } from 'react';
import { MarketListToolbar } from '@/components/market/composed/MarketListToolbar';
import { MarketFacetChipGroup, MarketPriceGroup } from '@/components/market/composed/MarketFilterControls';
import { MarketNotice } from '@/components/market/composed/MarketNotice';
import {
  canAddMarketFilterValue,
  toggleMarketListValue,
  type MarketFilters,
  type MarketListFilterKey,
  type MarketSort,
} from '@/features/market-v2/marketFilterState';
import { useDebouncedMarketFilters } from '@/features/market-v2/useDebouncedMarketFilters';
import {
  SEARCH_PRODUCT_SORTS,
  SEARCH_RELEVANCE_LABEL,
  searchFacetsToMarketFacets,
  type SearchProductState,
} from '@/features/search/searchProductState';
import type { SearchResponse } from '@/types/search';

export interface SearchProductRefineProps {
  readonly results: SearchResponse;
  readonly state: SearchProductState;
  readonly total: number;
  readonly updating: boolean;
  readonly onChange: (next: { filters: MarketFilters; sort: MarketSort | null }) => void;
}

/**
 * Sort, facets and "how we read your search" for product results, from the
 * lexicon search response. Built from the Market toolbar and filter groups so
 * a filter looks and behaves the same in search and in the Market.
 */
export function SearchProductRefine({ results, state, total, updating, onChange }: SearchProductRefineProps) {
  const panelId = useId();
  const [panelOpen, setPanelOpen] = useState(false);
  const facets = useMemo(() => searchFacetsToMarketFacets(results.facets), [results.facets]);
  const sorts = useMemo(
    () => SEARCH_PRODUCT_SORTS.filter((sort) => results.availableSorts?.includes(sort)),
    [results.availableSorts],
  );
  const { filters, sort } = state;
  const commitFilters = useCallback((next: MarketFilters) => onChange({ filters: next, sort }), [onChange, sort]);
  const commitSort = useCallback((next: MarketSort | null) => onChange({ filters, sort: next }), [onChange, filters]);
  const [panelFilters, setPanelFilters] = useDebouncedMarketFilters(filters, commitFilters);
  const canAdd = canAddMarketFilterValue(panelFilters);
  const toggle = (key: MarketListFilterKey) => (value: string) =>
    setPanelFilters(toggleMarketListValue(panelFilters, key, value));

  const understood = results.parsed?.attributes.filter((attribute) => attribute.applied) ?? [];
  const corrections = results.parsed?.corrections.filter((correction) => correction.applied) ?? [];

  return (
    <section aria-label="Refine product results" className="space-y-4">
      {corrections.length > 0 ? (
        <MarketNotice emoji="✍️">
          Showing results for {corrections.map((correction) => `“${correction.to}”`).join(', ')} (you typed{' '}
          {corrections.map((correction) => `“${correction.from}”`).join(', ')}).
        </MarketNotice>
      ) : null}
      {understood.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[color:var(--wiez-text-secondary)]">
            Searching for
          </span>
          <ul className="flex flex-wrap gap-2" aria-label="What we understood from your search">
            {understood.map((attribute) => (
              <li
                key={`${attribute.type}:${attribute.value}`}
                className="wiez-lg-surface wiez-lg-subtle wiez-lg-borderless wiez-lg-tone-brand-soft inline-flex min-h-[28px] items-center rounded-full px-3 text-xs font-bold"
              >
                {attribute.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <MarketListToolbar
        filters={filters}
        facets={facets}
        availableSorts={sorts}
        defaultOrderLabel={SEARCH_RELEVANCE_LABEL}
        sort={sort}
        sortEffective={null}
        total={total}
        updating={updating}
        onFilters={commitFilters}
        onSort={commitSort}
        onOpenFilters={facets ? () => setPanelOpen((open) => !open) : undefined}
      />

      {facets ? (
        <div
          id={panelId}
          className={`${panelOpen ? 'grid' : 'hidden md:grid'} gap-6 rounded-[2rem] bg-[var(--wiez-surface-card,#ffffff)]/70 p-5 sm:grid-cols-2 lg:grid-cols-4 dark:bg-white/5`}
        >
          <MarketPriceGroup
            key={`${panelFilters.priceMin}-${panelFilters.priceMax}`}
            filters={panelFilters}
            facets={facets}
            onChange={setPanelFilters}
          />
          <MarketFacetChipGroup legend="Brand" options={facets.brands} selected={panelFilters.brand} canAdd={canAdd} onToggle={toggle('brand')} />
          <MarketFacetChipGroup legend="Colour" options={facets.colors} selected={panelFilters.color} canAdd={canAdd} onToggle={toggle('color')} />
          <MarketFacetChipGroup legend="Size" options={facets.sizes} selected={panelFilters.size} canAdd={canAdd} onToggle={toggle('size')} />
        </div>
      ) : null}
    </section>
  );
}

export default SearchProductRefine;
