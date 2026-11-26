import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { useAuth } from '@/context/AuthContext';
import {
  marketV2Api,
  marketV2ErrorKind,
  retryMarketV2Request,
  shouldFallBackToClassicMarket,
  type MarketV2ListPage,
  type MarketV2PageResponse,
} from '@/api/MarketV2Api';
import { queryKeys } from '@/query/queryKeys';
import { marketFiltersKey, type MarketFilters, type MarketSort } from './marketFilterState';
import {
  isMarketHomeV2KnownUnavailable,
  markMarketHomeV2Unavailable,
  MARKET_V2_BUSY_TTL_MS,
  MARKET_V2_UNAVAILABLE_TTL_MS,
} from './marketV2Availability';
import { useMarketPagedList, type MarketPagedList } from './useMarketPagedList';

const identityPage = (page: MarketV2ListPage) => page;
const PAGE_STALE_TIME_MS = 3 * 60 * 1000;

/**
 * Viewer scope for cached Market responses. The server applies the viewer's
 * hidden items, so a response must never be served to a different account.
 */
export function useMarketViewerScope(): { viewer: string; ready: boolean } {
  const userId = useSelector((state: RootState) => state.user.profile?.id ?? null);
  const { loading } = useAuth();
  // While a stored session is being restored the request would go out as a
  // guest; wait for it so the first request is the right one.
  return { viewer: userId ?? 'guest', ready: !loading };
}

export interface MarketHome {
  /** The established Market must render instead (server switched off or unable to serve). */
  readonly fallback: boolean;
  readonly page: MarketV2PageResponse | undefined;
  readonly pageLoading: boolean;
  readonly pagePaused: boolean;
  readonly pageErrorKind: ReturnType<typeof marketV2ErrorKind> | null;
  readonly pageUpdatedAt: number;
  readonly retryPage: () => void;
  readonly catalog: MarketPagedList<MarketV2ListPage>;
}

/**
 * The composed Market home: exactly two requests, in parallel —
 * `/market/page` (sections) and `/market/catalog?includeFacets=1`.
 */
export function useMarketHome({
  filters,
  sort,
  anonymousSessionId,
}: {
  filters: MarketFilters;
  sort: MarketSort | null;
  anonymousSessionId: string | null;
}): MarketHome {
  const { viewer, ready } = useMarketViewerScope();
  const [fellBack, setFellBack] = useState(() => isMarketHomeV2KnownUnavailable());
  const enabled = ready && !fellBack;
  const filtersKey = marketFiltersKey(filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- filtersKey is the identity of filters
  const stableFilters = useMemo(() => filters, [filtersKey]);
  const anonymous = viewer === 'guest' ? anonymousSessionId : null;

  const pageQuery = useQuery({
    queryKey: queryKeys.market.v2Page({ filters: filtersKey, viewer, anonymous }),
    queryFn: ({ signal }) =>
      marketV2Api.getPage({ filters: stableFilters, anonymousSessionId: anonymous }, { signal }),
    enabled,
    retry: retryMarketV2Request,
    staleTime: PAGE_STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });

  const catalog = useMarketPagedList<MarketV2ListPage>({
    queryKey: queryKeys.market.v2Catalog({ filters: filtersKey, sort, viewer, anonymous }),
    enabled,
    fetchPage: (cursor, signal) =>
      marketV2Api.getCatalog(
        {
          filters: stableFilters,
          sort,
          cursor,
          includeFacets: cursor === null,
          anonymousSessionId: anonymous,
        },
        { signal },
      ),
    toListPage: identityPage,
  });

  const pageError = pageQuery.isError && !pageQuery.data ? pageQuery.error : null;
  const catalogError = catalog.error && !catalog.firstPage ? catalog.error : null;
  const pageHasSections = Boolean(pageQuery.data && pageQuery.data.sections.length > 0);

  // Fall back only on a first load. Data already on screen stays on screen.
  let fallbackError: unknown = null;
  if (pageError && shouldFallBackToClassicMarket(pageError)) fallbackError = pageError;
  else if (catalogError && shouldFallBackToClassicMarket(catalogError)) {
    const kind = marketV2ErrorKind(catalogError);
    // A busy catalogue under sections that rendered is an inline retry, not a swap.
    if (kind !== 'busy' || (!pageHasSections && !pageQuery.isFetching)) fallbackError = catalogError;
  }
  const shouldFallBack = fallbackError !== null;

  useEffect(() => {
    if (!shouldFallBack) return;
    const ttl = marketV2ErrorKind(fallbackError) === 'busy' ? MARKET_V2_BUSY_TTL_MS : MARKET_V2_UNAVAILABLE_TTL_MS;
    markMarketHomeV2Unavailable(Date.now(), ttl);
    setFellBack(true);
    // fallbackError is derived from the same render as shouldFallBack.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldFallBack]);

  const { refetch } = pageQuery;
  return {
    fallback: fellBack || shouldFallBack,
    page: pageQuery.data,
    pageLoading: pageQuery.isPending && pageQuery.fetchStatus === 'fetching',
    pagePaused: pageQuery.fetchStatus === 'paused',
    pageErrorKind: pageError ? marketV2ErrorKind(pageError) : null,
    pageUpdatedAt: pageQuery.dataUpdatedAt,
    retryPage: () => void refetch(),
    catalog,
  };
}
