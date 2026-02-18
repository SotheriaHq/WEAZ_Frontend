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

const RequireStoreSetup: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [status, setStatus] = useState<StoreStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [hadError, setHadError] = useState(false);

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
    setLoading(true);
    setHadError(false);

    const run = async () => {
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
      } finally {
        if (!mounted) return;
        setStatus(nextStatus);
        setHadError(Boolean(sawError && !nextStatus));
        setLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [isSetupRoute, location.pathname]);

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
