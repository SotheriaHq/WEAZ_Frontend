import { apiClient } from './httpClient';
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
    type?: 'MALE' | 'FEMALE' | 'EVERYBODY';
    visibility?: 'PUBLIC' | 'PRIVATE';
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

export async function finalizeCollectionUploads(collectionId: string, completions: CompletionDto[], shouldPublish = true) {
  const resp = await apiClient.post(`/collections/${collectionId}/finalize`, { completions, shouldPublish });
  // Unwrap interceptor-wrapped response
  return unwrapApiResponse(resp.data);
}

export default { initializeCollectionUploads, finalizeCollectionUploads };
