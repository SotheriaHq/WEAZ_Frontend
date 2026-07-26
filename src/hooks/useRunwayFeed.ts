import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { marketApi, type GetMarketFeedParams } from '@/api/MarketApi';
import { queryKeys } from '@/query/queryKeys';
import type { MarketFeedResponse } from '@/types/market';

/**
 * Hook to fetch and cache design feed (market feed).
 * Uses stale-while-revalidate pattern with TanStack Query.
 * 
 * Features:
 * - 3-minute cache before refetch (staleTime)
 * - 30-minute in-memory cache retention (gcTime)
 * - localStorage persistence
 * - No refetch on mount if cached
 * - Silent background refetch when stale
 */
export const useMarketFeed = (
  params?: GetMarketFeedParams,
  options?: {
    enabled?: boolean;
    initialData?: MarketFeedResponse;
  },
) => {
  return useQuery({
    queryKey: queryKeys.market.feed(params),
    queryFn: async ({ signal }) => {
      return await marketApi.getFeed(params, { signal });
    },
    enabled: options?.enabled !== false,
    initialData: options?.initialData,
    // Category/tag switches change this query key. Keep the previous feed
    // painted while the new tag loads so the skeleton never replaces
    // already-visible content mid-session.
    placeholderData: keepPreviousData,
    // Use default staleTime/gcTime from queryClient
    // staleTime: 3 minutes
    // gcTime: 30 minutes
  });
};

export default useMarketFeed;
