import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  dispatchMock,
  getLoginOptions,
  requestEmailLoginCode,
  confirmEmailLoginCode,
  setupPassword,
  googleAuth,
  requestGoogleIdToken,
  persistAccessToken,
  dropStoredAccessToken,
  toastError,
  toastSuccess,
} = vi.hoisted(() => ({
  dispatchMock: vi.fn(),
  getLoginOptions: vi.fn(),
  requestEmailLoginCode: vi.fn(),
  confirmEmailLoginCode: vi.fn(),
  setupPassword: vi.fn(),
  googleAuth: vi.fn(),
  requestGoogleIdToken: vi.fn(),
  persistAccessToken: vi.fn(),
  dropStoredAccessToken: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('react-redux', () => ({
  useDispatch: () => dispatchMock,
}));

vi.mock('sonner', () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}));

vi.mock('@/api/httpClient', () => ({
  apiClient: {
    post: vi.fn(),
  },
  persistAccessToken,
  dropStoredAccessToken,
}));

vi.mock('@/api/AuthApi', () => ({
  AuthApi: {
    getLoginOptions,
    requestEmailLoginCode,
    confirmEmailLoginCode,
    setupPassword,
    googleAuth,
    completeAdminFirstLoginReset: vi.fn(),
  },
}));

vi.mock('@/auth/googleIdentity', () => ({
  requestGoogleIdToken,
}));

vi.mock('@/config/env', () => ({
  env: {
    google: {
      clientId: 'google-web-client-id.apps.googleusercontent.com',
      configured: true,
    },
  },
}));

vi.mock('@/components/ui/Modal', () => ({
  default: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
}));

import LoginPage from '@/pages/Login';

const renderLogin = () =>
  render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>,
  );

const enterEmailAndContinue = async (
  methods: { password: boolean; google: boolean; passwordSetupAvailable: boolean },
) => {
  getLoginOptions.mockResolvedValueOnce({
    requestId: 'request-1',
    methods,
    message: 'Continue with an available sign-in method.',
  });

  const result = renderLogin();
  fireEvent.change(screen.getByPlaceholderText(/name@example\.com/i), {
    target: { value: 'ada@example.com' },
  });
  expect(getLoginOptions).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: /^continue$/i }));

  await waitFor(() => {
    expect(getLoginOptions).toHaveBeenCalledTimes(1);
  });

  return result;
};

describe('LoginPage Google progressive auth', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('starts with email first and does not render the password field initially', () => {
    const { container } = renderLogin();

    expect(screen.getByPlaceholderText(/name@example\.com/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^continue$/i })).toBeInTheDocument();
    expect(container.querySelector('input[type="password"]')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/new password/i)).not.toBeInTheDocument();
  });

  it('calls login-options only after Continue and renders password login for password accounts', async () => {
    const { container } = await enterEmailAndContinue({
      password: true,
      google: false,
      passwordSetupAvailable: false,
    });

    expect(screen.getByText(/^password$/i)).toBeInTheDocument();
    expect(container.querySelector('input[type="password"]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders Google and password setup choices for Google-only accounts', async () => {
    await enterEmailAndContinue({
      password: false,
      google: true,
      passwordSetupAvailable: true,
    });

    expect(screen.getByText(/set up for Google sign-in/i)).toBeInTheDocument();
    expect(screen.queryByText(/^password$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create a password with email code/i })).toBeInTheDocument();
  });

  it('requests a code, confirms it, and sets a password without logging in automatically', async () => {
    await enterEmailAndContinue({
      password: false,
      google: true,
      passwordSetupAvailable: true,
    });
    requestEmailLoginCode.mockResolvedValueOnce({ message: 'Sent' });
    confirmEmailLoginCode.mockResolvedValueOnce({
      passwordSetupToken: 'setup-token',
      expiresInSeconds: 900,
    });
    setupPassword.mockResolvedValueOnce({ message: 'Password set' });

    fireEvent.click(screen.getByRole('button', { name: /create a password with email code/i }));
    await waitFor(() => {
      expect(requestEmailLoginCode).toHaveBeenCalledWith({
        email: 'ada@example.com',
        purpose: 'PASSWORD_SETUP',
        requestId: 'request-1',
      });
    });

    fireEvent.change(screen.getByPlaceholderText(/verification code/i), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /verify code/i }));

    await waitFor(() => {
      expect(confirmEmailLoginCode).toHaveBeenCalledWith({
        email: 'ada@example.com',
        code: '123456',
        purpose: 'PASSWORD_SETUP',
      });
    });

    fireEvent.change(screen.getByPlaceholderText(/^new password$/i), {
      target: { value: 'very-long-password-12345' },
    });
    fireEvent.change(screen.getByPlaceholderText(/confirm password/i), {
      target: { value: 'very-long-password-12345' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create password/i }));

    await waitFor(() => {
      expect(setupPassword).toHaveBeenCalledWith({
        passwordSetupToken: 'setup-token',
        newPassword: 'very-long-password-12345',
      });
    });

    expect(await screen.findByText(/password created/i)).toBeInTheDocument();
    expect(persistAccessToken).not.toHaveBeenCalled();
    expect(dispatchMock).not.toHaveBeenCalled();
  });

  it('sends only the Google ID token to the backend for Google login', async () => {
    requestGoogleIdToken.mockResolvedValueOnce('google-id-token');
    googleAuth.mockResolvedValueOnce({
      accessToken: 'access-token',
      user: {
        id: 'user-1',
        email: 'ada@example.com',
        role: 'User',
        type: 'REGULAR',
      },
      message: 'Welcome Back',
    });

    renderLogin();
    fireEvent.click(screen.getByTestId('login-google-button'));

    await waitFor(() => {
      expect(googleAuth).toHaveBeenCalledWith({ idToken: 'google-id-token' });
    });
    expect(requestGoogleIdToken).toHaveBeenCalledWith({
      clientId: 'google-web-client-id.apps.googleusercontent.com',
      context: 'signin',
      loginHint: undefined,
    });
  });
});
