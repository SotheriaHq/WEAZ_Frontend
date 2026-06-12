import { useEffect, useMemo, useState } from 'react';
import { MeasurementPointsApi } from '@/api/MeasurementPointsApi';
import type { MeasurementPoint, MeasurementPointCategory } from '@/types/sizing';
import { getWithTTL, setWithTTL } from '@/utils/sizing';

const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour fallback cache
const MEASUREMENT_POINTS_UPDATED_EVENT = 'threadly:measurement-points-updated';

export function useMeasurementPoints(filter?: {
  gender?: 'MEN' | 'WOMEN' | 'UNISEX';
  category?: MeasurementPointCategory;
}) {
  const [points, setPoints] = useState<MeasurementPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const requestFilter = useMemo(() => {
    const nextFilter = {
      gender: filter?.gender,
      category: filter?.category,
    };
    return nextFilter.gender || nextFilter.category ? nextFilter : undefined;
  }, [filter?.gender, filter?.category]);

  const cacheKey = useMemo(
    () => `measurement_points:${requestFilter?.gender ?? 'ALL'}:${requestFilter?.category ?? 'ALL'}`,
    [requestFilter?.gender, requestFilter?.category],
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
        const response = await MeasurementPointsApi.getAll(requestFilter);
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
  }, [cacheKey, requestFilter, refreshTick]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleMeasurementPointRefresh = () => {
      setRefreshTick((current) => current + 1);
    };

    window.addEventListener(MEASUREMENT_POINTS_UPDATED_EVENT, handleMeasurementPointRefresh);
    return () => {
      window.removeEventListener(MEASUREMENT_POINTS_UPDATED_EVENT, handleMeasurementPointRefresh);
    };
  }, []);

  return { points, isLoading, error };
}
