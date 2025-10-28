import { apiClient } from './httpClient';

export const ReactionsApi = {
  // Collection-level likes
  async toggleCollectionLike(collectionId: string) {
    const clientEventId = (globalThis.crypto && 'randomUUID' in globalThis.crypto)
      ? (globalThis.crypto as any).randomUUID()
      : undefined;
    const { data } = await apiClient.post(`/collections/${collectionId}/reactions/like`, {}, {
      headers: clientEventId ? { 'x-client-event-id': clientEventId } : undefined,
    });
    return data as { likes: number; dislikes: number };
  },
  async getCollectionReactions(collectionId: string, limit = 20) {
    const { data } = await apiClient.get(`/collections/${collectionId}/reactions`, { params: { limit } });
    return data as { users: Array<{ id: string; username?: string; firstName?: string; lastName?: string; profileImage?: string }>; totalLikes: number; totalDislikes: number };
  },
  async getCollectionIsLiked(collectionId: string) {
    const { data } = await apiClient.get(`/collections/${collectionId}/is-liked`);
    return data as { liked: boolean };
  },

  // Media-level likes
  async toggleCollectionMediaLike(mediaId: string) {
    const clientEventId = (globalThis.crypto && 'randomUUID' in globalThis.crypto)
      ? (globalThis.crypto as any).randomUUID()
      : undefined;
    const { data } = await apiClient.post(`/collections/media/${mediaId}/reaction/like`, {}, {
      headers: clientEventId ? { 'x-client-event-id': clientEventId } : undefined,
    });
    return data as { likes: number };
  },
  async getCollectionMediaReactions(mediaId: string, limit = 20) {
    const { data } = await apiClient.get(`/collections/media/${mediaId}/reactions`, { params: { limit } });
    return data as { users: Array<{ id: string; username?: string; firstName?: string; lastName?: string; profileImage?: string }>; totalLikes: number };
  },
  async getCollectionMediaIsLiked(mediaId: string) {
    const { data } = await apiClient.get(`/collections/media/${mediaId}/is-liked`);
    return data as { liked: boolean };
  },

  async getContentOwner(contentType: 'COLLECTION' | 'COLLECTION_MEDIA', contentId: string) {
    const { data } = await apiClient.get(`/v1/reactions/owner/${contentType}/${contentId}`);
    return data as { ownerId: string };
  }
};
