import { apiClient } from './httpClient';
import { unwrapApiResponse } from '@/types/auth';
import type { MarketFeedResponse, MarketItem, MarketMediaType } from '@/types/market';
import { normalizeSizingMode } from '@/types/sizing';
import { resolveCatalogEntityType } from '@/utils/catalogEntity';

export interface GetMarketFeedParams {
  cursor?: string;
  limit?: number;
  tag?: string;
  // Optional category filter; backend may ignore until supported
  category?: string;
  counts?: 'combined';
}

type RawMarketItem = Record<string, unknown>;

export type MarketSectionSourceType =
  | 'PRODUCT'
  | 'COLLECTION'
  | 'DESIGN'
  | 'BRAND'
  | 'MIXED';

export type MarketSectionLayout =
  | 'HORIZONTAL_RAIL'
  | 'PRODUCT_GRID'
  | 'COLLECTION_RAIL'
  | 'CATEGORY_GRID'
  | 'BRAND_RAIL';

export type MarketSectionRanking = 'deterministic-v1' | 'aggregate-v1';
export type MarketSectionPersonalization = 'disabled' | 'aggregate-contextual';
export type MarketSectionRankingVersion = 'aggregate-v1';

export interface MarketSectionMetadata {
  ranking: MarketSectionRanking;
  personalization: MarketSectionPersonalization;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  rankingVersion: MarketSectionRankingVersion | null;
  shadowMode: boolean;
  rankingEnabled: boolean;
  minimumItems: number;
  previewItemLimit: number;
}

export interface MarketSectionItem {
  id: string;
  sourceId: string;
  sourceType: MarketSectionSourceType;
  entityType: 'PRODUCT' | 'COLLECTION' | 'DESIGN' | 'BRAND' | 'CATEGORY';
  title: string;
  subtitle?: string | null;
  description?: string | null;
  brand?: {
    id?: string | null;
    name?: string | null;
    logoUrl?: string | null;
  } | null;
  media?: {
    url?: string | null;
    thumbnailUrl?: string | null;
    type?: 'IMAGE' | 'VIDEO' | 'UNKNOWN';
    alt?: string | null;
  } | null;
  price?: {
    amount?: number | null;
    saleAmount?: number | null;
    effectiveAmount?: number | null;
    currency?: string;
  } | null;
  priceRange?: {
    min?: number | null;
    max?: number | null;
    currency?: string;
  } | null;
  availability?: {
    totalStock?: number | null;
    customOrderEnabled?: boolean;
    standardCheckoutEnabled?: boolean;
    isOnSale?: boolean;
  } | null;
  category?: {
    id?: string | null;
    slug?: string | null;
    name?: string | null;
  } | null;
  tags?: string[];
  stats?: {
    views?: number | null;
    threads?: number | null;
    products?: number | null;
  };
  target?: {
    type?: 'PRODUCT' | 'COLLECTION' | 'DESIGN' | 'BRAND' | 'CATEGORY';
    id?: string | null;
    key?: string | null;
    route?: string | null;
  };
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface MarketSection {
  key: string;
  title: string;
  subtitle?: string | null;
  emotionalLabel?: string | null;
  layout: MarketSectionLayout;
  sourceType: MarketSectionSourceType;
  items: MarketSectionItem[];
  viewAll?: {
    enabled: boolean;
    key: string;
    route: string;
    label: string;
  };
  pagination?: {
    limit: number;
    hasNextPage: boolean;
    nextCursor: string | null;
  };
  metadata?: MarketSectionMetadata;
}

export interface MarketSectionsResponse {
  generatedAt: string;
  sections: MarketSection[];
  metadata?: {
    version: string;
    personalization: string;
    cachePolicy: string;
  };
}

export interface MarketSectionDetailResponse {
  generatedAt: string;
  section: MarketSection;
}

export interface GetMarketSectionsParams {
  limit?: number;
  anonymousSessionId?: string;
}

export interface GetMarketSectionDetailParams {
  cursor?: string | null;
  limit?: number;
  anonymousSessionId?: string;
}

export type MarketSuggestionContext =
  | 'PRODUCT_DETAIL'
  | 'COLLECTION_DETAIL'
  | 'BRAND_DETAIL'
  | 'SEARCH_EMPTY'
  | 'MARKET_SECTION_DETAIL';

export type MarketSuggestionTargetType =
  | 'PRODUCT'
  | 'COLLECTION'
  | 'BRAND'
  | 'CATEGORY'
  | 'SECTION'
  | 'QUERY';

export type MarketSuggestionLayout = MarketSectionLayout | 'COMPACT_RAIL' | 'MIXED_GRID';
export type MarketSuggestionSourceType = MarketSectionSourceType;

export interface MarketSuggestionPagination {
  limit: number;
  hasNextPage: boolean;
  nextCursor: string | null;
}

export interface MarketSuggestionBlockMetadata {
  strategy?: string;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  personalization: 'disabled';
  ranking: 'deterministic-v1';
}

export interface MarketSuggestionResponseMetadata {
  version?: string;
  personalization: 'disabled';
  cachePolicy: 'private-no-store';
  fallbackUsed: boolean;
  fallbackReason: string | null;
  contextsDeferred?: MarketSuggestionContext[];
}

export interface MarketSuggestionBlock {
  blockKey: string;
  title: string;
  subtitle?: string | null;
  reason?: string | null;
  layout: MarketSuggestionLayout;
  sourceType: MarketSuggestionSourceType;
  items: MarketSectionItem[];
  pagination?: MarketSuggestionPagination;
  metadata?: MarketSuggestionBlockMetadata;
}

export interface MarketSuggestionResponse {
  generatedAt: string;
  context: MarketSuggestionContext;
  targetType: MarketSuggestionTargetType | null;
  targetId: string | null;
  sectionKey?: string | null;
  query?: string | null;
  blocks: MarketSuggestionBlock[];
  metadata?: MarketSuggestionResponseMetadata;
}

export interface GetMarketSuggestionsParams {
  context: MarketSuggestionContext;
  targetType?: MarketSuggestionTargetType;
  targetId?: string;
  sectionKey?: string;
  query?: string;
  limit?: number;
  cursor?: string | null;
  anonymousSessionId?: string;
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeFiniteNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const normalizeMarketSectionMetadata = (metadata: unknown): MarketSectionMetadata | undefined => {
  if (!isObjectRecord(metadata)) return undefined;

  const ranking: MarketSectionRanking =
    metadata.ranking === 'aggregate-v1' ? 'aggregate-v1' : 'deterministic-v1';
  const personalization: MarketSectionPersonalization =
    metadata.personalization === 'aggregate-contextual'
      ? 'aggregate-contextual'
      : 'disabled';

  return {
    ranking,
    personalization,
    fallbackUsed: metadata.fallbackUsed === true,
    fallbackReason: typeof metadata.fallbackReason === 'string' ? metadata.fallbackReason : null,
    rankingVersion: metadata.rankingVersion === 'aggregate-v1' ? 'aggregate-v1' : null,
    shadowMode: metadata.shadowMode === true,
    rankingEnabled: metadata.rankingEnabled === true,
    minimumItems: normalizeFiniteNumber(metadata.minimumItems, 0),
    previewItemLimit: normalizeFiniteNumber(metadata.previewItemLimit, 0),
  };
};

const normalizeMarketSection = (section: MarketSection): MarketSection => ({
  ...section,
  items: Array.isArray(section.items) ? section.items : [],
  metadata: normalizeMarketSectionMetadata(section.metadata),
});

const normalizeMarketSectionsResponse = (data: MarketSectionsResponse): MarketSectionsResponse => ({
  ...data,
  sections: Array.isArray(data.sections) ? data.sections.map(normalizeMarketSection) : [],
});

const normalizeMarketSectionDetailResponse = (
  data: MarketSectionDetailResponse,
): MarketSectionDetailResponse => ({
  ...data,
  section: normalizeMarketSection(data.section),
});

const normalizeSuggestionBlockMetadata = (
  metadata: unknown,
): MarketSuggestionBlockMetadata | undefined => {
  if (!isObjectRecord(metadata)) return undefined;
  return {
    strategy: typeof metadata.strategy === 'string' ? metadata.strategy : undefined,
    fallbackUsed: metadata.fallbackUsed === true,
    fallbackReason: typeof metadata.fallbackReason === 'string' ? metadata.fallbackReason : null,
    personalization: 'disabled',
    ranking: 'deterministic-v1',
  };
};

const normalizeMarketSuggestionResponse = (
  data: MarketSuggestionResponse,
): MarketSuggestionResponse => ({
  ...data,
  blocks: Array.isArray(data.blocks)
    ? data.blocks.map((block) => ({
        ...block,
        items: Array.isArray(block.items) ? block.items : [],
        metadata: normalizeSuggestionBlockMetadata(block.metadata),
        pagination: block.pagination
          ? {
              limit: normalizeFiniteNumber(block.pagination.limit, 0),
              hasNextPage: block.pagination.hasNextPage === true,
              nextCursor:
                typeof block.pagination.nextCursor === 'string'
                  ? block.pagination.nextCursor
                  : null,
            }
          : undefined,
      }))
    : [],
  metadata: isObjectRecord(data.metadata)
    ? {
        version: typeof data.metadata.version === 'string' ? data.metadata.version : undefined,
        personalization: 'disabled',
        cachePolicy: 'private-no-store',
        fallbackUsed: data.metadata.fallbackUsed === true,
        fallbackReason:
          typeof data.metadata.fallbackReason === 'string'
            ? data.metadata.fallbackReason
            : null,
        contextsDeferred: Array.isArray(data.metadata.contextsDeferred)
          ? data.metadata.contextsDeferred.filter(
              (context): context is MarketSuggestionContext => typeof context === 'string',
            )
          : undefined,
      }
    : undefined,
});

export type MarketSignalTargetType =
  | 'PRODUCT'
  | 'COLLECTION'
  | 'DESIGN'
  | 'BRAND'
  | 'CATEGORY'
  | 'SECTION'
  | 'SUGGESTION_BLOCK';

export type MarketSignalType =
  | 'IMPRESSION'
  | 'VIEW'
  | 'CLICK'
  | 'OPEN'
  | 'VIEW_ALL_CLICK'
  | 'HIDE'
  | 'NOT_INTERESTED'
  | 'DWELL_SHORT'
  | 'DWELL_MEDIUM'
  | 'DWELL_LONG'
  | 'SCROLL_SKIP'
  | 'LIKE'
  | 'SAVE'
  | 'COMMENT'
  | 'THREAD'
  | 'SHARE'
  | 'PROFILE_TAP'
  | 'PRODUCT_VIEW'
  | 'ADD_TO_CART'
  | 'WISHLIST'
  | 'PURCHASE'
  | 'MARKET_SECTION_VIEW'
  | 'MARKET_SECTION_SCROLL'
  | 'MARKET_SECTION_VIEW_ALL_CLICK'
  | 'MARKET_SECTION_DETAIL_VIEW'
  | 'MARKET_SECTION_DETAIL_SCROLL'
  | 'MARKET_SECTION_DISMISS'
  | 'MARKET_SECTION_BACK_TO_HOME'
  | 'SUGGESTION_BLOCK_VIEW'
  | 'SUGGESTION_ITEM_VIEW'
  | 'SUGGESTION_ITEM_CLICK'
  | 'SUGGESTION_ITEM_WISHLIST'
  | 'SUGGESTION_ITEM_CART_ADD'
  | 'SUGGESTION_ITEM_HIDE'
  | 'SUGGESTION_BLOCK_HIDE'
  | 'SUGGESTION_VIEW_ALL_CLICK';

export type MarketSignalSurface =
  | 'MARKET_HOME'
  | 'MARKET_SECTION_DETAIL'
  | 'DESIGN_FEED'
  | 'PRODUCT_DETAIL'
  | 'COLLECTION_DETAIL'
  | 'BRAND_DETAIL'
  | 'SEARCH'
  | 'SUGGESTION_BLOCK';

export type MarketSuppressionType =
  | 'HIDE_ITEM'
  | 'NOT_INTERESTED'
  | 'HIDE_BRAND'
  | 'HIDE_CATEGORY'
  | 'HIDE_SECTION'
  | 'HIDE_SUGGESTION_BLOCK'
  | 'SHOW_LESS';

export interface MarketSignalEvent {
  clientEventId?: string | null;
  targetType: MarketSignalTargetType;
  targetId: string;
  signalType: MarketSignalType;
  surface: MarketSignalSurface;
  value?: number | null;
  sectionKey?: string | null;
  suggestionBlockKey?: string | null;
  screenContext?: string | null;
  sessionId?: string | null;
  position?: number | null;
  metadata?: Record<string, unknown>;
}

export interface MarketSignalBatchRequest {
  batchId?: string;
  anonymousSessionId?: string;
  sessionId?: string;
  events: MarketSignalEvent[];
}

export interface MarketSignalBatchResponse {
  accepted: boolean;
  duplicate?: boolean;
  batchId?: string | null;
  received: number;
  deduplicated?: number;
  persisted: {
    userFeedSignals: number;
    seenItems: number;
    marketSectionSignals: number;
    suggestionSignals: number;
  };
  aggregation?: {
    mode?: string;
    status?: string;
    eventsAggregated?: number;
    bucketsUpdated?: number;
  };
}

export interface CreateMarketSuppressionRequest {
  anonymousSessionId?: string;
  targetType: MarketSignalTargetType;
  targetId?: string | null;
  brandId?: string | null;
  categoryId?: string | null;
  sectionKey?: string | null;
  suggestionBlockKey?: string | null;
  suppressionType: MarketSuppressionType;
  reason?: string | null;
  expiresAt?: string | null;
}

export interface MarketSuppression {
  id: string;
  userId?: string | null;
  anonymousSessionId?: string | null;
  targetType: MarketSignalTargetType;
  targetId?: string | null;
  brandId?: string | null;
  categoryId?: string | null;
  sectionKey?: string | null;
  suggestionBlockKey?: string | null;
  suppressionType: MarketSuppressionType;
  reason?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GetMarketSuppressionsParams {
  anonymousSessionId?: string;
}

export interface ResetFeedPreferencesRequest {
  resetType: 'FEED' | 'MARKET' | 'SUGGESTIONS' | 'ALL';
  reason?: string | null;
}

const toMarketItem = (raw: RawMarketItem): MarketItem => {
  const collection = (raw.collection as Record<string, unknown>) ?? {};
  const owner = (collection.owner as Record<string, unknown>) ?? {};
  const media = (raw.media ?? raw.file ?? raw) as Record<string, unknown>;
  const rawTags = Array.isArray(raw.tags)
    ? (raw.tags as unknown[]).map((tag) => (typeof tag === 'string' ? tag : '')).filter(Boolean)
    : [];

  const tags = Array.isArray(collection.tags)
    ? (collection.tags as unknown[]).map((tag) => (typeof tag === 'string' ? tag : '')).filter(Boolean)
    : rawTags;

  const mediaFileId =
    typeof media.fileId === 'string'
      ? (media.fileId as string)
      : typeof raw.mediaFileId === 'string'
        ? (raw.mediaFileId as string)
        : (raw.fileUploadId as string);

  const mediaUrl =
    typeof media.url === 'string'
      ? (media.url as string)
      : typeof media.s3Url === 'string'
        ? (media.s3Url as string)
        : typeof raw.mediaUrl === 'string'
          ? (raw.mediaUrl as string)
          : undefined;

  const mediaType = (raw.mediaType as MarketMediaType) ?? ((media.mediaType || media.type) as MarketMediaType) ?? 'POST_IMAGE';

  const num = (v: unknown): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
    return null;
  };

  const mapped: MarketItem = {
    id: String(raw.id ?? mediaFileId ?? ''),
    entityType: resolveCatalogEntityType(raw, 'DESIGN') ?? 'DESIGN',
    collectionId: String(raw.collectionId ?? collection.id ?? ''),
    coverMediaId:
      typeof raw.coverMediaId === 'string'
        ? (raw.coverMediaId as string)
        : typeof (collection as { coverMediaId?: unknown }).coverMediaId === 'string'
          ? ((collection as { coverMediaId?: string }).coverMediaId ?? null)
          : null,
    collectionTitle: String(collection.title ?? raw.collectionTitle ?? ''),
    collectionDescription:
      typeof collection.description === 'string'
        ? collection.description
        : typeof raw.collectionDescription === 'string'
          ? raw.collectionDescription
          : null,
    brandId: String(raw.brandId ?? owner.id ?? ''),
    brandName:
      (owner.brandFullName as string) ??
      (owner.brandName as string) ??
      (raw.brandName as string) ??
      (owner.username as string) ??
      null,
    username: (owner.username as string) ?? (raw.username as string) ?? null,
    brandLogo: (owner.profileImage as string) ?? (raw.brandLogo as string) ?? null,
    brandLogoFileId:
      (owner.profileImageId as string) ??
      ((owner.profileImageFile as Record<string, unknown> | undefined)?.id as string | undefined) ??
      (raw.brandLogoFileId as string | undefined) ??
      null,
    minPrice:
      num(collection.minPrice) ?? num(raw.minPrice),
    maxPrice:
      num(collection.maxPrice) ?? num(raw.maxPrice),
    // Include sale fields if provided by backend; accept number or numeric string
    saleMinPrice: num((collection as any).saleMinPrice ?? (raw as any).saleMinPrice),
    saleMaxPrice: num((collection as any).saleMaxPrice ?? (raw as any).saleMaxPrice),
    saleStartAt:
      (collection as any).saleStartAt && typeof (collection as any).saleStartAt === 'string'
        ? ((collection as any).saleStartAt as string)
        : typeof (raw as any).saleStartAt === 'string'
          ? ((raw as any).saleStartAt as string)
          : null,
    saleEndAt:
      (collection as any).saleEndAt && typeof (collection as any).saleEndAt === 'string'
        ? ((collection as any).saleEndAt as string)
        : typeof (raw as any).saleEndAt === 'string'
          ? ((raw as any).saleEndAt as string)
          : null,
    threadsCount:
      typeof raw.threadsCount === 'number'
        ? (raw.threadsCount as number)
        : typeof collection.threadsCount === 'number'
          ? (collection.threadsCount as number)
          : null,
    commentsCount:
      typeof raw.commentsCount === 'number'
        ? (raw.commentsCount as number)
        : typeof collection.commentsCount === 'number'
          ? (collection.commentsCount as number)
          : null,
    collectionCollabCount:
      typeof collection.collectionCollabCount === 'number'
        ? (collection.collectionCollabCount as number)
        : typeof raw.collectionCollabCount === 'number'
          ? (raw.collectionCollabCount as number)
          : null,
    sizingMode: normalizeSizingMode(
      typeof (collection as any).sizingMode === 'string'
        ? String((collection as any).sizingMode)
        : typeof (raw as any).sizingMode === 'string'
          ? String((raw as any).sizingMode)
          : undefined,
    ),
    customMeasurementKeys: Array.isArray((collection as any).customMeasurementKeys)
      ? ((collection as any).customMeasurementKeys as string[])
      : Array.isArray((raw as any).customMeasurementKeys)
        ? ((raw as any).customMeasurementKeys as string[])
        : [],
    customAvailable:
      typeof (raw as any).customAvailable === 'boolean'
        ? Boolean((raw as any).customAvailable)
        : typeof (collection as any).customAvailable === 'boolean'
          ? Boolean((collection as any).customAvailable)
            : false,
    tags,
    isThreaded: typeof raw.isThreaded === 'boolean' ? (raw.isThreaded as boolean) : false,
    media: {
      fileId: mediaFileId || '',
      url: mediaUrl,
      previewUrl:
        typeof media.previewUrl === 'string'
          ? (media.previewUrl as string)
          : typeof raw.previewUrl === 'string'
            ? (raw.previewUrl as string)
            : mediaUrl,
      type: mediaType,
      aspectRatio:
        typeof media.aspectRatio === 'number'
          ? (media.aspectRatio as number)
          : typeof raw.aspectRatio === 'number'
            ? (raw.aspectRatio as number)
            : null,
      createdAt:
        typeof media.createdAt === 'string'
          ? (media.createdAt as string)
          : typeof raw.createdAt === 'string'
            ? (raw.createdAt as string)
            : null,
    },
  };

  return mapped;
};

export const marketApi = {
  async getFeed(
    params?: GetMarketFeedParams,
    options?: { signal?: AbortSignal },
  ): Promise<MarketFeedResponse> {
    const response = await apiClient.get('/collections/market', {
      params,
      signal: options?.signal,
    });
    const payload = unwrapApiResponse<MarketFeedResponse | { items?: unknown }>(response.data);
    const data =
      (payload && 'items' in payload ? payload : response.data) as MarketFeedResponse & {
        items?: RawMarketItem[];
      };

    const rawItems = (data as { items?: RawMarketItem[] }).items;
    const mappedItems = Array.isArray(rawItems) ? rawItems.map((item) => {
      const mapped = toMarketItem(item);
      if (typeof (item as any).combinedCommentsCount === 'number') {
        mapped.commentsCount = (item as any).combinedCommentsCount as number;
      }
      return mapped;
    }) : [];

    // Safety net: collapse any duplicate media rows so every design collection
    // renders as a single card using its cover media.
    const byCollection = new Map<string, MarketItem>();
    mappedItems.forEach((entry) => {
      if (!entry.collectionId) return;
      const existing = byCollection.get(entry.collectionId);
      if (!existing) {
        byCollection.set(entry.collectionId, entry);
        return;
      }

      const preferredId = entry.coverMediaId ?? existing.coverMediaId ?? null;
      const existingIsCover = preferredId ? existing.id === preferredId : false;
      const entryIsCover = preferredId ? entry.id === preferredId : false;
      if (!existingIsCover && entryIsCover) {
        byCollection.set(entry.collectionId, entry);
      }
    });
    const items = Array.from(byCollection.values());

    return {
      items,
      hasNextPage: Boolean((data as MarketFeedResponse)?.hasNextPage ?? items.length > 0),
      nextCursor: (data as MarketFeedResponse)?.nextCursor ?? null,
    };
  },

  async getMarketSections(
    params?: GetMarketSectionsParams,
    options?: { signal?: AbortSignal },
  ): Promise<MarketSectionsResponse> {
    const response = await apiClient.get('/market/sections', {
      params,
      signal: options?.signal,
    });
    const payload = unwrapApiResponse<MarketSectionsResponse>(response.data);
    const data = payload && Array.isArray(payload.sections)
      ? payload
      : (response.data as MarketSectionsResponse);
    return normalizeMarketSectionsResponse(data);
  },

  async getMarketSectionDetail(
    key: string,
    params?: GetMarketSectionDetailParams,
    options?: { signal?: AbortSignal },
  ): Promise<MarketSectionDetailResponse> {
    const response = await apiClient.get(`/market/sections/${encodeURIComponent(key)}`, {
      params: {
        cursor: params?.cursor ?? undefined,
        limit: params?.limit,
        anonymousSessionId: params?.anonymousSessionId,
      },
      signal: options?.signal,
    });
    const payload = unwrapApiResponse<MarketSectionDetailResponse>(response.data);
    const data = payload && payload.section
      ? payload
      : (response.data as MarketSectionDetailResponse);
    return normalizeMarketSectionDetailResponse(data);
  },

  async getMarketSuggestions(
    params: GetMarketSuggestionsParams,
    options?: { signal?: AbortSignal },
  ): Promise<MarketSuggestionResponse> {
    const response = await apiClient.get('/market/suggestions', {
      params: {
        context: params.context,
        targetType: params.targetType,
        targetId: params.targetId,
        sectionKey: params.sectionKey,
        query: params.query,
        limit: params.limit,
        cursor: params.cursor ?? undefined,
        anonymousSessionId: params.anonymousSessionId,
      },
      signal: options?.signal,
    });
    const payload = unwrapApiResponse<MarketSuggestionResponse>(response.data);
    const data = payload && Array.isArray(payload.blocks)
      ? payload
      : (response.data as MarketSuggestionResponse);
    return normalizeMarketSuggestionResponse(data);
  },

  async sendMarketSignalBatch(
    payload: MarketSignalBatchRequest,
    options?: { signal?: AbortSignal },
  ): Promise<MarketSignalBatchResponse> {
    const response = await apiClient.post('/market/signals/batch', payload, {
      signal: options?.signal,
    });
    return unwrapApiResponse<MarketSignalBatchResponse>(response.data) ?? response.data;
  },

  async createMarketSuppression(
    payload: CreateMarketSuppressionRequest,
    options?: { signal?: AbortSignal },
  ): Promise<MarketSuppression> {
    const response = await apiClient.post('/market/suppressions', payload, {
      signal: options?.signal,
    });
    return unwrapApiResponse<MarketSuppression>(response.data) ?? response.data;
  },

  async deleteMarketSuppression(
    id: string,
    params?: { anonymousSessionId?: string },
    options?: { signal?: AbortSignal },
  ): Promise<{ deleted: boolean; id: string }> {
    const response = await apiClient.delete(`/market/suppressions/${encodeURIComponent(id)}`, {
      params,
      signal: options?.signal,
    });
    return unwrapApiResponse<{ deleted: boolean; id: string }>(response.data) ?? response.data;
  },

  async getMarketSuppressions(
    params?: GetMarketSuppressionsParams,
    options?: { signal?: AbortSignal },
  ): Promise<MarketSuppression[]> {
    const response = await apiClient.get('/market/suppressions', {
      params,
      signal: options?.signal,
    });
    const payload = unwrapApiResponse<MarketSuppression[]>(response.data);
    return Array.isArray(payload)
      ? payload
      : Array.isArray(response.data)
        ? (response.data as MarketSuppression[])
        : [];
  },

  async resetFeedPreferences(
    payload: ResetFeedPreferencesRequest,
    options?: { signal?: AbortSignal },
  ): Promise<unknown> {
    const response = await apiClient.post('/user/preferences/feed/reset', payload, {
      signal: options?.signal,
    });
    return unwrapApiResponse<unknown>(response.data) ?? response.data;
  },
};

export default marketApi;

