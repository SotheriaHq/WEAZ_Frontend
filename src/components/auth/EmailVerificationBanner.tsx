import React from 'react';

type EmailVerificationBannerProps = {
  title: string;
  description: React.ReactNode;
  resendLabel?: string;
  isResending?: boolean;
  /** Drives the passive "checking" hint; there is no button to press. */
  isChecking?: boolean;
  onResend: () => void;
};

/**
 * "Check status" is gone.
 *
 * The banner's owner re-checks on focus, on tab visibility and on a slow poll,
 * so by the time a user could reach for a button the answer has already
 * arrived. Asking someone to tell the app to notice something it can see for
 * itself is work the app should be doing.
 */
export const EmailVerificationBanner: React.FC<EmailVerificationBannerProps> = ({
  title,
  description,
  resendLabel = 'Resend email',
  isResending = false,
  isChecking = false,
  onResend,
}) => (
  <aside
    aria-label="Email verification required"
    aria-live="polite"
    className="rounded-xl border border-amber-300/60 bg-amber-50 px-3.5 py-3 text-amber-950 shadow-lg shadow-amber-950/10 dark:border-amber-300/25 dark:bg-slate-950/95 dark:text-amber-50 dark:shadow-black/30"
  >
    <div className="space-y-3">
      <div className="min-w-0">
        <p className="text-sm font-bold leading-5">{title}</p>
        <p className="mt-1 text-xs leading-5 text-amber-900/85 dark:text-amber-100/85">
          {description}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onResend}
          disabled={isResending}
          className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isResending ? 'Sending...' : resendLabel}
        </button>
        <span className="text-[11px] font-medium text-amber-900/70 dark:text-amber-100/70">
          {isChecking ? 'Checking…' : 'This clears itself once you confirm.'}
        </span>
      </div>
    </div>
  </aside>
);

export default EmailVerificationBanner;
