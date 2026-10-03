import type { MarketSectionItem } from '@/api/MarketApi';
import {
  normalizeMarketProduct,
  type MarketplaceProduct,
} from '@/utils/marketProductMapper';

export const mapSectionProductToMarketplaceProduct = (
  item: MarketSectionItem,
): MarketplaceProduct | null => {
  if (item.sourceType !== 'PRODUCT' || item.entityType !== 'PRODUCT') return null;
  const id = String(item.sourceId || item.id || '').trim();
  const mediaUrl = item.media?.url || item.media?.thumbnailUrl || null;
  const mediaFileId = item.media?.fileId ?? null;
  // Allow product open when we have a fileId even if the raw URL is unsigned/unusable.
  if (!id || (!mediaUrl && !mediaFileId)) return null;

  return normalizeMarketProduct({
    id,
    entityType: 'PRODUCT',
    name: item.title,
    description: item.description ?? undefined,
    price: item.price?.amount ?? item.price?.effectiveAmount ?? 0,
    salePrice: item.price?.saleAmount ?? null,
    currency: item.price?.currency ?? 'NGN',
    thumbnail: item.media?.thumbnailUrl ?? mediaUrl ?? undefined,
    images: mediaUrl ? [mediaUrl] : [],
    media: [
      {
        id: mediaFileId || id,
        fileUploadId: mediaFileId,
        url: mediaUrl || '',
        type: 'image',
        isPrimary: true,
        width: item.media?.width ?? null,
        height: item.media?.height ?? null,
        aspectRatio: item.media?.aspectRatio ?? null,
      },
    ],
    mediaIds: mediaFileId ? [mediaFileId] : undefined,
    totalStock: item.availability?.totalStock ?? 0,
    customOrderEnabled: Boolean(item.availability?.customOrderEnabled),
    customAvailable: Boolean(item.availability?.customOrderEnabled),
    tags: item.tags ?? [],
    categoryId: item.category?.id ?? undefined,
    createdAt: item.createdAt ?? undefined,
    updatedAt: item.updatedAt ?? undefined,
    viewsCount: item.stats?.views ?? 0,
    threadsCount: item.stats?.threads ?? 0,
    brandId: item.brand?.id ?? undefined,
    brand: {
      id: item.brand?.id ?? '',
      brandName: item.brand?.name ?? 'Brand',
      logoUrl: item.brand?.logoUrl ?? undefined,
      currency: item.price?.currency ?? 'NGN',
    },
  });
};

export const getSectionItemTargetId = (item: MarketSectionItem) => {
  return String(item.target?.id || item.sourceId || item.id || '').trim();
};

export const getSectionItemStableKey = (item: MarketSectionItem) => {
  return `${item.sourceType}:${item.sourceId || item.id}`;
};

export const getSectionItemSignalKey = (
  sectionKey: string,
  item: MarketSectionItem,
  index: number,
) => {
  return `${sectionKey}:${item.entityType}:${getSectionItemTargetId(item)}:${index}`;
};
