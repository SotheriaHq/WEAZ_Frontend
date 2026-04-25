import { apiClient } from './httpClient';

export type AccessState = 'PENDING' | 'APPROVED' | 'REVOKED';

export const AccessApi = {
  async requestAccess(collectionId: string): Promise<{ state: AccessState }> {
    const { data } = await apiClient.post(`/collections/${collectionId}/access-requests`);
    return data as { state: AccessState };
  },
  async listRequests(collectionId: string, cursor?: string, limit = 20) {
    const { data } = await apiClient.get(`/collections/${collectionId}/access-requests`, { params: { cursor, limit } });
    return data as { items: Array<{ id: string; viewer: { id: string; username?: string; profileImage?: string } }>; hasNextPage: boolean; endCursor?: string | null };
  },
  async listApproved(collectionId: string, cursor?: string, limit = 20) {
    const { data } = await apiClient.get(`/collections/${collectionId}/access`, { params: { cursor, limit } });
    return data as { items: Array<{ id: string; viewer: { id: string; username?: string; profileImage?: string } }>; hasNextPage: boolean; endCursor?: string | null };
  },
  async approveBulk(collectionId: string, userIds: string[]) {
    const { data } = await apiClient.post(`/collections/${collectionId}/access/grant`, { userIds });
    return data as { success: boolean };
  },
  async update(collectionId: string, userId: string, state: 'APPROVED' | 'REVOKED') {
    const { data } = await apiClient.patch(`/collections/${collectionId}/access/${userId}`, { state });
    return data as { success: boolean };
  },
  async revoke(collectionId: string, userId: string) {
    const { data } = await apiClient.delete(`/collections/${collectionId}/access/${userId}`);
    return data as { success: boolean };
  },
  async createInviteLink(collectionId: string, ttlSeconds?: number) {
    const { data } = await apiClient.post(`/collections/${collectionId}/access/invite-link`, { ttlSeconds });
    return data as { token: string };
  },
  async acceptInvite(token: string) {
    const { data } = await apiClient.post(`/collections/access/invite/accept`, { token });
    return data as { success: boolean };
  },
};

export default AccessApi;
