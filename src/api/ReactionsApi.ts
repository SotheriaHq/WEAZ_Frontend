import { apiClient } from './httpClient';

export const ReactionsApi = {
  // Collection-level threads
  async toggleCollectionThread(collectionId: string) {
    const clientEventId = (globalThis.crypto && 'randomUUID' in globalThis.crypto)
      ? (globalThis.crypto as any).randomUUID()
      : undefined;
    const { data } = await apiClient.post(`/collections/${collectionId}/reactions/thread`, {}, {
      headers: clientEventId ? { 'x-client-event-id': clientEventId } : undefined,
    });
    return data as { threads: number; dislikes: number; threaded: boolean };
  },
  async getCollectionReactions(collectionId: string, limit = 20) {
    const { data } = await apiClient.get(`/collections/${collectionId}/reactions`, { params: { limit } });
    return data as { users: Array<{ id: string; username?: string; firstName?: string; lastName?: string; profileImage?: string }>; totalThreads: number; totalDislikes: number };
  },
  async getCollectionIsThreaded(collectionId: string) {
    const { data } = await apiClient.get(`/collections/${collectionId}/is-threaded`);
    return data as { threaded: boolean };
  },

  // Media-level threads
  async toggleCollectionMediaThread(mediaId: string) {
    const clientEventId = (globalThis.crypto && 'randomUUID' in globalThis.crypto)
      ? (globalThis.crypto as any).randomUUID()
      : undefined;
    const { data } = await apiClient.post(`/collections/media/${mediaId}/reaction/thread`, {}, {
      headers: clientEventId ? { 'x-client-event-id': clientEventId } : undefined,
    });
    return data as { threads: number; threaded: boolean };
  },
  async getCollectionMediaReactions(mediaId: string, limit = 20) {
    const { data } = await apiClient.get(`/collections/media/${mediaId}/reactions`, { params: { limit } });
    return data as { users: Array<{ id: string; username?: string; firstName?: string; lastName?: string; profileImage?: string }>; totalThreads: number };
  },
  async getCollectionMediaIsThreaded(mediaId: string) {
    const { data } = await apiClient.get(`/collections/media/${mediaId}/is-threaded`);
    return data as { threaded: boolean };
  },

  async getContentOwner(contentType: 'COLLECTION' | 'COLLECTION_MEDIA', contentId: string) {
    const { data } = await apiClient.get(`/v1/reactions/owner/${contentType}/${contentId}`);
    return data as { ownerId: string };
  }
};
