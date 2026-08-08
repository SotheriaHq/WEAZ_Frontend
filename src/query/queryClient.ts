import { QueryClient } from '@tanstack/react-query';

import { replaceEqualDeepPreservingSignedUrls } from './structuralSharing';

export const WIEZ_QUERY_STALE_TIME_MS = 3 * 60 * 1000;
export const WIEZ_QUERY_GC_TIME_MS = 30 * 60 * 1000;
export const WIEZ_COUNT_STALE_TIME_MS = 30 * 1000;
export const WIEZ_SAVED_STATUS_STALE_TIME_MS = 60 * 1000;
export const WIEZ_QUERY_CACHE_MAX_ENTRIES = 200;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: WIEZ_QUERY_STALE_TIME_MS,
      gcTime: WIEZ_QUERY_GC_TIME_MS,
      retry: 1,
      // Perf policy: merely being STALE must not refetch on mount — staleTime
      // governs. But an explicitly INVALIDATED query must refetch, or
      // invalidateQueries means nothing. A plain `false` suppressed both, so a
      // mutation's invalidation only ever reached screens that happened to be
      // mounted at that instant; anything else served stale data until its TTL
      // elapsed. Mirrors threadly-mobile/src/query/queryClient.ts.
      refetchOnMount: (query) => (query.state.isInvalidated ? 'always' : false),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      // Stock structural sharing was defeated by re-signed S3 URLs, so every
      // background revalidation produced brand-new object references and
      // remounted every card and image. See ./structuralSharing.
      structuralSharing: (previous, next) =>
        replaceEqualDeepPreservingSignedUrls(previous, next),
    },
    mutations: {
      retry: 0,
    },
  },
});
