import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { getStoreStatus, type StoreStatusResponse } from '@/api/StoreApi';
import type { RootState } from '@/store';
import {
  clearStoreOpenPending,
  isBrandProfileComplete,
  isStoreOpenPending,
  resolveBrandProfileSetupDestination,
  resolveStoreSetupDestination,
  sleep,
} from '@/utils/storeSetup';
import { useEmbeddedSurface } from '@/hooks/useEmbeddedSurface';
import { postStudioNativeEvent } from '@/utils/studioNativeBridge';

const STATUS_RETRY_ATTEMPTS = 5;
const STATUS_RETRY_DELAY_MS = 600;
const STORE_STATUS_CACHE_TTL_MS = 5 * 60 * 1000;
const EMAIL_VERIFICATION_RETURN_PATH_KEY =
  'threadly.emailVerification.returnPath';

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

let storeStatusCacheUserId: string | null = null;

let inFlightStoreStatusCheck: Promise<StoreStatusCache> | null = null;
let inFlightStoreStatusCheckUserId: string | null = null;

const normalizeCacheUserId = (userId?: string | null): string | null => {
  const candidate = String(userId ?? '').trim();
  return candidate.length > 0 ? candidate : null;
};

const isCacheFresh = (userId?: string | null) =>
  storeStatusCacheUserId === normalizeCacheUserId(userId) &&
  storeStatusCache.checkedAt > 0 &&
  Date.now() - storeStatusCache.checkedAt < STORE_STATUS_CACHE_TTL_MS;

const canServeFromCache = (userId?: string | null) =>
  isCacheFresh(userId) &&
  !storeStatusCache.hadError &&
  Boolean(storeStatusCache.status?.isStoreOpen);

const fetchStoreStatusWithRetry = async (
  userId?: string | null,
): Promise<StoreStatusCache> => {
  const shouldRetryForPendingOpen = isStoreOpenPending(userId);
  const maxAttempts = shouldRetryForPendingOpen ? STATUS_RETRY_ATTEMPTS : 1;
  let nextStatus: StoreStatusResponse | null = null;
  let sawError = false;

  try {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        nextStatus = await getStoreStatus();
        sawError = false;
        if (nextStatus?.isStoreOpen) {
          clearStoreOpenPending(userId);
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
  storeStatusCacheUserId = normalizeCacheUserId(userId);
  return nextCache;
};

const getCachedOrFetchStoreStatus = async (
  userId?: string | null,
): Promise<StoreStatusCache> => {
  const normalizedUserId = normalizeCacheUserId(userId);
  if (
    inFlightStoreStatusCheck &&
    inFlightStoreStatusCheckUserId === normalizedUserId
  ) {
    return inFlightStoreStatusCheck;
  }

  inFlightStoreStatusCheckUserId = normalizedUserId;
  inFlightStoreStatusCheck = fetchStoreStatusWithRetry(userId).finally(() => {
    inFlightStoreStatusCheck = null;
    inFlightStoreStatusCheckUserId = null;
  });

  return inFlightStoreStatusCheck;
};

const RequireStoreSetup: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const user = useSelector((state: RootState) => state.user.profile);
  const embeddedSurface = useEmbeddedSurface();
  const isEmbeddedMobile = embeddedSurface === 'mobile-app';
  const [status, setStatus] = useState<StoreStatusResponse | null>(() =>
    isCacheFresh(user?.id) ? storeStatusCache.status : null,
  );
  const [loading, setLoading] = useState(() => !canServeFromCache(user?.id));
  const [hadError, setHadError] = useState(() =>
    isCacheFresh(user?.id) ? storeStatusCache.hadError : false,
  );

  const isSetupRoute = useMemo(() => {
    return (
      location.pathname.startsWith('/studio/store/essentials') ||
      location.pathname.startsWith('/studio/store/setup')
    );
  }, [location.pathname]);

  const verificationPromptDestination = useMemo(() => {
    const nextPath = `${location.pathname}${location.search}`;
    const params = new URLSearchParams();
    params.set('verifyEmailPrompt', 'store-setup');
    params.set('next', nextPath);
    return `/profile?${params.toString()}`;
  }, [location.pathname, location.search]);

  const brandProfileSetupDestination = useMemo(() => {
    const nextPath = `${location.pathname}${location.search}`;
    return resolveBrandProfileSetupDestination(nextPath);
  }, [location.pathname, location.search]);

  const effectiveEmailVerified =
    status?.isEmailVerified ?? user?.isEmailVerified ?? true;
  const effectiveProfileComplete =
    status?.isProfileComplete ?? isBrandProfileComplete(user);
  const requiresEmailVerification =
    user?.type === 'BRAND' && effectiveEmailVerified === false;
  const requiresProfileCompletion =
    user?.type === 'BRAND' && effectiveProfileComplete === false;

  useEffect(() => {
    if (!requiresEmailVerification) {
      return;
    }

    try {
      const nextPath = `${location.pathname}${location.search}`;
      window.sessionStorage.setItem(EMAIL_VERIFICATION_RETURN_PATH_KEY, nextPath);
    } catch {
      // Ignore storage errors.
    }
  }, [requiresEmailVerification, location.pathname, location.search]);

  useEffect(() => {
    let mounted = true;

    if (isCacheFresh(user?.id)) {
      setStatus(storeStatusCache.status);
      setHadError(storeStatusCache.hadError);
      setLoading(false);
    }

    if (canServeFromCache(user?.id)) {
      return () => {
        mounted = false;
      };
    }

    const shouldBlockWithLoader =
      !isCacheFresh(user?.id) ||
      !storeStatusCache.status?.isStoreOpen ||
      storeStatusCache.hadError;
    if (shouldBlockWithLoader) {
      setLoading(true);
      setHadError(false);
    }

    const run = async () => {
      const nextCache = await getCachedOrFetchStoreStatus(user?.id);
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
  }, [isSetupRoute, user?.id]);

  if (requiresEmailVerification) {
    if (isEmbeddedMobile) {
      postStudioNativeEvent({ type: 'PROFILE_SETUP_REQUIRED', path: verificationPromptDestination });
      return (
        <div className="flex min-h-screen items-center justify-center bg-white px-5 text-slate-900 dark:bg-black dark:text-white">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm dark:border-white/10 dark:bg-zinc-950">
            <div className="text-base font-semibold">Email verification required</div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Return to the app to complete verification before opening Studio.
            </p>
          </div>
        </div>
      );
    }
    return <Navigate to={verificationPromptDestination} replace />;
  }

  if (requiresProfileCompletion) {
    if (isEmbeddedMobile) {
      postStudioNativeEvent({ type: 'PROFILE_SETUP_REQUIRED', path: brandProfileSetupDestination });
      return (
        <div className="flex min-h-screen items-center justify-center bg-white px-5 text-slate-900 dark:bg-black dark:text-white">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm dark:border-white/10 dark:bg-zinc-950">
            <div className="text-base font-semibold">Profile setup required</div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Return to the app to complete your brand profile before opening Studio.
            </p>
          </div>
        </div>
      );
    }
    return <Navigate to={brandProfileSetupDestination} replace />;
  }

  if (isSetupRoute) {
    return <>{children}</>;
  }

  if (loading) {
    return <>{children}</>;
  }

  if (status?.isStoreOpen) {
    clearStoreOpenPending(user?.id);
    return <>{children}</>;
  }

  if (isStoreOpenPending(user?.id)) {
    return <>{children}</>;
  }

  const destination = resolveStoreSetupDestination(user?.id);
  if (hadError || !status) {
    return <>{children}</>;
  }

  if (status.isStoreOpen) {
    return <>{children}</>;
  }

  if (isEmbeddedMobile) {
    const embeddedDestination = `${destination}${destination.includes('?') ? '&' : '?'}surface=mobile-app`;
    return <Navigate to={embeddedDestination} replace />;
  }

  return <Navigate to={destination} replace />;
};

export default RequireStoreSetup;
