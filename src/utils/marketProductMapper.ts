import type { StoreProduct } from '@/components/designs/StoreProductCard';
import { normalizeSizingMode } from '@/types/sizing';
import { resolveCatalogEntityType } from '@/utils/catalogEntity';

export interface RawProductsPayload {
  items?: unknown[];
  total?: number;
  hasNextPage?: boolean;
  nextCursor?: string | null;
}

export type MarketplaceProduct = StoreProduct & {
  createdAt?: string;
  updatedAt?: string;
};

const parseTimestamp = (value?: string | null): number => {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
};

export const getProductRecencyTimestamp = (product: MarketplaceProduct): number => {
  const createdTs = parseTimestamp(product.createdAt);
  const updatedTs = parseTimestamp(product.updatedAt);
  const publishedTs = parseTimestamp(product.publishAt ?? null);
  return Math.max(createdTs, updatedTs, publishedTs);
};

export const normalizeMarketProduct = (raw: any): MarketplaceProduct | null => {
  const id = String(raw?.id ?? '').trim();
  if (!id) return null;

  const brand = raw?.brand ?? raw?.collection?.brand ?? {};
  const price = Number(raw?.price ?? 0);
  const salePrice = raw?.salePrice != null ? Number(raw.salePrice) : null;
  const totalStock = Number(raw?.totalStock ?? 0);
  const now = Date.now();
  const saleStartAt = raw?.saleStartAt ? new Date(raw.saleStartAt).getTime() : null;
  const saleEndAt = raw?.saleEndAt ? new Date(raw.saleEndAt).getTime() : null;
  const saleWindowValid = (!saleStartAt || saleStartAt <= now) && (!saleEndAt || saleEndAt >= now);
  const isOnSale = Boolean(salePrice != null && salePrice > 0 && salePrice < price && saleWindowValid);
  const effectivePrice = isOnSale ? Number(salePrice) : price;
  const discountPercent = isOnSale && price > 0 ? Math.round(((price - Number(salePrice)) / price) * 100) : null;

  const media = Array.isArray(raw?.media)
    ? raw.media
      .map((m: any) => {
        const mediaId = m?.id ? String(m.id) : null;
        const mediaUrl = m?.url ? String(m.url) : null;
        if (!mediaId || !mediaUrl) return null;
        return {
          id: mediaId,
          url: mediaUrl,
          type: String(m?.type ?? 'image'),
          isPrimary: Boolean(m?.isPrimary),
        };
      })
      .filter(Boolean) as Array<{ id: string; url: string; type: string; isPrimary?: boolean }>
    : [];

  const sizeAvailability = Array.isArray(raw?.sizes)
    ? raw.sizes.map((size: any) => ({
      size: String(size),
      inStock: totalStock > 0,
      quantity: totalStock,
    }))
    : [];

  const variants: StoreProduct['variants'] = Array.isArray(raw?.variants)
    ? raw.variants
      .map((v: any) => {
        const variantId = String(v?.id ?? '').trim();
        if (!variantId) return null;
        return {
          id: variantId,
          size: v?.size != null ? String(v.size) : null,
          color: v?.color != null ? String(v.color) : null,
          stock: Number(v?.stock ?? 0),
          price: v?.price != null ? Number(v.price) : null,
          sku: v?.sku != null ? String(v.sku) : null,
          colorHex: v?.colorHex != null ? String(v.colorHex) : null,
        };
      })
      .filter((v: StoreProduct['variants'] extends Array<infer T> ? T | null : never): v is StoreProduct['variants'] extends Array<infer T> ? T : never => Boolean(v))
    : [];

  const name = String(raw?.name ?? raw?.title ?? 'Product');

  return {
    id,
    entityType: resolveCatalogEntityType(raw, 'PRODUCT') ?? 'PRODUCT',
    collectionId: String(raw?.collectionId ?? raw?.collection?.id ?? ''),
    brandId: String(raw?.brandId ?? brand?.id ?? ''),
    name,
    description: raw?.description ? String(raw.description) : undefined,
    price,
    salePrice,
    effectivePrice,
    isOnSale,
    discountPercent,
    thumbnail: raw?.thumbnail ? String(raw.thumbnail) : undefined,
    images: Array.isArray(raw?.images) ? raw.images.map((img: any) => String(img)) : [],
    media,
    sizes: Array.isArray(raw?.sizes) ? raw.sizes.map((size: any) => String(size)) : [],
    sizingMode: normalizeSizingMode(raw?.sizingMode),
    customMeasurementKeys: Array.isArray(raw?.customMeasurementKeys)
      ? raw.customMeasurementKeys.map((key: any) => String(key))
      : [],
    customAvailable: Boolean(raw?.customAvailable ?? raw?.customOrderEnabled),
    customOrderEnabled: Boolean(raw?.customOrderEnabled ?? raw?.customAvailable),
    isCustomOrderOnly: Boolean(raw?.isCustomOrderOnly),
    canBagWhenOutOfStock: Boolean(raw?.canBagWhenOutOfStock),
    sizeAvailability,
    colors: Array.isArray(raw?.colors) ? raw.colors.map((color: any) => String(color)) : [],
    variants,
    totalStock,
    isLowStock: totalStock > 0 && totalStock <= 5,
    isOutOfStock: totalStock <= 0,
    isFeatured: Boolean(raw?.isFeatured),
    isActive: typeof raw?.isActive === 'boolean' ? raw.isActive : undefined,
    publishAt: raw?.publishAt ? String(raw.publishAt) : null,
    createdAt: raw?.createdAt ? String(raw.createdAt) : undefined,
    updatedAt: raw?.updatedAt ? String(raw.updatedAt) : undefined,
    threadsCount: Number(raw?.threadsCount ?? 0),
    viewsCount: Number(raw?.viewsCount ?? 0),
    brand: {
      id: String(brand?.id ?? raw?.brandId ?? ''),
      name: String(brand?.brandName ?? brand?.name ?? 'Brand'),
      logo: brand?.logoUrl ? String(brand.logoUrl) : undefined,
      currency: String(brand?.currency ?? raw?.currency ?? 'NGN'),
    },
  };
};
