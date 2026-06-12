import { useCallback } from 'react';
import { useScrollRestore } from '@/components/ScrollRestoreProvider';
import useMarketFeed from '@/hooks/useMarketFeed';
import useMarketSections from '@/hooks/useMarketSections';
import type { GetMarketFeedParams } from '@/api/MarketApi';
import { useMarketSignals } from '@/hooks/useMarketSignals';

/**
 * Hook to manage market data fetching with caching and scroll restoration.
 * Replaces direct API calls with React Query for better state management.
 *
 * Usage:
 * const { data, isLoading, error, refetch, saveScroll } = useMarketWithCache('MARKET_HOME');
 */
export const useMarketWithCache = (surfaceType: string, params?: GetMarketFeedParams) => {
  const { saveScrollPosition, getScrollPosition } = useScrollRestore(surfaceType);
  const { anonymousSessionId } = useMarketSignals(surfaceType);
  
  // Fetch market feed with React Query
  const feedQuery = useMarketFeed(params, {
    enabled: true,
  });

  // Fetch market sections with React Query
  const sectionsQuery = useMarketSections(
    { limit: 8, anonymousSessionId },
    { enabled: true }
  );

  // Combine loading states
  const isLoading = feedQuery.isLoading || sectionsQuery.isLoading;
  const error = feedQuery.error || sectionsQuery.error;

  // Create a callback to save scroll position before navigation
  const beforeNavigate = useCallback(
    (filterState?: Record<string, any>, selectedIndex?: number) => {
      const y = window.scrollY;
      saveScrollPosition(surfaceType, y, filterState, selectedIndex);
    },
    [surfaceType, saveScrollPosition],
  );

  return {
    feed: feedQuery.data,
    sections: sectionsQuery.data,
    isLoading,
    error: error?.message || null,
    refetch: () => {
      feedQuery.refetch();
      sectionsQuery.refetch();
    },
    beforeNavigate,
    getScrollPosition: () => getScrollPosition(surfaceType),
  };
};

export default useMarketWithCache;
