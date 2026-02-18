import { apiClient } from './httpClient';
import type { SizeFitProfile, SizeFitShareDto, SizeFitSharesPayload } from '@/types/sizeFit';

const unwrap = <T>(raw: any): T => {
  return (raw?.data ?? raw) as T;
};

export const SizeFitApi = {
  async getMyProfile(): Promise<SizeFitProfile> {
    const res = await apiClient.get('/users/me/size-fit');
    return unwrap<SizeFitProfile>(res.data);
  },

  async getPublicProfile(userId: string): Promise<SizeFitProfile> {
    const res = await apiClient.get(`/users/${userId}/size-fit/public`);
    return unwrap<SizeFitProfile>(res.data);
  },

  async updateProfile(payload: {
    measurements?: Record<string, unknown>;
    notes?: string;
    requireUpdateEveryDays?: number;
  }): Promise<SizeFitProfile> {
    const res = await apiClient.put('/users/me/size-fit', payload);
    return unwrap<SizeFitProfile>(res.data);
  },

  async updateSettings(payload: {
    visibility?: 'PUBLIC' | 'PRIVATE';
    sharePolicy?: 'OWNER_ONLY' | 'REQUIRE_PERMISSION' | 'ALLOW_ANYONE';
    notifyOnShare?: boolean;
    requireUpdateEveryDays?: number;
  }): Promise<Partial<SizeFitProfile>> {
    const res = await apiClient.patch('/users/me/size-fit/settings', payload);
    return unwrap<Partial<SizeFitProfile>>(res.data);
  },

  async share(payload: SizeFitShareDto): Promise<{ status: string; shareId: string; requiresApproval: boolean }> {
    const res = await apiClient.post('/users/me/size-fit/share', payload);
    return unwrap<{ status: string; shareId: string; requiresApproval: boolean }>(res.data);
  },

  async respondToShareRequest(
    shareId: string,
    decision: 'APPROVE' | 'REJECT' | 'REVOKE',
    note?: string,
  ): Promise<{ id: string; status: string; respondedAt: string | null; note: string }> {
    const res = await apiClient.patch(`/users/me/size-fit/share-requests/${shareId}`, {
      decision,
      note,
    });
    return unwrap<{ id: string; status: string; respondedAt: string | null; note: string }>(res.data);
  },

  async getShares(): Promise<SizeFitSharesPayload> {
    const res = await apiClient.get('/users/me/size-fit/shares');
    return unwrap<SizeFitSharesPayload>(res.data);
  },
};
