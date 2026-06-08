import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import userReducer from '@/features/userSlice';
import { queryClient } from '@/query/queryClient';
import type { AuthUserDto } from '@/types/auth';

const { apiGet, apiPost, clearWebPrivateSessionState } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  clearWebPrivateSessionState: vi.fn(),
}));

vi.mock('@/api/httpClient', () => ({
  apiClient: {
    get: apiGet,
    post: apiPost,
  },
  dropStoredAccessToken: vi.fn(),
  persistAccessToken: vi.fn(),
}));

vi.mock('@/auth/sessionCleanup', () => ({
  clearWebPrivateSessionState,
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
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

  it('fetches auth profile with cache bypass headers and a fresh query key request', async () => {
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
});
