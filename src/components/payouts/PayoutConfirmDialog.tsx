import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { brandApi, type PayoutChallenge } from '@/api/BrandApi';

/**
 * The second factor on a payout, asked for at the moment it matters.
 *
 * A payout moves money off the platform, and until now a session alone could
 * do it — one left-open laptop, one stolen token, one staff account nobody
 * revoked. The server now validates the request, emails a six-digit code, and
 * creates nothing until that code comes back.
 *
 * The dialog's job is to make the waiting legible. Three things change under
 * the person while they use it — the code expires, attempts run down, and the
 * resend unlocks — and a confirmation screen that hides any of them turns a
 * slow email into "it's broken". So all three are on screen, counting.
 *
 * The amount is shown and is NOT editable. It is fixed to the code server-side;
 * showing it here is what lets someone notice they are confirming the wrong
 * figure before they spend the code, not after.
 */

const formatClock = (totalSeconds: number) => {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const formatAmount = (amount: number) =>
  `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CODE_LENGTH = 6;

export type PayoutConfirmDialogProps = {
  open: boolean;
  brandId: string;
  challenge: PayoutChallenge | null;
  onCancel: () => void;
  onConfirmed: () => void;
  /** Re-issues a code. Resolves with the new challenge, or null if it failed. */
  onResend: () => Promise<PayoutChallenge | null>;
};

const PayoutConfirmDialog: React.FC<PayoutConfirmDialogProps> = ({
  open,
  brandId,
  challenge,
  onCancel,
  onConfirmed,
  onResend,
}) => {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [resendIn, setResendIn] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  /* A new challenge resets everything: a fresh code, a fresh clock, no stale error. */
  useEffect(() => {
    if (!challenge) return;
    setCode('');
    setError(null);
    setSecondsLeft(challenge.expiresInSeconds);
    setResendIn(challenge.resendAfterSeconds);
  }, [challenge]);

  useEffect(() => {
    if (!open) return;
    // Autofocus after the entrance animation, or the caret lands mid-flight.
    const timer = window.setTimeout(() => inputRef.current?.focus(), 180);
    return () => window.clearTimeout(timer);
  }, [open]);

  /* One ticker drives both counters — two intervals would drift apart on screen. */
  useEffect(() => {
    if (!open) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((current) => (current > 0 ? current - 1 : 0));
      setResendIn((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [open]);

  const expired = secondsLeft <= 0;
  const canSubmit = code.length === CODE_LENGTH && !submitting && !expired;

  const handleConfirm = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await brandApi.confirmPayoutRequest(brandId, code);
      toast.success('Payout requested. It is now awaiting approval.');
      onConfirmed();
    } catch (err: any) {
      const message =
        err?.response?.data?.message || 'That code could not be confirmed.';
      setError(message);
      // The code is spent or wrong either way; clear it so the next attempt
      // starts from an empty field rather than an edit of a failed one.
      setCode('');
      inputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }, [brandId, canSubmit, code, onConfirmed]);

  const handleResend = useCallback(async () => {
    if (resendIn > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      const next = await onResend();
      if (next) toast.success(`New code sent to ${next.emailHint}`);
    } finally {
      setResending(false);
    }
  }, [onResend, resendIn, resending]);

  const statusLine = useMemo(() => {
    if (expired) return 'This code has expired. Send a new one to continue.';
    return `Expires in ${formatClock(secondsLeft)}`;
  }, [expired, secondsLeft]);

  if (!open || !challenge) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onCancel}
        role="presentation"
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="payout-confirm-title"
          className="w-full max-w-md rounded-[28px] border border-white/60 bg-white p-6 shadow-[0_28px_70px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-slate-950"
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl" aria-hidden>
              🔐
            </span>
            <div className="min-w-0">
              <h2
                id="payout-confirm-title"
                className="text-lg font-semibold text-slate-900 dark:text-white"
              >
                Confirm this payout
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                We emailed a {CODE_LENGTH}-digit code to{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {challenge.emailHint}
                </span>
                .
              </p>
            </div>
          </div>

          {/* The figure being authorised, stated once and not editable. */}
          <div className="mt-5 rounded-2xl border border-fuchsia-200/70 bg-fuchsia-50/60 px-4 py-3 dark:border-fuchsia-400/25 dark:bg-fuchsia-500/10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-700 dark:text-fuchsia-300">
              Releasing
            </p>
            <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {formatAmount(challenge.amount)}
            </p>
          </div>

          <label
            htmlFor="payout-confirm-code"
            className="mt-5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400"
          >
            Confirmation code
          </label>
          <input
            id="payout-confirm-code"
            ref={inputRef}
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleConfirm();
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••••"
            aria-invalid={Boolean(error)}
            aria-describedby="payout-confirm-status"
            disabled={submitting}
            className={`mt-2 w-full rounded-2xl border bg-white/90 px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] text-slate-900 outline-none transition-colors focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200 disabled:opacity-60 dark:bg-white/[0.04] dark:text-white dark:focus:ring-fuchsia-500/30 ${
              error
                ? 'border-rose-400 dark:border-rose-500/50'
                : 'border-slate-200 dark:border-white/10'
            }`}
          />

          <div
            id="payout-confirm-status"
            className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs"
          >
            <span
              className={
                expired
                  ? 'font-semibold text-rose-600 dark:text-rose-300'
                  : 'text-slate-500 dark:text-slate-400'
              }
            >
              {statusLine}
            </span>
            <button
              type="button"
              onClick={() => void handleResend()}
              disabled={resendIn > 0 || resending}
              className="font-semibold text-fuchsia-600 transition-colors hover:text-fuchsia-700 disabled:cursor-not-allowed disabled:text-slate-400 dark:text-fuchsia-300 dark:disabled:text-slate-500"
            >
              {resending
                ? 'Sending...'
                : resendIn > 0
                  ? `Resend in ${resendIn}s`
                  : 'Send a new code'}
            </button>
          </div>

          <AnimatePresence>
            {error ? (
              <motion.p
                key={error}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                role="alert"
                className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
              >
                {error}
              </motion.p>
            ) : null}
          </AnimatePresence>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 disabled:opacity-60 dark:border-white/15 dark:text-slate-200 dark:hover:border-white/25 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={!canSubmit}
              className="rounded-full bg-fuchsia-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-fuchsia-500/25 transition-colors hover:bg-fuchsia-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none dark:focus-visible:ring-offset-slate-950 dark:disabled:bg-white/10 dark:disabled:text-slate-500"
            >
              {submitting ? 'Confirming...' : 'Release payout'}
            </button>
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
            Did not start this payout? Do not enter the code. Change your password
            and contact support — someone with access to your account began it.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PayoutConfirmDialog;
