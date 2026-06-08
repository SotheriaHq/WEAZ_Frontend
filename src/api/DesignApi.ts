import type { SizingMode } from '@/types/sizing';
import { apiClient } from './httpClient';
import { createIdempotencyKey } from './idempotency';
import {
  type MediaViewSlot,
  toBackendMediaViewSlot,
} from '@/utils/contentIntegrity';
import {
  getRequiredLegalAcceptances,
  LEGAL_CONTENT_PUBLISH_DOCUMENT_KEYS,
} from '@/api/LegalApi';

const DESIGN_DETAIL_TTL_MS = 30 * 1000;
const designDetailCache = new Map<string, { data: unknown; expiresAt: number }>();
const designDetailPending = new Map<string, Promise<unknown>>();

const clearDesignDetailCache = (designId?: string) => {
  if (designId) {
    designDetailCache.delete(designId);
    designDetailPending.delete(designId);
    return;
  }
  designDetailCache.clear();
  designDetailPending.clear();
};

export type DesignAudience = 'MALE' | 'FEMALE' | 'EVERYBODY';
export type DesignVisibility = 'PUBLIC' | 'PRIVATE';
export type DesignFitPreference = 'SLIM' | 'REGULAR' | 'LOOSE' | 'OVERSIZED';
export type DesignTargetAgeGroup = 'ADULT' | 'CHILD';

export type PresignEntry = {
  fileId: string;
  expectedKey: string;
  uploadUrl: string;
  uploadFields?: Record<string, string> | null;
  method?: 'POST' | 'PUT';
  viewSlot?: MediaViewSlot | string | null;
};

export type CompletionDto = {
  fileId: string;
  s3Key: string;
  actualSize: number;
  actualMimeType: string;
  viewSlot?: MediaViewSlot | string | null;
};

export type DesignMetadata = {
  title?: string;
  description?: string;
  visibility?: DesignVisibility;
  type?: DesignAudience;
  audience?: DesignAudience;
  categoryId?: string;
  subCategoryId?: string;
  categoryTypeId?: string;
  tags?: string[];
  filterValueIds?: string[];
  sizingMode?: SizingMode;
  rtwSizes?: string[];
  rtwSizeSystem?: string;
  rtwSizeType?: 'PREDEFINED' | 'FREEFORM' | 'MIXED';
  customGender?: 'MEN' | 'WOMEN' | 'UNISEX';
  customMeasurementKeys?: string[];
  customOrderEnabled?: boolean;
  customFreeformPointIds?: string[];
  fitPreference?: DesignFitPreference;
  targetAgeGroup?: DesignTargetAgeGroup;
  minPrice?: number;
  maxPrice?: number;
};

export type InitializeDesignUploadsDto = DesignMetadata & {
  files: { name: string; type: string; size: number; viewSlot?: MediaViewSlot | string | null }[];
  draftOnly?: boolean;
};

export type InitializeDesignResponse = {
  id?: string;
  designId?: string;
  legacyCollectionId?: string;
  collectionId?: string;
  uploads: PresignEntry[];
};

export type DraftDesignSessionResponse = {
  id?: string;
  designId?: string;
  legacyCollectionId?: string;
  collectionId?: string;
  sessionToken: string;
  hasConflict: boolean;
  conflictDetails?: {
    existingSessionToken?: string;
    deviceName?: string;
    deviceType?: 'desktop' | 'tablet' | 'mobile';
    startedAt: string;
    userId?: string;
  };
};

const unwrapData = <T>(payload: unknown): T => {
  let data = payload;
  while (data && typeof data === 'object' && 'data' in data) {
    data = (data as Record<string, unknown>).data;
  }
  return data as T;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const asOptionalString = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

export const resolveDesignId = (response: unknown): string | undefined => {
  const record = asRecord(response);
  const nestedData = asRecord(record.data);
  return (
    asOptionalString(record.designId) ??
    asOptionalString(record.id) ??
    asOptionalString(record.legacyCollectionId) ??
    asOptionalString(record.collectionId) ??
    asOptionalString(nestedData.designId) ??
    asOptionalString(nestedData.id) ??
    asOptionalString(nestedData.legacyCollectionId) ??
    asOptionalString(nestedData.collectionId)
  );
};

const normalizeInitializeDesignResponse = (payload: unknown): InitializeDesignResponse => {
  const source = asRecord(unwrapData(payload));
  const designId = resolveDesignId(source);
  return {
    ...source,
    id: asOptionalString(source.id) ?? designId,
    designId,
    legacyCollectionId: asOptionalString(source.legacyCollectionId) ?? asOptionalString(source.collectionId),
    collectionId: asOptionalString(source.collectionId) ?? asOptionalString(source.legacyCollectionId),
    uploads: Array.isArray(source.uploads) ? (source.uploads as PresignEntry[]) : [],
  };
};

export async function initializeDesignUploads(
  dto: InitializeDesignUploadsDto,
): Promise<InitializeDesignResponse> {
  const response = await apiClient.post('/designs/initialize', {
    ...dto,
    files: dto.files.map((file, index) => ({
      ...file,
      viewSlot: toBackendMediaViewSlot(file.viewSlot, index),
    })),
  });
  return normalizeInitializeDesignResponse(response.data);
}

export async function finalizeDesignUploads(
  designId: string,
  completions: CompletionDto[],
  shouldPublish = true,
  options?: {
    action?: 'publish' | 'draft';
    designMetadata?: DesignMetadata;
    coverMediaId?: string;
    coverIndex?: number;
    draftSessionToken?: string;
    draftVersion?: number;
  },
) {
  const response = await apiClient.post(
    `/designs/${designId}/finalize`,
    {
      completions: completions.map((completion, index) => ({
        ...completion,
        viewSlot: completion.viewSlot
          ? toBackendMediaViewSlot(completion.viewSlot, index)
          : undefined,
      })),
      shouldPublish,
      action: options?.action,
      designMetadata: options?.designMetadata,
      coverMediaId: options?.coverMediaId,
      coverIndex:
        typeof options?.coverIndex === 'number' ? options.coverIndex : undefined,
      draftSessionToken: options?.draftSessionToken,
      draftVersion: options?.draftVersion,
    },
    { headers: { 'Idempotency-Key': createIdempotencyKey() } },
  );
  clearDesignDetailCache(designId);
  return unwrapData<unknown>(response.data);
}

export async function getDesignDetail(
  designId: string,
  options?: { forceRefresh?: boolean },
) {
  const cacheKey = String(designId ?? '').trim();
  const forceRefresh = options?.forceRefresh === true;
  if (forceRefresh) clearDesignDetailCache(cacheKey);

  const cached = designDetailCache.get(cacheKey);
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const pending = designDetailPending.get(cacheKey);
  if (!forceRefresh && pending) {
    return pending;
  }

  const request = (async () => {
    const response = await apiClient.get(
      `/designs/${cacheKey}`,
      forceRefresh
        ? {
            params: { _cb: Date.now() },
            headers: {
              'Cache-Control': 'no-store',
              Pragma: 'no-cache',
            },
          }
        : undefined,
    );
    const data = unwrapData<unknown>(response.data);
    designDetailCache.set(cacheKey, { data, expiresAt: Date.now() + DESIGN_DETAIL_TTL_MS });
    return data;
  })();

  designDetailPending.set(cacheKey, request);
  return await request.finally(() => {
    designDetailPending.delete(cacheKey);
  });
}

export async function updateDesign(designId: string, designMetadata: DesignMetadata) {
  const response = await apiClient.patch(`/designs/${designId}`, designMetadata);
  clearDesignDetailCache(designId);
  return unwrapData<unknown>(response.data);
}

export async function initializeDesignMediaUploads(
  designId: string,
  files: InitializeDesignUploadsDto['files'],
): Promise<InitializeDesignResponse> {
  const response = await apiClient.post(`/designs/${designId}/media/initialize`, {
    files: files.map((file, index) => ({
      ...file,
      viewSlot: toBackendMediaViewSlot(file.viewSlot, index),
    })),
  });
  return normalizeInitializeDesignResponse(response.data);
}

export async function submitDesignForReview(designId: string) {
  const response = await apiClient.post(`/designs/${designId}/submit`);
  clearDesignDetailCache(designId);
  return unwrapData<unknown>(response.data);
}

export async function acknowledgeContentPolicy() {
  const legalAcceptances = await getRequiredLegalAcceptances(
    LEGAL_CONTENT_PUBLISH_DOCUMENT_KEYS,
  );
  await apiClient.post('/store/content-policy/acknowledge', {
    legalAcceptances,
  });
}

export async function reorderDesignMedia(designId: string, mediaIds: string[]) {
  const response = await apiClient.patch(`/designs/${designId}/reorder-media`, {
    items: mediaIds.map((mediaId, orderIndex) => ({ mediaId, orderIndex })),
  });
  clearDesignDetailCache(designId);
  return unwrapData<unknown>(response.data);
}

export async function deleteDesignMedia(designId: string, mediaId: string) {
  await apiClient.delete(`/designs/${designId}/media/${mediaId}`);
  clearDesignDetailCache(designId);
}

export async function startDesignDraftSession(
  designId: string,
  options?: { deviceName?: string; forceNew?: boolean; existingToken?: string },
): Promise<DraftDesignSessionResponse> {
  const response = await apiClient.post(`/designs/${designId}/draft-session`, {
    deviceName: options?.deviceName ?? navigator.userAgent.slice(0, 50),
    forceNew: options?.forceNew ?? false,
    existingToken: options?.existingToken,
  });
  return unwrapData<DraftDesignSessionResponse>(response.data);
}

export async function getDesignCustomOrderConfiguration(designId: string) {
  const response = await apiClient.get(`/designs/${designId}/custom-order-configuration`);
  return unwrapData<unknown>(response.data);
}

export const DesignApi = {
  initializeDesignUploads,
  finalizeDesignUploads,
  getDesignDetail,
  updateDesign,
  initializeDesignMediaUploads,
  submitDesignForReview,
  acknowledgeContentPolicy,
  reorderDesignMedia,
  deleteDesignMedia,
  startDesignDraftSession,
  getDesignCustomOrderConfiguration,
  resolveDesignId,
};

export default DesignApi;
