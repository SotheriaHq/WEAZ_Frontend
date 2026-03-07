import { apiClient } from './httpClient';

export interface PublicFeaturedItem {
  id: string;
  entityType: 'PRODUCT' | 'DESIGN';
  entityId: string;
  brandId: string;
  startsAt: string;
  expiresAt: string;
  displayImages: string[];
  useCoverOnly: boolean;
  brand: { id: string; name: string; logo: string | null };
  entityName: string;
  entityThumbnail: string | null;
  entityPrice: { price: string; salePrice: string | null; currency: string } | null;
}

export const featuredApi = {
  listActive: () =>
    apiClient.get<PublicFeaturedItem[]>('/featured/active'),
  getById: (id: string) =>
    apiClient.get<PublicFeaturedItem>(`/featured/${id}`),
};
