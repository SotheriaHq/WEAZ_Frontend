import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { marketApi, type GetMarketFeedParams } from '@/api/MarketApi';
import { queryKeys } from '@/query/queryKeys';
import type { MarketFeedResponse } from '@/types/market';

/**
 * Design feed for the Runway UI surface.
 *
 * Domain: Design (backend). Presentation label: Runway (frontend aesthetics).
 * Not the commerce Market surface (`MarketPlace` / `/market`).
 *
 * Uses stale-while-revalidate (TanStack Query): 3m stale / 30m gc defaults.
 */
export const useRunwayFeed = (
  params?: GetMarketFeedParams,
  options?: {
    enabled?: boolean;
    initialData?: MarketFeedResponse;
  },
) => {
  return useQuery({
    // Cache key stays under queryKeys.runway; transport may still hit
    // GET /collections/market until the backend renames the design feed path.
    queryKey: queryKeys.runway.feed(params),
    queryFn: async ({ signal }) => {
      return await marketApi.getRunwayFeed(params, { signal });
    },
    enabled: options?.enabled !== false,
    initialData: options?.initialData,
    // Category/tag switches change this query key. Keep the previous feed
    // painted while the new tag loads so the skeleton never replaces
    // already-visible content mid-session.
    placeholderData: keepPreviousData,
  });
};

export default useRunwayFeed;
