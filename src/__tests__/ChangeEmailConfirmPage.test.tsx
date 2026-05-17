import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { confirmEmailChange } = vi.hoisted(() => ({
  confirmEmailChange: vi.fn(),
}));

vi.mock('@/api/AuthApi', () => ({
  AuthApi: {
    confirmEmailChange,
  },
}));

import ChangeEmailConfirmPage from '@/pages/ChangeEmailConfirmPage';

describe('ChangeEmailConfirmPage', () => {
  beforeEach(() => {
    confirmEmailChange.mockResolvedValue({ message: 'Email updated successfully' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a missing-token state when the confirmation link has no token', () => {
    render(
      <MemoryRouter initialEntries={['/change-email/confirm']}>
        <ChangeEmailConfirmPage />
      </MemoryRouter>,
    );

    expect(screen.getByText(/email change unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/missing a token/i)).toBeInTheDocument();
    expect(confirmEmailChange).not.toHaveBeenCalled();
  });

  it('submits the trimmed token and removes it from browser history', async () => {
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');

    render(
      <MemoryRouter initialEntries={['/change-email/confirm?token=%20email-token%20']}>
        <ChangeEmailConfirmPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(confirmEmailChange).toHaveBeenCalledWith('email-token');
    });

    expect(await screen.findByText(/email updated successfully/i)).toBeInTheDocument();
    expect(replaceStateSpy).toHaveBeenCalledWith({}, document.title, '/change-email/confirm');
  });
});
