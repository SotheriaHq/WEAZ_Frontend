import React, { useCallback, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  physicalVerificationApi,
  type PhysicalVerificationDetail,
  type PhysicalVerificationProofKind,
  type PhysicalVerificationSummary,
} from '@/api/PhysicalVerificationApi';
import useCachedResource from '@/hooks/useCachedResource';
import {
  CHIP_BASE,
  FIELD_LABEL,
  formatSlot,
  INSET,
  PANEL,
  ROW_DIVIDER,
  VISIT_STATUS_LABEL,
  VISIT_STATUS_TONE,
  visitNeedsAgent,
} from '@/components/verification/visitPresentation';

/**
 * The verification agent's console: the queue, and one visit at a time.
 *
 * Laid out as a fixed two-column shell rather than a list that swaps itself
 * for a detail view. Selecting a visit changes only the right column, so the
 * queue never re-lays-out under the cursor and the page keeps its height
 * through every action. The same reason every button below carries a fixed
 * height and a minimum width: a control that resizes when its own label
 * changes moves whatever is next to it.
 *
 * Borders: the two columns are the only bordered boxes on the screen. Rows are
 * separated by hairlines, blocks inside the detail by a soft fill. Nothing is
 * a box inside a box.
 */

const BTN =
  'inline-flex h-9 min-w-[92px] items-center justify-center rounded-lg px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60';
const BTN_PRIMARY = `${BTN} bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900`;
const BTN_QUIET = `${BTN} bg-black/[0.05] text-slate-700 hover:bg-black/[0.08] dark:bg-white/10 dark:text-slate-200`;
const BTN_OK = `${BTN} bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300`;
const BTN_NO = `${BTN} bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 dark:text-rose-300`;

const PROOF_KINDS: PhysicalVerificationProofKind[] = [
  'WORKSPACE',
  'PACKAGING',
  'BRANDING',
  'SIGNAGE',
  'EQUIPMENT',
  'OTHER',
];

/** Local datetime input value → ISO. Empty stays empty. */
const toIso = (local: string): string => {
  if (!local) return '';
  const parsed = new Date(local);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
};

const QueueRow: React.FC<{
  row: PhysicalVerificationSummary;
  active: boolean;
  onSelect: () => void;
}> = ({ row, active, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    /* Selection is a fill, never a border — a border appearing on the active
       row would shift every row below it by a pixel. */
    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
      active
        ? 'bg-black/[0.05] dark:bg-white/[0.08]'
        : 'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]'
    }`}
  >
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">
        {row.brandName}
      </span>
      <span className="mt-0.5 block truncate text-xs text-slate-500 dark:text-slate-400">
        {row.selectedSlotAt
          ? formatSlot(row.selectedSlotAt)
          : `Opened ${formatSlot(row.createdAt)}`}
      </span>
    </span>
    <span className={`${CHIP_BASE} ${VISIT_STATUS_TONE[row.status]}`}>
      {VISIT_STATUS_LABEL[row.status]}
    </span>
  </button>
);

const AdminVerificationVisitsPage: React.FC = () => {
  const { id: routeId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [onlyMine, setOnlyMine] = useState(false);
  const [busy, setBusy] = useState(false);

  const {
    data: queue = [],
    loading: queueLoading,
    refetch: refetchQueue,
  } = useCachedResource<PhysicalVerificationSummary[]>({
    queryKey: ['verification', 'visits', onlyMine ? 'mine' : 'all'],
    queryFn: () => physicalVerificationApi.list({ mine: onlyMine || undefined }),
  });

  const selectedId = routeId ?? queue[0]?.id ?? null;

  const {
    data: detail,
    loading: detailLoading,
    refetch: refetchDetail,
  } = useCachedResource<PhysicalVerificationDetail | null>({
    queryKey: ['verification', 'visit', selectedId],
    queryFn: () =>
      selectedId ? physicalVerificationApi.detail(selectedId) : Promise.resolve(null),
    enabled: Boolean(selectedId),
  });

  const ordered = useMemo(
    () =>
      [...queue].sort((a, b) => {
        // What needs a person first, oldest first within that.
        const aNeeds = visitNeedsAgent(a) ? 0 : 1;
        const bNeeds = visitNeedsAgent(b) ? 0 : 1;
        if (aNeeds !== bNeeds) return aNeeds - bNeeds;
        return a.createdAt < b.createdAt ? -1 : 1;
      }),
    [queue],
  );

  const run = useCallback(
    async (action: () => Promise<unknown>, success: string) => {
      setBusy(true);
      try {
        await action();
        await Promise.all([refetchDetail(), refetchQueue()]);
        toast.success(success);
      } catch (error: any) {
        toast.error(error?.response?.data?.message ?? 'That did not go through.');
      } finally {
        setBusy(false);
      }
    },
    [refetchDetail, refetchQueue],
  );

  /* ── scheduling ─────────────────────────────────────────────────────── */
  const [slotDrafts, setSlotDrafts] = useState<string[]>(['', '']);
  const [proposeNote, setProposeNote] = useState('');
  const usableSlots = slotDrafts.map(toIso).filter(Boolean);

  /* ── evidence ───────────────────────────────────────────────────────── */
  const [proofKey, setProofKey] = useState('');
  const [proofKind, setProofKind] = useState<PhysicalVerificationProofKind>('WORKSPACE');
  const [proofCaption, setProofCaption] = useState('');

  /* ── verdict ────────────────────────────────────────────────────────── */
  const [failureReason, setFailureReason] = useState('');
  const [decisionNotes, setDecisionNotes] = useState('');

  const enoughProof =
    detail != null && detail.proofCount >= detail.minProofsForDecision;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-6">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Verification visits
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Claim a visit, agree a time, record what you found.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOnlyMine((prev) => !prev)}
          aria-pressed={onlyMine}
          className={onlyMine ? BTN_PRIMARY : BTN_QUIET}
        >
          {onlyMine ? 'Mine' : 'All'}
        </button>
      </header>

      {/* Fixed two-column shell. The queue keeps its width and its scroll while
          the right column changes, so selecting never moves the list. */}
      <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
        <section className={`${PANEL} overflow-hidden`}>
          <div className={`${ROW_DIVIDER} max-h-[70vh] overflow-y-auto`}>
            {queueLoading ? (
              // Same row height as a real row, so the list does not jump when
              // the data lands.
              [0, 1, 2, 3].map((key) => (
                <div key={key} className="flex h-[62px] items-center px-4">
                  <div className="h-4 w-40 animate-pulse rounded bg-black/[0.06] dark:bg-white/10" />
                </div>
              ))
            ) : ordered.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                No visits here.
              </p>
            ) : (
              ordered.map((row) => (
                <QueueRow
                  key={row.id}
                  row={row}
                  active={row.id === selectedId}
                  onSelect={() => navigate(`/admin/verification/visits/${row.id}`)}
                />
              ))
            )}
          </div>
        </section>

        <section className={`${PANEL} min-h-[420px] p-5`}>
          {detailLoading || !detail ? (
            <div className="animate-pulse" aria-hidden>
              <div className="h-3 w-24 rounded bg-black/[0.06] dark:bg-white/10" />
              <div className="mt-3 h-6 w-56 rounded bg-black/[0.06] dark:bg-white/10" />
              <div className="mt-6 h-20 rounded-xl bg-black/[0.04] dark:bg-white/[0.06]" />
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={FIELD_LABEL}>Brand</p>
                  <h2 className="mt-1 truncate text-lg font-bold text-slate-900 dark:text-white">
                    {detail.brandName}
                  </h2>
                </div>
                <span className={`${CHIP_BASE} ${VISIT_STATUS_TONE[detail.status]}`}>
                  {VISIT_STATUS_LABEL[detail.status]}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['Opened', formatSlot(detail.createdAt)],
                  ['Appointment', formatSlot(detail.selectedSlotAt)],
                  ['Reschedules', String(detail.rescheduleCount)],
                  [
                    'Evidence',
                    `${detail.proofCount} / ${detail.minProofsForDecision}`,
                  ],
                ].map(([label, value]) => (
                  <div key={label} className={`${INSET} px-3 py-2.5`}>
                    <dt className={FIELD_LABEL}>{label}</dt>
                    <dd className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-white">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              {/* Ownership */}
              {detail.status === 'PENDING_ASSIGNMENT' ? (
                <div className="mt-5 flex items-center gap-2">
                  <button
                    type="button"
                    className={BTN_PRIMARY}
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => physicalVerificationApi.claim(detail.id),
                        'Visit claimed.',
                      )
                    }
                  >
                    {busy ? 'Working…' : 'Claim'}
                  </button>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Nobody owns this visit yet.
                  </p>
                </div>
              ) : null}

              {/* Answering a reschedule request. */}
              {detail.status === 'RESCHEDULE_REQUESTED' ? (
                <div className={`${INSET} mt-5 px-3.5 py-3`}>
                  <p className={FIELD_LABEL}>They asked for</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {formatSlot(detail.selectedSlotAt)}
                  </p>
                  {detail.brandResponseNote ? (
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      “{detail.brandResponseNote}”
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={BTN_OK}
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            physicalVerificationApi.respondToReschedule(detail.id, {
                              decision: 'ACCEPTED',
                            }),
                          'Time accepted.',
                        )
                      }
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className={BTN_NO}
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            physicalVerificationApi.respondToReschedule(detail.id, {
                              decision: 'DECLINED',
                              note: decisionNotes.trim() || undefined,
                            }),
                          'Postponed. Offer new times when you can.',
                        )
                      }
                    >
                      Postpone
                    </button>
                    <p className="self-center text-xs text-slate-500 dark:text-slate-400">
                      Or offer different times below.
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Offering times. */}
              {['ASSIGNED', 'SCHEDULE_PROPOSED', 'RESCHEDULE_REQUESTED', 'ON_HOLD', 'SCHEDULE_CONFIRMED'].includes(
                detail.status,
              ) ? (
                <div className="mt-5">
                  <p className={FIELD_LABEL}>Offer times</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {slotDrafts.map((value, index) => (
                      <input
                        key={index}
                        type="datetime-local"
                        value={value}
                        disabled={busy}
                        onChange={(event) =>
                          setSlotDrafts((prev) =>
                            prev.map((slot, i) =>
                              i === index ? event.target.value : slot,
                            ),
                          )
                        }
                        className={`${INSET} h-10 px-3 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20 dark:text-white dark:focus-visible:ring-white/20`}
                      />
                    ))}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={BTN_QUIET}
                      disabled={busy || slotDrafts.length >= 6}
                      onClick={() => setSlotDrafts((prev) => [...prev, ''])}
                    >
                      Add time
                    </button>
                    <button
                      type="button"
                      className={BTN_PRIMARY}
                      disabled={busy || usableSlots.length < 2}
                      title={
                        usableSlots.length < 2
                          ? 'Offer at least two times so the brand has a choice'
                          : undefined
                      }
                      onClick={() =>
                        void run(async () => {
                          await physicalVerificationApi.propose(detail.id, {
                            slots: usableSlots,
                            note: proposeNote.trim() || undefined,
                          });
                          setSlotDrafts(['', '']);
                          setProposeNote('');
                        }, 'Times sent to the brand.')
                      }
                    >
                      {busy ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Evidence. */}
              {['SCHEDULE_CONFIRMED', 'VISIT_COMPLETED', 'ASSIGNED'].includes(
                detail.status,
              ) ? (
                <div className="mt-6">
                  <p className={FIELD_LABEL}>
                    Evidence ({detail.proofCount} of {detail.minProofsForDecision} needed)
                  </p>
                  {detail.proofs.length > 0 ? (
                    <ul className={`${INSET} ${ROW_DIVIDER} mt-2 overflow-hidden`}>
                      {detail.proofs.map((proof) => (
                        <li
                          key={proof.id}
                          className="flex items-center gap-3 px-3 py-2.5"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-800 dark:text-slate-200">
                            {proof.caption || proof.fileName || proof.fileKey}
                          </span>
                          <span className={`${CHIP_BASE} bg-black/[0.05] text-slate-600 dark:bg-white/10 dark:text-slate-300`}>
                            {proof.kind}
                          </span>
                          <button
                            type="button"
                            className="h-8 shrink-0 rounded-lg px-2 text-xs font-semibold text-rose-600 hover:bg-rose-500/10 dark:text-rose-300"
                            disabled={busy}
                            onClick={() =>
                              void run(
                                () =>
                                  physicalVerificationApi.removeProof(
                                    detail.id,
                                    proof.id,
                                  ),
                                'Removed.',
                              )
                            }
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px]">
                    <input
                      value={proofKey}
                      disabled={busy}
                      onChange={(event) => setProofKey(event.target.value)}
                      placeholder="Uploaded file key"
                      className={`${INSET} h-10 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-slate-900/20 dark:text-white dark:focus-visible:ring-white/20`}
                    />
                    <select
                      value={proofKind}
                      disabled={busy}
                      onChange={(event) =>
                        setProofKind(event.target.value as PhysicalVerificationProofKind)
                      }
                      className={`${INSET} h-10 px-3 text-sm text-slate-900 outline-none dark:text-white`}
                    >
                      {PROOF_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={proofCaption}
                      disabled={busy}
                      onChange={(event) => setProofCaption(event.target.value)}
                      placeholder="Caption (optional)"
                      className={`${INSET} h-10 min-w-0 flex-1 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-slate-900/20 dark:text-white dark:focus-visible:ring-white/20`}
                    />
                    <button
                      type="button"
                      className={BTN_QUIET}
                      disabled={busy || !proofKey.trim()}
                      onClick={() =>
                        void run(async () => {
                          await physicalVerificationApi.addProof(detail.id, {
                            fileKey: proofKey.trim(),
                            kind: proofKind,
                            caption: proofCaption.trim() || undefined,
                          });
                          setProofKey('');
                          setProofCaption('');
                        }, 'Evidence attached.')
                      }
                    >
                      Attach
                    </button>
                  </div>
                </div>
              ) : null}

              {/* The verdict. */}
              {detail.status === 'VISIT_COMPLETED' ? (
                <div className="mt-6">
                  <p className={FIELD_LABEL}>Verdict</p>
                  <textarea
                    value={decisionNotes}
                    rows={2}
                    disabled={busy}
                    onChange={(event) => setDecisionNotes(event.target.value)}
                    placeholder="Notes (optional)"
                    className={`${INSET} mt-2 w-full resize-none px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-slate-900/20 dark:text-white dark:focus-visible:ring-white/20`}
                  />
                  <input
                    value={failureReason}
                    disabled={busy}
                    onChange={(event) => setFailureReason(event.target.value)}
                    placeholder="Reason — required to fail"
                    className={`${INSET} mt-2 h-10 w-full px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-slate-900/20 dark:text-white dark:focus-visible:ring-white/20`}
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className={BTN_OK}
                      disabled={busy || !enoughProof}
                      title={
                        enoughProof
                          ? undefined
                          : `Attach at least ${detail.minProofsForDecision} pieces of evidence first`
                      }
                      onClick={() =>
                        void run(
                          () =>
                            physicalVerificationApi.decide(detail.id, {
                              outcome: 'PASSED',
                              notes: decisionNotes.trim() || undefined,
                            }),
                          'Passed. The brand is verified.',
                        )
                      }
                    >
                      Pass
                    </button>
                    <button
                      type="button"
                      className={BTN_NO}
                      disabled={busy || !enoughProof || !failureReason.trim()}
                      onClick={() =>
                        void run(
                          () =>
                            physicalVerificationApi.decide(detail.id, {
                              outcome: 'FAILED',
                              notes: decisionNotes.trim() || undefined,
                              failureReason: failureReason.trim(),
                            }),
                          'Recorded as failed.',
                        )
                      }
                    >
                      Fail
                    </button>
                    {!enoughProof ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        A verdict needs {detail.minProofsForDecision} pieces of evidence.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Closed. */}
              {['PASSED', 'FAILED', 'DECLINED'].includes(detail.status) ? (
                <div className={`${INSET} mt-6 px-3.5 py-3`}>
                  <p className={FIELD_LABEL}>Closed {formatSlot(detail.decidedAt)}</p>
                  {detail.failureReason || detail.declineReason ? (
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                      {detail.failureReason ?? detail.declineReason}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default AdminVerificationVisitsPage;
