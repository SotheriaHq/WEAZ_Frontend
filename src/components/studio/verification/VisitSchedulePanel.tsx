import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
  physicalVerificationApi,
  type BrandVisitView,
} from '@/api/PhysicalVerificationApi';
import useCachedResource from '@/hooks/useCachedResource';
import {
  brandVisitHeadline,
  CHIP_BASE,
  FIELD_LABEL,
  formatSlot,
  INSET,
  PANEL,
  VISIT_STATUS_LABEL,
  VISIT_STATUS_TONE,
} from '@/components/verification/visitPresentation';

/**
 * The brand's side of the visit.
 *
 * The whole panel is built so that nothing it does can move the page. Its
 * outer box carries a `min-h` that matches its tallest resting state, the
 * action row keeps its height whether or not buttons are in it, and every
 * button holds its width while its own label changes ("Agree" → "Saving…").
 * A panel that grows by forty pixels the moment you press something makes the
 * next press land on whatever slid underneath the cursor.
 *
 * The reply is three choices and nothing else, matching the server: agree to
 * one of the offered times, ask for a different one OF THOSE, or decline —
 * which ends the whole attempt, so it is confirmed rather than instant.
 */

type Mode = 'idle' | 'reschedule' | 'decline';

/** Fixed so the row cannot change height between its states. */
const ACTION_ROW = 'flex min-h-[40px] flex-wrap items-center gap-2';
const BTN_BASE =
  'inline-flex h-10 min-w-[104px] items-center justify-center rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60';
const BTN_PRIMARY = `${BTN_BASE} bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100`;
const BTN_QUIET = `${BTN_BASE} bg-black/[0.05] text-slate-700 hover:bg-black/[0.08] dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/[0.16]`;
const BTN_DANGER = `${BTN_BASE} bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 dark:text-rose-300`;

const SlotChoice: React.FC<{
  slot: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}> = ({ slot, selected, disabled, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    disabled={disabled}
    aria-pressed={selected}
    /* The ring is inset so selecting never changes the button's box. A border
       that appears on selection reflows every sibling in the row. */
    className={`h-11 rounded-xl px-3 text-left text-sm font-medium transition disabled:opacity-60 ${
      selected
        ? 'bg-slate-900 text-white ring-2 ring-inset ring-slate-900 dark:bg-white dark:text-slate-900 dark:ring-white'
        : 'bg-black/[0.04] text-slate-700 ring-2 ring-inset ring-transparent hover:bg-black/[0.07] dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/[0.1]'
    }`}
  >
    {formatSlot(slot)}
  </button>
);

export const VisitSchedulePanel: React.FC = () => {
  const {
    data: visit,
    loading,
    refetch,
  } = useCachedResource<BrandVisitView | null>({
    queryKey: ['verification', 'visit', 'me'],
    queryFn: () => physicalVerificationApi.mine(),
  });

  const [mode, setMode] = useState<Mode>('idle');
  const [slot, setSlot] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const send = useCallback(
    async (
      response: 'AGREED' | 'RESCHEDULE_REQUESTED' | 'DECLINED',
      selectedSlot?: string,
    ) => {
      if (!visit) return;
      setBusy(true);
      try {
        await physicalVerificationApi.reply(visit.id, {
          response,
          selectedSlot,
          note: note.trim() || undefined,
        });
        await refetch();
        setMode('idle');
        setNote('');
        setSlot(null);
        toast.success(
          response === 'DECLINED'
            ? 'Visit declined.'
            : response === 'RESCHEDULE_REQUESTED'
              ? 'We have asked the reviewer about that time.'
              : 'Visit confirmed.',
        );
      } catch (error: any) {
        // The server is the authority on which slots are allowed, so its
        // message is more useful than anything this panel could guess.
        toast.error(
          error?.response?.data?.message ?? 'Could not send your answer.',
        );
      } finally {
        setBusy(false);
      }
    },
    [note, refetch, visit],
  );

  // Nothing to show before the document step passes. Rendering an empty
  // bordered box here would add a rectangle to a page that has enough.
  if (!loading && !visit) return null;

  if (loading) {
    return (
      <section className={`${PANEL} min-h-[168px] animate-pulse p-5`} aria-hidden>
        <div className="h-3 w-24 rounded bg-black/[0.06] dark:bg-white/10" />
        <div className="mt-3 h-5 w-64 max-w-full rounded bg-black/[0.06] dark:bg-white/10" />
        <div className="mt-2 h-4 w-80 max-w-full rounded bg-black/[0.06] dark:bg-white/10" />
      </section>
    );
  }
  if (!visit) return null;

  const headline = brandVisitHeadline(visit.status);
  const canRespond = visit.canRespond && !busy;
  const slots = visit.proposedSlots ?? [];

  return (
    /* One border for the whole thing. `min-h` matches the tallest resting
       state so a status change never shortens the page under the reader. */
    <section className={`${PANEL} min-h-[168px] p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={FIELD_LABEL}>Physical verification</p>
          <h3 className="mt-1.5 text-base font-bold text-slate-900 dark:text-white">
            {headline.title}
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {headline.body}
          </p>
        </div>
        <span className={`${CHIP_BASE} ${VISIT_STATUS_TONE[visit.status]}`}>
          {VISIT_STATUS_LABEL[visit.status]}
        </span>
      </div>

      {visit.selectedSlotAt && visit.status === 'SCHEDULE_CONFIRMED' ? (
        <div className={`${INSET} mt-4 px-3.5 py-3`}>
          <p className={FIELD_LABEL}>Your appointment</p>
          <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
            {formatSlot(visit.selectedSlotAt)}
          </p>
        </div>
      ) : null}

      {visit.status === 'FAILED' && visit.failureReason ? (
        <div className={`${INSET} mt-4 px-3.5 py-3`}>
          <p className={FIELD_LABEL}>Reason</p>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
            {visit.failureReason}
          </p>
        </div>
      ) : null}

      {visit.canRespond && slots.length > 0 ? (
        <div className="mt-4">
          <p className={FIELD_LABEL}>
            {mode === 'reschedule' ? 'Which of these suits you?' : 'Offered times'}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {slots.map((option) => (
              <SlotChoice
                key={option}
                slot={option}
                selected={slot === option}
                disabled={busy}
                onSelect={() => setSlot(option)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {mode !== 'idle' ? (
        <div className="mt-3">
          <label className={FIELD_LABEL} htmlFor="visit-note">
            {mode === 'decline' ? 'Why are you declining?' : 'Anything to add?'}
          </label>
          <textarea
            id="visit-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            maxLength={500}
            disabled={busy}
            className={`${INSET} mt-1.5 w-full resize-none px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-slate-900/20 dark:text-white dark:focus-visible:ring-white/20`}
            placeholder={mode === 'decline' ? 'Optional' : 'Optional'}
          />
        </div>
      ) : null}

      {visit.canRespond ? (
        <div className={`${ACTION_ROW} mt-4`}>
          {mode === 'idle' ? (
            <>
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={!canRespond || !slot}
                onClick={() => void send('AGREED', slot ?? undefined)}
                title={slot ? undefined : 'Choose a time first'}
              >
                {busy ? 'Saving…' : 'Agree'}
              </button>
              <button
                type="button"
                className={BTN_QUIET}
                disabled={!canRespond || visit.remainingReschedules <= 0}
                onClick={() => setMode('reschedule')}
                title={
                  visit.remainingReschedules <= 0
                    ? 'No reschedules remain on this visit'
                    : undefined
                }
              >
                Reschedule
              </button>
              <button
                type="button"
                className={BTN_DANGER}
                disabled={!canRespond}
                onClick={() => setMode('decline')}
              >
                Decline
              </button>
            </>
          ) : mode === 'reschedule' ? (
            <>
              <button
                type="button"
                className={BTN_PRIMARY}
                disabled={!canRespond || !slot}
                onClick={() =>
                  void send('RESCHEDULE_REQUESTED', slot ?? undefined)
                }
              >
                {busy ? 'Saving…' : 'Request'}
              </button>
              <button
                type="button"
                className={BTN_QUIET}
                disabled={busy}
                onClick={() => setMode('idle')}
              >
                Back
              </button>
            </>
          ) : (
            <>
              {/* Declining ends the whole attempt, so it is confirmed rather
                  than instant — and the consequence is stated, not implied. */}
              <button
                type="button"
                className={BTN_DANGER}
                disabled={busy}
                onClick={() => void send('DECLINED')}
              >
                {busy ? 'Saving…' : 'Confirm decline'}
              </button>
              <button
                type="button"
                className={BTN_QUIET}
                disabled={busy}
                onClick={() => setMode('idle')}
              >
                Back
              </button>
              <p className="text-xs text-rose-600 dark:text-rose-300">
                This ends verification. A new attempt starts from the beginning.
              </p>
            </>
          )}
        </div>
      ) : null}

      {visit.canRespond && visit.remainingReschedules > 0 ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {visit.remainingReschedules} reschedule
          {visit.remainingReschedules === 1 ? '' : 's'} left.
        </p>
      ) : null}
    </section>
  );
};

export default VisitSchedulePanel;
