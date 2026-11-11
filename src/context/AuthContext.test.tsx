import { configureStore } from '@reduxjs/toolkit';
import { act, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { Provider } from 'react-redux';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { env } from '@/config/env';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import userReducer from '@/features/userSlice';
import { queryClient } from '@/query/queryClient';
import type { AuthUserDto } from '@/types/auth';
import { AxiosError } from 'axios';

const {
  apiGet,
  apiPost,
  clearWebPrivateSessionState,
  dropStoredAccessToken,
  persistAccessToken,
  logoutCurrentSession,
  getStoredAccessToken,
  refreshAccessToken,
  toastError,
  toastInfo,
} = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  clearWebPrivateSessionState: vi.fn(),
  dropStoredAccessToken: vi.fn(),
  persistAccessToken: vi.fn(),
  logoutCurrentSession: vi.fn(),
  getStoredAccessToken: vi.fn(),
  refreshAccessToken: vi.fn(),
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
  logoutCurrentSession,
  getStoredAccessToken,
  refreshAccessToken,
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

  return { ...render(strict ? <StrictMode>{authTree}</StrictMode> : authTree), store };
};

const persistBaseUser = () => {
  localStorage.setItem(env.userStorageKey, JSON.stringify(baseUser));
};

describe('AuthProvider profile bootstrap', () => {
  beforeEach(() => {
    localStorage.clear();
    queryClient.clear();
    vi.clearAllMocks();
    getStoredAccessToken.mockReturnValue('restored-test-token');
    refreshAccessToken.mockResolvedValue('restored-test-token');
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

  it('restores the cookie session bearer before requesting a potentially challenged profile', async () => {
    persistBaseUser(); getStoredAccessToken.mockReturnValue(null);
    let restore!: (value: string | null) => void;
    refreshAccessToken.mockImplementationOnce(() => new Promise(resolve => { restore = resolve; }));
    renderAuthProvider();
    await waitFor(() => expect(refreshAccessToken).toHaveBeenCalledOnce());
    expect(apiGet).not.toHaveBeenCalled();
    await act(async () => restore('restored-bound-token'));
    await waitFor(() => expect(apiGet).toHaveBeenCalledOnce());
  });

  it('does not issue an unbound profile request or erase shared sign-in when refresh is unavailable', async () => {
    persistBaseUser(); getStoredAccessToken.mockReturnValue(null); refreshAccessToken.mockResolvedValueOnce(null);
    renderAuthProvider(); await waitFor(() => expect(screen.getByText('auth ready')).toBeInTheDocument());
    expect(apiGet).not.toHaveBeenCalled(); expect(clearWebPrivateSessionState).not.toHaveBeenCalled();
    expect(localStorage.getItem(env.userStorageKey)).not.toBeNull();
  });

  it('restores the bearer again before server-validating an identity signalled by another tab', async () => {
    persistBaseUser(); renderAuthProvider();
    await waitFor(() => expect(screen.getByText('auth ready')).toBeInTheDocument()); queryClient.clear();
    apiGet.mockClear(); getStoredAccessToken.mockReturnValue(null);
    let restore!: (value: string | null) => void;
    refreshAccessToken.mockImplementationOnce(() => new Promise(resolve => { restore = resolve; }));
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: env.userStorageKey,
      newValue: JSON.stringify(baseUser), storageArea: localStorage })));
    await waitFor(() => expect(refreshAccessToken).toHaveBeenCalledOnce()); expect(apiGet).not.toHaveBeenCalled();
    await act(async () => restore('restored-bound-token'));
    await waitFor(() => expect(apiGet).toHaveBeenCalledOnce());
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

  it('does not combine a different persisted person’s contact data with the server identity', async () => {
    localStorage.setItem(env.userStorageKey, JSON.stringify({ ...baseUser, id: 'other', phoneNumber: 'private-other-phone', address: 'private-other-address' }));
    const { store } = renderAuthProvider();
    await waitFor(() => expect(screen.getByText('auth ready')).toBeInTheDocument());
    expect(store.getState().user.profile?.id).toBe(baseUser.id);
    expect(store.getState().user.profile?.phoneNumber).not.toBe('private-other-phone');
    expect(store.getState().user.profile?.address).not.toBe('private-other-address');
  });

  it('clears the old tab immediately and never imports an unverified storage identity', async () => {
    persistBaseUser(); const { store } = renderAuthProvider();
    await waitFor(() => expect(screen.getByText('auth ready')).toBeInTheDocument());
    queryClient.clear(); let resolve!: (value: unknown) => void;
    apiGet.mockImplementationOnce(() => new Promise(yes => { resolve = yes; }));
    const unverified = JSON.stringify({ ...baseUser, id: 'forged-local-storage' });
    localStorage.setItem(env.userStorageKey, unverified);
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: env.userStorageKey, newValue: unverified, storageArea: localStorage })));
    expect(store.getState().user.profile).toBeNull();
    expect(clearWebPrivateSessionState).toHaveBeenCalledWith(expect.objectContaining({ preserveSharedAuthStorage: true }));
    await waitFor(() => expect(resolve).toBeTypeOf('function'));
    await act(async () => resolve({ data: { user: { ...baseUser, id: 'server-confirmed' } } }));
    await waitFor(() => expect(store.getState().user.profile?.id).toBe('server-confirmed'));
  });

  it('treats a discarded old-session response as cancellation without clearing a newer sign-in', async () => {
    persistBaseUser(); apiGet.mockRejectedValueOnce(Object.assign(new Error('Session changed'), { __CANCEL__: true, code: 'ERR_CANCELED' }));
    renderAuthProvider(); await waitFor(() => expect(screen.getByText('auth ready')).toBeInTheDocument());
    expect(dropStoredAccessToken).not.toHaveBeenCalled(); expect(clearWebPrivateSessionState).not.toHaveBeenCalled();
  });

  it('a receiving tab failure never deletes the healthy sender’s shared sign-in', async () => {
    persistBaseUser(); const { store } = renderAuthProvider();
    await waitFor(() => expect(screen.getByText('auth ready')).toBeInTheDocument()); queryClient.clear();
    const snapshot = JSON.stringify({ ...baseUser, id: 'healthy-other-tab' });
    localStorage.setItem(env.userStorageKey, snapshot);
    apiGet.mockRejectedValueOnce(new AxiosError('Offline', 'ERR_NETWORK'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: env.userStorageKey, newValue: snapshot, storageArea: localStorage })));
    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    expect(store.getState().user.profile).toBeNull();
    expect(localStorage.getItem(env.userStorageKey)).toBe(snapshot);
    consoleError.mockRestore();
  });

  it('a cookie identity mismatch expires this tab without deleting the other tab’s shared snapshot', async () => {
    persistBaseUser(); const { store } = renderAuthProvider();
    await waitFor(() => expect(screen.getByText('auth ready')).toBeInTheDocument());
    const snapshot = JSON.stringify({ ...baseUser, id: 'healthy-other-tab' }); localStorage.setItem(env.userStorageKey, snapshot);
    act(() => window.dispatchEvent(new CustomEvent('auth:expired', { detail: { preserveSharedAuthStorage: true } })));
    expect(store.getState().user.profile).toBeNull(); expect(localStorage.getItem(env.userStorageKey)).toBe(snapshot);
    expect(clearWebPrivateSessionState).toHaveBeenCalledWith(expect.objectContaining({ preserveSharedAuthStorage: true }));
  });
});
