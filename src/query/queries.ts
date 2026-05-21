import { useQuery, useQueryClient, type QueryClient, type UseQueryOptions } from '@tanstack/react-query';

import { brandApi, type CollectionScope } from '@/api/BrandApi';
import { configApi } from '@/api/ConfigApi';
import { getStoreStatus } from '@/api/StoreApi';
import { DesignApi } from '@/api/DesignApi';
import type { BrandProfileDto, CollectionDto } from '@/types/profile';
import { THREADLY_QUERY_STALE_TIME_MS } from './queryClient';
import { queryKeys } from './queryKeys';

type EnabledOption = { enabled?: boolean };

type BrandCollectionsArgs = {
  ownerId?: string | null;
  visibility?: 'public' | 'private' | 'all';
  scope?: CollectionScope;
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
};

const isEnabled = (value: unknown, enabled = true) => Boolean(value) && enabled;

export function useBrandProfileQuery(brandId?: string | null, options?: EnabledOption) {
  return useQuery({
    queryKey: queryKeys.brand.profile(brandId),
    queryFn: () => brandApi.getBrandProfile(String(brandId)),
    enabled: isEnabled(brandId, options?.enabled ?? true),
  });
}

export async function fetchBrandProfileQuery(
  queryClient: QueryClient,
  brandId?: string | null,
  options?: { forceRefresh?: boolean },
) {
  if (!brandId) return null;
  if (options?.forceRefresh) {
    const data = await brandApi.getBrandProfile(brandId, { forceRefresh: true });
    queryClient.setQueryData(queryKeys.brand.profile(brandId), data);
    return data;
  }
  return queryClient.fetchQuery({
    queryKey: queryKeys.brand.profile(brandId),
    queryFn: () => brandApi.getBrandProfile(brandId),
  });
}

export function useBrandCollectionsQuery(args: BrandCollectionsArgs, options?: EnabledOption) {
  const { ownerId, scope = 'design', visibility = 'all', includeDeleted, onlyDeleted } = args;
  return useQuery({
    queryKey: queryKeys.brand.collections(ownerId, { scope, visibility, includeDeleted, onlyDeleted }),
    queryFn: () => brandApi.getCollections(String(ownerId), { scope, visibility, includeDeleted, onlyDeleted }),
    enabled: isEnabled(ownerId, options?.enabled ?? true),
  });
}

export async function fetchBrandCollectionsQuery(
  queryClient: QueryClient,
  args: BrandCollectionsArgs,
  options?: { forceRefresh?: boolean },
) {
  if (!args.ownerId) return [];
  const scope = args.scope ?? 'design';
  const visibility = args.visibility ?? 'all';
  const key = queryKeys.brand.collections(args.ownerId, {
    scope,
    visibility,
    includeDeleted: args.includeDeleted,
    onlyDeleted: args.onlyDeleted,
  });
  if (options?.forceRefresh) {
    const data = await brandApi.getCollections(args.ownerId, {
      scope,
      visibility,
      includeDeleted: args.includeDeleted,
      onlyDeleted: args.onlyDeleted,
      forceRefresh: true,
    });
    queryClient.setQueryData(key, data);
    return data;
  }
  return queryClient.fetchQuery({
    queryKey: key,
    queryFn: () => brandApi.getCollections(String(args.ownerId), {
      scope,
      visibility,
      includeDeleted: args.includeDeleted,
      onlyDeleted: args.onlyDeleted,
    }),
  });
}

export function useCollectionDetailQuery(
  collectionId?: string | null,
  scope?: CollectionScope,
  options?: EnabledOption,
) {
  const queryClient = useQueryClient();
  const initialData =
    scope === 'design'
      ? queryClient.getQueryData(queryKeys.design.detail(collectionId))
      : undefined;

  return useQuery({
    queryKey: queryKeys.brand.collectionDetail(collectionId, scope),
    queryFn: async () => {
      const data = await brandApi.getCollectionDetail(String(collectionId), { scope });
      if (scope === 'design') {
        queryClient.setQueryData(queryKeys.design.detail(collectionId), data);
      }
      return data;
    },
    enabled: isEnabled(collectionId, options?.enabled ?? true),
    initialData,
  });
}

export async function fetchCollectionDetailQuery(
  queryClient: QueryClient,
  collectionId?: string | null,
  scope?: CollectionScope,
  options?: { forceRefresh?: boolean },
) {
  if (!collectionId) return null;
  const key = queryKeys.brand.collectionDetail(collectionId, scope);
  if (scope === 'design' && !options?.forceRefresh) {
    const designDetail = queryClient.getQueryData(queryKeys.design.detail(collectionId));
    if (typeof designDetail !== 'undefined') {
      queryClient.setQueryData(key, designDetail);
      return designDetail;
    }
  }
  if (options?.forceRefresh) {
    const data = await brandApi.getCollectionDetail(collectionId, { scope, forceRefresh: true });
    queryClient.setQueryData(key, data);
    if (scope === 'design') {
      queryClient.setQueryData(queryKeys.design.detail(collectionId), data);
    }
    return data;
  }
  const data = await queryClient.fetchQuery({
    queryKey: key,
    queryFn: () => brandApi.getCollectionDetail(collectionId, { scope }),
  });
  if (scope === 'design') {
    queryClient.setQueryData(queryKeys.design.detail(collectionId), data);
  }
  return data;
}

export function useDesignDetailQuery(
  designId?: string | null,
  options?: EnabledOption & Partial<UseQueryOptions<unknown>>,
) {
  const queryClient = useQueryClient();
  const initialData =
    options?.initialData ?? queryClient.getQueryData(queryKeys.brand.collectionDetail(designId, 'design'));

  return useQuery({
    queryKey: queryKeys.design.detail(designId),
    queryFn: async () => {
      const data = await DesignApi.getDesignDetail(String(designId));
      queryClient.setQueryData(queryKeys.brand.collectionDetail(designId, 'design'), data);
      return data;
    },
    enabled: isEnabled(designId, options?.enabled ?? true),
    initialData,
    placeholderData: options?.placeholderData,
  });
}

export async function fetchDesignDetailQuery(
  queryClient: QueryClient,
  designId?: string | null,
  options?: { forceRefresh?: boolean },
) {
  if (!designId) return null;
  const key = queryKeys.design.detail(designId);
  if (options?.forceRefresh) {
    const data = await DesignApi.getDesignDetail(designId, { forceRefresh: true });
    queryClient.setQueryData(key, data);
    queryClient.setQueryData(queryKeys.brand.collectionDetail(designId, 'design'), data);
    return data;
  }
  const data = await queryClient.fetchQuery({
    queryKey: key,
    queryFn: () => DesignApi.getDesignDetail(designId),
  });
  queryClient.setQueryData(queryKeys.brand.collectionDetail(designId, 'design'), data);
  return data;
}

export function useStoreStatusQuery(options?: EnabledOption) {
  return useQuery({
    queryKey: queryKeys.store.status(),
    queryFn: () => getStoreStatus(),
    enabled: options?.enabled ?? true,
  });
}

export function useUploadLimitsQuery(options?: EnabledOption) {
  return useQuery({
    queryKey: queryKeys.config.uploadLimits(),
    queryFn: () => configApi.getUploadLimits(),
    enabled: options?.enabled ?? true,
  });
}

export function useMediaPublicUrlQuery(fileId?: string | null, options?: EnabledOption) {
  return useQuery({
    queryKey: queryKeys.media.publicUrl(fileId),
    queryFn: () => brandApi.getSignedFileUrl(String(fileId)),
    enabled: isEnabled(fileId, options?.enabled ?? true),
    staleTime: THREADLY_QUERY_STALE_TIME_MS,
  });
}

export function useMediaSignedUrlQuery(fileId?: string | null, options?: EnabledOption) {
  return useQuery({
    queryKey: queryKeys.media.signedUrl(fileId),
    queryFn: () => brandApi.getSignedFileUrl(String(fileId)),
    enabled: isEnabled(fileId, options?.enabled ?? true),
    staleTime: THREADLY_QUERY_STALE_TIME_MS,
    gcTime: THREADLY_QUERY_STALE_TIME_MS,
  });
}

export const setCollectionDetailQueryData = (
  queryClient: QueryClient,
  collectionId: string,
  detail: unknown,
  scope?: CollectionScope,
) => {
  queryClient.setQueryData(queryKeys.brand.collectionDetail(collectionId, scope), detail);
};

export const setBrandCollectionsQueryData = (
  queryClient: QueryClient,
  args: BrandCollectionsArgs,
  updater: (items: CollectionDto[]) => CollectionDto[],
) => {
  queryClient.setQueryData<CollectionDto[]>(
    queryKeys.brand.collections(args.ownerId, {
      scope: args.scope ?? 'design',
      visibility: args.visibility ?? 'all',
      includeDeleted: args.includeDeleted,
      onlyDeleted: args.onlyDeleted,
    }),
    (current) => updater(current ?? []),
  );
};

export const setBrandProfileQueryData = (
  queryClient: QueryClient,
  brandId: string,
  profile: BrandProfileDto | null,
) => {
  queryClient.setQueryData(queryKeys.brand.profile(brandId), profile);
};
