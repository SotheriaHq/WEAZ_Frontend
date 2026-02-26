import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getStoreStatus, type StoreStatusResponse } from '@/api/StoreApi';
import {
  clearStoreOpenPending,
  isStoreOpenPending,
  resolveStoreSetupDestination,
  sleep,
} from '@/utils/storeSetup';

const STATUS_RETRY_ATTEMPTS = 5;
const STATUS_RETRY_DELAY_MS = 600;
const STORE_STATUS_CACHE_TTL_MS = 5 * 60 * 1000;

type StoreStatusCache = {
  status: StoreStatusResponse | null;
  hadError: boolean;
  checkedAt: number;
};

let storeStatusCache: StoreStatusCache = {
  status: null,
  hadError: false,
  checkedAt: 0,
};

let inFlightStoreStatusCheck: Promise<StoreStatusCache> | null = null;

const isCacheFresh = () =>
  storeStatusCache.checkedAt > 0 &&
  Date.now() - storeStatusCache.checkedAt < STORE_STATUS_CACHE_TTL_MS;

const canServeFromCache = () =>
  isCacheFresh() &&
  !storeStatusCache.hadError &&
  Boolean(storeStatusCache.status?.isStoreOpen);

const fetchStoreStatusWithRetry = async (): Promise<StoreStatusCache> => {
  const shouldRetryForPendingOpen = isStoreOpenPending();
  const maxAttempts = shouldRetryForPendingOpen ? STATUS_RETRY_ATTEMPTS : 1;
  let nextStatus: StoreStatusResponse | null = null;
  let sawError = false;

  try {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        nextStatus = await getStoreStatus();
        sawError = false;
        if (nextStatus?.isStoreOpen) {
          clearStoreOpenPending();
          break;
        }
      } catch {
        sawError = true;
      }

      if (attempt < maxAttempts - 1) {
        await sleep(STATUS_RETRY_DELAY_MS);
      }
    }
  } catch {
    sawError = true;
  }

  const nextCache: StoreStatusCache = {
    status: nextStatus,
    hadError: Boolean(sawError && !nextStatus),
    checkedAt: Date.now(),
  };

  storeStatusCache = nextCache;
  return nextCache;
};

const getCachedOrFetchStoreStatus = async (): Promise<StoreStatusCache> => {
  if (inFlightStoreStatusCheck) {
    return inFlightStoreStatusCheck;
  }

  inFlightStoreStatusCheck = fetchStoreStatusWithRetry().finally(() => {
    inFlightStoreStatusCheck = null;
  });

  return inFlightStoreStatusCheck;
};

const RequireStoreSetup: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [status, setStatus] = useState<StoreStatusResponse | null>(storeStatusCache.status);
  const [loading, setLoading] = useState(() => !canServeFromCache());
  const [hadError, setHadError] = useState(storeStatusCache.hadError);

  const isSetupRoute = useMemo(() => {
    return (
      location.pathname.startsWith('/studio/store/essentials') ||
      location.pathname.startsWith('/studio/store/setup')
    );
  }, [location.pathname]);

  useEffect(() => {
    if (isSetupRoute) {
      setLoading(false);
      return;
    }

    let mounted = true;

    if (storeStatusCache.checkedAt > 0) {
      setStatus(storeStatusCache.status);
      setHadError(storeStatusCache.hadError);
      setLoading(false);
    }

    if (canServeFromCache()) {
      return () => {
        mounted = false;
      };
    }

    const shouldBlockWithLoader =
      storeStatusCache.checkedAt === 0 ||
      !storeStatusCache.status?.isStoreOpen ||
      storeStatusCache.hadError;
    if (shouldBlockWithLoader) {
      setLoading(true);
      setHadError(false);
    }

    const run = async () => {
      const nextCache = await getCachedOrFetchStoreStatus();
      if (!mounted) return;
      setStatus(nextCache.status);
      setHadError(nextCache.hadError);
      if (shouldBlockWithLoader) {
        setLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [isSetupRoute]);

  if (isSetupRoute) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <div className="text-sm text-gray-500">Checking store setup...</div>
      </div>
    );
  }

  if (status?.isStoreOpen) {
    clearStoreOpenPending();
    return <>{children}</>;
  }

  if (isStoreOpenPending()) {
    return <>{children}</>;
  }

  const destination = resolveStoreSetupDestination();
  if (hadError || !status) {
    return <Navigate to={destination} replace />;
  }

  return status.isStoreOpen ? <>{children}</> : <Navigate to={destination} replace />;
};

export default RequireStoreSetup;
