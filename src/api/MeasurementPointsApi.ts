import type { MeasurementPoint, MeasurementPointCategory } from '@/types/sizing';
import { apiClient } from './httpClient';

const unwrap = <T>(raw: any): T => (raw?.data ?? raw) as T;

const normalizeMeasurementDisplayLabel = (rawLabel: string) =>
  String(rawLabel ?? '')
    .trim()
    .replace(/^BRAND[_\-\s]+[^_\-\s]+[_\-\s]+/i, '')
    .replace(/^(MEN|WOMEN|WOMAN|UNISEX)[_\-\s]+/i, '')
    .replace(/[_\-\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizePoint = (point: MeasurementPoint): MeasurementPoint => ({
  ...point,
  label: normalizeMeasurementDisplayLabel(point.label),
});

export const MeasurementPointsApi = {
  async getAll(params?: {
    gender?: 'MEN' | 'WOMEN' | 'UNISEX';
    category?: MeasurementPointCategory;
  }): Promise<MeasurementPoint[]> {
    const response = await apiClient.get('/measurement-points', { params });
    return unwrap<MeasurementPoint[]>(response.data).map(normalizePoint);
  },

  async getForBrand(brandId: string): Promise<MeasurementPoint[]> {
    const response = await apiClient.get(`/measurement-points/brand/${brandId}`);
    return unwrap<MeasurementPoint[]>(response.data).map(normalizePoint);
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
    const data = unwrap<{
      point: MeasurementPoint;
      fuzzyMatches: Array<{ id: string; key: string; label: string; similarity: number }>;
    }>(response.data);

    return {
      ...data,
      point: normalizePoint(data.point),
      fuzzyMatches: Array.isArray(data.fuzzyMatches)
        ? data.fuzzyMatches.map((match) => ({
            ...match,
            label: normalizeMeasurementDisplayLabel(match.label),
          }))
        : [],
    };
  },
};
