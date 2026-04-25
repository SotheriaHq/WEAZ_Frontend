import { apiClient } from './httpClient';

export interface PublicProfileAliasResponse {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
}

export interface PublicStorefrontAliasResponse {
  ownerId: string;
  slug: string;
  displayName: string;
}

export interface PublicProductAliasResponse {
  id: string;
  slug: string;
  name: string;
}

const extract = <T>(payload: any): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data as T;
  }
  return payload as T;
};

export const publicLinkApi = {
  async resolveProfileByUsername(username: string): Promise<PublicProfileAliasResponse> {
    const response = await apiClient.get(`/users/lookup/username/${encodeURIComponent(username)}/profile/public`);
    return extract<PublicProfileAliasResponse>(response.data);
  },

  async resolveStorefrontBySlug(slug: string): Promise<PublicStorefrontAliasResponse> {
    const response = await apiClient.get(`/public/storefronts/${encodeURIComponent(slug)}`);
    return extract<PublicStorefrontAliasResponse>(response.data);
  },

  async resolveProductBySlug(slug: string): Promise<PublicProductAliasResponse> {
    const response = await apiClient.get(`/public/products/slug/${encodeURIComponent(slug)}`);
    return extract<PublicProductAliasResponse>(response.data);
  },
};
