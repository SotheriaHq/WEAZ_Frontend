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
  metadata?: {
    ranking: string;
    personalization: string;
    minimumItems: number;
    previewItemLimit: number;
  };
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
  batchId?: string | null;
  received: number;
  persisted: {
    userFeedSignals: number;
    seenItems: number;
    marketSectionSignals: number;
    suggestionSignals: number;
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
  async getFeed(params?: GetMarketFeedParams): Promise<MarketFeedResponse> {
    const response = await apiClient.get('/collections/market', { params });
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
    return payload && Array.isArray(payload.sections)
      ? payload
      : (response.data as MarketSectionsResponse);
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
    return payload && payload.section
      ? payload
      : (response.data as MarketSectionDetailResponse);
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

