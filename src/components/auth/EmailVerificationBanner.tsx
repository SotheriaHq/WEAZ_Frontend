import React from 'react';

type EmailVerificationBannerProps = {
  title: string;
  description: React.ReactNode;
  resendLabel?: string;
  statusLabel?: string;
  isResending?: boolean;
  isChecking?: boolean;
  onResend: () => void;
  onCheckStatus: () => void;
};

export const EmailVerificationBanner: React.FC<EmailVerificationBannerProps> = ({
  title,
  description,
  resendLabel = 'Resend email',
  statusLabel = 'Check status',
  isResending = false,
  isChecking = false,
  onResend,
  onCheckStatus,
}) => (
  <section
    aria-label="Email verification required"
    className="rounded-2xl border border-amber-300/50 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm dark:border-amber-300/25 dark:bg-amber-400/10 dark:text-amber-50"
  >
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-1 text-sm leading-5 text-amber-900/85 dark:text-amber-100/85">
          {description}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onResend}
          disabled={isResending}
          className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isResending ? 'Sending...' : resendLabel}
        </button>
        <button
          type="button"
          onClick={onCheckStatus}
          disabled={isChecking}
          className="rounded-full border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-300/30 dark:bg-transparent dark:text-amber-100 dark:hover:bg-amber-400/10"
        >
          {isChecking ? 'Checking...' : statusLabel}
        </button>
      </div>
    </div>
  </section>
);

export default EmailVerificationBanner;
