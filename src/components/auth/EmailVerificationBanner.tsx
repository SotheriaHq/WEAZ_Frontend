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
        <button
          type="button"
          onClick={onCheckStatus}
          disabled={isChecking}
          className="rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-300/30 dark:bg-transparent dark:text-amber-100 dark:hover:bg-amber-400/10"
        >
          {isChecking ? 'Checking...' : statusLabel}
        </button>
      </div>
    </div>
  </aside>
);

export default EmailVerificationBanner;
