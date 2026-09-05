import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { marketApi } from '@/api/MarketApi';
import { queryKeys } from '@/query/queryKeys';
import { getWebMarketSignalAnonymousSessionId } from '@/services/marketSignalQueue';

type MarketSurface = 'runway' | 'market';

/** Run work when the browser is idle; falls back to a timer on Safari. */
const onIdle = (callback: () => void): (() => void) => {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, { timeout: 4_000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(callback, 1_500);
  return () => window.clearTimeout(id);
};

/**
 * Cross-surface warm-up: once the CURRENT market surface has settled, quietly
 * prefetch the sibling surface's primary queries so switching Runway ⇄ Market
 * renders instantly from cache instead of showing a cold skeleton.
 *
 * `prefetchQuery` respects staleTime — if fresh data is already cached this is
 * a no-op, so it never duplicates in-flight or fresh requests.
 *
 * IMPORTANT: params here must stay IDENTICAL to what the target screens pass,
 * or the query keys won't match and the prefetch is wasted:
 * - MarketPlace sections: { limit: 8, anonymousSessionId } (MarketPlace.tsx)
 * - Runway design feed: { counts: 'combined' } (Runway.tsx)
 */
export const useMarketSurfacePrefetch = (current: MarketSurface) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    return onIdle(() => {
      if (current !== 'market') {
        const sectionsParams = {
          limit: 8,
          anonymousSessionId: getWebMarketSignalAnonymousSessionId(),
        };
        void queryClient.prefetchQuery({
          queryKey: queryKeys.market.sections(sectionsParams),
          queryFn: ({ signal }) => marketApi.getMarketSections(sectionsParams, { signal }),
        });
      }

      if (current !== 'runway') {
        const feedParams = { counts: 'combined' as const };
        void queryClient.prefetchQuery({
          queryKey: queryKeys.runway.feed(feedParams),
          queryFn: ({ signal }) => marketApi.getRunwayFeed(feedParams, { signal }),
        });
        void queryClient.prefetchQuery({
          queryKey: queryKeys.runway.feedCategories(),
          queryFn: ({ signal }) => marketApi.getFeedCategories({ signal }),
        });
      }
    });
  }, [current, queryClient]);
};

export default useMarketSurfacePrefetch;
