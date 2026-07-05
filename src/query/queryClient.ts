import { QueryClient } from '@tanstack/react-query';

export const THREADLY_QUERY_STALE_TIME_MS = 3 * 60 * 1000;
export const THREADLY_QUERY_GC_TIME_MS = 30 * 60 * 1000;
export const THREADLY_COUNT_STALE_TIME_MS = 30 * 1000;
export const THREADLY_SAVED_STATUS_STALE_TIME_MS = 60 * 1000;
export const THREADLY_QUERY_CACHE_MAX_ENTRIES = 200;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: THREADLY_QUERY_STALE_TIME_MS,
      gcTime: THREADLY_QUERY_GC_TIME_MS,
      retry: 1,
      // Stale-while-revalidate on remount: cached data paints instantly
      // (isLoading stays false when data exists, so no skeletons), and if the
      // data is older than staleTime a SILENT background refetch runs. The
      // previous `false` meant revisited screens could show arbitrarily old
      // data with no refresh at all.
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
