import { apiClient } from './httpClient';
import { unwrapApiResponse } from '@/types/auth';
import type { BrandMemberRole, BrandMemberStatus } from '@/types/auth';

export type BrandStaffMember = {
  id: string;
  userId: string;
  email: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  role: BrandMemberRole;
  status: BrandMemberStatus;
  joinedAt: string | null;
  invitedById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BrandStaffInvite = {
  id: string;
  brandId: string;
  email: string;
  role: BrandMemberRole;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';
  invitedById: string;
  invitedUserId: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  rejectedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  inviteToken?: string;
};

export type BrandStaffListResponse = {
  members: BrandStaffMember[];
  invites: BrandStaffInvite[];
};

export const brandStaffApi = {
  async list(brandId: string): Promise<BrandStaffListResponse> {
    const response = await apiClient.get(`/brands/${brandId}/staff`);
    return unwrapApiResponse<BrandStaffListResponse>(response.data);
  },

  async invite(brandId: string, payload: { email: string; role: BrandMemberRole }): Promise<BrandStaffInvite> {
    const response = await apiClient.post(`/brands/${brandId}/staff/invite`, payload);
    return unwrapApiResponse<BrandStaffInvite>(response.data);
  },

  async cancelInvite(brandId: string, inviteId: string): Promise<BrandStaffInvite> {
    const response = await apiClient.delete(`/brands/${brandId}/staff/invites/${inviteId}`);
    return unwrapApiResponse<BrandStaffInvite>(response.data);
  },

  async acceptInvite(token: string): Promise<BrandStaffMember> {
    const response = await apiClient.post('/brands/staff/invites/accept', { token });
    return unwrapApiResponse<BrandStaffMember>(response.data);
  },

  async rejectInvite(token: string): Promise<BrandStaffInvite> {
    const response = await apiClient.post('/brands/staff/invites/reject', { token });
    return unwrapApiResponse<BrandStaffInvite>(response.data);
  },

  async updateRole(brandId: string, memberId: string, role: BrandMemberRole): Promise<BrandStaffMember> {
    const response = await apiClient.patch(`/brands/${brandId}/staff/${memberId}/role`, { role });
    return unwrapApiResponse<BrandStaffMember>(response.data);
  },

  async updateStatus(brandId: string, memberId: string, status: BrandMemberStatus): Promise<BrandStaffMember> {
    const response = await apiClient.patch(`/brands/${brandId}/staff/${memberId}/status`, { status });
    return unwrapApiResponse<BrandStaffMember>(response.data);
  },

  async remove(brandId: string, memberId: string): Promise<BrandStaffMember> {
    const response = await apiClient.delete(`/brands/${brandId}/staff/${memberId}`);
    return unwrapApiResponse<BrandStaffMember>(response.data);
  },
};
