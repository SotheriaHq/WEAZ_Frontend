import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EmailVerificationBanner } from './EmailVerificationBanner';

describe('EmailVerificationBanner', () => {
  it('renders the prompt with a resend action', () => {
    const onResend = vi.fn();

    render(
      <EmailVerificationBanner
        title="Verify your email"
        description="Open the verification link, then come back."
        onResend={onResend}
      />,
    );

    expect(screen.getByLabelText('Email verification required')).toBeTruthy();
    expect(screen.getByText('Verify your email')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Resend email' }));
    expect(onResend).toHaveBeenCalledTimes(1);
  });

  /**
   * Verification completes outside this tab, so the banner's owner polls and
   * re-checks on focus. Offering a "check status" button asks the user to tell
   * the app to notice something it can already see — and it was the only way
   * out of a stale `isEmailVerified: false`, which is the bug that removed it.
   */
  it('offers no manual status check — detection is automatic', () => {
    render(
      <EmailVerificationBanner
        title="Verify your email"
        description="Open the verification link, then come back."
        onResend={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /check status/i })).toBeNull();
    expect(screen.getByText(/clears itself once you confirm/i)).toBeTruthy();
  });

  it('shows a passive checking hint and disables resend while it runs', () => {
    render(
      <EmailVerificationBanner
        title="Verify your email"
        description="Open the verification link, then come back."
        isResending
        isChecking
        onResend={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Sending...' })).toHaveProperty(
      'disabled',
      true,
    );
    // A hint, not a control.
    expect(screen.getByText('Checking…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Checking…' })).toBeNull();
  });
});
