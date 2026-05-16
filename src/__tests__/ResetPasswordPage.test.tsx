import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { confirmPasswordReset } = vi.hoisted(() => ({
  confirmPasswordReset: vi.fn(),
}));

vi.mock('@/api/AuthApi', () => ({
  AuthApi: {
    confirmPasswordReset,
  },
}));

import ResetPasswordPage from '@/pages/ResetPasswordPage';

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    confirmPasswordReset.mockResolvedValue({ message: 'Password reset successful' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a missing-token state when the reset link has no token', () => {
    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <ResetPasswordPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/invalid reset link/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /request new link/i })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('submits the trimmed query token and removes it from browser history after success', async () => {
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    const { container } = render(
      <MemoryRouter initialEntries={['/reset-password?token=%20reset-token%20']}>
        <ResetPasswordPage />
      </MemoryRouter>,
    );

    const passwordInputs = container.querySelectorAll('input[type="password"]');
    expect(passwordInputs.length).toBe(2);

    fireEvent.change(passwordInputs[0], {
      target: { value: 'very-long-password-12345' },
    });
    fireEvent.change(passwordInputs[1], {
      target: { value: 'very-long-password-12345' },
    });
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

    await waitFor(() => {
      expect(confirmPasswordReset).toHaveBeenCalledWith({
        token: 'reset-token',
        newPassword: 'very-long-password-12345',
      });
    });

    expect(await screen.findByText(/password reset successfully/i)).toBeInTheDocument();
    expect(replaceStateSpy).toHaveBeenCalledWith({}, document.title, '/reset-password');
  });
});
