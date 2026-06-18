import { useQuery } from '@tanstack/react-query';
import { marketApi } from '@/api/MarketApi';
import type { RunwayPinnedFeedResponse } from '@/types/market';

export interface UseRunwayPinnedFeedParams {
  query: string;
  anchorDesignId?: string;
  cursor?: string;
  limit?: number;
}

/**
 * SEARCH-CORE-5: fetch the Runway search-pinned feed for a query/anchor.
 * Backend owns relevance + visibility; this hook only fetches and caches.
 * Disabled automatically when there is no query.
 */
export const useRunwayPinnedFeed = (
  params: UseRunwayPinnedFeedParams,
  options?: { enabled?: boolean },
) => {
  const enabled = options?.enabled !== false && Boolean(params.query.trim());
  return useQuery<RunwayPinnedFeedResponse>({
    queryKey: [
      'market',
      'runwayPinned',
      params.query,
      params.anchorDesignId ?? null,
      params.cursor ?? null,
      params.limit ?? null,
    ],
    queryFn: ({ signal }) => marketApi.getRunwayPinnedFeed(params, { signal }),
    enabled,
  });
};

export default useRunwayPinnedFeed;
