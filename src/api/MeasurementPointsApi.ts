import type { MeasurementPoint, MeasurementPointCategory } from '@/types/sizing';
import { apiClient } from './httpClient';

const unwrap = <T>(raw: any): T => (raw?.data ?? raw) as T;

export const MeasurementPointsApi = {
  async getAll(params?: {
    gender?: 'MEN' | 'WOMEN' | 'UNISEX';
    category?: MeasurementPointCategory;
  }): Promise<MeasurementPoint[]> {
    const response = await apiClient.get('/measurement-points', { params });
    return unwrap<MeasurementPoint[]>(response.data);
  },

  async getForBrand(brandId: string): Promise<MeasurementPoint[]> {
    const response = await apiClient.get(`/measurement-points/brand/${brandId}`);
    return unwrap<MeasurementPoint[]>(response.data);
  },

  async submitFreeform(payload: {
    label: string;
    description?: string;
    category: MeasurementPointCategory;
    gender?: 'MEN' | 'WOMEN' | 'UNISEX';
    minValueCm?: number;
    maxValueCm?: number;
  }): Promise<{
    point: MeasurementPoint;
    fuzzyMatches: Array<{ id: string; key: string; label: string; similarity: number }>;
  }> {
    const response = await apiClient.post('/measurement-points/freeform', payload);
    return unwrap(response.data);
  },
};
