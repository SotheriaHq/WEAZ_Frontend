import type { MarketItem } from '@/types/market';
import { resolveProfileImageSource } from '@/utils/profileImage';

export const toDesignMarketItem = (
  detail: any,
  mediaOverrideId?: string | null,
): MarketItem | null => {
  if (!detail) return null;

  const medias = Array.isArray(detail.medias)
    ? detail.medias
    : Array.isArray(detail.media)
      ? detail.media
      : [];
  const selectedMedia =
    medias.find((media: any) => media?.id === mediaOverrideId) ||
    medias.find((media: any) => media?.id === detail.coverMediaId) ||
    medias[0] ||
    null;

  if (!selectedMedia) return null;

  const file = selectedMedia.file ?? {};
  const mediaUrl =
    (typeof file.s3Url === 'string' && file.s3Url) ||
    (typeof file.url === 'string' && file.url) ||
    (typeof selectedMedia.url === 'string' && selectedMedia.url) ||
    '';
  const owner = detail.owner ?? {};
  const ownerAvatar = resolveProfileImageSource(owner ?? null);
  const designId = String(detail.designId ?? detail.id ?? detail.collectionId ?? '');
  const legacyCollectionId =
    typeof detail.legacyCollectionId === 'string' && detail.legacyCollectionId.trim().length > 0
      ? detail.legacyCollectionId
      : null;
  const collectionId = String(detail.collectionId ?? legacyCollectionId ?? designId);

  return {
    id: String(selectedMedia.id),
    entityType: 'DESIGN',
    designId,
    legacyCollectionId,
    collectionId,
    coverMediaId: detail.coverMediaId ?? null,
    collectionTitle: String(detail.title ?? 'Design'),
    collectionDescription: typeof detail.description === 'string' ? detail.description : null,
    brandId: String(detail.brandId ?? owner?.brand?.id ?? owner?.id ?? ''),
    brandName: owner?.brand?.brandName ?? owner?.brand?.name ?? owner?.username ?? null,
    username: owner?.username ?? null,
    brandLogo: ownerAvatar.src,
    brandLogoFileId: ownerAvatar.fileId,
    minPrice: typeof detail.minPrice === 'number' ? detail.minPrice : null,
    maxPrice: typeof detail.maxPrice === 'number' ? detail.maxPrice : null,
    saleMinPrice: typeof detail.saleMinPrice === 'number' ? detail.saleMinPrice : null,
    saleMaxPrice: typeof detail.saleMaxPrice === 'number' ? detail.saleMaxPrice : null,
    saleStartAt: typeof detail.saleStartAt === 'string' ? detail.saleStartAt : null,
    saleEndAt: typeof detail.saleEndAt === 'string' ? detail.saleEndAt : null,
    threadsCount: typeof detail.threadsCount === 'number'
      ? detail.threadsCount
      : typeof detail.totalThreads === 'number'
        ? detail.totalThreads
        : null,
    commentsCount: typeof detail.commentsCount === 'number' ? detail.commentsCount : null,
    collectionCollabCount: null,
    customMeasurementKeys: Array.isArray(detail.customMeasurementKeys)
      ? detail.customMeasurementKeys
      : [],
    customAvailable: detail.customOrderEnabled === true || detail.customAvailable === true,
    tags: Array.isArray(detail.tags) ? detail.tags : [],
    media: {
      fileId: String(file.id ?? selectedMedia.fileUploadId ?? selectedMedia.id ?? ''),
      url: mediaUrl,
      previewUrl: mediaUrl,
      type: String(selectedMedia.mediaType ?? selectedMedia.type ?? file.mimeType ?? 'POST_IMAGE')
        .toUpperCase()
        .includes('VIDEO')
        ? 'POST_VIDEO'
        : 'POST_IMAGE',
      aspectRatio: null,
      createdAt: null,
    },
    isThreaded: false,
  };
};
