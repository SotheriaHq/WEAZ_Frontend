import { apiClient } from './httpClient';

// Design creation/upload moved to the design domain (`DesignApi` +
// `useDesignUpload`); store collections use the store-collections endpoints.
// This module keeps only the live collection reads: cart preview and draft
// expiry stats.

// ===================== Cart Preview Types =====================
export interface CartPreviewProduct {
  id: string;
  name: string;
  price: number;
  salePrice?: number | null;
  currency: string;
  thumbnail?: string | null;
  images?: string[];
  isAvailable: boolean;
  unavailableReason?: string;
  variants?: { size?: string; color?: string; stock: number; price?: number }[];
  sizes?: string[];
  colors?: string[];
  defaultSize?: string;
  defaultColor?: string;
}

export interface CollectionCartPreviewResponse {
  collectionId: string;
  collectionTitle: string;
  totalProducts: number;
  availableCount: number;
  unavailableCount: number;
  totalPrice: number;
  currency: string;
  products: CartPreviewProduct[];
}

type RawCartPreviewItem = {
  productId?: string;
  id?: string;
  name?: string;
  price?: number;
  salePrice?: number | null;
  effectivePrice?: number;
  currency?: string;
  thumbnail?: string | null;
  images?: string[];
  variants?: { size?: string; color?: string; stock: number; price?: number }[];
  sizes?: string[];
  colors?: string[];
  defaultSize?: string;
  defaultColor?: string;
  reason?: string;
};

type RawCartPreviewEnvelope = {
  collectionId?: string;
  collectionTitle?: string;
  available?: RawCartPreviewItem[];
  unavailable?: RawCartPreviewItem[];
  summary?: {
    availableCount?: number;
    unavailableCount?: number;
    totalCount?: number;
    availableSubtotal?: number;
    currency?: string;
  };
  // Client-ready shape fallback
  totalProducts?: number;
  availableCount?: number;
  unavailableCount?: number;
  totalPrice?: number;
  currency?: string;
  products?: CartPreviewProduct[];
};

const mapUnavailableReason = (reason?: string): string => {
  switch (String(reason || '').toLowerCase()) {
    case 'out_of_stock':
      return 'Out of stock';
    case 'archived':
      return 'Archived';
    case 'deleted':
      return 'Deleted';
    case 'inactive':
      return 'Not active';
    case 'scheduled':
      return 'Scheduled for later';
    default:
      return 'Unavailable';
  }
};

const normalizeCollectionCartPreview = (
  raw: RawCartPreviewEnvelope,
): CollectionCartPreviewResponse => {
  const legacyProducts = Array.isArray(raw?.products) ? raw.products : null;
  if (legacyProducts) {
    return {
      collectionId: String(raw?.collectionId || ''),
      collectionTitle: String(raw?.collectionTitle || 'Collection'),
      totalProducts:
        typeof raw?.totalProducts === 'number'
          ? raw.totalProducts
          : legacyProducts.length,
      availableCount:
        typeof raw?.availableCount === 'number'
          ? raw.availableCount
          : legacyProducts.filter((p) => p.isAvailable).length,
      unavailableCount:
        typeof raw?.unavailableCount === 'number'
          ? raw.unavailableCount
          : legacyProducts.filter((p) => !p.isAvailable).length,
      totalPrice:
        typeof raw?.totalPrice === 'number'
          ? raw.totalPrice
          : legacyProducts
              .filter((p) => p.isAvailable)
              .reduce((sum, p) => sum + Number(p.salePrice ?? p.price ?? 0), 0),
      currency: String(raw?.currency || 'NGN'),
      products: legacyProducts,
    };
  }

  const available = Array.isArray(raw?.available) ? raw.available : [];
  const unavailable = Array.isArray(raw?.unavailable) ? raw.unavailable : [];
  const currency =
    raw?.summary?.currency ||
    available[0]?.currency ||
    unavailable[0]?.currency ||
    raw?.currency ||
    'NGN';

  const availableProducts: CartPreviewProduct[] = available
    .filter((item): item is RawCartPreviewItem => Boolean(item?.productId || item?.id))
    .map((item) => ({
      id: String(item.productId || item.id),
      name: String(item.name || 'Product'),
      price: Number(item.price ?? 0),
      salePrice:
        typeof item.salePrice === 'number' ? Number(item.salePrice) : null,
      currency: String(item.currency || currency),
      thumbnail: item.thumbnail ?? null,
      images: Array.isArray(item.images) ? item.images : [],
      isAvailable: true,
      variants: Array.isArray(item.variants) ? item.variants : [],
      sizes: Array.isArray(item.sizes) ? item.sizes : [],
      colors: Array.isArray(item.colors) ? item.colors : [],
      defaultSize:
        typeof item.defaultSize === 'string' ? item.defaultSize : undefined,
      defaultColor:
        typeof item.defaultColor === 'string' ? item.defaultColor : undefined,
    }));

  const unavailableProducts: CartPreviewProduct[] = unavailable
    .filter((item): item is RawCartPreviewItem => Boolean(item?.productId || item?.id))
    .map((item) => ({
      id: String(item.productId || item.id),
      name: String(item.name || 'Product'),
      price: Number(item.price ?? 0),
      salePrice:
        typeof item.salePrice === 'number' ? Number(item.salePrice) : null,
      currency: String(item.currency || currency),
      thumbnail: item.thumbnail ?? null,
      images: Array.isArray(item.images) ? item.images : [],
      isAvailable: false,
      unavailableReason: mapUnavailableReason(item.reason),
      variants: Array.isArray(item.variants) ? item.variants : [],
      sizes: Array.isArray(item.sizes) ? item.sizes : [],
      colors: Array.isArray(item.colors) ? item.colors : [],
      defaultSize:
        typeof item.defaultSize === 'string' ? item.defaultSize : undefined,
      defaultColor:
        typeof item.defaultColor === 'string' ? item.defaultColor : undefined,
    }));

  const products = [...availableProducts, ...unavailableProducts];

  return {
    collectionId: String(raw?.collectionId || ''),
    collectionTitle: String(raw?.collectionTitle || 'Collection'),
    totalProducts:
      typeof raw?.summary?.totalCount === 'number'
        ? raw.summary.totalCount
        : products.length,
    availableCount:
      typeof raw?.summary?.availableCount === 'number'
        ? raw.summary.availableCount
        : availableProducts.length,
    unavailableCount:
      typeof raw?.summary?.unavailableCount === 'number'
        ? raw.summary.unavailableCount
        : unavailableProducts.length,
    totalPrice:
      typeof raw?.summary?.availableSubtotal === 'number'
        ? raw.summary.availableSubtotal
        : availableProducts.reduce(
            (sum, p) => sum + Number(p.salePrice ?? p.price ?? 0),
            0,
          ),
    currency: String(currency),
    products,
  };
};

// ===================== Cart Preview API =====================
/**
 * Get cart preview showing available and unavailable products in a collection
 * Used before "Add Entire Collection to Bag"
 */
export async function getCollectionCartPreview(collectionId: string): Promise<CollectionCartPreviewResponse> {
  const resp = await apiClient.get(`/collections/${collectionId}/cart-preview`);
  let data: unknown = resp.data;
  if (data && typeof data === 'object' && 'data' in data) {
    data = (data as Record<string, unknown>).data;
  }
  if (data && typeof data === 'object' && 'data' in data) {
    data = (data as Record<string, unknown>).data;
  }
  return normalizeCollectionCartPreview((data ?? {}) as RawCartPreviewEnvelope);
}

// ===================== Draft Stats API =====================
export interface DraftExpiryStats {
  totalDrafts: number;
  expiringIn7Days: number;
  expiringIn3Days: number;
  expiringToday: number;
  oldestDraftAge: number;
  draftTtlDays: number;
  warningThresholdDays: number;
}

/**
 * Draft expiry statistics for the CURRENT user (JWT subject; no id is sent).
 *
 * `domain` scopes the count to one kind of draft. `Collection` backs both
 * designs and store collections, so an unscoped count mixes them — and a
 * surface that only links to one of the two then shows a number it cannot
 * account for. Pass the domain that matches wherever "View All" goes.
 */
export async function getDraftExpiryStats(
  domain?: 'DESIGN' | 'STORE',
): Promise<DraftExpiryStats> {
  const resp = await apiClient.get('/collections/my/draft-stats', {
    params: domain ? { domain } : undefined,
  });
  let data = resp.data;
  if (data && typeof data === 'object' && 'data' in data) {
    data = (data as Record<string, unknown>).data;
  }
  return data as DraftExpiryStats;
}

export default {
  getCollectionCartPreview,
  getDraftExpiryStats,
};
