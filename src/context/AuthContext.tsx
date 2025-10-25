
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { unwrapApiResponse } from '../types/auth';
import type { AuthUserDto, AuthProfileResponse, AuthTokensResponse } from '../types/auth';
import { useDispatch } from 'react-redux';
import { env } from '../config/env';
import { setUser, clearUser } from '../features/userSlice';
import {
  apiClient,
  dropStoredAccessToken,
  getStoredAccessToken,
  persistAccessToken,
} from '../api/httpClient';
import { isAxiosError } from 'axios';

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
    const response = await apiClient.get('/auth/profile');
    const profilePayload = unwrapApiResponse<AuthProfileResponse | AuthUserDto>(response.data);
    const user =
      'user' in profilePayload
        ? (profilePayload as AuthProfileResponse).user
        : (profilePayload as AuthUserDto);

    if (!user || !user.id) {
      throw new Error('Invalid profile response');
    }

    // Merge persisted user fields (profileImage, profileImageFile, etc.) to avoid
    // overwriting locally persisted values with empty/undefined values from the server.
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(env.userStorageKey) : null;
      if (raw) {
        const persisted = JSON.parse(raw) as AuthUserDto;
        // Only overwrite server values when server doesn't provide them and persisted has them
        const merged = { ...user } as AuthUserDto;
        if (!merged.profileImage && persisted.profileImage) merged.profileImage = persisted.profileImage;
        if (!merged.profileImageId && persisted.profileImageId) merged.profileImageId = persisted.profileImageId;
        if (!merged.profileImageFile && persisted.profileImageFile) merged.profileImageFile = persisted.profileImageFile;
        if (!merged.bannerImage && persisted.bannerImage) merged.bannerImage = persisted.bannerImage;
        if (!merged.bannerImageId && persisted.bannerImageId) merged.bannerImageId = persisted.bannerImageId;
        if (!merged.bannerImageFile && persisted.bannerImageFile) merged.bannerImageFile = persisted.bannerImageFile;

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
        if (status === 401 || status === 403) {
          dropStoredAccessToken();
          dispatch(clearUser());
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

    const initialize = async () => {
      try {
        const storedToken = getStoredAccessToken();
        if (!storedToken) {
          dispatch(clearUser());
          return;
        }
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

      if (user && user.id) {
        dispatch(setUser(user));
        try {
          await fetchUserProfile();
        } catch (profileError) {
          handleProfileError(profileError, { allowPersistedUser: true });
        }
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
    dropStoredAccessToken();
    dispatch(clearUser());
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
