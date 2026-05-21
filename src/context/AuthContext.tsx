import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { disconnectSocket } from '../lib/ws';
import type { ReactNode } from 'react';
import { unwrapApiResponse } from '../types/auth';
import type { AuthUserDto, AuthProfileResponse, AuthTokensResponse } from '../types/auth';
import { useDispatch } from 'react-redux';
import { env } from '../config/env';
import { setUser, setUserFromStorage, clearUser } from '../features/userSlice';
import {
  apiClient,
  dropStoredAccessToken,
  persistAccessToken,
} from '../api/httpClient';
import { isAxiosError } from 'axios';
import { toast } from 'sonner';
import { queryClient } from '@/query/queryClient';
import { queryKeys } from '@/query/queryKeys';

interface AuthContextType {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = useCallback(async () => {
    const profilePayload = await queryClient.fetchQuery({
      queryKey: queryKeys.auth.profile(),
      queryFn: async () => {
        const response = await apiClient.get('/auth/profile');
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
        if (!merged.phoneNumber && persisted.phoneNumber) merged.phoneNumber = persisted.phoneNumber;
        if (!merged.address && persisted.address) merged.address = persisted.address;

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
    (error: unknown, { allowPersistedUser = false }: { allowPersistedUser?: boolean } = {}) => {
      if (isAxiosError(error)) {
        const status = error.response?.status ?? 0;
        if (status === 401) {
          dropStoredAccessToken();
          dispatch(clearUser());
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
            dispatch(clearUser());
          }
        }
      } else {
        console.error('Unexpected profile error:', error);
        if (!allowPersistedUser) {
          dropStoredAccessToken();
          dispatch(clearUser());
        }
      }
    },
    [dispatch],
  );

  const hasInitialisedRef = useRef(false);

  useEffect(() => {
    if (hasInitialisedRef.current) {
      return;
    }
    hasInitialisedRef.current = true;

    let isMounted = true;

    const onAuthExpired = () => {
      dropStoredAccessToken();
      dispatch(clearUser());
      try { toast.info('Session expired. Please sign in again.'); } catch {}
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('auth:expired', onAuthExpired);
    }

    const onUserStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return;
      if (event.key !== env.userStorageKey) return;

      if (!event.newValue) {
        dispatch(clearUser());
        return;
      }

      try {
        const parsed = JSON.parse(event.newValue) as AuthUserDto;
        if (parsed?.id) {
          dispatch(setUserFromStorage(parsed));
        } else {
          dispatch(clearUser());
        }
      } catch {
        dispatch(clearUser());
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onUserStorage);
    }

    const initialize = async () => {
      try {
        await fetchUserProfile();
      } catch (error) {
        handleProfileError(error, { allowPersistedUser: true });
      } finally {
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
  }, [dispatch, fetchUserProfile, handleProfileError]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      dropStoredAccessToken();
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
    void apiClient.post('/auth/logout').catch(() => undefined);
    queryClient.removeQueries({ queryKey: queryKeys.auth.profile(), exact: true });
    dropStoredAccessToken();
    dispatch(clearUser());
    disconnectSocket();
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
