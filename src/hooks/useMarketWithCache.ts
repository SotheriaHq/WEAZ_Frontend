import { useCallback } from 'react';
import { useScrollRestore } from '@/components/ScrollRestoreProvider';
import useRunwayFeed from '@/hooks/useRunwayFeed';
import useMarketSections from '@/hooks/useMarketSections';
import type { GetMarketFeedParams } from '@/api/MarketApi';
import { useMarketSignals } from '@/hooks/useMarketSignals';

/**
 * Combined cache helper: design feed (Runway) + commerce market sections.
 * Prefer dedicated hooks when only one surface is needed.
 */
export const useMarketWithCache = (surfaceType: string, params?: GetMarketFeedParams) => {
  const { saveScrollPosition, getScrollPosition } = useScrollRestore(surfaceType);
  const { anonymousSessionId } = useMarketSignals(surfaceType);
  
  // Design feed (Runway UI)
  const feedQuery = useRunwayFeed(params, {
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
