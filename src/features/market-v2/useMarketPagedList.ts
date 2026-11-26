import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  keepPreviousData,
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
  type QueryKey,
} from '@tanstack/react-query';
import {
  marketV2ErrorKind,
  retryMarketV2Request,
  type MarketFacets,
  type MarketV2ErrorKind,
  type MarketV2Item,
  type MarketV2ListPage,
} from '@/api/MarketV2Api';
import type { MarketSort } from './marketFilterState';
import { mergeMarketPages, type MarketListNotice } from './mergeMarketPages';

export interface MarketPagedListOptions<P> {
  readonly queryKey: QueryKey;
  readonly enabled: boolean;
  /** `cursor` is null for the first page, which is the only one asking for facets. */
  readonly fetchPage: (cursor: string | null, signal: AbortSignal) => Promise<P>;
  /** The list view of a page, or null when the page belongs to another renderer. */
  readonly toListPage: (page: P) => MarketV2ListPage | null;
}

export interface MarketPagedList<P> {
  readonly firstPage: P | undefined;
  readonly items: MarketV2Item[];
  readonly facets: MarketFacets | null;
  /** The sort menu comes from the first page; continuations may list fewer. */
  readonly availableSorts: readonly MarketSort[];
  readonly sortEffective: string | null;
  readonly fallbackReason: string | null;
  readonly total: number | null;
  readonly hasNextPage: boolean;
  readonly isLoading: boolean;
  /** Fetching while offline: the request waits for the connection. */
  readonly isPaused: boolean;
  readonly isUpdating: boolean;
  readonly isFetchingNextPage: boolean;
  readonly dataUpdatedAt: number;
  readonly error: unknown;
  readonly errorKind: MarketV2ErrorKind | null;
  readonly nextPageErrorKind: MarketV2ErrorKind | null;
  readonly notice: MarketListNotice | null;
  /** Increments every time the server restarts the list order. */
  readonly restartCount: number;
  readonly dismissNotice: () => void;
  readonly loadMore: () => void;
  readonly retry: () => void;
  /** Start again from the first page with one request (a new epoch on the server). */
  readonly refresh: () => void;
}

const LIST_STALE_TIME_MS = 3 * 60 * 1000;

type Pages<P> = InfiniteData<P, string | null>;

/** Keep only the first page, so a refetch costs one request instead of one per loaded page. */
const firstPageOnly = <P,>(current: Pages<P> | undefined): Pages<P> | undefined =>
  current && current.pages.length > 1
    ? { pages: current.pages.slice(0, 1), pageParams: current.pageParams.slice(0, 1) }
    : current;

/**
 * One live keyset list (Market catalogue or a See All section).
 *
 * - Pages merge by entity type and id, in server order.
 * - When a page comes back re-anchored, the server has restarted the order:
 *   the cache is collapsed to that page (keeping the first page's facets and
 *   sort menu) and the shopper sees "Updated" or "Prices updated".
 * - A rejected cursor (`INVALID_CURSOR`, for example after the server switched
 *   lists) restarts the list from its first page with the same notice, while
 *   the loaded cards stay on screen until the fresh page replaces them.
 */
export function useMarketPagedList<P>({
  queryKey,
  enabled,
  fetchPage,
  toListPage,
}: MarketPagedListOptions<P>): MarketPagedList<P> {
  const queryClient = useQueryClient();
  // The accessor and fetcher are read through refs so callers need not memoise them.
  const toListPageRef = useRef(toListPage);
  const fetchPageRef = useRef(fetchPage);
  useEffect(() => {
    toListPageRef.current = toListPage;
    fetchPageRef.current = fetchPage;
  });
  const keyString = JSON.stringify(queryKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyString is the identity of queryKey
  const stableKey = useMemo(() => queryKey, [keyString]);

  const query = useInfiniteQuery<P, Error, Pages<P>, QueryKey, string | null>({
    queryKey: stableKey,
    queryFn: ({ pageParam, signal }) => fetchPageRef.current(pageParam, signal),
    initialPageParam: null,
    getNextPageParam: (last) => {
      const page = toListPageRef.current(last);
      return page?.hasNextPage && page.nextCursor ? page.nextCursor : undefined;
    },
    enabled,
    retry: retryMarketV2Request,
    staleTime: LIST_STALE_TIME_MS,
    // A reconnect would otherwise replay every loaded page in sequence. A paused
    // request still resumes on its own when the connection returns.
    refetchOnReconnect: false,
    placeholderData: keepPreviousData,
  });

  const [notice, setNotice] = useState<{ key: string; value: MarketListNotice } | null>(null);
  const [restartCount, setRestartCount] = useState(0);
  const seenPagesRef = useRef<{ key: string; count: number }>({ key: keyString, count: 0 });

  const pages = query.data?.pages;
  const showingPlaceholder = query.isPlaceholderData;
  useEffect(() => {
    if (!pages || showingPlaceholder) return;
    if (seenPagesRef.current.key !== keyString) seenPagesRef.current = { key: keyString, count: 0 };
    const previousCount = seenPagesRef.current.count;
    seenPagesRef.current.count = pages.length;
    if (pages.length <= previousCount || pages.length < 2) return;
    const latest = toListPageRef.current(pages[pages.length - 1]);
    if (!latest) return;
    if (latest.notice) setNotice({ key: keyString, value: latest.notice });
    if (!latest.reanchored) return;
    setRestartCount((value) => value + 1);
    const first = toListPageRef.current(pages[0]);
    queryClient.setQueryData<Pages<P>>(stableKey, (current) => {
      if (!current || current.pages.length < 2) return current;
      const restarted = {
        ...current.pages[current.pages.length - 1],
        ...(first ? { facets: latest.facets ?? first.facets, availableSorts: first.availableSorts } : {}),
      } as P;
      return { pages: [restarted], pageParams: [null] };
    });
    seenPagesRef.current.count = 1;
  }, [pages, showingPlaceholder, keyString, stableKey, queryClient]);

  const nextPageErrorKind = query.isFetchNextPageError ? marketV2ErrorKind(query.error) : null;
  const listRestarting = query.isFetchNextPageError && nextPageErrorKind === 'invalid-cursor';

  const { fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = query;
  const refresh = useCallback(() => {
    queryClient.setQueryData<Pages<P>>(stableKey, firstPageOnly);
    seenPagesRef.current = { key: keyString, count: 1 };
    void refetch();
  }, [keyString, queryClient, refetch, stableKey]);

  const restartingRef = useRef(false);
  useEffect(() => {
    if (!listRestarting) {
      restartingRef.current = false;
      return;
    }
    if (restartingRef.current) return;
    restartingRef.current = true;
    setNotice({ key: keyString, value: 'Updated' });
    setRestartCount((value) => value + 1);
    refresh();
  }, [listRestarting, keyString, refresh]);

  const listPages = useMemo(
    () =>
      (pages ?? [])
        .map((page) => toListPageRef.current(page))
        .filter((page): page is MarketV2ListPage => page !== null),
    [pages],
  );
  const merged = useMemo(() => mergeMarketPages(listPages), [listPages]);
  const first = listPages[0];
  const last = listPages[listPages.length - 1];

  const loadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
  const isFetchNextPageError = query.isFetchNextPageError;
  const retry = useCallback(() => {
    if (isFetchNextPageError) void fetchNextPage();
    else void refetch();
  }, [fetchNextPage, isFetchNextPageError, refetch]);
  const dismissNotice = useCallback(() => setNotice(null), []);

  const firstPageError = query.isError && !query.isFetchNextPageError ? query.error : null;

  return {
    firstPage: pages?.[0],
    items: merged.items,
    facets: first?.facets ?? null,
    availableSorts: first?.availableSorts ?? [],
    sortEffective: first?.sortEffective ?? null,
    fallbackReason: first?.fallbackReason ?? null,
    total: first?.total ?? null,
    hasNextPage: Boolean(last?.hasNextPage && hasNextPage),
    isLoading: query.isPending && query.fetchStatus === 'fetching',
    isPaused: query.fetchStatus === 'paused',
    isUpdating: query.isPlaceholderData || (query.isFetching && !query.isFetchingNextPage && !query.isPending),
    isFetchingNextPage,
    dataUpdatedAt: query.dataUpdatedAt,
    error: firstPageError,
    errorKind: firstPageError ? marketV2ErrorKind(firstPageError) : null,
    nextPageErrorKind: listRestarting ? null : nextPageErrorKind,
    notice: notice && notice.key === keyString ? notice.value : null,
    restartCount,
    dismissNotice,
    loadMore,
    retry,
    refresh,
  };
}
