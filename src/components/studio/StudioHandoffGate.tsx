import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useLocation } from 'react-router-dom';

import { apiClient, persistAccessToken } from '@/api/httpClient';
import type { AppDispatch } from '@/store';
import { setUser } from '@/features/userSlice';
import type { AuthProfileResponse, AuthUserDto } from '@/types/auth';
import { unwrapApiResponse } from '@/types/auth';
import { postStudioNativeEvent } from '@/utils/studioNativeBridge';
import { env } from '@/config/env';

type Status = 'idle' | 'exchanging' | 'failed' | 'ready';

type StudioHandoffExchangeResponse = {
  accessToken?: string | null;
  intendedPath?: string | null;
};

type StudioHandoffGateProps = {
  children: React.ReactNode;
};

type HandoffFailureDetails = {
  reason: string;
  stage: string;
  status?: number;
  message?: string;
};

type HandoffExchangeResult = {
  user: AuthUserDto;
};

type HandoffExchangeCacheEntry = {
  promise: Promise<HandoffExchangeResult>;
  createdAt: number;
};

const HANDOFF_EXCHANGE_CACHE_TTL_MS = 2 * 60 * 1000;
const handoffExchangeCache = new Map<string, HandoffExchangeCacheEntry>();

const getHandoffCodeId = (code: string): string | null => {
  const [id, secret, ...extra] = String(code ?? '').split('.');
  if (!id || !secret || extra.length > 0) return null;
  return id;
};

const pruneHandoffExchangeCache = () => {
  const expiresBefore = Date.now() - HANDOFF_EXCHANGE_CACHE_TTL_MS;
  for (const [key, entry] of handoffExchangeCache.entries()) {
    if (entry.createdAt < expiresBefore) {
      handoffExchangeCache.delete(key);
    }
  }
};

const getErrorMessage = (error: unknown): string | undefined => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return undefined;
};

const getHttpStatus = (error: unknown): number | undefined => {
  const status = (error as { response?: { status?: unknown } })?.response?.status;
  return typeof status === 'number' ? status : undefined;
};

const getFailureReason = (error: unknown): string => {
  if ((error as { response?: unknown })?.response) {
    return 'http_error';
  }
  if ((error as { request?: unknown })?.request) {
    return 'network_or_cors_error';
  }
  return 'client_error';
};

const logHandoffDebug = (event: string, details: Record<string, unknown>) => {
  if (!import.meta.env.DEV) return;
  console.info('[studio-handoff-web]', event, details);
};

const scrubHandoffCodeFromUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete('handoffCode');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
};

const loadProfile = async (): Promise<AuthUserDto> => {
  const response = await apiClient.get('/auth/profile');
  const profilePayload = unwrapApiResponse<AuthProfileResponse | AuthUserDto>(response.data);
  return profilePayload && 'user' in profilePayload
    ? (profilePayload as AuthProfileResponse).user
    : (profilePayload as AuthUserDto);
};

const exchangeStudioHandoffOnce = (
  handoffCode: string,
  intendedPath: string,
  onStageChange: (stage: string) => void,
): Promise<HandoffExchangeResult> => {
  pruneHandoffExchangeCache();

  const codeId = getHandoffCodeId(handoffCode);
  if (!codeId) {
    throw new Error('Malformed Studio handoff code');
  }

  const cached = handoffExchangeCache.get(codeId);
  if (cached) {
    logHandoffDebug('exchange-reused-inflight', {
      apiBaseUrl: env.apiBaseUrl,
      codeId,
    });
    return cached.promise;
  }

  const promise = (async (): Promise<HandoffExchangeResult> => {
    onStageChange('exchange');
    const exchange = await apiClient.post('/auth/studio-handoff/exchange', {
      code: handoffCode,
      intendedPath,
    });
    logHandoffDebug('exchange-success', {
      status: exchange.status,
      apiBaseUrl: env.apiBaseUrl,
    });
    const payload = unwrapApiResponse<StudioHandoffExchangeResponse>(exchange.data);
    if (payload?.accessToken) {
      persistAccessToken(payload.accessToken);
    }

    scrubHandoffCodeFromUrl();

    onStageChange('profile');
    const user = await loadProfile();
    if (!user?.id) {
      throw new Error('Profile failed after Studio handoff');
    }
    logHandoffDebug('profile-success', {
      apiBaseUrl: env.apiBaseUrl,
      hasUser: true,
    });

    return { user };
  })();

  handoffExchangeCache.set(codeId, {
    promise,
    createdAt: Date.now(),
  });

  promise.catch(() => {
    handoffExchangeCache.delete(codeId);
  });

  return promise;
};

export const StudioHandoffGate: React.FC<StudioHandoffGateProps> = ({ children }) => {
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const handoffCode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('handoffCode');
  }, [location.search]);
  const isEmbedded = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('surface') === 'mobile-app';
  }, [location.search]);
  const [status, setStatus] = useState<Status>(handoffCode ? 'exchanging' : 'ready');
  const [message, setMessage] = useState('Opening Studio securely...');

  useEffect(() => {
    if (!handoffCode) {
      setStatus('ready');
      return;
    }

    let mounted = true;

    const run = async () => {
      setStatus('exchanging');
      setMessage('Opening Studio securely...');
      logHandoffDebug('exchange-start', {
        apiBaseUrl: env.apiBaseUrl,
        endpoint: '/auth/studio-handoff/exchange',
        path: `${location.pathname}${location.hash}`,
        hasHandoffCode: true,
      });

      let failureStage = 'exchange';
      try {
        const { user } = await exchangeStudioHandoffOnce(
          handoffCode,
          `${location.pathname}${location.search}${location.hash}`,
          (stage) => {
            failureStage = stage;
          },
        );
        dispatch(setUser(user));
        postStudioNativeEvent({ type: 'READY' });
        if (mounted) setStatus('ready');
      } catch (error) {
        const details: HandoffFailureDetails = {
          reason: getFailureReason(error),
          stage: (typeof failureStage === 'string' ? failureStage : 'exchange'),
          status: getHttpStatus(error),
          message: getErrorMessage(error),
        };
        logHandoffDebug('handoff-failed', {
          ...details,
          apiBaseUrl: env.apiBaseUrl,
        });
        scrubHandoffCodeFromUrl();
        postStudioNativeEvent({
          type: 'HANDOFF_FAILED',
          ...details,
          apiBaseUrl: env.apiBaseUrl,
        });
        if (mounted) {
          setMessage('We could not open Studio securely. Return to the app and try again.');
          setStatus('failed');
        }
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [dispatch, handoffCode, location.hash, location.pathname, location.search]);

  useEffect(() => {
    if (!isEmbedded) return;
    postStudioNativeEvent({
      type: 'ROUTE_CHANGED',
      path: `${location.pathname}${location.search}${location.hash}`,
    });
  }, [isEmbedded, location.hash, location.pathname, location.search]);

  if (status === 'ready') {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-5 text-slate-900 dark:bg-black dark:text-white">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm dark:border-white/10 dark:bg-zinc-950">
        <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-xl bg-purple-100 dark:bg-purple-500/20" />
        <div className="text-base font-semibold">{status === 'failed' ? 'Studio session failed' : 'Studio'}</div>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{message}</p>
      </div>
    </div>
  );
};

export default StudioHandoffGate;
