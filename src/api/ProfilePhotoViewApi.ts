import { apiClient } from './httpClient';
import type { ProfilePhotoViewState } from '@/types/profilePhoto';

const unwrap = <T>(payload: unknown): T => {
  const maybe = payload as { data?: unknown } | null | undefined;
  return (maybe?.data ?? payload) as T;
};

export const ProfilePhotoViewApi = {
  async getViewState(ownerId: string): Promise<ProfilePhotoViewState> {
    const response = await apiClient.get(`/users/${ownerId}/profile-photo-view`);
    return unwrap<ProfilePhotoViewState>(response.data);
  },

  async markViewed(ownerId: string): Promise<ProfilePhotoViewState> {
    const response = await apiClient.post(`/users/${ownerId}/profile-photo-view`);
    return unwrap<ProfilePhotoViewState>(response.data);
  },
};
