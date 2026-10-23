import { queryOptions } from '@tanstack/react-query';
import { brandApi, type CategoryOption, type FilterDimensionOption } from '@/api/BrandApi';

export const EMPTY_CREATOR_CATEGORIES: CategoryOption[] = [];
export const EMPTY_CREATOR_FILTERS: FilterDimensionOption[] = [];

// Public taxonomy is shared by all creators; private collections use account keys.
export const creatorCategoriesOptions = queryOptions({
  queryKey: ['creator-metadata', 'categories'] as const,
  queryFn: () => brandApi.getCategoriesWithSubCategories(false),
  refetchOnMount: true,
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
});

export const creatorFiltersOptions = queryOptions({
  queryKey: ['creator-metadata', 'filters'] as const,
  queryFn: () => brandApi.getFilterDimensions(),
  refetchOnMount: true,
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
});
