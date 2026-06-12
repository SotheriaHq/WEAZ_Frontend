import { useQuery } from '@tanstack/react-query';
import { marketApi, type GetMarketSectionsParams, type GetMarketSectionDetailParams } from '@/api/MarketApi';
import { queryKeys } from '@/query/queryKeys';

/**
 * Hook to fetch market sections for homepage.
 * Uses stale-while-revalidate with TanStack Query.
 * 
 * Features:
 * - 3-minute cache (staleTime)
 * - 30-minute memory retention (gcTime)
 * - localStorage persistence
 * - Silent background refresh when stale
 */
export const useMarketSections = (
  params?: GetMarketSectionsParams,
  options?: {
    enabled?: boolean;
  },
) => {
  return useQuery({
    queryKey: queryKeys.market.sections(params),
    queryFn: async ({ signal }) => {
      return await marketApi.getMarketSections(params, { signal });
    },
    enabled: options?.enabled !== false,
  });
};

/**
 * Hook to fetch a specific market section with cursor pagination.
 * Useful for "View All" functionality.
 */
export const useMarketSectionDetail = (
  sectionKey: string | null | undefined,
  params?: GetMarketSectionDetailParams,
  options?: {
    enabled?: boolean;
  },
) => {
  return useQuery({
    queryKey: queryKeys.market.sectionDetail(sectionKey, params),
    queryFn: async ({ signal }) => {
      if (!sectionKey) throw new Error('Section key required');
      return await marketApi.getMarketSectionDetail(sectionKey, params, { signal });
    },
    enabled: Boolean(sectionKey) && options?.enabled !== false,
  });
};

export default useMarketSections;
