import { useInfiniteQuery } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { listMyCategorySuggestions } from '@/api/CategoriesSuggestionsApi';

export function useCategorySuggestions(enabled = true) {
  const accountId = useSelector((state: RootState) => state.user.profile?.id);
  return useInfiniteQuery({
    queryKey: ['category-suggestions', 'mine', accountId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => listMyCategorySuggestions(pageParam, signal),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(accountId) && enabled,
    staleTime: 30_000,
  });
}
