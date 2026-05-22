import { useQuery, useQueryClient, type QueryClient, type UseQueryOptions } from '@tanstack/react-query';

import { brandApi, type CollectionScope } from '@/api/BrandApi';
import { CommentsApi } from '@/api/CommentsApi';
import { configApi } from '@/api/ConfigApi';
import {
  customOrderConfigurationsApi,
  customOrdersBuyerApi,
  type CustomOrderConfiguration,
  type CustomOrderSourceType,
} from '@/api/CustomOrderApi';
import { apiClient } from '@/api/httpClient';
import { NotificationsApi } from '@/api/NotificationsApi';
import { ReactionsApi } from '@/api/ReactionsApi';
import { SizeFitApi } from '@/api/SizeFitApi';
import { getStoreStatus } from '@/api/StoreApi';
import { DesignApi } from '@/api/DesignApi';
import type { CommentTarget, CommentV2Dto, PageResult } from '@/types/comments';
import type { BrandProfileDto, CollectionDto } from '@/types/profile';
import { THREADLY_QUERY_STALE_TIME_MS } from './queryClient';
import { queryKeys } from './queryKeys';

type EnabledOption = { enabled?: boolean };
type ThreadContentType = 'COLLECTION' | 'COLLECTION_MEDIA';
const THREADLY_COMMENT_STALE_TIME_MS = 60 * 1000;
const THREADLY_NOTIFICATION_SETTINGS_STALE_TIME_MS = 10 * 60 * 1000;
const EMPTY_COMMENT_PAGE: PageResult<CommentV2Dto> = {
  items: [],
  hasNextPage: false,
  endCursor: null,
};

const isHttpStatus = (error: unknown, status: number) => {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return false;
  }

  return (error as { response?: { status?: number } }).response?.status === status;
};

const emptyCommentPage = (): PageResult<CommentV2Dto> => ({
  ...EMPTY_COMMENT_PAGE,
  items: [],
});
type BrandPrivateAccessState = {
  collectionId: string;
  title: string;
  coverUrl?: string | null;
  coverFileId?: string | null;
  itemCount?: number;
  state: 'APPROVED' | 'PENDING' | 'REVOKED' | 'NONE';
};

type BrandCollectionsArgs = {
  ownerId?: string | null;
  visibility?: 'public' | 'private' | 'all';
  scope?: CollectionScope;
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
};

const isEnabled = (value: unknown, enabled = true) => Boolean(value) && enabled;
const normalizeIdList = (values?: Array<string | null | undefined> | null) =>
  Array.from(
    new Set(
      (values ?? [])
        .map((value) => String(value ?? '').trim())
        .filter(Boolean),
    ),
  ).sort();

const toSavedStatusMap = (items: unknown) => {
  const result: Record<string, boolean> = {};
  if (!Array.isArray(items)) return result;
  for (const item of items) {
    const entry = item as { targetId?: unknown; isSaved?: unknown };
    if (typeof entry.targetId === 'string' && entry.targetId.length > 0) {
      result[entry.targetId] = Boolean(entry.isSaved);
    }
  }
  return result;
};

export const getPublicProfileUserType = (payload: unknown): 'BRAND' | 'REGULAR' | null => {
  const container = payload as { user?: unknown; profile?: unknown; type?: unknown; role?: unknown } | null | undefined;
  const source = (container?.user ?? container?.profile ?? container) as
    | { type?: unknown; role?: unknown }
    | null
    | undefined;
  const rawType = typeof source?.type === 'string' ? source.type : undefined;
  if (rawType === 'BRAND' || rawType === 'REGULAR') return rawType;
  return source?.role === 'User' ? 'REGULAR' : null;
};

export function usePublicUserProfileQuery(userId?: string | null, options?: EnabledOption) {
  return useQuery({
    queryKey: queryKeys.user.publicProfile(userId),
    queryFn: async () => {
      const response = await apiClient.get(`/users/${String(userId)}/profile/public`);
      return response.data?.data ?? response.data ?? null;
    },
    enabled: isEnabled(userId, options?.enabled ?? true),
  });
}

export async function fetchMyUserProfileQuery(
  queryClient: QueryClient,
  userId?: string | null,
  options?: { forceRefresh?: boolean },
) {
  if (!userId) return null;
  const key = queryKeys.user.meProfile(userId);
  if (options?.forceRefresh) {
    await queryClient.removeQueries({ queryKey: key, exact: true });
  }
  return queryClient.fetchQuery({
    queryKey: key,
    queryFn: async () => {
      const response = await apiClient.get('/users/me/profile');
      return response.data?.data ?? response.data ?? null;
    },
    staleTime: THREADLY_QUERY_STALE_TIME_MS,
  });
}

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

export function useBrandPrivateAccessStatesQuery(
  brandId?: string | null,
  viewerId?: string | null,
  options?: EnabledOption,
) {
  return useQuery({
    queryKey: queryKeys.brandPrivateAccess.myStates(brandId, viewerId),
    queryFn: (): Promise<BrandPrivateAccessState[]> => brandApi.getBrandPrivateStates(String(brandId)),
    enabled: Boolean(brandId && viewerId && (options?.enabled ?? true)),
    staleTime: THREADLY_QUERY_STALE_TIME_MS,
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

export function useNotificationSettingsQuery(userId?: string | null, options?: EnabledOption) {
  return useQuery({
    queryKey: queryKeys.notifications.settings(userId),
    queryFn: () => NotificationsApi.getSettings(),
    enabled: isEnabled(userId, options?.enabled ?? true),
    staleTime: THREADLY_NOTIFICATION_SETTINGS_STALE_TIME_MS,
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
    queryFn: () => brandApi.getPublicFileUrl(String(fileId)),
    enabled: isEnabled(fileId, options?.enabled ?? true),
    staleTime: THREADLY_QUERY_STALE_TIME_MS,
  });
}

export function useMediaSignedUrlQuery(fileId?: string | null, options?: EnabledOption) {
  return useQuery({
    queryKey: queryKeys.media.signedUrl(fileId),
    queryFn: () => brandApi.getPrivateSignedFileUrl(String(fileId)),
    enabled: isEnabled(fileId, options?.enabled ?? true),
    staleTime: THREADLY_QUERY_STALE_TIME_MS,
    gcTime: THREADLY_QUERY_STALE_TIME_MS,
  });
}

export function useSavedBatchStatusQuery(
  targetType: string,
  targetIds?: Array<string | null | undefined> | null,
  options?: EnabledOption,
) {
  const normalizedTargetIds = normalizeIdList(targetIds);
  return useQuery({
    queryKey: queryKeys.saved.batch(targetType, normalizedTargetIds),
    queryFn: async () => {
      const response = await apiClient.post('/saved/check/batch', {
        targetType,
        targetIds: normalizedTargetIds,
      });
      const items = response.data?.data?.items ?? response.data?.items ?? [];
      return toSavedStatusMap(items);
    },
    enabled: normalizedTargetIds.length > 0 && (options?.enabled ?? true),
    staleTime: THREADLY_QUERY_STALE_TIME_MS,
  });
}

export function useSavedStatusQuery(
  targetType: string,
  targetId?: string | null,
  options?: EnabledOption,
) {
  return useQuery({
    queryKey: queryKeys.saved.status(targetType, targetId),
    queryFn: async () => {
      const response = await apiClient.get('/saved/check', {
        params: { targetType, targetId },
      });
      const payload = response.data?.data ?? response.data ?? {};
      return Boolean((payload as { isSaved?: unknown }).isSaved);
    },
    enabled: isEnabled(targetId, options?.enabled ?? true),
    staleTime: THREADLY_QUERY_STALE_TIME_MS,
  });
}

export function useThreadedStatusQuery(
  contentType: ThreadContentType,
  contentId?: string | null,
  options?: EnabledOption,
) {
  return useQuery({
    queryKey:
      contentType === 'COLLECTION_MEDIA'
        ? queryKeys.threaded.collectionMedia(contentId)
        : queryKeys.threaded.collection(contentId),
    queryFn: () =>
      contentType === 'COLLECTION_MEDIA'
        ? ReactionsApi.getCollectionMediaIsThreaded(String(contentId))
        : ReactionsApi.getCollectionIsThreaded(String(contentId)),
    enabled: isEnabled(contentId, options?.enabled ?? true),
    staleTime: THREADLY_QUERY_STALE_TIME_MS,
  });
}

export async function fetchCommentListQuery(
  queryClient: QueryClient,
  targetType: CommentTarget,
  targetId?: string | null,
  options?: { cursor?: string | null; limit?: number; forceRefresh?: boolean },
) {
  if (!targetId) return emptyCommentPage();
  const cursor = options?.cursor ?? null;
  const limit = options?.limit ?? 20;
  const key = queryKeys.comments.list(targetType, targetId, { cursor, limit });
  if (options?.forceRefresh) {
    await queryClient.removeQueries({ queryKey: key, exact: true });
  }
  return queryClient.fetchQuery({
    queryKey: key,
    queryFn: async () => {
      try {
        return await CommentsApi.list(targetType, targetId, cursor ?? undefined, limit);
      } catch (error) {
        if (isHttpStatus(error, 404)) {
          return emptyCommentPage();
        }
        throw error;
      }
    },
    staleTime: THREADLY_COMMENT_STALE_TIME_MS,
  });
}

export async function fetchUnifiedCollectionCommentsQuery(
  queryClient: QueryClient,
  collectionId?: string | null,
  options?: { cursor?: string | null; limit?: number; forceRefresh?: boolean },
) {
  if (!collectionId) return emptyCommentPage();
  const cursor = options?.cursor ?? null;
  const limit = options?.limit ?? 20;
  const key = queryKeys.comments.unifiedCollection(collectionId, { cursor, limit });
  if (options?.forceRefresh) {
    await queryClient.removeQueries({ queryKey: key, exact: true });
  }
  return queryClient.fetchQuery({
    queryKey: key,
    queryFn: async () => {
      try {
        return await CommentsApi.listUnifiedForCollection(collectionId, cursor ?? undefined, limit);
      } catch (error) {
        if (isHttpStatus(error, 404)) {
          return emptyCommentPage();
        }
        throw error;
      }
    },
    staleTime: THREADLY_COMMENT_STALE_TIME_MS,
  });
}

export async function fetchCommentRepliesQuery(
  queryClient: QueryClient,
  commentId?: string | null,
  options?: { cursor?: string | null; limit?: number; forceRefresh?: boolean },
) {
  if (!commentId) return emptyCommentPage();
  const cursor = options?.cursor ?? null;
  const limit = options?.limit ?? 20;
  const key = queryKeys.comments.replies(commentId, { cursor, limit });
  if (options?.forceRefresh) {
    await queryClient.removeQueries({ queryKey: key, exact: true });
  }
  return queryClient.fetchQuery({
    queryKey: key,
    queryFn: async () => {
      try {
        return await CommentsApi.replies(commentId, cursor ?? undefined, limit);
      } catch (error) {
        if (isHttpStatus(error, 404)) {
          return emptyCommentPage();
        }
        throw error;
      }
    },
    staleTime: THREADLY_COMMENT_STALE_TIME_MS,
  });
}

export function invalidateCommentListQueries(
  queryClient: QueryClient,
  targetType: CommentTarget,
  targetId?: string | null,
) {
  if (!targetId) return;
  void queryClient.invalidateQueries({
    queryKey: queryKeys.comments.listRoot(targetType, targetId),
  });
}

export function invalidateUnifiedCollectionCommentsQuery(
  queryClient: QueryClient,
  collectionId?: string | null,
) {
  if (!collectionId) return;
  void queryClient.invalidateQueries({
    queryKey: queryKeys.comments.unifiedCollectionRoot(collectionId),
  });
}

export async function fetchMySizeFitProfileQuery(
  queryClient: QueryClient,
  userId?: string | null,
  options?: { forceRefresh?: boolean },
) {
  if (!userId) return null;
  const key = queryKeys.sizeFit.myProfile(userId);
  if (options?.forceRefresh) {
    await queryClient.removeQueries({ queryKey: key, exact: true });
  }
  return queryClient.fetchQuery({
    queryKey: key,
    queryFn: () => SizeFitApi.getMyProfile(),
    staleTime: THREADLY_QUERY_STALE_TIME_MS,
  });
}

export async function fetchMySizeFitSharesQuery(
  queryClient: QueryClient,
  userId?: string | null,
  options?: { forceRefresh?: boolean },
) {
  if (!userId) return null;
  const key = queryKeys.sizeFit.shares(userId);
  if (options?.forceRefresh) {
    await queryClient.removeQueries({ queryKey: key, exact: true });
  }
  return queryClient.fetchQuery({
    queryKey: key,
    queryFn: () => SizeFitApi.getShares(),
    staleTime: THREADLY_QUERY_STALE_TIME_MS,
  });
}

export async function fetchDisplayChartPreferenceQuery(
  queryClient: QueryClient,
  userId?: string | null,
  options?: { forceRefresh?: boolean },
) {
  if (!userId) return null;
  const key = queryKeys.customOrders.displayChartPreference(userId);
  if (options?.forceRefresh) {
    await queryClient.removeQueries({ queryKey: key, exact: true });
  }
  return queryClient.fetchQuery({
    queryKey: key,
    queryFn: () => customOrdersBuyerApi.getDisplayChartPreference(),
    staleTime: THREADLY_QUERY_STALE_TIME_MS,
  });
}

export async function fetchActiveCustomOrderConfigurationQuery(
  queryClient: QueryClient,
  sourceType?: CustomOrderSourceType | null,
  sourceId?: string | null,
  options?: { forceRefresh?: boolean },
): Promise<CustomOrderConfiguration | null> {
  if (!sourceType || !sourceId) return null;
  const key = queryKeys.customOrders.activeConfiguration(sourceType, sourceId);
  if (options?.forceRefresh) {
    await queryClient.removeQueries({ queryKey: key, exact: true });
  }
  return queryClient.fetchQuery({
    queryKey: key,
    queryFn: () =>
      sourceType === 'PRODUCT'
        ? customOrderConfigurationsApi.getActiveForProduct(sourceId)
        : customOrderConfigurationsApi.getActiveForDesign(sourceId),
    staleTime: THREADLY_QUERY_STALE_TIME_MS,
  });
}

export function useActiveCustomOrderConfigurationQuery(
  sourceType?: CustomOrderSourceType | null,
  sourceId?: string | null,
  options?: EnabledOption,
) {
  return useQuery({
    queryKey: queryKeys.customOrders.activeConfiguration(sourceType, sourceId),
    queryFn: () =>
      sourceType === 'PRODUCT'
        ? customOrderConfigurationsApi.getActiveForProduct(sourceId as string)
        : customOrderConfigurationsApi.getActiveForDesign(sourceId as string),
    enabled: isEnabled(sourceType, options?.enabled ?? true) && isEnabled(sourceId, options?.enabled ?? true),
    staleTime: THREADLY_QUERY_STALE_TIME_MS,
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
