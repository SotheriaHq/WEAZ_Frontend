import { useMemo, useRef } from 'react';
import type { MarketFacets } from '@/api/MarketV2Api';
import UniversalSelect from '@/components/forms/UniversalSelect';
import {
  countActiveMarketFilters,
  EMPTY_MARKET_FILTERS,
  type MarketFilters,
  type MarketSort,
} from '@/features/market-v2/marketFilterState';
import { describeAppliedMarketFilters } from '@/features/market-v2/appliedFilters';
import { MARKET_SORT_LABELS, marketPiecesLabel } from './marketCopy';

export interface MarketListToolbarProps {
  filters: MarketFilters;
  facets: MarketFacets | null;
  /** Sort menu from the list's first page. */
  availableSorts: readonly MarketSort[];
  /** The sort in the URL, if the shopper chose one. */
  sort: MarketSort | null;
  /** The sort the server actually applied. */
  sortEffective: string | null;
  /**
   * A list with its own order (a See All section, search relevance) offers it
   * first under this label; it is what "no sort" means there.
   */
  defaultOrderLabel?: string;
  total: number | null;
  updating: boolean;
  onFilters: (next: MarketFilters) => void;
  onSort: (next: MarketSort | null) => void;
  /** Opens the phone/tablet sheet; omitted when there is nothing to filter. */
  onOpenFilters?: () => void;
}

/**
 * Count, sort and the applied-filter chips above a list. Removing a chip or
 * clearing all keeps focus on the toolbar so keyboard users do not lose
 * their place; the count is announced politely once a change settles.
 */
export function MarketListToolbar({
  filters,
  facets,
  availableSorts,
  sort,
  sortEffective,
  defaultOrderLabel,
  total,
  updating,
  onFilters,
  onSort,
  onOpenFilters,
}: MarketListToolbarProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  /** Keep keyboard focus in the toolbar after a chip it was on disappears. */
  const refocus = () =>
    requestAnimationFrame(() => {
      const root = rootRef.current;
      (root?.querySelector<HTMLElement>('[data-applied-filter]') ?? root)?.focus();
    });
  const applied = useMemo(() => describeAppliedMarketFilters(filters, facets), [facets, filters]);
  const activeCount = countActiveMarketFilters(filters);
  const sortOptions = useMemo(() => {
    const options = availableSorts.map((value) => ({ value, label: MARKET_SORT_LABELS[value] }));
    return defaultOrderLabel ? [{ value: '', label: defaultOrderLabel }, ...options] : options;
  }, [availableSorts, defaultOrderLabel]);
  const effective =
    sort ?? (sortEffective && sortOptions.some((option) => option.value === sortEffective) ? sortEffective : '');
  const sortValue = sortOptions.some((option) => option.value === effective) ? effective : sortOptions[0]?.value ?? '';

  return (
    <div ref={rootRef} tabIndex={-1} className="space-y-3 outline-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-h-[1.25rem] text-sm font-semibold text-[color:var(--wiez-text-secondary)]" aria-live="polite">
          {total !== null && !updating ? marketPiecesLabel(total) : updating ? 'Updating…' : ''}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {onOpenFilters ? (
            <button
              type="button"
              onClick={onOpenFilters}
              className="wiez-lg-surface wiez-lg-subtle wiez-lg-borderless wiez-lg-interactive inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3.5 text-xs font-bold md:hidden"
            >
              <span aria-hidden="true">🎛️</span>
              Sort &amp; filter
              {activeCount > 0 ? (
                <span className="rounded-full bg-purple-600 px-1.5 text-[11px] font-bold text-white">{activeCount}</span>
              ) : null}
            </button>
          ) : null}
          {sortOptions.length > 1 ? (
            <div className="w-[13.5rem]">
              <UniversalSelect
                label="Sort by"
                value={sortValue}
                options={sortOptions}
                size="sm"
                searchable={false}
                onChange={(value) => onSort(value ? (value as MarketSort) : null)}
              />
            </div>
          ) : null}
        </div>
      </div>

      {applied.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Applied filters" role="group">
          {applied.map((entry) => (
            <button
              key={entry.id}
              data-applied-filter=""
              type="button"
              onClick={() => {
                onFilters(entry.remove(filters));
                refocus();
              }}
              aria-label={`Remove ${entry.label}`}
              className="wiez-lg-surface wiez-lg-subtle wiez-lg-borderless wiez-lg-tone-brand-soft inline-flex min-h-[32px] items-center gap-1.5 rounded-full px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--wiez-border-focus)]"
            >
              <span className="break-words">{entry.label}</span>
              <span aria-hidden="true">×</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              onFilters(EMPTY_MARKET_FILTERS);
              refocus();
            }}
            className="rounded-full px-2 py-1 text-xs font-bold text-purple-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--wiez-border-focus)] dark:text-purple-300"
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default MarketListToolbar;
