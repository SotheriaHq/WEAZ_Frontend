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
};

export default marketApi;

