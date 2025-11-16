import { apiClient } from './httpClient';
import { unwrapApiResponse } from '@/types/auth';
import type { MarketFeedResponse, MarketItem, MarketMediaType } from '@/types/market';

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
    collectionId: String(raw.collectionId ?? collection.id ?? ''),
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
    likesCount:
      typeof raw.likesCount === 'number'
        ? (raw.likesCount as number)
        : typeof collection.likesCount === 'number'
          ? (collection.likesCount as number)
          : null,
    commentsCount:
      typeof raw.commentsCount === 'number'
        ? (raw.commentsCount as number)
        : typeof collection.commentsCount === 'number'
          ? (collection.commentsCount as number)
          : null,
    patchesCount:
      typeof collection.patchesCount === 'number'
        ? (collection.patchesCount as number)
        : typeof raw.patchesCount === 'number'
          ? (raw.patchesCount as number)
          : null,
    tags,
    isLiked: typeof raw.isLiked === 'boolean' ? (raw.isLiked as boolean) : false,
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

  if (mapped.saleMinPrice != null || mapped.saleMaxPrice != null) {
    // Surface when sale data is present so UI should render stacked/green badge
    // Also helps detect numeric-string coercion working as intended
    // eslint-disable-next-line no-console
    console.log('🧾 [MarketApi] Sale fields mapped', {
      id: mapped.id,
      saleMinPrice: mapped.saleMinPrice,
      saleMaxPrice: mapped.saleMaxPrice,
      saleStartAt: mapped.saleStartAt,
      saleEndAt: mapped.saleEndAt,
    });
  }

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
    const items = Array.isArray(rawItems) ? rawItems.map((item) => {
      const mapped = toMarketItem(item);
      if (typeof (item as any).combinedCommentsCount === 'number') {
        mapped.commentsCount = (item as any).combinedCommentsCount as number;
      }
      return mapped;
    }) : [];
    return {
      items,
      hasNextPage: Boolean((data as MarketFeedResponse)?.hasNextPage ?? items.length > 0),
      nextCursor: (data as MarketFeedResponse)?.nextCursor ?? null,
    };
  },
};

export default marketApi;

