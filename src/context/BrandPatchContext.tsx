import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSelector } from 'react-redux';
import { apiClient } from '@/api/httpClient';
import type { RootState } from '@/store';

type EnsurePatchOptions = {
  force?: boolean;
  silent?: boolean;
};

type BrandPatchContextValue = {
  isPatchCapable: boolean;
  getPatched: (brandId?: string | null) => boolean;
  isLoading: (brandId?: string | null) => boolean;
  prefetchStatuses: (brandIds: Array<string | null | undefined>) => Promise<void>;
  ensureStatus: (brandId?: string | null, options?: EnsurePatchOptions) => Promise<boolean>;
  toggleStatus: (brandId?: string | null) => Promise<boolean>;
  clearCache: () => void;
};

const PATCH_STATUS_TTL_MS = 30_000;
const PATCH_BATCH_THROTTLE_MS = 900;

const BrandPatchContext = createContext<BrandPatchContextValue | null>(null);

const normalizeBrandId = (brandId?: string | null): string | null => {
  if (typeof brandId !== 'string') return null;
  const normalized = brandId.trim();
  return normalized.length > 0 ? normalized : null;
};

const extractPatchedState = (payload: unknown): boolean => {
  const data = payload as Record<string, any> | null;
  return Boolean(data?.isPatched ?? data?.data?.isPatched ?? false);
};

const hasFreshStatus = (
  brandId: string,
  lastFetchedMap: Record<string, number>,
  force?: boolean,
): boolean => {
  if (force) return false;
  const fetchedAt = lastFetchedMap[brandId] ?? 0;
  return fetchedAt > 0 && Date.now() - fetchedAt < PATCH_STATUS_TTL_MS;
};

export const BrandPatchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useSelector((state: RootState) => state.user.isAuthenticated);
  const userType = useSelector((state: RootState) => state.user.profile?.type);

  const isPatchCapable = Boolean(isAuthenticated && userType === 'REGULAR');

  const [patchByBrand, setPatchByBrand] = useState<Record<string, boolean>>({});
  const [loadingByBrand, setLoadingByBrand] = useState<Record<string, boolean>>({});

  const patchByBrandRef = useRef<Record<string, boolean>>({});
  const lastFetchedRef = useRef<Record<string, number>>({});
  const singleInFlightRef = useRef<Record<string, Promise<boolean>>>({});
  const toggleInFlightRef = useRef<Record<string, Promise<boolean>>>({});
  const batchInFlightRef = useRef<Record<string, Promise<void>>>({});
  const batchLastRunRef = useRef<Record<string, number>>({});

  useEffect(() => {
    patchByBrandRef.current = patchByBrand;
  }, [patchByBrand]);

  const setBrandLoading = useCallback((brandId: string, loading: boolean) => {
    setLoadingByBrand((prev) => {
      const current = Boolean(prev[brandId]);
      if (current === loading) return prev;
      const next = { ...prev };
      if (loading) {
        next[brandId] = true;
      } else {
        delete next[brandId];
      }
      return next;
    });
  }, []);

  const clearCache = useCallback(() => {
    setPatchByBrand({});
    setLoadingByBrand({});
    patchByBrandRef.current = {};
    lastFetchedRef.current = {};
    singleInFlightRef.current = {};
    toggleInFlightRef.current = {};
    batchInFlightRef.current = {};
    batchLastRunRef.current = {};
  }, []);

  useEffect(() => {
    if (!isPatchCapable) {
      clearCache();
    }
  }, [clearCache, isPatchCapable]);

  const fetchSingleStatus = useCallback(
    async (brandId: string, options?: EnsurePatchOptions): Promise<boolean> => {
      if (!isPatchCapable) return false;

      const currentMap = patchByBrandRef.current;
      if (
        currentMap[brandId] !== undefined &&
        hasFreshStatus(brandId, lastFetchedRef.current, options?.force)
      ) {
        return currentMap[brandId];
      }

      const existingPromise = singleInFlightRef.current[brandId];
      if (existingPromise) {
        return existingPromise;
      }

      if (!options?.silent) {
        setBrandLoading(brandId, true);
      }

      const request = apiClient
        .get(`/brands/${brandId}/patches/check`)
        .then((res) => {
          const nextValue = extractPatchedState(res.data);
          setPatchByBrand((prev) => {
            if (prev[brandId] === nextValue) return prev;
            return { ...prev, [brandId]: nextValue };
          });
          lastFetchedRef.current[brandId] = Date.now();
          return nextValue;
        })
        .catch(() => {
          const fallback = Boolean(patchByBrandRef.current[brandId]);
          return fallback;
        })
        .finally(() => {
          delete singleInFlightRef.current[brandId];
          if (!options?.silent) {
            setBrandLoading(brandId, false);
          }
        });

      singleInFlightRef.current[brandId] = request;
      return request;
    },
    [isPatchCapable, setBrandLoading],
  );

  const prefetchStatuses = useCallback(
    async (brandIds: Array<string | null | undefined>) => {
      if (!isPatchCapable) return;

      const normalizedIds = Array.from(
        new Set(
          brandIds
            .map((brandId) => normalizeBrandId(brandId))
            .filter((brandId): brandId is string => Boolean(brandId)),
        ),
      );
      if (normalizedIds.length === 0) return;

      const targetIds = normalizedIds.filter((brandId) => {
        if (patchByBrandRef.current[brandId] === undefined) return true;
        return !hasFreshStatus(brandId, lastFetchedRef.current);
      });
      if (targetIds.length === 0) return;

      const requestKey = targetIds.join('|');
      const existingBatch = batchInFlightRef.current[requestKey];
      if (existingBatch) {
        return existingBatch;
      }

      const now = Date.now();
      const lastRunAt = batchLastRunRef.current[requestKey] ?? 0;
      if (now - lastRunAt < PATCH_BATCH_THROTTLE_MS) {
        return;
      }

      targetIds.forEach((brandId) => setBrandLoading(brandId, true));

      const request = apiClient
        .post('/brands/patches/check/batch', {
          targetIds,
        })
        .then((res) => {
          const rows = Array.isArray(res.data?.items)
            ? (res.data.items as Array<Record<string, any>>)
            : [];
          const resultById = new Map<string, boolean>();

          rows.forEach((row) => {
            const targetId = normalizeBrandId(String(row?.targetId ?? ''));
            if (!targetId) return;
            resultById.set(targetId, Boolean(row?.isPatched));
          });

          setPatchByBrand((prev) => {
            let changed = false;
            const next = { ...prev };

            targetIds.forEach((brandId) => {
              const nextValue = resultById.has(brandId)
                ? Boolean(resultById.get(brandId))
                : false;
              if (next[brandId] !== nextValue) {
                next[brandId] = nextValue;
                changed = true;
              }
            });

            return changed ? next : prev;
          });

          const timestamp = Date.now();
          targetIds.forEach((brandId) => {
            lastFetchedRef.current[brandId] = timestamp;
          });
        })
        .catch(() => {
          // Keep previous cache on batch failure.
        })
        .finally(() => {
          delete batchInFlightRef.current[requestKey];
          batchLastRunRef.current[requestKey] = Date.now();
          targetIds.forEach((brandId) => setBrandLoading(brandId, false));
        });

      batchInFlightRef.current[requestKey] = request;
      return request;
    },
    [isPatchCapable, setBrandLoading],
  );

  const ensureStatus = useCallback(
    async (brandId?: string | null, options?: EnsurePatchOptions) => {
      const normalizedBrandId = normalizeBrandId(brandId);
      if (!normalizedBrandId || !isPatchCapable) return false;
      return fetchSingleStatus(normalizedBrandId, options);
    },
    [fetchSingleStatus, isPatchCapable],
  );

  const toggleStatus = useCallback(
    async (brandId?: string | null) => {
      const normalizedBrandId = normalizeBrandId(brandId);
      if (!normalizedBrandId || !isPatchCapable) return false;

      const existingToggle = toggleInFlightRef.current[normalizedBrandId];
      if (existingToggle) {
        return existingToggle;
      }

      const previous = Boolean(patchByBrandRef.current[normalizedBrandId]);
      const optimisticNext = !previous;

      setBrandLoading(normalizedBrandId, true);
      setPatchByBrand((prev) => ({
        ...prev,
        [normalizedBrandId]: optimisticNext,
      }));

      const request = (async () => {
        try {
          if (previous) {
            await apiClient.delete(`/brands/${normalizedBrandId}/patches`);
          } else {
            await apiClient.post(`/brands/${normalizedBrandId}/patches`);
          }

          const verified = await fetchSingleStatus(normalizedBrandId, {
            force: true,
            silent: true,
          });
          return verified;
        } catch (error) {
          setPatchByBrand((prev) => ({
            ...prev,
            [normalizedBrandId]: previous,
          }));
          throw error;
        } finally {
          delete toggleInFlightRef.current[normalizedBrandId];
          setBrandLoading(normalizedBrandId, false);
        }
      })();

      toggleInFlightRef.current[normalizedBrandId] = request;
      return request;
    },
    [fetchSingleStatus, isPatchCapable, setBrandLoading],
  );

  const getPatched = useCallback(
    (brandId?: string | null) => {
      const normalizedBrandId = normalizeBrandId(brandId);
      if (!normalizedBrandId || !isPatchCapable) return false;
      return Boolean(patchByBrand[normalizedBrandId]);
    },
    [isPatchCapable, patchByBrand],
  );

  const isLoading = useCallback((brandId?: string | null) => {
    const normalizedBrandId = normalizeBrandId(brandId);
    if (!normalizedBrandId) return false;
    return Boolean(loadingByBrand[normalizedBrandId]);
  }, [loadingByBrand]);

  const value = useMemo<BrandPatchContextValue>(
    () => ({
      isPatchCapable,
      getPatched,
      isLoading,
      prefetchStatuses,
      ensureStatus,
      toggleStatus,
      clearCache,
    }),
    [
      clearCache,
      ensureStatus,
      getPatched,
      isLoading,
      isPatchCapable,
      prefetchStatuses,
      toggleStatus,
    ],
  );

  return <BrandPatchContext.Provider value={value}>{children}</BrandPatchContext.Provider>;
};

export const useBrandPatchState = (): BrandPatchContextValue => {
  const context = useContext(BrandPatchContext);
  if (!context) {
    throw new Error('useBrandPatchState must be used inside BrandPatchProvider');
  }
  return context;
};
