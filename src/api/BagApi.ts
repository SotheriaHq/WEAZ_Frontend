import { apiClient } from './httpClient';
import { unwrapApiResponse, type ApiSuccessPayload } from '@/types/auth';
import type { BagStatus, CartItem } from './StoreApi';
import type {
  CustomOrderCheckoutBagLine,
  CustomOrderCheckoutBagResponse,
} from './CustomOrderApi';
import type { SizingMode } from '@/types/sizing';
import type { SizeRecommendationSnapshot } from '@/types/sizeFit';

export type BagSourceType = 'PRODUCT' | 'DESIGN' | 'COLLECTION';

export interface BagCount {
  standardQuantity: number;
  customLineCount: number;
  combinedCount: number;
}

export type StandardBagPayload = {
  productId: string;
  quantity?: number;
  selectedSize?: string;
  selectedColor?: string;
  sizingMode?: SizingMode;
  requiredMeasurementKeys?: string[];
  sizeFitData?: Record<string, unknown>;
  sizeRecommendationSnapshot?: SizeRecommendationSnapshot | Record<string, unknown>;
  manualOverrideReason?: string;
};

export type StandardBag = {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
  totalQuantity?: number;
};

export interface CollectionBagProductStatus {
  productId: string;
  name: string;
  coverImage: string | null;
  coverImageId: string | null;
  media: Array<{ url: string | null; fileId: string | null }>;
  price: number;
  currency: string;
  canBag: boolean;
  inBag: boolean;
  reason: string | null;
  stockState: string;
  defaultAction:
    | 'ADD_STANDARD'
    | 'OPEN_SELECTOR'
    | 'OPEN_FITTINGS'
    | 'CONFIRM_STALE_FITTINGS'
    | 'OPEN_CUSTOM_FLOW'
    | 'ALREADY_IN_BAG'
    | 'DISABLED';
  requiresSize: boolean;
  requiresColor: boolean;
  availableSizes: string[];
  availableColors: string[];
  requiredMeasurementKeys: string[];
  missingMeasurementKeys: string[];
  freshnessState: string;
  sourceStatus: BagStatus;
}

export interface CollectionBagStatus {
  sourceType: 'COLLECTION';
  sourceId: string;
  collection: {
    id: string;
    title: string;
    description: string | null;
    brandId: string | null;
    brandName: string | null;
    coverImage: string | null;
    coverImageId: string | null;
    productCount: number;
    priceRange: { min: number | null; max: number | null; currency: string };
  };
  summary: {
    canBagAll: boolean;
    canBagSelected: boolean;
    eligibleCount: number;
    blockedCount: number;
    alreadyInBagCount: number;
    requiresSelectionCount: number;
    requiresFittingsCount: number;
    staleFittingsCount: number;
    outOfStockCount: number;
    totalPrice: number;
    currency: string;
  };
  products: CollectionBagProductStatus[];
  ui: {
    defaultAction: 'BAG_ALL' | 'BAG_SELECTED' | 'RESOLVE_BLOCKERS' | 'AUTH_REQUIRED' | 'DISABLED';
    disabledReason: string | null;
  };
  featureFlags: { collectionReviewsEnabled: boolean };
}

export type CollectionBagSelection = {
  selectedSize?: string;
  selectedColor?: string;
  quantity?: number;
};

export type CollectionBagMutationPayload = {
  productIds?: string[];
  selections?: Record<string, CollectionBagSelection>;
  acknowledgements?: { staleFittingsAccepted?: boolean };
};

export interface CollectionBagMutationResult {
  collectionId: string;
  added: Array<{ productId: string; bagItemId: string; quantity: number }>;
  skipped: Array<{ productId: string; reason: string }>;
  blocked: Array<{
    productId: string;
    reason: string;
    missingMeasurementKeys?: string[];
    requiredMeasurementKeys?: string[];
  }>;
  summary: {
    addedCount: number;
    skippedCount: number;
    blockedCount: number;
    combinedBagCount: number;
  };
}

const unwrap = <T>(data: unknown): T => unwrapApiResponse<T>(data as ApiSuccessPayload<T>);

const shouldLogBagTiming = () => {
  const mode = import.meta.env.MODE;
  return import.meta.env.DEV || mode === 'test' || mode === 'e2e' || import.meta.env.VITE_BAGGING_OBSERVABILITY === 'true';
};

const logBagTiming = (label: string, startedAt: number, context: Record<string, unknown>) => {
  if (!shouldLogBagTiming()) return;
  console.debug('[bagging:timing]', {
    event: `web.${label}.duration`,
    durationMs: Math.round(performance.now() - startedAt),
    ...context,
  });
};

export const BagApi = {
  async getBagCount(): Promise<BagCount> {
    const response = await apiClient.get('/bag/count');
    return unwrap<BagCount>(response.data);
  },

  async getProductBagStatus(productId: string): Promise<BagStatus> {
    const startedAt = performance.now();
    try {
      const response = await apiClient.get(`/store/products/${productId}/bag-status`);
      return unwrap<BagStatus>(response.data);
    } finally {
      logBagTiming('product_status_request', startedAt, { productId });
    }
  },

  async getSourceBagStatus(sourceType: BagSourceType, sourceId: string): Promise<BagStatus> {
    const startedAt = performance.now();
    try {
      const response = await apiClient.get(`/bag/sources/${sourceType}/${sourceId}/status`);
      return unwrap<BagStatus>(response.data);
    } finally {
      logBagTiming('source_status_request', startedAt, { sourceType, sourceId });
    }
  },

  async getCollectionBagStatus(collectionId: string): Promise<CollectionBagStatus> {
    const startedAt = performance.now();
    try {
      const response = await apiClient.get(`/bag/sources/COLLECTION/${collectionId}/status`);
      return unwrap<CollectionBagStatus>(response.data);
    } finally {
      logBagTiming('collection_status_request', startedAt, { collectionId });
    }
  },

  async bagCollectionAll(
    collectionId: string,
    payload: Omit<CollectionBagMutationPayload, 'productIds'> = {},
  ): Promise<CollectionBagMutationResult> {
    const startedAt = performance.now();
    try {
      const response = await apiClient.post(`/bag/collections/${collectionId}/bag-all`, payload);
      return unwrap<CollectionBagMutationResult>(response.data);
    } finally {
      logBagTiming('collection_bag_all_request', startedAt, { collectionId });
    }
  },

  async bagCollectionSelected(
    collectionId: string,
    payload: CollectionBagMutationPayload,
  ): Promise<CollectionBagMutationResult> {
    const startedAt = performance.now();
    try {
      const response = await apiClient.post(`/bag/collections/${collectionId}/bag-selected`, payload);
      return unwrap<CollectionBagMutationResult>(response.data);
    } finally {
      logBagTiming('collection_bag_selected_request', startedAt, {
        collectionId,
        productCount: payload.productIds?.length ?? 0,
      });
    }
  },

  async addStandardToBag(payload: StandardBagPayload): Promise<StandardBag> {
    const response = await apiClient.post('/store/cart', payload);
    return unwrap<StandardBag>(response.data);
  },

  async getStandardBag(): Promise<StandardBag> {
    const response = await apiClient.get('/store/cart');
    return unwrap<StandardBag>(response.data);
  },

  async updateStandardBagItem(itemId: string, payload: { quantity: number }): Promise<StandardBag> {
    const response = await apiClient.patch(`/store/cart/${itemId}`, payload);
    return unwrap<StandardBag>(response.data);
  },

  async removeStandardBagItem(itemId: string): Promise<StandardBag> {
    const response = await apiClient.delete(`/store/cart/${itemId}`);
    return unwrap<StandardBag>(response.data);
  },

  async getCustomBag(): Promise<CustomOrderCheckoutBagResponse> {
    const response = await apiClient.get('/custom-orders/checkout-bag');
    return unwrap<CustomOrderCheckoutBagResponse>(response.data);
  },

  async removeCustomBagLine(sessionId: string): Promise<{ removed: boolean }> {
    const response = await apiClient.delete(`/custom-orders/checkout-sessions/${sessionId}`);
    return unwrap<{ removed: boolean }>(response.data);
  },
};

export type { BagStatus, CartItem, CustomOrderCheckoutBagLine, CustomOrderCheckoutBagResponse };

export default BagApi;
