import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { env } from '@/config/env';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import userReducer from '@/features/userSlice';
import { queryClient } from '@/query/queryClient';
import type { AuthUserDto } from '@/types/auth';

const {
  apiGet,
  apiPost,
  clearWebPrivateSessionState,
  dropStoredAccessToken,
  persistAccessToken,
  toastError,
  toastInfo,
} = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  clearWebPrivateSessionState: vi.fn(),
  dropStoredAccessToken: vi.fn(),
  persistAccessToken: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock('@/api/httpClient', () => ({
  apiClient: {
    get: apiGet,
    post: apiPost,
  },
  dropStoredAccessToken,
  persistAccessToken,
}));

vi.mock('@/auth/sessionCleanup', () => ({
  clearWebPrivateSessionState,
}));

vi.mock('sonner', () => ({
  toast: {
    error: toastError,
    info: toastInfo,
  },
}));

const baseUser: AuthUserDto = {
  id: 'admin-1',
  username: 'admin',
  email: 'adminoversee@test.com',
  firstName: 'Admin',
  lastName: 'Owner',
  role: 'SuperAdmin',
  type: 'REGULAR',
  themePreference: 'system',
  phoneNumber: null,
  address: null,
  brandFullName: null,
  brandDescription: null,
  brandCountry: null,
  brandState: null,
  brandCity: null,
  brandTags: [],
  brandBusinessType: null,
  socialInstagram: null,
  socialFacebook: null,
  socialTwitter: null,
  socialWebsite: null,
  cacNumber: null,
  tin: null,
  ceoNin: null,
  ceoFirstName: null,
  ceoLastName: null,
  companyLocation: null,
  profileImage: null,
  profileImageId: null,
  profileImageFile: null,
  bannerImage: null,
  bannerImageId: null,
  bannerImageFile: null,
  isEmailVerified: true,
  storeId: null,
  isActive: 'ACTIVE',
  createdAt: '2026-06-08T00:00:00.000Z',
  updatedAt: '2026-06-08T00:00:00.000Z',
};

function AuthStatusProbe() {
  const { loading } = useAuth();
  return <div>{loading ? 'auth loading' : 'auth ready'}</div>;
}

const renderAuthProvider = ({ strict = false }: { strict?: boolean } = {}) => {
  const store = configureStore({
    reducer: {
      user: userReducer,
    },
  });

  const authTree = (
    <Provider store={store}>
      <AuthProvider>
        <AuthStatusProbe />
      </AuthProvider>
    </Provider>
  );

  return render(strict ? <StrictMode>{authTree}</StrictMode> : authTree);
};

const persistBaseUser = () => {
  localStorage.setItem(env.userStorageKey, JSON.stringify(baseUser));
};

describe('AuthProvider profile bootstrap', () => {
  beforeEach(() => {
    localStorage.clear();
    queryClient.clear();
    vi.clearAllMocks();
    apiGet.mockResolvedValue({
      data: {
        data: {
          user: baseUser,
        },
      },
    });
  });

  it('skips profile bootstrap when there is no persisted session evidence', async () => {
    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByText('auth ready')).toBeInTheDocument();
    });

    expect(apiGet).not.toHaveBeenCalled();
  });

  it('fetches auth profile with cache bypass headers and a fresh query key request', async () => {
    persistBaseUser();
    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByText('auth ready')).toBeInTheDocument();
    });

    expect(apiGet).toHaveBeenCalledWith(
      '/auth/profile',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        }),
        params: expect.objectContaining({
          _authProfileTs: expect.any(String),
        }),
      }),
    );
  });

  it('finishes auth bootstrap under React StrictMode double effects', async () => {
    persistBaseUser();
    renderAuthProvider({ strict: true });

    await waitFor(() => {
      expect(screen.getByText('auth ready')).toBeInTheDocument();
    });

    expect(apiGet).toHaveBeenCalledWith(
      '/auth/profile',
      expect.objectContaining({
        params: expect.objectContaining({
          _authProfileTs: expect.any(String),
        }),
      }),
    );
  });

  it('does not log or clear auth state for expected profile query cancellation', async () => {
    const cancelled = new Error('Cancelled');
    cancelled.name = 'CancelledError';
    persistBaseUser();
    apiGet.mockRejectedValueOnce(cancelled);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByText('auth ready')).toBeInTheDocument();
    });

    expect(consoleError).not.toHaveBeenCalled();
    expect(dropStoredAccessToken).not.toHaveBeenCalled();
    expect(clearWebPrivateSessionState).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it('dedupes user-facing expired-session toasts after auth bootstrap', async () => {
    persistBaseUser();
    renderAuthProvider();

    await waitFor(() => {
      expect(screen.getByText('auth ready')).toBeInTheDocument();
    });

    vi.clearAllMocks();

    window.dispatchEvent(new CustomEvent('auth:expired'));
    window.dispatchEvent(new CustomEvent('auth:expired'));

    await waitFor(() => {
      expect(clearWebPrivateSessionState).toHaveBeenCalled();
    });
    expect(toastInfo).toHaveBeenCalledTimes(1);
    expect(toastInfo).toHaveBeenCalledWith('Session expired. Please sign in again.');
  });
});
