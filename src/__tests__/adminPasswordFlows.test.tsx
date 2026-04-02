import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { navigate, logout, requestAdminPasswordReset, confirmAdminPasswordReset, changePassword } =
  vi.hoisted(() => ({
    navigate: vi.fn(),
    logout: vi.fn(),
    requestAdminPasswordReset: vi.fn(),
    confirmAdminPasswordReset: vi.fn(),
    changePassword: vi.fn(),
  }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock('@/api/AuthApi', () => ({
  AuthApi: {
    requestAdminPasswordReset,
    confirmAdminPasswordReset,
    changePassword,
  },
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ logout }),
}));

import AdminForceResetPasswordPage from '@/pages/admin/AdminForceResetPasswordPage';
import AdminResetPasswordPage from '@/pages/admin/AdminResetPasswordPage';

describe('admin password flows', () => {
  beforeEach(() => {
    navigate.mockReset();
    logout.mockReset();
    requestAdminPasswordReset.mockReset();
    confirmAdminPasswordReset.mockReset();
    changePassword.mockReset();

    requestAdminPasswordReset.mockResolvedValue({
      message: 'If the account exists, a reset link has been generated.',
    });
    confirmAdminPasswordReset.mockResolvedValue({
      message: 'Password reset successful',
    });
    changePassword.mockResolvedValue({
      message: 'Password updated',
    });
  });

  it('shows a check-your-email state after admin reset request and allows manual token entry', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/admin/reset-password']}>
        <AdminResetPasswordPage />
      </MemoryRouter>,
    );

    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement | null;
    expect(emailInput).not.toBeNull();

    fireEvent.change(emailInput as HTMLInputElement, {
      target: { value: 'admin@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /request reset link/i }));

    expect(await screen.findByText(/check your inbox/i)).toBeTruthy();
    expect(requestAdminPasswordReset).toHaveBeenCalledWith('admin@example.com');

    fireEvent.click(screen.getByRole('button', { name: /enter reset token manually/i }));
    expect(container.querySelector('input[type="text"]')).toBeTruthy();
    expect(container.querySelectorAll('input[type="password"]').length).toBe(2);
  });

  it('logs the user out and redirects to sign in after a forced admin password change', async () => {
    const { container } = render(<AdminForceResetPasswordPage />);

    const inputs = container.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThanOrEqual(3);

    fireEvent.change(inputs[0], { target: { value: 'current-password' } });
    fireEvent.change(inputs[1], { target: { value: 'very-long-password-12345' } });
    fireEvent.change(inputs[2], { target: { value: 'very-long-password-12345' } });
    fireEvent.click(screen.getByRole('button', { name: /update password/i }));

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: 'current-password',
        newPassword: 'very-long-password-12345',
      });
      expect(logout).toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith('/login', { replace: true });
    });
  });
});