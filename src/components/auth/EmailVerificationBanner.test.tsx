import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EmailVerificationBanner } from './EmailVerificationBanner';

describe('EmailVerificationBanner', () => {
  it('renders email verification status with resend and status actions', () => {
    const onResend = vi.fn();
    const onCheckStatus = vi.fn();

    render(
      <EmailVerificationBanner
        title="Verify your email"
        description="Open the verification link, then come back."
        onResend={onResend}
        onCheckStatus={onCheckStatus}
      />,
    );

    expect(screen.getByLabelText('Email verification required')).toBeTruthy();
    expect(screen.getByText('Verify your email')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Resend email' }));
    fireEvent.click(screen.getByRole('button', { name: 'Check status' }));

    expect(onResend).toHaveBeenCalledTimes(1);
    expect(onCheckStatus).toHaveBeenCalledTimes(1);
  });

  it('disables actions while resend or status check is running', () => {
    render(
      <EmailVerificationBanner
        title="Verify your email"
        description="Open the verification link, then come back."
        isResending
        isChecking
        onResend={vi.fn()}
        onCheckStatus={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Sending...' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('button', { name: 'Checking...' })).toHaveProperty(
      'disabled',
      true,
    );
  });
});
