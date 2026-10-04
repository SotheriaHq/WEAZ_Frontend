/**
 * Working a single custom-order dispute.
 *
 * The shape of this panel follows the rule that ownership comes first: nothing
 * about the substance is actionable until an admin has claimed the case, and
 * the only way out of a claim is to hand it to a named colleague with a
 * SuperAdmin's approval. That is not a UI preference — the API enforces it, and
 * showing resolution controls to someone who cannot use them would just produce
 * a form that 403s on submit.
 *
 * Resolution options come from the server WITH their blocked reasons rather
 * than filtered, so an admin can see that "shopper agrees to more time" exists
 * and why it is unavailable on this order. Hiding it would send them looking
 * for a control that is deliberately absent.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import UniversalSelect from '@/components/forms/UniversalSelect';
import { adminUsersApi } from '@/api/AdminApi';
import { customOrdersAdminApi, type DisputeQueueDetail } from '@/api/CustomOrderApi';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import type { AdminUser } from '@/types/admin';
import { unwrapApiResponse } from '@/types/auth';

interface Props {
  disputeId: string | null;
  onClose: () => void;
  onChanged: () => void;
}

function humanize(value: string): string {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? new Date(ms).toLocaleString() : '—';
}

const DisputeQueueDetailDrawer: React.FC<Props> = ({ disputeId, onClose, onChanged }) => {
  const { hasPermission } = useAdminPermissions();
  const [detail, setDetail] = useState<DisputeQueueDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [resolution, setResolution] = useState('');
  const [note, setNote] = useState('');
  const [extraDays, setExtraDays] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [successorId, setSuccessorId] = useState('');
  const [handoverReason, setHandoverReason] = useState('');
  const [admins, setAdmins] = useState<AdminUser[]>([]);

  /**
   * Who a dispute can be handed to.
   *
   * Loaded once the drawer opens rather than on every render: this is a list of
   * colleagues, it changes rarely, and the handover controls are behind a
   * collapsed section most sessions never open.
   */
  useEffect(() => {
    if (!disputeId) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await adminUsersApi.list({ limit: '100' });
        const data = unwrapApiResponse<{ items?: AdminUser[] } | AdminUser[]>(
          response.data as never,
        );
        const items = Array.isArray(data) ? data : (data.items ?? []);
        if (!cancelled) {
          setAdmins(
            items.filter((user) =>
              String(user.role ?? '').toLowerCase().includes('admin'),
            ),
          );
        }
      } catch {
        // A missing colleague list disables handover, it does not break the
        // drawer — reading and resolving the dispute still work.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [disputeId]);

  const adminOptions = useMemo(
    () =>
      admins
        // Never offer the current holder as their own successor; the API
        // refuses it and an option that always fails is worse than no option.
        .filter((user) => user.id !== detail?.claimedByAdminId)
        .map((user) => ({
          value: user.id,
          label:
            `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email,
        })),
    [admins, detail?.claimedByAdminId],
  );

  const load = useCallback(async () => {
    if (!disputeId) return;
    setLoading(true);
    setError(null);
    try {
      setDetail(await customOrdersAdminApi.getQueuedDispute(disputeId));
    } catch (loadError: any) {
      setError(
        loadError?.response?.data?.message || 'This dispute could not be loaded.',
      );
    } finally {
      setLoading(false);
    }
  }, [disputeId]);

  useEffect(() => {
    if (!disputeId) {
      setDetail(null);
      setResolution('');
      setNote('');
      setExtraDays('');
      setRefundAmount('');
      return;
    }
    void load();
  }, [disputeId, load]);

  const run = async (action: () => Promise<DisputeQueueDetail>) => {
    setBusy(true);
    setError(null);
    try {
      setDetail(await action());
      onChanged();
    } catch (actionError: any) {
      // The API's codes are the useful part here — "claimed by another admin"
      // is a real outcome a handler needs to read, not a generic failure.
      const payload = actionError?.response?.data;
      setError(
        payload?.message ||
          (typeof payload === 'string' ? payload : null) ||
          'That could not be completed.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (!disputeId) return null;

  const selectedOption = detail?.resolutionOptions.find(
    (option) => option.resolution === resolution,
  );
  const isMine = Boolean(detail?.claimedByAdminId);
  const canClaim = hasPermission('DISPUTES_CLAIM') && !detail?.claimedByAdminId;
  const canResolve = hasPermission('DISPUTES_RESOLVE') && isMine;
  const canApproveHandover = hasPermission('DISPUTES_HANDOVER_APPROVE');

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-xl dark:bg-gray-950"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Dispute detail"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {detail?.order?.title ?? 'Dispute'}
            </h2>
            {detail?.order ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {[detail.order.buyerName ?? detail.order.buyerEmail, detail.order.brandName]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Close
          </button>
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
          >
            {error}
          </div>
        ) : null}

        {loading || !detail ? (
          <p className="mt-6 text-sm text-gray-500">Loading...</p>
        ) : (
          <div className="mt-6 space-y-6">
            <section className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Status</div>
                <div className="font-medium">{humanize(detail.status)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Reason</div>
                <div className="font-medium">{humanize(detail.reasonType)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">Opened</div>
                <div className="font-medium">{formatWhen(detail.openedAt)}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  Claim due
                </div>
                <div
                  className={`font-medium ${detail.claimOverdue ? 'text-red-600 dark:text-red-400' : ''}`}
                >
                  {formatWhen(detail.claimDueAt)}
                  {detail.claimOverdue ? ' — overdue' : ''}
                </div>
              </div>
            </section>

            {detail.buyerStatement ? (
              <section>
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  What the shopper said
                </div>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  {detail.buyerStatement}
                </p>
              </section>
            ) : null}

            {detail.brandResponse ? (
              <section>
                <div className="text-xs uppercase tracking-wide text-gray-500">
                  What the brand said
                </div>
                <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  {detail.brandResponse}
                </p>
              </section>
            ) : null}

            {/* Ownership, before anything else. */}
            <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                Ownership
              </div>
              {detail.claimedByAdminId ? (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Claimed {formatWhen(detail.claimedAt)}. Ownership can only be
                  handed to a named colleague, and a SuperAdmin has to approve it.
                </p>
              ) : (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Nobody owns this yet. Claim it to work on it — the resolution
                  controls stay locked until someone does.
                </p>
              )}
              {canClaim ? (
                <button
                  disabled={busy}
                  onClick={() => void run(() => customOrdersAdminApi.claimDispute(detail.id))}
                  className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-60"
                >
                  Claim this dispute
                </button>
              ) : null}

              {/*
                A pending handover outranks the form to request one. The
                approver and the requester see the same block and are offered
                different controls — the admin asking to be released must not
                be able to approve themselves, which the API also enforces.
              */}
              {detail.handover?.pending ? (
                <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-500/10">
                  <p className="font-medium text-amber-900 dark:text-amber-200">
                    ⏳ Handover waiting on a SuperAdmin
                  </p>
                  {detail.handover.reason ? (
                    <p className="mt-1 text-amber-900/90 dark:text-amber-200/90">
                      “{detail.handover.reason}”
                    </p>
                  ) : null}
                  {canApproveHandover ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            customOrdersAdminApi.decideDisputeHandover(detail.id, {
                              approve: true,
                            }),
                          )
                        }
                        className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                      >
                        Approve handover
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            customOrdersAdminApi.decideDisputeHandover(detail.id, {
                              approve: false,
                              ...(handoverReason.trim()
                                ? { reason: handoverReason.trim() }
                                : {}),
                            }),
                          )
                        }
                        className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200"
                      >
                        Refuse — it stays with them
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Handing on, for the admin who holds it. */}
              {isMine &&
              !detail.handover?.pending &&
              hasPermission('DISPUTES_HANDOVER_REQUEST') ? (
                <details className="mt-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
                    Hand this to someone else
                  </summary>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    There is no way to simply put a dispute down. Name who takes
                    it, say why, and a SuperAdmin decides.
                  </p>
                  <div className="mt-3">
                    <UniversalSelect
                      label="Hand to"
                      value={successorId}
                      onChange={setSuccessorId}
                      options={adminOptions}
                      placeholder="Choose an admin"
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={handoverReason}
                    onChange={(event) => setHandoverReason(event.target.value)}
                    placeholder="Why are you handing this on?"
                    className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                  />
                  <button
                    disabled={
                      busy || !successorId || handoverReason.trim().length < 10
                    }
                    onClick={() =>
                      void run(() =>
                        customOrdersAdminApi.requestDisputeHandover(detail.id, {
                          successorAdminId: successorId,
                          reason: handoverReason.trim(),
                        }),
                      )
                    }
                    className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    Request handover
                  </button>
                </details>
              ) : null}

              {/* Taking it off someone, for a SuperAdmin. */}
              {detail.claimedByAdminId &&
              !isMine &&
              !detail.handover?.pending &&
              canApproveHandover ? (
                <details className="mt-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">
                    Reassign this dispute
                  </summary>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    For a case whose owner has gone quiet. It moves straight to
                    the person you name — it is never returned to the pool.
                  </p>
                  <div className="mt-3">
                    <UniversalSelect
                      label="Reassign to"
                      value={successorId}
                      onChange={setSuccessorId}
                      options={adminOptions}
                      placeholder="Choose an admin"
                    />
                  </div>
                  <textarea
                    rows={2}
                    value={handoverReason}
                    onChange={(event) => setHandoverReason(event.target.value)}
                    placeholder="Why is this being reassigned?"
                    className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                  />
                  <button
                    disabled={
                      busy || !successorId || handoverReason.trim().length < 10
                    }
                    onClick={() =>
                      void run(() =>
                        customOrdersAdminApi.reassignDispute(detail.id, {
                          successorAdminId: successorId,
                          reason: handoverReason.trim(),
                        }),
                      )
                    }
                    className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  >
                    Reassign
                  </button>
                </details>
              ) : null}
            </section>

            {/* An open proposal outranks the form to make a new one. */}
            {detail.proposal && detail.status === 'AWAITING_PARTY_CONSENT' ? (
              <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-500/30 dark:bg-amber-500/10">
                <div className="font-semibold text-amber-900 dark:text-amber-200">
                  ⏳ Waiting on {humanize(detail.proposal.consentBy ?? 'party')}
                </div>
                <p className="mt-1 text-amber-900 dark:text-amber-200">
                  {humanize(detail.proposal.resolution)}
                  {detail.proposal.extraDays
                    ? ` — ${detail.proposal.extraDays} day(s)`
                    : ''}
                  . They have until {formatWhen(detail.proposal.respondByAt)} to answer.
                </p>
              </section>
            ) : canResolve ? (
              <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  Resolve
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Some outcomes are yours to decide. Others — more time, a remake
                  — have to be agreed by the party they bind, and will be put to
                  them rather than applied.
                </p>

                <div className="mt-3">
                  <UniversalSelect
                    label="Outcome"
                    value={resolution}
                    onChange={setResolution}
                    options={detail.resolutionOptions.map((option) => ({
                      value: String(option.resolution),
                      label: option.blockedReason
                        ? `${option.label} (unavailable)`
                        : option.label,
                    }))}
                    placeholder="Choose an outcome"
                  />
                </div>

                {selectedOption?.blockedReason ? (
                  <p className="mt-2 rounded-lg bg-gray-100 p-3 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                    🔒 {selectedOption.blockedReason}
                  </p>
                ) : null}

                {selectedOption && !selectedOption.blockedReason ? (
                  <>
                    {selectedOption.consentFrom ? (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        This will be put to the{' '}
                        {humanize(selectedOption.consentFrom).toLowerCase()} and applied
                        only if they agree.
                      </p>
                    ) : null}

                    {String(selectedOption.resolution) === 'MEDIATED_EXTENSION' ? (
                      <div className="mt-3">
                        <label
                          htmlFor="dispute-extra-days"
                          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          Extra days
                        </label>
                        <input
                          id="dispute-extra-days"
                          type="number"
                          min={1}
                          max={3}
                          value={extraDays}
                          onChange={(event) => setExtraDays(event.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                        />
                      </div>
                    ) : null}

                    {String(selectedOption.resolution) === 'PARTIAL_REFUND' ? (
                      <div className="mt-3">
                        <label
                          htmlFor="dispute-refund"
                          className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                        >
                          Refund amount
                        </label>
                        <input
                          id="dispute-refund"
                          type="number"
                          min={0}
                          step="0.01"
                          value={refundAmount}
                          onChange={(event) => setRefundAmount(event.target.value)}
                          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                        />
                      </div>
                    ) : null}

                    {selectedOption.movesMoney &&
                    !hasPermission('DISPUTES_REFUND') ? (
                      <p className="mt-3 rounded-lg bg-gray-100 p-3 text-sm text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                        🔒 This outcome moves money, which needs the dispute refund
                        permission. Ask a SuperAdmin, or pick an outcome that does
                        not.
                      </p>
                    ) : null}

                    <div className="mt-3">
                      <label
                        htmlFor="dispute-note"
                        className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300"
                      >
                        Note to the parties
                      </label>
                      <textarea
                        id="dispute-note"
                        rows={3}
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
                      />
                    </div>

                    <button
                      disabled={
                        busy ||
                        (selectedOption.movesMoney && !hasPermission('DISPUTES_REFUND'))
                      }
                      onClick={() =>
                        void run(() =>
                          customOrdersAdminApi.proposeDisputeResolution(detail.id, {
                            resolution: String(selectedOption.resolution),
                            ...(note.trim() ? { note: note.trim() } : {}),
                            ...(extraDays ? { extraDays: Number(extraDays) } : {}),
                            ...(refundAmount
                              ? { refundAmount: Number(refundAmount) }
                              : {}),
                          }),
                        )
                      }
                      className="mt-4 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-60"
                    >
                      {selectedOption.consentFrom ? 'Put this to them' : 'Apply outcome'}
                    </button>
                  </>
                ) : null}
              </section>
            ) : null}
          </div>
        )}
      </aside>
    </div>
  );
};

export default DisputeQueueDetailDrawer;
