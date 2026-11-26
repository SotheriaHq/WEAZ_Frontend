import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import type { AppDispatch, RootState } from '@/store';
import type { MarketV2Section } from '@/api/MarketV2Api';
import { fetchWishlist } from '@/features/wishlistSlice';
import SearchBarWithSuggestions from '@/components/search/SearchBarWithSuggestions';
import Button from '@/components/ui/Button';
import ProductCardSkeleton from '@/components/designs/ProductCardSkeleton';
import { useScrollRestore } from '@/components/ScrollRestoreProvider';
import { useMarketSignals } from '@/hooks/useMarketSignals';
import { MarketComposedRail } from '@/components/market/composed/MarketComposedRail';
import { MarketCuratedHero } from '@/components/market/composed/MarketCuratedHero';
import { MarketCatalogGrid } from '@/components/market/composed/MarketCatalogGrid';
import { MarketListToolbar } from '@/components/market/composed/MarketListToolbar';
import { MarketFilterControls, MarketFilterChip } from '@/components/market/composed/MarketFilterControls';
import { MarketFilterSheet } from '@/components/market/composed/MarketFilterSheet';
import { MarketNotice } from '@/components/market/composed/MarketNotice';
import { MARKET_SORT_LABELS, marketErrorCopy, marketPiecesLabel } from '@/components/market/composed/marketCopy';
import { prefersReducedMotion } from '@/components/market/composed/marketMotion';
import {
  EMPTY_MARKET_FILTERS,
  hasActiveMarketFilters,
  serializeMarketUrlState,
  type MarketAudience,
  type MarketFilters,
  type MarketSort,
} from '@/features/market-v2/marketFilterState';
import { useMarketUrlState } from '@/features/market-v2/useMarketUrlState';
import { useMarketHome } from '@/features/market-v2/useMarketHome';
import { useMarketItemOpener } from '@/features/market-v2/useMarketItemOpener';
import { useDebouncedMarketFilters } from '@/features/market-v2/useDebouncedMarketFilters';
import { useIsOnline, useStaleOnReturn } from '@/features/market-v2/useMarketFreshness';
import { marketAudienceLabel } from '@/features/market-v2/appliedFilters';

const LegacyMarketPlace = React.lazy(() => import('./MarketPlace'));

const SCROLL_KEY = 'MARKET_PLACE_COMPOSED';
const AUDIENCES: MarketAudience[] = ['MEN', 'WOMEN', 'UNISEX'];
const GRID_COLUMNS_WITH_PANEL = 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';

function SectionsSkeleton() {
  return (
    <div className="space-y-12" aria-hidden="true">
      {[0, 1].map((row) => (
        <div key={row} className="space-y-4">
          <div className="h-6 w-48 rounded-lg bg-gray-200 motion-safe:animate-pulse dark:bg-white/10" />
          <div className="flex gap-3.5 overflow-hidden sm:gap-4">
            {[0, 1, 2, 3, 4].map((card) => (
              <div key={card} className="w-[calc((100%-1.75rem)/2.3)] shrink-0 sm:w-[220px] lg:w-[236px]">
                <ProductCardSkeleton />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Market home, composed by the server: its sections in its order (D-05 rails
 * arrive as server sections), the catalogue with server sorts and facets, and
 * URL state for filters and sort. Two requests, in parallel. When the server
 * cannot serve the composed home on a first load, the established Market
 * renders instead.
 */
export default function MarketComposedPage() {
  const url = useMarketUrlState();
  const signals = useMarketSignals('MARKET_HOME');
  const home = useMarketHome({
    filters: url.filters,
    sort: url.sort,
    anonymousSessionId: signals.anonymousSessionId ?? null,
  });

  if (home.fallback) {
    return (
      <Suspense fallback={<div className="mx-auto w-full max-w-[1440px] px-4 pt-7 sm:px-6 lg:px-8"><SectionsSkeleton /></div>}>
        <LegacyMarketPlace />
      </Suspense>
    );
  }
  return <MarketComposedHome url={url} signals={signals} home={home} />;
}

function MarketComposedHome({
  url,
  signals,
  home,
}: {
  url: ReturnType<typeof useMarketUrlState>;
  signals: ReturnType<typeof useMarketSignals>;
  home: ReturnType<typeof useMarketHome>;
}) {
  const dispatch = useDispatch<AppDispatch>();
  const isAuth = useSelector((state: RootState) => state.user.isAuthenticated);
  const { filters, sort, commit, linkCorrected, dismissLinkCorrection } = url;
  const { trackMarketSignal, flushMarketSignals } = signals;
  const { page, catalog } = home;
  const { saveScrollPosition } = useScrollRestore(SCROLL_KEY);
  const online = useIsOnline();
  const gridHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sortDropped, setSortDropped] = useState<MarketSort | null>(null);
  const stale = useStaleOnReturn(Math.min(home.pageUpdatedAt || Infinity, catalog.dataUpdatedAt || Infinity) || 0);

  useEffect(() => {
    if (isAuth) void dispatch(fetchWishlist({ page: 1, limit: 100 }));
  }, [dispatch, isAuth]);

  const beforeNavigate = useCallback(() => saveScrollPosition(SCROLL_KEY, window.scrollY), [saveScrollPosition]);
  const flush = useCallback(() => void flushMarketSignals(), [flushMarketSignals]);
  const { openFor, overlay } = useMarketItemOpener({ track: trackMarketSignal, flush, beforeNavigate });
  const openSection = useCallback(
    (section: MarketV2Section) =>
      openFor({ surface: 'MARKET_HOME', sectionKey: section.key, epoch: page?.epoch ?? null, policyVersion: section.policyVersion }),
    [openFor, page?.epoch],
  );
  const openCatalogItem = useMemo(
    () => openFor({ surface: 'MARKET_HOME', sectionKey: 'catalog', epoch: page?.epoch ?? null }),
    [openFor, page?.epoch],
  );
  const catalogContext = useMemo(
    () => ({ surface: 'MARKET_HOME' as const, sectionKey: 'catalog', epoch: page?.epoch ?? null }),
    [page?.epoch],
  );

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
    if (catalog.errorKind !== 'unsupported-sort' || !sort) return;
    setSortDropped(sort);
    commit({ filters, sort: null });
  }, [catalog.errorKind, commit, filters, sort]);

  // When the server restarts the list order, bring the shopper back to its top.
  const restartCount = catalog.restartCount;
  useEffect(() => {
    if (restartCount === 0) return;
    const heading = gridHeadingRef.current;
    if (heading && heading.getBoundingClientRect().top < 0) {
      heading.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  }, [restartCount]);

  const setAudience = (value: MarketAudience | null) =>
    commitFilters({ ...filters, audience: value ? [value] : [] });
  const selectedAudience = filters.audience.length === 1 ? filters.audience[0] : null;
  const categoryChips = (catalog.facets?.categories ?? []).filter((option) => option.count >= 2);
  const categoryHref = (id: string) => {
    const query = serializeMarketUrlState({ filters: { ...EMPTY_MARKET_FILTERS, audience: filters.audience, category: [id] }, sort: null });
    return `/market?${query.toString()}`;
  };

  const sections = page?.sections ?? [];
  const hero = sections[0]?.template === 'CURATED_LIST' && sections[0].items.length > 0 ? sections[0] : null;
  const filtered = hasActiveMarketFilters(filters);
  const refresh = () => {
    home.retryPage();
    catalog.refresh();
  };
  const catalogCopy = marketErrorCopy(catalog.errorKind);
  const pageCopy = marketErrorCopy(home.pageErrorKind);
  const emptyMarket = !filtered && catalog.total === 0 && sections.length === 0 && !catalog.isLoading && !home.pageLoading;
  const insufficientEvidence = Boolean(sort && catalog.fallbackReason === 'INSUFFICIENT_EVIDENCE' && catalog.sortEffective);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-5 sm:px-6 sm:pt-7 lg:px-8">
      <div className="space-y-8 sm:space-y-10">
        <header className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <h1 className="text-3xl font-extrabold tracking-tight text-[color:var(--wiez-text-primary)] sm:text-4xl">Market</h1>
            <div className="w-full lg:max-w-md">
              <SearchBarWithSuggestions placeholder="Search designers, Aso-Oke, trench…" className="w-full" />
            </div>
          </div>

          <div role="group" aria-label="Audience" className="flex min-h-[40px] items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <MarketFilterChip label="All" pressed={filters.audience.length === 0} onToggle={() => setAudience(null)} />
            {AUDIENCES.map((value) => (
              <MarketFilterChip
                key={value}
                label={marketAudienceLabel(value)}
                pressed={selectedAudience === value}
                onToggle={() => setAudience(selectedAudience === value ? null : value)}
              />
            ))}
          </div>

          {categoryChips.length > 0 ? (
            <nav aria-label="Shop by category" className="flex min-h-[40px] items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {categoryChips.slice(0, 12).map((option) => (
                <Link
                  key={option.value}
                  to={categoryHref(option.value)}
                  onClick={() => requestAnimationFrame(() => gridHeadingRef.current?.focus())}
                  className="inline-flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-full bg-black/[0.05] px-3 text-xs font-bold text-[color:var(--wiez-text-primary)] hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--wiez-border-focus)] dark:bg-white/10 dark:hover:bg-white/15"
                >
                  {option.label}
                  <span className="tabular-nums text-[11px] text-[color:var(--wiez-text-secondary)]">{option.count}</span>
                </Link>
              ))}
            </nav>
          ) : null}

          <div aria-live="polite" className="space-y-2">
            {!online ? (
              <MarketNotice emoji="📡" tone="warning">
                You are offline. Showing what already loaded; new pieces appear when you reconnect.
              </MarketNotice>
            ) : null}
            {linkCorrected ? (
              <MarketNotice emoji="🔗" onDismiss={dismissLinkCorrection}>
                Some filters in this link could not be used, so they were removed.
              </MarketNotice>
            ) : null}
            {stale && online ? (
              <MarketNotice emoji="🔄" actionLabel="Refresh" onAction={refresh}>
                New pieces may be available.
              </MarketNotice>
            ) : null}
            {page?.partial ? (
              <MarketNotice emoji="🧩">Some sections could not load just now.</MarketNotice>
            ) : null}
          </div>
          {filtered ? (
            <a href="#market-all-pieces" className="sr-only focus:not-sr-only focus:text-sm focus:font-bold">
              Skip to matching pieces
            </a>
          ) : null}
        </header>

        {emptyMarket ? (
          <div className="rounded-3xl bg-purple-50/70 p-10 text-center dark:bg-white/[0.04]">
            <p className="text-3xl" aria-hidden="true">🧵</p>
            <h2 className="mt-3 text-xl font-extrabold text-[color:var(--wiez-text-primary)]">Market opens soon</h2>
            <p className="mt-2 text-sm font-semibold text-[color:var(--wiez-text-secondary)]">
              Follow designers on the Runway to be first when their pieces go on sale.
            </p>
            <Link to="/runway" className="mt-5 inline-flex rounded-xl px-4 py-2 text-sm font-bold text-purple-700 underline-offset-4 hover:underline dark:text-purple-300">
              Explore the Runway
            </Link>
          </div>
        ) : null}

        {home.pageLoading ? (
          <SectionsSkeleton />
        ) : home.pageErrorKind && !page ? (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-black/[0.04] px-4 py-3 dark:bg-white/[0.06]" role="alert">
            <span className="min-w-0 flex-1 text-sm font-semibold text-[color:var(--wiez-text-secondary)]">
              {pageCopy.title}. {pageCopy.body}
            </span>
            <Button type="button" size="sm" variant="secondary" onClick={home.retryPage}>
              Try again
            </Button>
          </div>
        ) : sections.length > 0 ? (
          <div className="space-y-12 sm:space-y-14">
            {hero ? (
              <MarketCuratedHero section={hero} epoch={page?.epoch ?? null} onOpen={openSection} onTrackSignal={trackMarketSignal} />
            ) : null}
            {sections.map((section) =>
              section === hero && section.items.length < 2 ? null : (
                <MarketComposedRail
                  key={section.key}
                  section={section}
                  epoch={page?.epoch ?? null}
                  startIndex={section === hero ? 1 : 0}
                  onOpen={openSection}
                  onViewAll={beforeNavigate}
                  onTrackSignal={trackMarketSignal}
                />
              ),
            )}
          </div>
        ) : null}

        {emptyMarket ? null : (
          <section id="market-all-pieces" aria-labelledby="market-all-pieces-heading" className="space-y-5 scroll-mt-24">
            <h2
              id="market-all-pieces-heading"
              ref={gridHeadingRef}
              tabIndex={-1}
              className="text-xl font-extrabold tracking-tight text-[color:var(--wiez-text-primary)] outline-none sm:text-2xl"
            >
              {filtered ? 'Matching pieces' : 'All pieces'}
            </h2>
            <div aria-live="polite" className="space-y-2">
              {catalog.notice ? (
                <MarketNotice emoji="✨" onDismiss={catalog.dismissNotice}>
                  {catalog.notice === 'Prices updated' ? 'Prices updated. The list starts again in the new order.' : 'Updated. The list starts again with the latest pieces.'}
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
                  {catalog.sortEffective === 'newest' ? 'newest first' : 'in the default order'}.
                </MarketNotice>
              ) : null}
            </div>

            <MarketListToolbar
              filters={filters}
              facets={catalog.facets}
              availableSorts={catalog.availableSorts}
              sort={sort}
              sortEffective={catalog.sortEffective}
              total={catalog.total}
              updating={catalog.isUpdating}
              onFilters={commitFilters}
              onSort={commitSort}
              onOpenFilters={() => setSheetOpen(true)}
            />

            <div className="flex gap-8">
              <aside aria-label="Filters" className="hidden w-64 shrink-0 md:block">
                <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain pb-6 pr-1">
                  <MarketFilterControls filters={panelFilters} facets={catalog.facets} onChange={setPanelFilters} />
                </div>
              </aside>
              <div className={`min-w-0 flex-1 transition-opacity motion-reduce:transition-none ${catalog.isUpdating ? 'opacity-70' : ''}`}>
                {catalog.errorKind && !catalog.firstPage ? (
                  <div className="space-y-4 rounded-3xl bg-black/[0.04] p-8 text-center dark:bg-white/[0.06]" role="alert">
                    <p className="text-base font-bold text-[color:var(--wiez-text-primary)]">{catalogCopy.title}</p>
                    <p className="text-sm font-semibold text-[color:var(--wiez-text-secondary)]">{catalogCopy.body}</p>
                    <div className="flex flex-wrap justify-center gap-3">
                      {catalog.errorKind === 'invalid-filter' ? (
                        <Button type="button" size="sm" variant="brand" onClick={() => commitFilters(EMPTY_MARKET_FILTERS)}>
                          Clear filters
                        </Button>
                      ) : (
                        <Button type="button" size="sm" variant="secondary" onClick={catalog.retry}>
                          Try again
                        </Button>
                      )}
                    </div>
                  </div>
                ) : catalog.isPaused && !catalog.firstPage ? (
                  <div className="rounded-3xl bg-black/[0.04] p-8 text-center dark:bg-white/[0.06]" role="status">
                    <p className="text-base font-bold text-[color:var(--wiez-text-primary)]">You are offline</p>
                    <p className="mt-1 text-sm font-semibold text-[color:var(--wiez-text-secondary)]">Pieces will load when you reconnect.</p>
                  </div>
                ) : (
                  <MarketCatalogGrid
                    items={catalog.items}
                    loading={catalog.isLoading && !catalog.firstPage}
                    isFetchingNextPage={catalog.isFetchingNextPage}
                    hasNextPage={catalog.hasNextPage}
                    nextPageErrorKind={catalog.nextPageErrorKind}
                    onLoadMore={catalog.loadMore}
                    onRetry={catalog.retry}
                    context={catalogContext}
                    onTrackSignal={trackMarketSignal}
                    onOpen={openCatalogItem}
                    columnsClassName={GRID_COLUMNS_WITH_PANEL}
                    empty={
                      <div className="space-y-3 rounded-3xl bg-black/[0.04] p-10 text-center dark:bg-white/[0.06]">
                        <p className="text-base font-bold text-[color:var(--wiez-text-primary)]">
                          {filtered ? 'No pieces match these filters' : 'No pieces yet'}
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
                        {catalog.total !== null ? `You have seen all ${marketPiecesLabel(catalog.total)}` : 'You have seen everything here'}
                      </p>
                    }
                  />
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      <MarketFilterSheet
        open={sheetOpen}
        filters={filters}
        facets={catalog.facets}
        onApply={commitFilters}
        onClose={() => setSheetOpen(false)}
      />
      {overlay}
    </div>
  );
}
