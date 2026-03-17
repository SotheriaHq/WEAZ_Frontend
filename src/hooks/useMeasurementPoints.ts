import { useEffect, useMemo, useState } from 'react';
import { MeasurementPointsApi } from '@/api/MeasurementPointsApi';
import type { MeasurementPoint, MeasurementPointCategory } from '@/types/sizing';
import { getWithTTL, setWithTTL } from '@/utils/sizing';

const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour fallback cache

export function useMeasurementPoints(filter?: {
  gender?: 'MEN' | 'WOMEN' | 'UNISEX';
  category?: MeasurementPointCategory;
}) {
  const [points, setPoints] = useState<MeasurementPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cacheKey = useMemo(
    () => `measurement_points:${filter?.gender ?? 'ALL'}:${filter?.category ?? 'ALL'}`,
    [filter?.gender, filter?.category],
  );

  useEffect(() => {
    let active = true;

    const cached = getWithTTL<MeasurementPoint[]>(cacheKey);
    if (cached?.length) {
      setPoints(cached);
      setIsLoading(false);
    }

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await MeasurementPointsApi.getAll(filter);
        if (!active) return;

        setPoints(response);
        setWithTTL(cacheKey, response, CACHE_TTL_MS);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message ?? 'Failed to load measurement points');
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [cacheKey, filter?.gender, filter?.category]);

  return { points, isLoading, error };
}
