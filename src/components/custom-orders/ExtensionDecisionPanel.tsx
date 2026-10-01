/**
 * The shopper's decision on a request for more time.
 *
 * This used to be a `<select>` and a "Send response" button at the bottom of a
 * "Support and actions" card, below the delivery-confirmation form — which is why
 * a shopper who tapped the notification landed on the order and reported that
 * there was nothing to interact with. There was; it was just the last thing on
 * the page and looked like a setting.
 *
 * So the open request is a banner at the TOP of the order, it says what declining
 * actually does before anyone presses it, and the decision itself happens in a
 * dialog where the only two things on screen are the two answers. Resolved
 * requests collapse into a history list, because after the fact the only
 * interesting part is what was asked, what was granted, and what either side said.
 */
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type {
  CustomOrderExtensionRequest,
  CustomOrderExtensionResponseStatus,
} from '@/api/CustomOrderApi';
import { humanizeCustomOrderToken } from './customOrderFormatting';

type Decision = Extract<CustomOrderExtensionResponseStatus, 'ACCEPTED' | 'REJECTED'>;

const formatDateTime = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
};

/** "in 9 hours" / "2 hours ago", for a deadline a shopper has to feel. */
const formatCountdown = (value?: string | null): string | null => {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  const diffMs = target.getTime() - Date.now();
  const hours = Math.round(Math.abs(diffMs) / (60 * 60 * 1000));
  if (diffMs <= 0) return 'This request has expired';
  if (hours < 1) return 'Less than an hour left to answer';
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'} left to answer`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} left to answer`;
};

const targetLabel = (targetType: string) => {
  if (targetType === 'DELIVERY') return 'delivery';
  if (targetType === 'BOTH') return 'production and delivery';
  return 'production';
};

const statusTone = (status: string) => {
  switch (status) {
    case 'ACCEPTED':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200';
    case 'REJECTED':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200';
    case 'COUNTERED':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200';
    case 'EXPIRED':
    case 'VOIDED':
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
    default:
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200';
  }
};

/** What each resolved state means, in the shopper's terms rather than the enum's. */
const statusExplanation = (request: CustomOrderExtensionRequest): string => {
  const days = request.appliedExtraDays ?? request.requestedExtraDays;
  switch (request.buyerResponseStatus) {
    case 'ACCEPTED':
      return `You granted ${days} extra day${days === 1 ? '' : 's'}.`;
    case 'REJECTED':
      return 'You declined. WIEZ reviewed the order with the maker.';
    case 'COUNTERED':
      return request.buyerCounterDays
        ? `You offered ${request.buyerCounterDays} day${request.buyerCounterDays === 1 ? '' : 's'} instead.`
        : 'You offered a different number of days.';
    case 'EXPIRED':
      return 'This expired without an answer. No extra time was granted.';
    case 'VOIDED':
      return 'No longer needed — the work had already moved on.';
    default:
      return 'Waiting for your answer.';
  }
};

export const ExtensionHistoryList: React.FC<{
  requests: CustomOrderExtensionRequest[];
}> = ({ requests }) => {
  if (requests.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        No extra time has been requested on this order.
      </div>
    );
  }

  return (
    <ol className="space-y-2">
      {requests.map((request) => (
        <li
          key={request.id}
          className="rounded-2xl border border-gray-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.03]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              {request.sequence ? `Request ${request.sequence}: ` : ''}
              {request.requestedExtraDays} day
              {request.requestedExtraDays === 1 ? '' : 's'} on {targetLabel(request.targetType)}
            </div>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone(request.buyerResponseStatus)}`}
            >
              {humanizeCustomOrderToken(request.buyerResponseStatus)}
            </span>
          </div>
          <p className="mt-1.5 text-[13px] text-gray-600 dark:text-gray-300">
            {statusExplanation(request)}
          </p>
          <dl className="mt-2 space-y-1 text-[12px] text-gray-500 dark:text-gray-400">
            <div className="flex gap-1.5">
              <dt className="font-semibold">Maker's reason:</dt>
              <dd className="min-w-0 break-words">{request.reason}</dd>
            </div>
            {request.buyerNote ? (
              <div className="flex gap-1.5">
                <dt className="font-semibold">Your note:</dt>
                <dd className="min-w-0 break-words">{request.buyerNote}</dd>
              </div>
            ) : null}
            {request.brandNote ? (
              <div className="flex gap-1.5">
                <dt className="font-semibold">Maker's reply:</dt>
                <dd className="min-w-0 break-words">{request.brandNote}</dd>
              </div>
            ) : null}
            {formatDateTime(request.resolvedAt ?? request.createdAt) ? (
              <div className="flex gap-1.5">
                <dt className="font-semibold">
                  {request.resolvedAt ? 'Settled:' : 'Asked:'}
                </dt>
                <dd>{formatDateTime(request.resolvedAt ?? request.createdAt)}</dd>
              </div>
            ) : null}
          </dl>
        </li>
      ))}
    </ol>
  );
};

export const ExtensionDecisionPanel: React.FC<{
  request: CustomOrderExtensionRequest;
  brandName: string;
  busy?: boolean;
  /** Resolves once the response has been recorded. */
  onRespond: (decision: Decision, note: string) => Promise<void>;
  /** True when the notification brought the shopper straight here. */
  autoOpen?: boolean;
}> = ({ request, brandName, busy = false, onRespond, autoOpen = false }) => {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState('');
  const dialogTitleId = useId();
  const noteId = useId();
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const countdown = useMemo(
    () => formatCountdown(request.respondByAt),
    [request.respondByAt],
  );

  // A notification deep-link should land the shopper looking AT the decision.
  useEffect(() => {
    if (!autoOpen) return;
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [autoOpen]);

  // Focus the confirm button when the dialog opens, and close on Escape.
  useEffect(() => {
    if (!decision) return;
    confirmRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDecision(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [decision]);

  const submit = useCallback(async () => {
    if (!decision) return;
    await onRespond(decision, note.trim());
    setDecision(null);
    setNote('');
  }, [decision, note, onRespond]);

  return (
    <div
      ref={panelRef}
      className="rounded-[28px] border border-indigo-300/70 bg-indigo-50/80 p-5 shadow-sm dark:border-indigo-500/30 dark:bg-indigo-500/10 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-2xl leading-none">
          ⏳
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-indigo-950 dark:text-indigo-50 sm:text-lg">
            {brandName} needs {request.requestedExtraDays} more day
            {request.requestedExtraDays === 1 ? '' : 's'}
          </h3>
          <p className="mt-1 text-[13px] text-indigo-900/80 dark:text-indigo-100/80">
            They have asked to extend {targetLabel(request.targetType)} on this
            order. It is your call.
          </p>
          {countdown ? (
            <p className="mt-2 inline-flex rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-bold text-indigo-900 dark:bg-white/10 dark:text-indigo-100">
              {countdown}
            </p>
          ) : null}
        </div>
      </div>

      <figure className="mt-4 rounded-2xl bg-white/70 p-4 dark:bg-white/[0.06]">
        <figcaption className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-900/70 dark:text-indigo-100/70">
          Why they are asking
        </figcaption>
        <blockquote className="mt-1.5 break-words text-[13px] text-indigo-950 dark:text-indigo-50">
          {request.reason}
        </blockquote>
      </figure>

      {/*
        Said before the buttons, not after. The single most common misreading of
        "Decline" is that it cancels the order and refunds the money, and a
        shopper who believes that will use it as a cancel button.
      */}
      <p className="mt-3 text-[12px] leading-snug text-indigo-900/80 dark:text-indigo-100/80">
        Accepting moves the delivery date by{' '}
        {request.requestedExtraDays} day
        {request.requestedExtraDays === 1 ? '' : 's'}. Declining does not cancel
        your order or refund it — it brings WIEZ in to resolve the delay with the
        maker. Either way you can add a note.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => setDecision('ACCEPTED')}
          className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          Grant {request.requestedExtraDays} day
          {request.requestedExtraDays === 1 ? '' : 's'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setDecision('REJECTED')}
          className="rounded-full border border-indigo-300 bg-white/80 px-5 py-2.5 text-sm font-semibold text-indigo-900 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-60 dark:border-white/20 dark:bg-white/10 dark:text-indigo-50"
        >
          Decline
        </button>
      </div>

      {decision ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setDecision(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            className="w-full max-w-md rounded-[28px] border border-black/10 bg-white p-5 shadow-xl dark:border-white/10 dark:bg-slate-950 sm:p-6"
          >
            <h4
              id={dialogTitleId}
              className="text-lg font-bold text-gray-900 dark:text-white"
            >
              {decision === 'ACCEPTED'
                ? `Grant ${request.requestedExtraDays} extra day${request.requestedExtraDays === 1 ? '' : 's'}?`
                : 'Decline the extra time?'}
            </h4>
            <p className="mt-1.5 text-[13px] text-gray-600 dark:text-gray-300">
              {decision === 'ACCEPTED'
                ? 'Your delivery date moves and the maker carries on.'
                : 'Your order stays live. WIEZ steps in to sort the delay out with the maker, and will be in touch.'}
            </p>

            <label
              htmlFor={noteId}
              className="mt-4 block text-[12px] font-semibold text-gray-700 dark:text-gray-200"
            >
              Add a note (optional)
            </label>
            <textarea
              id={noteId}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder={
                decision === 'ACCEPTED'
                  ? 'Anything you want the maker to know'
                  : 'Anything WIEZ should know about the delay'
              }
              className="mt-1.5 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            />

            <div className="mt-4 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setDecision(null)}
                className="rounded-full border border-black/10 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/[0.06]"
              >
                Back
              </button>
              <button
                ref={confirmRef}
                type="button"
                disabled={busy}
                onClick={() => void submit()}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 ${
                  decision === 'ACCEPTED'
                    ? 'bg-indigo-600 hover:bg-indigo-500 focus-visible:ring-indigo-500'
                    : 'bg-rose-600 hover:bg-rose-500 focus-visible:ring-rose-500'
                }`}
              >
                {busy
                  ? 'Sending…'
                  : decision === 'ACCEPTED'
                    ? 'Grant the time'
                    : 'Decline'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ExtensionDecisionPanel;
