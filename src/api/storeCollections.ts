import { apiClient } from './httpClient';
import { unwrapApiResponse } from '../types/auth';

export type CollectionVisibility = 'PUBLIC' | 'PRIVATE';
export type CollectionType = 'MALE' | 'FEMALE' | 'EVERYBODY';

export interface InitializeStoreCollectionPayload {
  mode: 'existing' | 'new-individual' | 'new-template' | 'bulk';
  title?: string;
  description?: string;
  visibility?: CollectionVisibility;
  categoryId?: string;
  categoryTypeId?: string;
  type?: CollectionType;
  tags?: string[];
  isAvailableInStore?: boolean;
}

export interface InitializeStoreCollectionResponse {
  sessionId: string;
  expiresAt?: string;
}

const unwrap = <T>(payload: unknown): T => {
  let data: unknown = payload;
  if (data && typeof data === 'object' && 'data' in (data as Record<string, unknown>)) {
    data = (data as Record<string, unknown>).data;
  }
  if (data && typeof data === 'object' && 'data' in (data as Record<string, unknown>)) {
    data = (data as Record<string, unknown>).data;
  }
  return unwrapApiResponse<T>(data as any);
};

export async function initializeStoreCollection(
  payload: InitializeStoreCollectionPayload
): Promise<InitializeStoreCollectionResponse> {
  const res = await apiClient.post('/collections/initialize', payload);
  const data = unwrap<Record<string, unknown>>(res.data);
  const sessionId =
    (data?.sessionId as string | undefined) ||
    (data?.collectionId as string | undefined) ||
    (data?.id as string | undefined);
  if (!sessionId) {
    throw new Error('Missing collection session id from initialize response.');
  }
  return {
    sessionId,
    expiresAt: typeof data?.expiresAt === 'string' ? (data.expiresAt as string) : undefined,
  };
}

export async function addProductsToCollection(collectionId: string, productIds: string[]) {
  const res = await apiClient.post(`/collections/${collectionId}/add-products`, { productIds });
  return unwrap<{ success: boolean }>(res.data);
}

export async function removeProductsFromCollection(collectionId: string, productIds: string[]) {
  const res = await apiClient.post(`/collections/${collectionId}/remove-products`, { productIds });
  return unwrap<{ success: boolean }>(res.data);
}

export async function reorderCollectionProducts(
  collectionId: string,
  items: Array<{ productId: string; orderIndex: number }>
) {
  const res = await apiClient.patch(`/collections/${collectionId}/reorder-products`, { items });
  return unwrap<{ success: boolean }>(res.data);
}

export async function finalizeStoreCollection(
  collectionId: string,
  payload: {
    action: 'publish' | 'draft';
    collectionMetadata: {
      title?: string;
      description?: string;
      visibility?: CollectionVisibility;
      type?: CollectionType;
      categoryId?: string;
      categoryTypeId?: string;
      tags?: string[];
      isAvailableInStore?: boolean;
    };
  }
) {
  const res = await apiClient.post(`/collections/${collectionId}/finalize`, payload, {
    params: { scope: 'store' },
  });
  return unwrap<Record<string, unknown>>(res.data);
}
