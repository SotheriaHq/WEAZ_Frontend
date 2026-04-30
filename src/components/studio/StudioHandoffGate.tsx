import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useLocation } from 'react-router-dom';

import { apiClient, persistAccessToken } from '@/api/httpClient';
import type { AppDispatch } from '@/store';
import { setUser } from '@/features/userSlice';
import type { AuthProfileResponse, AuthUserDto } from '@/types/auth';
import { unwrapApiResponse } from '@/types/auth';
import { postStudioNativeEvent } from '@/utils/studioNativeBridge';

type Status = 'idle' | 'exchanging' | 'failed' | 'ready';

type StudioHandoffExchangeResponse = {
  accessToken?: string | null;
  intendedPath?: string | null;
};

type StudioHandoffGateProps = {
  children: React.ReactNode;
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

      try {
        const exchange = await apiClient.post('/auth/studio-handoff/exchange', {
          code: handoffCode,
          intendedPath: `${location.pathname}${location.search}${location.hash}`,
        });
        const payload = unwrapApiResponse<StudioHandoffExchangeResponse>(exchange.data);
        if (payload?.accessToken) {
          persistAccessToken(payload.accessToken);
        }

        scrubHandoffCodeFromUrl();

        const user = await loadProfile();
        if (!user?.id) {
          throw new Error('Profile failed after Studio handoff');
        }
        dispatch(setUser(user));
        postStudioNativeEvent({ type: 'READY' });
        if (mounted) setStatus('ready');
      } catch {
        scrubHandoffCodeFromUrl();
        postStudioNativeEvent({ type: 'HANDOFF_FAILED', reason: 'exchange_failed' });
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
