import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { isCancelledError } from '@tanstack/react-query';
import { unwrapApiResponse } from '../types/auth';
import type { AuthUserDto, AuthProfileResponse, AuthTokensResponse } from '../types/auth';
import { useDispatch } from 'react-redux';
import { env } from '../config/env';
import { setUser, setUserFromStorage, clearUser } from '../features/userSlice';
import { resetAdminState } from '../features/adminSlice';
import { resetCartState } from '../features/cartSlice';
import { resetState as resetNotificationsState } from '../features/notificationsSlice';
import { resetWishlistState } from '../features/wishlistSlice';
import {
  apiClient,
  dropStoredAccessToken,
  persistAccessToken,
  logoutCurrentSession,
  getStoredAccessToken,
  refreshAccessToken,
} from '../api/httpClient';
import { isAxiosError, isCancel } from 'axios';
import { toast } from 'sonner';
import { queryClient } from '@/query/queryClient';
import { queryKeys } from '@/query/queryKeys';
import { clearWebPrivateSessionState } from '@/auth/sessionCleanup';
import { SecurityVerificationCancelled } from '@/auth/securityChallenge';

interface AuthContextType {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CANCELLED_ERROR_NAMES = new Set(['CancelledError', 'CanceledError', 'AbortError']);

const isExpectedQueryCancellation = (error: unknown) => {
  if (isCancelledError(error) || isCancel(error)) {
    return true;
  }
  if (error instanceof Error && CANCELLED_ERROR_NAMES.has(error.name)) {
    return true;
  }
  if (error && typeof error === 'object' && 'name' in error) {
    const name = (error as { name?: unknown }).name;
    return typeof name === 'string' && CANCELLED_ERROR_NAMES.has(name);
  }
  return false;
};

const hasPersistedSessionEvidence = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    return Boolean(
      localStorage.getItem(env.tokenStorageKey) ||
        localStorage.getItem(env.userStorageKey),
    );
  } catch {
    return false;
  }
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(() => hasPersistedSessionEvidence());
  const authExpiredToastShownRef = useRef(false);
  const bootstrapCompleteRef = useRef(false);

  const fetchUserProfile = useCallback(async () => {
    const profilePayload = await queryClient.fetchQuery({
      queryKey: queryKeys.auth.profile(),
      staleTime: 0,
      retry: false,
      queryFn: async () => {
        // Cookies survive reloads; the in-memory bearer does not. Restore its
        // session binding before a challenged profile can ask for verification.
        // The transport fences refresh against sign-out/account changes. A
        // transient failure must not turn into an unbound cookie-only prompt.
        if (!getStoredAccessToken() && !await refreshAccessToken()) {
          throw new SecurityVerificationCancelled('Sign-in restoration could not finish. Retry when connected.');
        }
        const response = await apiClient.get('/auth/profile', {
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
          params: {
            _authProfileTs: Date.now().toString(),
          },
        });
        return unwrapApiResponse<AuthProfileResponse | AuthUserDto>(response.data);
      },
    });
    const user =
      'user' in profilePayload
        ? (profilePayload as AuthProfileResponse).user
        : (profilePayload as AuthUserDto);

    if (!user || !user.id) {
      throw new Error('Invalid profile response');
    }

    // Keep auth/profile as the canonical server snapshot.
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(env.userStorageKey) : null;
      if (raw) {
        const persisted = JSON.parse(raw) as AuthUserDto;
        // Only overwrite server values when server doesn't provide them and persisted has them
        const merged = { ...user } as AuthUserDto;
        if (persisted.id === user.id) {
          if (!merged.phoneNumber && persisted.phoneNumber) merged.phoneNumber = persisted.phoneNumber;
          if (!merged.address && persisted.address) merged.address = persisted.address;
        }

        dispatch(setUser(merged));
        return merged;
      }
    } catch (err) {
      // If parsing fails, just dispatch the fetched user
      console.warn('Failed to merge persisted user data', err);
    }

    dispatch(setUser(user));
    return user;
  }, [dispatch]);

  const handleProfileError = useCallback(
    (error: unknown, { allowPersistedUser = false, preserveSharedAuthStorage = false }:
      { allowPersistedUser?: boolean; preserveSharedAuthStorage?: boolean } = {}) => {
      if (isExpectedQueryCancellation(error)) {
        return;
      }
      if (isAxiosError(error)) {
        const status = error.response?.status ?? 0;
        if (status === 401) {
          dropStoredAccessToken();
          dispatch(preserveSharedAuthStorage ? setUserFromStorage(null) : clearUser());
        } else if (status === 403) {
          if (!allowPersistedUser) {
            toast.error('You do not have permission to perform this action. Ask the brand owner for access.');
          }
        } else if (status === 429) {
          if (!allowPersistedUser) {
            console.warn('Profile request throttled; preserving current state.');
          }
        } else {
          console.error('Profile fetch failed:', error);
          if (!allowPersistedUser) {
            dropStoredAccessToken();
            dispatch(preserveSharedAuthStorage ? setUserFromStorage(null) : clearUser());
          }
        }
      } else {
        console.error('Unexpected profile error:', error);
        if (!allowPersistedUser) {
          dropStoredAccessToken();
          dispatch(preserveSharedAuthStorage ? setUserFromStorage(null) : clearUser());
        }
      }
    },
    [dispatch],
  );

  const clearPrivateSession = useCallback(async ({ preserveSharedAuthStorage = false } = {}) => {
    const cleanup = clearWebPrivateSessionState({ client: queryClient, preserveSharedAuthStorage });
    // Clear visible state before yielding; an old cleanup must not run its
    // Redux clears after a new sign-in has already completed.
    dispatch(preserveSharedAuthStorage ? setUserFromStorage(null) : clearUser());
    dispatch(resetNotificationsState());
    dispatch(resetCartState());
    dispatch(resetWishlistState());
    dispatch(resetAdminState());
    await cleanup;
  }, [dispatch]);

  useEffect(() => {
    let isMounted = true;

    const onAuthExpired = (event: Event) => {
      const shouldNotify = bootstrapCompleteRef.current && hasPersistedSessionEvidence();
      const preserveSharedAuthStorage = (event as CustomEvent)?.detail?.preserveSharedAuthStorage === true;
      if (preserveSharedAuthStorage) void clearPrivateSession({ preserveSharedAuthStorage: true });
      else void clearPrivateSession();
      if (shouldNotify && !authExpiredToastShownRef.current) {
        authExpiredToastShownRef.current = true;
        try { toast.info('Session expired. Please sign in again.'); } catch {}
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('auth:expired', onAuthExpired);
    }

    const onUserStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return;
      if (event.key !== env.userStorageKey) return;

      // A storage event is a signal, never proof of identity. Drop this tab's
      // old credentials/private state, then ask the server about its cookies.
      // Preserve the sender's storage to avoid a cross-tab sign-out loop.
      void (async () => {
        await clearPrivateSession({ preserveSharedAuthStorage: true });
        if (!event.newValue) return;
        try { await fetchUserProfile(); }
        catch (error) { handleProfileError(error, { preserveSharedAuthStorage: true }); }
      })();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onUserStorage);
    }

    const initialize = async () => {
      const bootstrapTimeout = window.setTimeout(() => {
        bootstrapCompleteRef.current = true;
        if (isMounted) {
          setLoading(false);
        }
      }, 8_000);

      try {
        if (!hasPersistedSessionEvidence()) {
          return;
        }
        await fetchUserProfile();
        authExpiredToastShownRef.current = false;
      } catch (error) {
        if (isExpectedQueryCancellation(error)) {
          return;
        }
        handleProfileError(error);
        await clearPrivateSession();
      } finally {
        window.clearTimeout(bootstrapTimeout);
        bootstrapCompleteRef.current = true;
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void initialize();

    return () => {
      isMounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('auth:expired', onAuthExpired);
        window.removeEventListener('storage', onUserStorage);
      }
    };
  }, [dispatch, fetchUserProfile, handleProfileError, clearPrivateSession]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      await clearPrivateSession();
      const response = await apiClient.post('/auth/login', { email, password });
      const loginPayload = unwrapApiResponse<AuthTokensResponse | AuthUserDto>(response.data);

      let accessToken: string | null = null;
      let user: AuthUserDto | null = null;

      if (loginPayload && typeof loginPayload === 'object') {
        if ('accessToken' in loginPayload && typeof loginPayload.accessToken === 'string') {
          accessToken = loginPayload.accessToken;
        }
        if ('user' in loginPayload && loginPayload.user && typeof loginPayload.user === 'object') {
          user = loginPayload.user as AuthUserDto;
        } else if ('id' in loginPayload) {
          user = loginPayload as AuthUserDto;
        }
      }

      if (accessToken) {
        persistAccessToken(accessToken);
      }
      authExpiredToastShownRef.current = false;
      queryClient.removeQueries({ queryKey: queryKeys.auth.profile(), exact: true });

      if (user && user.id) {
        dispatch(setUser(user));
        void fetchUserProfile().catch((profileError) => {
          handleProfileError(profileError, { allowPersistedUser: true });
        });
      } else {
        await fetchUserProfile();
      }

      return true;
    } catch (error) {
      handleProfileError(error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    void logoutCurrentSession().catch(() => undefined);
    void clearPrivateSession();
  };

  return (
    <AuthContext.Provider value={{ login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
