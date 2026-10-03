/**
 * Reporting that a bespoke order is late, and ending that report.
 *
 * Shoppers could not do this at all. The only dispute control on the order
 * screen was gated to `DELIVERED_PENDING_BUYER_CONFIRMATION` — a complaint about
 * a garment you have — and the API's evidence validator demanded a photograph,
 * which an order that has not arrived cannot supply. An order could be a
 * fortnight overdue with nothing to press.
 *
 * Two states live here. Before the promise is missed, or during the grace, the
 * offer is to MESSAGE the maker: a dispute raised the hour a date slips is one
 * both sides regret, and makers running an afternoon late usually say so. Once
 * it is genuinely late, the escalation appears — and says, before the button,
 * that it does not cancel the order, because that is the assumption that would
 * otherwise turn it into a cancel button.
 *
 * While one is open the panel inverts: it reports that WIEZ is looking at it and
 * offers the shopper the way out they most often want — the piece turned up, take
 * it late, close this.
 */
import React, { useCallback, useId, useState } from 'react';
import type {
  CustomOrderDelayEligibility,
  CustomOrderDispute,
} from '@/api/CustomOrderApi';

const formatDateTime = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
};

/** Why the escalation is not offered, in the shopper's terms. */
const unavailableCopy = (
  eligibility: CustomOrderDelayEligibility,
): string | null => {
  switch (eligibility.reason) {
    case 'WITHIN_GRACE': {
      const at = formatDateTime(eligibility.availableAt);
      return at
        ? `Your maker is past the production date. Give them a little room — if nothing has moved by ${at}, you can escalate this to WIEZ.`
        : 'Your maker is just past the production date. Message them first — you can escalate shortly if nothing moves.';
    }
    case 'NOT_LATE_YET':
      return null;
    case 'NO_PROMISE_RECORDED':
      return null;
    case 'NOT_A_LIVE_ORDER':
      return null;
    case 'ALREADY_DISPUTED':
      return null;
    default:
      return null;
  }
};

export const DelayDisputePanel: React.FC<{
  eligibility?: CustomOrderDelayEligibility;
  /** The open delay dispute, when there is one. */
  openDispute?: CustomOrderDispute | null;
  /** True while WIEZ is formally steering the order. */
  interventionOpen?: boolean;
  busy?: boolean;
  onReport: (description: string) => Promise<void>;
  onClose: (disputeId: string, note: string) => Promise<void>;
  onMessageMaker?: () => void;
}> = ({
  eligibility,
  openDispute,
  interventionOpen = false,
  busy = false,
  onReport,
  onClose,
  onMessageMaker,
}) => {
  const [reporting, setReporting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [description, setDescription] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const descriptionId = useId();
  const closeNoteId = useId();

  const submitReport = useCallback(async () => {
    if (description.trim().length < 10) return;
    await onReport(description.trim());
    setReporting(false);
    setDescription('');
  }, [description, onReport]);

  const submitClose = useCallback(async () => {
    if (!openDispute) return;
    await onClose(openDispute.id, closeNote.trim());
    setClosing(false);
    setCloseNote('');
  }, [closeNote, onClose, openDispute]);

  // An open dispute outranks everything: it IS the state of the order.
  if (openDispute) {
    return (
      <section className="rounded-[28px] border border-amber-300/70 bg-amber-50/80 p-5 dark:border-amber-500/30 dark:bg-amber-500/10 sm:p-6">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="text-2xl leading-none">
            🛟
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-amber-950 dark:text-amber-50 sm:text-lg">
              {interventionOpen
                ? 'WIEZ is looking into this delay'
                : 'Your delay report is open'}
            </h3>
            <p className="mt-1 text-[13px] text-amber-900/85 dark:text-amber-100/85">
              Your order is still live and your maker has been told to keep
              working. We will be in touch here. Raised{' '}
              {formatDateTime(openDispute.openedAt) ?? 'recently'}.
            </p>
          </div>
        </div>

        {closing ? (
          <div className="mt-4 rounded-2xl bg-white/70 p-4 dark:bg-white/[0.06]">
            <label
              htmlFor={closeNoteId}
              className="block text-[12px] font-semibold text-amber-950 dark:text-amber-50"
            >
              Anything to add? (optional)
            </label>
            <textarea
              id={closeNoteId}
              value={closeNote}
              onChange={(event) => setCloseNote(event.target.value)}
              rows={2}
              maxLength={500}
              placeholder="e.g. it arrived and the fit is perfect"
              className="mt-1.5 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
            />
            <div className="mt-3 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setClosing(false)}
                className="rounded-full border border-black/10 px-4 py-2 text-[13px] font-semibold text-amber-950 transition hover:bg-black/[0.04] dark:border-white/10 dark:text-amber-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitClose()}
                className="rounded-full bg-amber-900 px-5 py-2 text-[13px] font-semibold text-white transition hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 disabled:opacity-60 dark:bg-amber-100 dark:text-amber-950"
              >
                {busy ? 'Closing…' : 'Close the report'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-3">
            {/*
              The way out most shoppers want. Letting them end it themselves is
              the difference between a dispute that resolves and one that sits
              open because nobody with the authority to close it has looked.
            */}
            <button
              type="button"
              disabled={busy}
              onClick={() => setClosing(true)}
              className="rounded-full bg-amber-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 disabled:opacity-60 dark:bg-amber-100 dark:text-amber-950"
            >
              It arrived — close this
            </button>
            {onMessageMaker ? (
              <button
                type="button"
                onClick={onMessageMaker}
                className="rounded-full border border-amber-300 bg-white/80 px-5 py-2.5 text-sm font-semibold text-amber-900 transition hover:bg-white dark:border-white/20 dark:bg-white/10 dark:text-amber-50"
              >
                Message your maker
              </button>
            ) : null}
          </div>
        )}
      </section>
    );
  }

  if (!eligibility) return null;

  if (!eligibility.eligible) {
    const copy = unavailableCopy(eligibility);
    if (!copy) return null;
    // The grace period, said as guidance rather than as a disabled control.
    return (
      <section className="rounded-[28px] border border-gray-200/80 bg-white/70 p-5 dark:border-gray-800/80 dark:bg-white/[0.03]">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
          ⏳ Running a little late
        </h3>
        <p className="mt-1 text-[13px] text-gray-600 dark:text-gray-300">{copy}</p>
        {onMessageMaker ? (
          <button
            type="button"
            onClick={onMessageMaker}
            className="mt-3 rounded-full border border-black/10 px-4 py-2 text-[13px] font-semibold text-gray-800 transition hover:bg-black/[0.04] dark:border-white/10 dark:text-gray-100"
          >
            Message your maker
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-[28px] border border-rose-300/70 bg-rose-50/80 p-5 dark:border-rose-500/30 dark:bg-rose-500/10 sm:p-6">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-2xl leading-none">
          🚩
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-rose-950 dark:text-rose-50 sm:text-lg">
            {eligibility.basis === 'DELIVERY'
              ? 'This order has missed its delivery date'
              : 'This order has missed its production date'}
          </h3>
          <p className="mt-1 text-[13px] text-rose-900/85 dark:text-rose-100/85">
            If your maker has not explained the delay, you can bring WIEZ in.
          </p>
        </div>
      </div>

      {/*
        Said before the button. Shoppers read "report a problem" as "cancel and
        refund me", and one who believes that will press it to get their money
        back rather than to get their garment.
      */}
      <p className="mt-3 text-[12px] leading-snug text-rose-900/85 dark:text-rose-100/85">
        Reporting this does <strong>not</strong> cancel your order or refund it,
        and your maker keeps working. It freezes their payment and puts a person
        at WIEZ on it, who will talk to you both.
      </p>

      {reporting ? (
        <div className="mt-4 rounded-2xl bg-white/70 p-4 dark:bg-white/[0.06]">
          <label
            htmlFor={descriptionId}
            className="block text-[12px] font-semibold text-rose-950 dark:text-rose-50"
          >
            What has happened? (required)
          </label>
          <textarea
            id={descriptionId}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="e.g. the date passed four days ago and I have had no update"
            className="mt-1.5 w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-white/10 dark:bg-slate-900 dark:text-white"
          />
          <p className="mt-1 text-[11px] text-rose-900/70 dark:text-rose-100/70">
            No photos needed — nothing has arrived to photograph.
          </p>
          <div className="mt-3 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => setReporting(false)}
              className="rounded-full border border-black/10 px-4 py-2 text-[13px] font-semibold text-rose-950 transition hover:bg-black/[0.04] dark:border-white/10 dark:text-rose-50"
            >
              Back
            </button>
            <button
              type="button"
              disabled={busy || description.trim().length < 10}
              onClick={() => void submitReport()}
              className="rounded-full bg-rose-600 px-5 py-2 text-[13px] font-semibold text-white transition hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {busy ? 'Reporting…' : 'Report the delay'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => setReporting(true)}
            className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            Report the delay to WIEZ
          </button>
          {onMessageMaker ? (
            <button
              type="button"
              onClick={onMessageMaker}
              className="rounded-full border border-rose-300 bg-white/80 px-5 py-2.5 text-sm font-semibold text-rose-900 transition hover:bg-white dark:border-white/20 dark:bg-white/10 dark:text-rose-50"
            >
              Message your maker first
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
};

export default DelayDisputePanel;
