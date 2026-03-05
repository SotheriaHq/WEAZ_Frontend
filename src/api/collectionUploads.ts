import { apiClient } from './httpClient';
import { createIdempotencyKey } from './idempotency';
import { unwrapApiResponse } from '../types/auth'; // Keep this import for potential future use

// Type for presigned upload entries from collections/initialize
export type PresignEntry = {
  fileId: string;
  expectedKey: string;
  uploadUrl: string;
  uploadFields?: Record<string, string> | null;
  method: 'POST' | 'PUT';
};

// Response shape for collection initialization
export interface InitializeCollectionResponse {
  collectionId: string;
  uploads: PresignEntry[];
}

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
  // Legacy/client-ready shape fallback
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

// ===================== Draft Session Types =====================
export interface DraftSessionResponse {
  collectionId: string;
  sessionToken: string;
  hasConflict: boolean;
  conflictDetails?: {
    existingSessionToken?: string;
    deviceName?: string;
    deviceType?: 'desktop' | 'tablet' | 'mobile';
    startedAt: string;
    userId?: string;
  };
}

// ===================== Bulk Upload Types =====================
export interface BulkUploadRowError {
  row: number;
  field: string;
  message: string;
}

export interface BulkUploadStatusResponse {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  totalRows: number;
  processedRows: number;
  successRows: number;
  failedRows: number;
  errors: BulkUploadRowError[];
  createdAt: string;
  completedAt?: string;
}

export async function initializeCollectionUploads(
  dto: {
    title: string;
    description?: string;
    minPrice?: number;
    maxPrice?: number;
    isAvailableInStore?: boolean;
    tags: string[];
    files: { name: string; type: string; size: number }[];
    // New metadata required by backend
    categoryId?: string;
    subCategoryId?: string;
    categoryTypeId?: string;
    type?: 'MALE' | 'FEMALE' | 'EVERYBODY';
    visibility?: 'PUBLIC' | 'PRIVATE';
    filterValueIds?: string[];
    sizingMode?: 'NONE' | 'RTW' | 'CUSTOM' | 'RTW_PLUS_CUSTOM';
    rtwSizeSystem?: string;
    rtwSizeType?: 'PREDEFINED' | 'FREEFORM' | 'MIXED';
    customGender?: 'MEN' | 'WOMEN' | 'UNISEX';
    customMeasurementKeys?: string[];
    fitPreference?: 'SLIM' | 'REGULAR' | 'LOOSE' | 'OVERSIZED';
    targetAgeGroup?: 'ADULT' | 'CHILD';
  },
): Promise<InitializeCollectionResponse> {
  const resp = await apiClient.post('/collections/initialize', dto);
  // Double-unwrap any nested { data } envelopes to get the raw payload
  let container: unknown = resp.data;
  if (container && typeof container === 'object' && 'data' in container) {
    container = (container as Record<string, unknown>).data;
  }
  if (container && typeof container === 'object' && 'data' in container) {
    container = (container as Record<string, unknown>).data;
  }
  return container as InitializeCollectionResponse;
}

export type CompletionDto = { fileId: string; s3Key: string; actualSize: number; actualMimeType: string };

export async function finalizeCollectionUploads(
  collectionId: string,
  completions: CompletionDto[],
  shouldPublish = true,
  options?: {
    action?: 'publish' | 'draft';
    collectionMetadata?: {
      title?: string;
      description?: string;
      visibility?: 'PUBLIC' | 'PRIVATE';
      type?: 'MALE' | 'FEMALE' | 'EVERYBODY';
      categoryId?: string;
      subCategoryId?: string;
      categoryTypeId?: string;
      tags?: string[];
      filterValueIds?: string[];
      sizingMode?: 'NONE' | 'RTW' | 'CUSTOM' | 'RTW_PLUS_CUSTOM';
      rtwSizeSystem?: string;
      rtwSizeType?: 'PREDEFINED' | 'FREEFORM' | 'MIXED';
      customGender?: 'MEN' | 'WOMEN' | 'UNISEX';
      customMeasurementKeys?: string[];
      fitPreference?: 'SLIM' | 'REGULAR' | 'LOOSE' | 'OVERSIZED';
      targetAgeGroup?: 'ADULT' | 'CHILD';
    };
    coverMediaId?: string;
    coverIndex?: number;
  },
) {
  const resp = await apiClient.post(
    `/collections/${collectionId}/finalize`,
    {
      completions,
      shouldPublish,
      action: options?.action,
      collectionMetadata: options?.collectionMetadata,
      coverMediaId: options?.coverMediaId,
      coverIndex:
        typeof options?.coverIndex === 'number' ? options.coverIndex : undefined,
    },
    { headers: { 'Idempotency-Key': createIdempotencyKey() } },
  );
  // Unwrap interceptor-wrapped response
  return unwrapApiResponse(resp.data);
}

// ===================== Cart Preview API =====================
/**
 * Get cart preview showing available and unavailable products in a collection
 * Used before "Add Entire Collection to Cart"
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

// ===================== Draft Session API =====================
/**
 * Start or resume a draft editing session
 * Returns conflict info if another session is active
 */
export async function startDraftSession(
  collectionId: string, 
  options?: { 
    deviceName?: string; 
    forceNew?: boolean;
    existingToken?: string;
  }
): Promise<DraftSessionResponse> {
  const resp = await apiClient.post(`/collections/${collectionId}/draft-session`, {
    deviceName: options?.deviceName ?? navigator.userAgent.slice(0, 50),
    forceNew: options?.forceNew ?? false,
    existingToken: options?.existingToken,
  });
  let data = resp.data;
  if (data && typeof data === 'object' && 'data' in data) {
    data = (data as Record<string, unknown>).data;
  }
  return data as DraftSessionResponse;
}

/**
 * Take over an existing draft session (force edit)
 */
export async function takeOverDraftSession(collectionId: string): Promise<DraftSessionResponse> {
  return startDraftSession(collectionId, { forceNew: true });
}

// ===================== Bulk Upload API =====================
/**
 * Initiate bulk upload of products to a collection
 */
export async function initiateBulkUpload(
  collectionId: string,
  file: File
): Promise<{ jobId: string; status: string }> {
  const formData = new FormData();
  formData.append('file', file);
  
  const resp = await apiClient.post(`/collections/${collectionId}/bulk-upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  let data = resp.data;
  if (data && typeof data === 'object' && 'data' in data) {
    data = (data as Record<string, unknown>).data;
  }
  return data as { jobId: string; status: string };
}

/**
 * Get status of a bulk upload job
 */
export async function getBulkUploadStatus(jobId: string): Promise<BulkUploadStatusResponse> {
  const resp = await apiClient.get(`/collections/bulk-upload/${jobId}`);
  let data = resp.data;
  if (data && typeof data === 'object' && 'data' in data) {
    data = (data as Record<string, unknown>).data;
  }
  return data as BulkUploadStatusResponse;
}

/**
 * Retry failed rows in a bulk upload job
 */
export async function retryBulkUploadRows(
  jobId: string, 
  rows?: number[]
): Promise<{ retriedCount: number; status: string }> {
  const resp = await apiClient.post(`/collections/bulk-upload/${jobId}/retry`, { rows });
  let data = resp.data;
  if (data && typeof data === 'object' && 'data' in data) {
    data = (data as Record<string, unknown>).data;
  }
  return data as { retriedCount: number; status: string };
}

// ===================== Custom Fit Inquiry API =====================
/**
 * Submit a custom fit inquiry for a product in a collection
 * Scaffold - actual implementation pending
 */
export async function submitCustomFitInquiry(
  collectionId: string,
  inquiry: {
    productId: string;
    measurements: Record<string, number>;
    notes?: string;
  }
): Promise<{ inquiryId: string; status: string }> {
  const resp = await apiClient.post(`/collections/${collectionId}/custom-fit-inquiry`, inquiry);
  let data = resp.data;
  if (data && typeof data === 'object' && 'data' in data) {
    data = (data as Record<string, unknown>).data;
  }
  return data as { inquiryId: string; status: string };
}

// ===================== Media Management API =====================
/**
 * Delete a media item from a collection
 * Handles cover reassignment automatically if needed
 */
export async function deleteCollectionMedia(
  collectionId: string,
  mediaId: string
): Promise<{ success: boolean; newCoverId?: string }> {
  const resp = await apiClient.delete(`/collections/${collectionId}/media/${mediaId}`);
  let data = resp.data;
  if (data && typeof data === 'object' && 'data' in data) {
    data = (data as Record<string, unknown>).data;
  }
  return data as { success: boolean; newCoverId?: string };
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
 * Get draft expiry statistics for the current user
 * Used for dashboard display and notifications
 */
export async function getDraftExpiryStats(): Promise<DraftExpiryStats> {
  const resp = await apiClient.get('/collections/my/draft-stats');
  let data = resp.data;
  if (data && typeof data === 'object' && 'data' in data) {
    data = (data as Record<string, unknown>).data;
  }
  return data as DraftExpiryStats;
}

export default { 
  initializeCollectionUploads, 
  finalizeCollectionUploads,
  getCollectionCartPreview,
  startDraftSession,
  takeOverDraftSession,
  initiateBulkUpload,
  getBulkUploadStatus,
  retryBulkUploadRows,
  submitCustomFitInquiry,
  deleteCollectionMedia,
  getDraftExpiryStats,
};
