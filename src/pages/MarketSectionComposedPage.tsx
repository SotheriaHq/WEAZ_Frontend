import React, { Suspense, useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AppDispatch, RootState } from '@/store';
import {
  marketV2Api,
  retryMarketV2Request,
  shouldFallBackToClassicMarket,
  type MarketSectionPageResult,
} from '@/api/MarketV2Api';
import { fetchWishlist } from '@/features/wishlistSlice';
import { useScrollRestore } from '@/components/ScrollRestoreProvider';
import { useMarketSignals } from '@/hooks/useMarketSignals';
import { MarketNotice } from '@/components/market/composed/MarketNotice';
import { MarketPagedListSection } from '@/components/market/composed/MarketPagedListSection';
import { MARKET_SECTION_ORDER_LABEL } from '@/components/market/composed/marketCopy';
import { queryKeys } from '@/query/queryKeys';
import { marketFiltersKey } from '@/features/market-v2/marketFilterState';
import { useMarketUrlState } from '@/features/market-v2/useMarketUrlState';
import { useMarketViewerScope } from '@/features/market-v2/useMarketHome';
import { useMarketItemOpener } from '@/features/market-v2/useMarketItemOpener';
import { useMarketPagedList } from '@/features/market-v2/useMarketPagedList';
import { useIsOnline } from '@/features/market-v2/useMarketFreshness';

const LegacyMarketSectionPage = React.lazy(() => import('./MarketSectionPage'));

const FACETS_STALE_TIME_MS = 3 * 60 * 1000;
const asListPage = (page: MarketSectionPageResult) => (page.kind === 'v2' ? page : null);

/**
 * See All for one server section: the section's own order, server sorts,
 * section-scoped facets and keyset paging, through the same list as the
 * Market home. A server that still answers in the established shape (or
 * cannot serve this section on a first load) gets the established page.
 */
export default function MarketSectionComposedPage() {
  const { sectionKey = '' } = useParams<{ sectionKey: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const isAuth = useSelector((state: RootState) => state.user.isAuthenticated);
  const { filters, sort, commit, linkCorrected, dismissLinkCorrection } = useMarketUrlState();
  const { trackMarketSignal, flushMarketSignals, anonymousSessionId } = useMarketSignals('MARKET_SECTION_DETAIL');
  const { viewer, ready } = useMarketViewerScope();
  const anonymous = viewer === 'guest' ? (anonymousSessionId ?? null) : null;
  const filtersKey = marketFiltersKey(filters);
  const scrollKey = `MARKET_SECTION_COMPOSED:${sectionKey}`;
  const { saveScrollPosition } = useScrollRestore(scrollKey);
  const online = useIsOnline();

  const list = useMarketPagedList<MarketSectionPageResult>({
    queryKey: queryKeys.market.v2Section(sectionKey, { filters: filtersKey, sort, viewer, anonymous }),
    enabled: ready && sectionKey.length > 0,
    fetchPage: (cursor, signal) =>
      marketV2Api.getSectionPage(sectionKey, { filters, sort, cursor, anonymousSessionId: anonymous }, { signal }),
    toListPage: asListPage,
  });
  const first = list.firstPage;
  const section = first?.kind === 'v2' ? first.section : null;

  // Facets ride their own request so the first page is never held up by them.
  const facetsQuery = useQuery({
    queryKey: queryKeys.market.v2SectionFacets(sectionKey, { filters: filtersKey, viewer, anonymous }),
    queryFn: ({ signal }) =>
      marketV2Api.getSectionFacets(sectionKey, { filters, anonymousSessionId: anonymous }, { signal }),
    enabled: Boolean(section),
    retry: retryMarketV2Request,
    staleTime: FACETS_STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (isAuth) void dispatch(fetchWishlist({ page: 1, limit: 100 }));
  }, [dispatch, isAuth]);

  const beforeNavigate = useCallback(() => saveScrollPosition(scrollKey, window.scrollY), [saveScrollPosition, scrollKey]);
  const flush = useCallback(() => void flushMarketSignals(), [flushMarketSignals]);
  const { openFor, overlay } = useMarketItemOpener({ track: trackMarketSignal, flush, beforeNavigate });
  const context = useMemo(
    () => ({ surface: 'MARKET_SECTION_DETAIL' as const, sectionKey, epoch: null }),
    [sectionKey],
  );
  const openItem = useMemo(() => openFor(context), [openFor, context]);

  const legacy =
    first?.kind === 'legacy' || (!first && list.error != null && shouldFallBackToClassicMarket(list.error));
  if (legacy) {
    return (
      <Suspense fallback={null}>
        <LegacyMarketSectionPage />
      </Suspense>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-16 pt-5 sm:px-6 sm:pt-7 lg:px-8">
      <header className="mb-6 space-y-3">
        <Link
          to="/market"
          className="inline-flex min-h-[32px] items-center gap-1 rounded-lg text-sm font-bold text-[color:var(--wiez-text-secondary)] hover:text-[color:var(--wiez-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--wiez-border-focus)]"
        >
          <span aria-hidden="true">‹</span> Market
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-[color:var(--wiez-text-primary)] sm:text-4xl">
          {section?.title ?? (list.isLoading ? ' ' : 'Market')}
        </h1>
        {section?.subtitle ? (
          <p className="text-sm font-semibold text-[color:var(--wiez-text-secondary)]">{section.subtitle}</p>
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
        </div>
      </header>

      <MarketPagedListSection
        id="market-section-pieces"
        heading={section ? 'All pieces' : 'Pieces'}
        list={list}
        facets={facetsQuery.data ?? null}
        filters={filters}
        sort={sort}
        commit={commit}
        context={context}
        onOpen={openItem}
        onTrackSignal={trackMarketSignal}
        emptyTitle="Nothing here yet"
        defaultOrderLabel={MARKET_SECTION_ORDER_LABEL}
      />
      {overlay}
    </div>
  );
}
