import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { MarketSignalEvent } from '@/api/MarketApi';
import type { MarketFacets } from '@/api/MarketV2Api';
import Button from '@/components/ui/Button';
import { MarketCatalogGrid } from './MarketCatalogGrid';
import { MarketListToolbar } from './MarketListToolbar';
import { MarketFilterControls } from './MarketFilterControls';
import { MarketFilterSheet } from './MarketFilterSheet';
import { MarketNotice } from './MarketNotice';
import type { MarketCardOpen } from './MarketCardCell';
import { MARKET_SORT_LABELS, marketErrorCopy, marketPiecesLabel } from './marketCopy';
import { prefersReducedMotion } from './marketMotion';
import {
  EMPTY_MARKET_FILTERS,
  hasActiveMarketFilters,
  type MarketFilters,
  type MarketSort,
} from '@/features/market-v2/marketFilterState';
import { useDebouncedMarketFilters } from '@/features/market-v2/useDebouncedMarketFilters';
import type { MarketSignalContext } from '@/features/market-v2/marketTelemetry';
import type { MarketPagedList } from '@/features/market-v2/useMarketPagedList';

const GRID_COLUMNS_WITH_PANEL = 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

export interface MarketPagedListSectionProps {
  readonly id: string;
  readonly heading: string;
  readonly headingRef?: RefObject<HTMLHeadingElement | null>;
  readonly list: MarketPagedList<unknown>;
  /** Facets for the filter panel; the list's own first-page facets when omitted. */
  readonly facets?: MarketFacets | null;
  readonly filters: MarketFilters;
  readonly sort: MarketSort | null;
  readonly commit: (next: { filters: MarketFilters; sort: MarketSort | null }) => void;
  readonly context: MarketSignalContext;
  readonly onOpen: MarketCardOpen;
  readonly onTrackSignal: (event: MarketSignalEvent) => void;
  /** Shown when the unfiltered list is empty. */
  readonly emptyTitle?: string;
  /** Label for the list's own order when it has one (see `MarketListToolbar`). */
  readonly defaultOrderLabel?: string;
}

/**
 * One server-ordered, filterable keyset list: notices, toolbar, desktop filter
 * panel, grid and the small-screen filter sheet. The Market home's catalogue
 * and See All both render through it, so they behave the same.
 */
export function MarketPagedListSection({
  id,
  heading,
  headingRef,
  list,
  facets: facetsOverride,
  filters,
  sort,
  commit,
  context,
  onOpen,
  onTrackSignal,
  emptyTitle = 'No pieces yet',
  defaultOrderLabel,
}: MarketPagedListSectionProps) {
  const ownHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const titleRef = headingRef ?? ownHeadingRef;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sortDropped, setSortDropped] = useState<MarketSort | null>(null);
  const facets = facetsOverride === undefined ? list.facets : facetsOverride;

  const commitFilters = useCallback((next: MarketFilters) => commit({ filters: next, sort }), [commit, sort]);
  const commitSort = useCallback(
    (next: MarketSort | null) => {
      setSortDropped(null);
      commit({ filters, sort: next });
    },
    [commit, filters],
  );
  const [panelFilters, setPanelFilters] = useDebouncedMarketFilters(filters, commitFilters);

  // A shared link may carry a sort this list cannot offer; drop it once and say so.
  useEffect(() => {
    if (list.errorKind !== 'unsupported-sort' || !sort) return;
    setSortDropped(sort);
    commit({ filters, sort: null });
  }, [list.errorKind, commit, filters, sort]);

  // When the server restarts the list order, bring the shopper back to its top.
  const restartCount = list.restartCount;
  useEffect(() => {
    if (restartCount === 0) return;
    const title = titleRef.current;
    if (title && title.getBoundingClientRect().top < 0) {
      title.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  }, [restartCount, titleRef]);

  const filtered = hasActiveMarketFilters(filters);
  const errorCopy = marketErrorCopy(list.errorKind);
  const insufficientEvidence = Boolean(sort && list.fallbackReason === 'INSUFFICIENT_EVIDENCE' && list.sortEffective);
  const headingId = `${id}-heading`;

  return (
    <section id={id} aria-labelledby={headingId} className="space-y-5 scroll-mt-24">
      <h2
        id={headingId}
        ref={titleRef}
        tabIndex={-1}
        className="text-xl font-extrabold tracking-tight text-[color:var(--wiez-text-primary)] outline-none sm:text-2xl"
      >
        {heading}
      </h2>
      <div aria-live="polite" className="space-y-2">
        {list.notice ? (
          <MarketNotice emoji="✨" onDismiss={list.dismissNotice}>
            {list.notice === 'Prices updated'
              ? 'Prices updated. The list starts again in the new order.'
              : 'Updated. The list starts again with the latest pieces.'}
          </MarketNotice>
        ) : null}
        {sortDropped ? (
          <MarketNotice emoji="↕️" onDismiss={() => setSortDropped(null)}>
            {MARKET_SORT_LABELS[sortDropped]} is not available here, so the default order is shown.
          </MarketNotice>
        ) : null}
        {insufficientEvidence && sort ? (
          <MarketNotice emoji="📊">
            There is not enough activity yet to sort by {MARKET_SORT_LABELS[sort].toLowerCase()}, so pieces are shown{' '}
            {list.sortEffective === 'newest' ? 'newest first' : 'in the default order'}.
          </MarketNotice>
        ) : null}
      </div>

      <MarketListToolbar
        filters={filters}
        facets={facets}
        availableSorts={list.availableSorts}
        defaultOrderLabel={defaultOrderLabel}
        sort={sort}
        sortEffective={list.sortEffective}
        total={list.total}
        updating={list.isUpdating}
        onFilters={commitFilters}
        onSort={commitSort}
        onOpenFilters={() => setSheetOpen(true)}
      />

      <div className="flex gap-8">
        <aside aria-label="Filters" className="hidden w-64 shrink-0 md:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain pb-6 pr-1">
            <MarketFilterControls filters={panelFilters} facets={facets} onChange={setPanelFilters} />
          </div>
        </aside>
        <div className={`min-w-0 flex-1 transition-opacity motion-reduce:transition-none ${list.isUpdating ? 'opacity-70' : ''}`}>
          {list.errorKind && !list.firstPage ? (
            <div className="space-y-4 rounded-3xl bg-black/[0.04] p-8 text-center dark:bg-white/[0.06]" role="alert">
              <p className="text-base font-bold text-[color:var(--wiez-text-primary)]">{errorCopy.title}</p>
              <p className="text-sm font-semibold text-[color:var(--wiez-text-secondary)]">{errorCopy.body}</p>
              <div className="flex flex-wrap justify-center gap-3">
                {list.errorKind === 'invalid-filter' ? (
                  <Button type="button" size="sm" variant="brand" onClick={() => commitFilters(EMPTY_MARKET_FILTERS)}>
                    Clear filters
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="secondary" onClick={list.retry}>
                    Try again
                  </Button>
                )}
              </div>
            </div>
          ) : list.isPaused && !list.firstPage ? (
            <div className="rounded-3xl bg-black/[0.04] p-8 text-center dark:bg-white/[0.06]" role="status">
              <p className="text-base font-bold text-[color:var(--wiez-text-primary)]">You are offline</p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--wiez-text-secondary)]">Pieces will load when you reconnect.</p>
            </div>
          ) : (
            <MarketCatalogGrid
              items={list.items}
              loading={list.isLoading && !list.firstPage}
              isFetchingNextPage={list.isFetchingNextPage}
              hasNextPage={list.hasNextPage}
              nextPageErrorKind={list.nextPageErrorKind}
              onLoadMore={list.loadMore}
              onRetry={list.retry}
              context={context}
              onTrackSignal={onTrackSignal}
              onOpen={onOpen}
              columnsClassName={GRID_COLUMNS_WITH_PANEL}
              empty={
                <div className="space-y-3 rounded-3xl bg-black/[0.04] p-10 text-center dark:bg-white/[0.06]">
                  <p className="text-base font-bold text-[color:var(--wiez-text-primary)]">
                    {filtered ? 'No pieces match these filters' : emptyTitle}
                  </p>
                  {filtered ? (
                    <Button type="button" size="sm" variant="brand" onClick={() => commitFilters(EMPTY_MARKET_FILTERS)}>
                      Clear filters
                    </Button>
                  ) : null}
                </div>
              }
              exhausted={
                <p className="text-xs font-bold uppercase tracking-widest text-[color:var(--wiez-text-secondary)]">
                  {list.total !== null ? `You have seen all ${marketPiecesLabel(list.total)}` : 'You have seen everything here'}
                </p>
              }
            />
          )}
        </div>
      </div>

      <MarketFilterSheet
        open={sheetOpen}
        filters={filters}
        facets={facets}
        onApply={commitFilters}
        onClose={() => setSheetOpen(false)}
      />
    </section>
  );
}

export default MarketPagedListSection;
