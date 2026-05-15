import type { SizingMode } from '@/types/sizing';
import { apiClient } from './httpClient';
import { createIdempotencyKey } from './idempotency';

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
};

export type CompletionDto = {
  fileId: string;
  s3Key: string;
  actualSize: number;
  actualMimeType: string;
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
  files: { name: string; type: string; size: number }[];
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
  const response = await apiClient.post('/designs/initialize', dto);
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
      completions,
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
  return unwrapData<unknown>(response.data);
}

export async function getDesignDetail(designId: string) {
  const response = await apiClient.get(`/designs/${designId}`, {
    params: { _cb: Date.now() },
    headers: {
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
  });
  return unwrapData<unknown>(response.data);
}

export async function updateDesign(designId: string, designMetadata: DesignMetadata) {
  const response = await apiClient.patch(`/designs/${designId}`, designMetadata);
  return unwrapData<unknown>(response.data);
}

export async function initializeDesignMediaUploads(
  designId: string,
  files: InitializeDesignUploadsDto['files'],
): Promise<InitializeDesignResponse> {
  const response = await apiClient.post(`/designs/${designId}/media/initialize`, {
    files,
  });
  return normalizeInitializeDesignResponse(response.data);
}

export async function reorderDesignMedia(designId: string, mediaIds: string[]) {
  const response = await apiClient.patch(`/designs/${designId}/reorder-media`, {
    items: mediaIds.map((mediaId, orderIndex) => ({ mediaId, orderIndex })),
  });
  return unwrapData<unknown>(response.data);
}

export async function deleteDesignMedia(designId: string, mediaId: string) {
  await apiClient.delete(`/designs/${designId}/media/${mediaId}`);
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
  reorderDesignMedia,
  deleteDesignMedia,
  startDesignDraftSession,
  getDesignCustomOrderConfiguration,
  resolveDesignId,
};

export default DesignApi;
