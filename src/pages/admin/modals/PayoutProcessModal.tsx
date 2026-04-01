import React, { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PayoutSourceBreakdown from '@/components/payouts/PayoutSourceBreakdown';
import { adminPayoutsApi } from '@/api/AdminApi';
import type { AdminPayout, AdminPayoutDetail } from '@/types/admin';
import { toast } from 'sonner';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { unwrapApiResponse } from '@/types/auth';

interface Props {
  payout: AdminPayout | null;
  open: boolean;
  onClose: () => void;
  onUpdated: (payout?: AdminPayout | null) => void;
}

const STATUS_EMOJI: Record<string, string> = {
  PENDING_APPROVAL: '🟡',
  APPROVED: '🔵',
  PROCESSING: '🟣',
  PAID: '🟢',
  FAILED: '🔴',
  REJECTED: '⛔',
  ON_HOLD: '⏸️',
  RECONCILIATION_REVIEW: '🧾',
};

const TRANSITIONS: Record<string, string[]> = {
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'ON_HOLD'],
  APPROVED: ['PROCESSING', 'ON_HOLD', 'REJECTED'],
  PROCESSING: ['PAID', 'FAILED', 'RECONCILIATION_REVIEW'],
  FAILED: ['APPROVED', 'ON_HOLD', 'REJECTED'],
  REJECTED: [],
  ON_HOLD: ['APPROVED', 'REJECTED'],
  RECONCILIATION_REVIEW: ['APPROVED', 'PAID', 'FAILED', 'ON_HOLD'],
  PAID: [],
};

type ConfirmAction =
  | {
      kind: 'status';
      title: string;
      message: string;
      isDestructive?: boolean;
      newStatus: string;
    }
  | {
      kind: 'claim' | 'release' | 'initiate';
      title: string;
      message: string;
      isDestructive?: boolean;
    };

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

const PayoutProcessModal: React.FC<Props> = ({
  payout,
  open,
  onClose,
  onUpdated,
}) => {
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<AdminPayoutDetail | null>(null);
  const [reason, setReason] = useState('');
  const [otp, setOtp] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const { hasPermission } = useAdminPermissions();

  const activePayout = detail ?? payout;
  const transitions = useMemo(
    () => (activePayout ? TRANSITIONS[activePayout.status] ?? [] : []),
    [activePayout],
  );
  const providerStatus = String(activePayout?.providerTransferStatus ?? '')
    .trim()
    .toUpperCase();
  const canInitiateTransfer = !!activePayout &&
    ['APPROVED', 'FAILED', 'RECONCILIATION_REVIEW'].includes(activePayout.status);
  const canRefreshProvider = !!activePayout?.providerTransferCode;
  const needsOtp = providerStatus === 'OTP';

  const loadDetail = async (payoutId: string) => {
    setDetailLoading(true);
    try {
      const response = await adminPayoutsApi.getById(payoutId);
      const nextDetail = unwrapApiResponse<AdminPayoutDetail>(response.data as any);
      setDetail(nextDetail);
      return nextDetail;
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to load payout details');
      return null;
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    if (!open || !payout?.id) {
      setDetail(null);
      setReason('');
      setOtp('');
      setConfirmAction(null);
      setLoading(false);
      return;
    }

    const run = async () => {
      setDetailLoading(true);
      try {
        const response = await adminPayoutsApi.getById(payout.id);
        if (cancelled) return;
        setDetail(unwrapApiResponse<AdminPayoutDetail>(response.data as any));
      } catch (error: any) {
        if (cancelled) return;
        toast.error(error?.response?.data?.message || 'Unable to load payout details');
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [open, payout?.id]);

  if (!payout || !activePayout) return null;

  const syncUpdatedPayout = (payload: unknown) => {
    const updated = unwrapApiResponse<AdminPayout>(payload as any);
    onUpdated(updated);
    setDetail((prev) => (prev ? { ...prev, ...updated } : prev));
    return updated;
  };

  const runMutation = async (
    action: () => Promise<any>,
    successMessage: string,
    fallbackMessage: string,
  ) => {
    setLoading(true);
    try {
      const response = await action();
      const updated = syncUpdatedPayout(response.data);
      toast.success(successMessage);
      if (updated?.id) {
        void loadDetail(updated.id);
      }
      return updated;
    } catch (err: any) {
      toast.error(err?.response?.data?.message || fallbackMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (newStatus: string) => {
    setConfirmAction({
      kind: 'status',
      title: `Mark payout as ${newStatus}?`,
      message: `Payout of ${activePayout.amount} ${activePayout.currency} for ${
        activePayout.brand?.name ?? activePayout.brandId
      } will be set to ${newStatus}.`,
      isDestructive: newStatus === 'FAILED' || newStatus === 'REJECTED',
      newStatus,
    });
  };

  const executeConfirm = async () => {
    if (!confirmAction) return;

    if (confirmAction.kind === 'status') {
      await runMutation(
        () =>
          adminPayoutsApi.updateStatus(
            activePayout.id,
            confirmAction.newStatus,
            reason.trim() || undefined,
          ),
        `Payout marked as ${confirmAction.newStatus}`,
        'Failed to update payout',
      );
    } else if (confirmAction.kind === 'claim') {
      await runMutation(
        () => adminPayoutsApi.claim(activePayout.id),
        'Payout claimed',
        'Failed to claim payout',
      );
    } else if (confirmAction.kind === 'release') {
      await runMutation(
        () => adminPayoutsApi.release(activePayout.id, reason.trim() || undefined),
        'Payout released',
        'Failed to release payout',
      );
    } else if (confirmAction.kind === 'initiate') {
      await runMutation(
        () => adminPayoutsApi.initiateTransfer(activePayout.id),
        'Paystack transfer initiated',
        'Failed to initiate Paystack transfer',
      );
    }

    setReason('');
    setConfirmAction(null);
  };

  const handleRefreshProvider = async () => {
    await runMutation(
      () => adminPayoutsApi.getProviderStatus(activePayout.id),
      'Provider status refreshed',
      'Failed to refresh provider status',
    );
  };

  const handleFinalizeOtp = async () => {
    const cleanOtp = otp.trim();
    if (!cleanOtp) {
      toast.error('Enter the Paystack OTP first');
      return;
    }

    const updated = await runMutation(
      () => adminPayoutsApi.finalizeTransferOtp(activePayout.id, cleanOtp),
      'Transfer finalization submitted',
      'Failed to finalize transfer',
    );

    if (updated) {
      setOtp('');
    }
  };

  const ownerLabel = activePayout.assignedAdmin
    ? `${activePayout.assignedAdmin.firstName} ${activePayout.assignedAdmin.lastName}`.trim()
    : 'Unclaimed';
  const latestNote =
    activePayout.providerTransferFailureMessage ||
    activePayout.failureReason ||
    activePayout.statusReason ||
    null;
  const payoutAccount = detail?.payoutAccount ?? null;

  return (
    <>
      <Modal open={open} onClose={onClose} title="💰 Payout Details" size="md">
        <div className="max-h-[80vh] space-y-6 overflow-y-auto pr-1">
          {detailLoading ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
              Loading payout detail…
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Brand</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {activePayout.brand?.name ?? activePayout.brandId}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Status</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {STATUS_EMOJI[activePayout.status] ?? '⚪'} {activePayout.status}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Amount</span>
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                {activePayout.amount} {activePayout.currency}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Owner</span>
              <p className="text-gray-600 dark:text-gray-300">{ownerLabel}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Reference</span>
              <p className="text-gray-600 dark:text-gray-300">
                {activePayout.reference || '—'}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Created</span>
              <p className="text-gray-600 dark:text-gray-300">
                {formatDateTime(activePayout.createdAt)}
              </p>
            </div>
            {latestNote ? (
              <div className="md:col-span-2">
                <span className="text-gray-500 dark:text-gray-400">Latest note</span>
                <p className="mt-1 text-gray-700 dark:text-gray-300">{latestNote}</p>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-white/10 dark:bg-white/5">
            <h3 className="font-semibold text-gray-900 dark:text-white">🏦 Brand payout account</h3>
            {payoutAccount ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Readiness</span>
                  <p className="text-gray-800 dark:text-gray-200">
                    {STATUS_EMOJI[payoutAccount.status] ?? '🧾'} {payoutAccount.status}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Current bank</span>
                  <p className="text-gray-800 dark:text-gray-200">
                    {payoutAccount.bankName && payoutAccount.maskedAccountNumber
                      ? `${payoutAccount.bankName} • ${payoutAccount.maskedAccountNumber}`
                      : 'Not configured'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Recipient code</span>
                  <p className="break-all text-gray-800 dark:text-gray-200">
                    {payoutAccount.transferRecipientCode || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Recipient active</span>
                  <p className="text-gray-800 dark:text-gray-200">
                    {payoutAccount.transferRecipientActive ? 'Yes' : 'No'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Recipient synced</span>
                  <p className="text-gray-800 dark:text-gray-200">
                    {formatDateTime(payoutAccount.transferRecipientLastSyncAt)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Subaccount synced</span>
                  <p className="text-gray-800 dark:text-gray-200">
                    {formatDateTime(payoutAccount.subaccountLastSyncAt)}
                  </p>
                </div>
                {payoutAccount.lastSyncError ? (
                  <div className="md:col-span-2">
                    <span className="text-gray-500 dark:text-gray-400">Latest sync error</span>
                    <p className="text-rose-700 dark:text-rose-300">
                      {payoutAccount.lastSyncError}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-gray-600 dark:text-gray-300">
                No brand payout account record is linked to this payout yet.
              </p>
            )}
          </div>

          {(activePayout.providerTransferCode ||
            activePayout.providerTransferReference ||
            activePayout.providerRecipientCode ||
            activePayout.providerTransferStatus) && (
            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-white/10 dark:bg-white/5">
              <h3 className="font-semibold text-gray-900 dark:text-white">🔁 Paystack transfer</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Provider</span>
                  <p className="text-gray-800 dark:text-gray-200">
                    {activePayout.provider || 'PAYSTACK'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Transfer status</span>
                  <p className="text-gray-800 dark:text-gray-200">
                    {activePayout.providerTransferStatus || 'Not started'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Transfer code</span>
                  <p className="break-all text-gray-800 dark:text-gray-200">
                    {activePayout.providerTransferCode || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Recipient code</span>
                  <p className="break-all text-gray-800 dark:text-gray-200">
                    {activePayout.providerRecipientCode || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Transfer reference</span>
                  <p className="break-all text-gray-800 dark:text-gray-200">
                    {activePayout.providerTransferReference || activePayout.gatewayReference || '—'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Initiated</span>
                  <p className="text-gray-800 dark:text-gray-200">
                    {formatDateTime(activePayout.providerTransferInitiatedAt)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Finalized</span>
                  <p className="text-gray-800 dark:text-gray-200">
                    {formatDateTime(activePayout.providerTransferFinalizedAt)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Reversed</span>
                  <p className="text-gray-800 dark:text-gray-200">
                    {formatDateTime(activePayout.providerTransferReversedAt)}
                  </p>
                </div>
                {activePayout.providerTransferFailureMessage ? (
                  <div className="md:col-span-2">
                    <span className="text-gray-500 dark:text-gray-400">Provider failure</span>
                    <p className="text-gray-800 dark:text-gray-200">
                      {activePayout.providerTransferFailureMessage}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <PayoutSourceBreakdown
            breakdown={detail?.sourceBreakdown}
            emptyMessage="No source rows were recorded for this payout yet."
          />

          {detail?.events?.length ? (
            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-white/10 dark:bg-white/5">
              <h3 className="font-semibold text-gray-900 dark:text-white">🧾 Event timeline</h3>
              <div className="space-y-3">
                {detail.events.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-black/20"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {event.type}
                        </div>
                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Source: {event.source}
                          {event.providerEventType ? ` • Provider event: ${event.providerEventType}` : ''}
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                        <div>{formatDateTime(event.createdAt)}</div>
                        {event.processedAt ? (
                          <div>Processed: {formatDateTime(event.processedAt)}</div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {hasPermission('PAYOUTS_PROCESS') && (
            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Ownership
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() =>
                    setConfirmAction({
                      kind: 'claim',
                      title: 'Claim payout?',
                      message: 'You will become the active owner of this payout.',
                    })
                  }
                  className="rounded-lg bg-blue-100 px-3 py-1.5 text-xs text-blue-800 transition hover:bg-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
                >
                  Claim
                </button>
                <button
                  onClick={() =>
                    setConfirmAction({
                      kind: 'release',
                      title: 'Release payout?',
                      message: 'The payout will become available for another admin to claim.',
                    })
                  }
                  className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs text-gray-800 transition hover:bg-gray-300 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/15"
                >
                  Release
                </button>
              </div>
            </div>
          )}

          {hasPermission('PAYOUTS_PROCESS') && (
            <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Transfer actions
              </h3>
              <div className="flex flex-wrap gap-2">
                {canInitiateTransfer ? (
                  <button
                    onClick={() =>
                      setConfirmAction({
                        kind: 'initiate',
                        title: 'Initiate Paystack transfer?',
                        message:
                          'This will send the payout to the brand transfer recipient saved in the active payout account.',
                      })
                    }
                    className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs text-emerald-800 transition hover:bg-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
                  >
                    🚀 Initiate transfer
                  </button>
                ) : null}
                {canRefreshProvider ? (
                  <button
                    onClick={handleRefreshProvider}
                    disabled={loading}
                    className="rounded-lg bg-white px-3 py-1.5 text-xs text-gray-800 transition hover:bg-gray-100 disabled:opacity-60 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/15"
                  >
                    🔄 Refresh provider status
                  </button>
                ) : null}
              </div>

              {needsOtp ? (
                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
                  <p className="text-xs text-amber-900 dark:text-amber-200">
                    Paystack is requesting an OTP to finalize this transfer.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={otp}
                      onChange={(event) => setOtp(event.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                      placeholder="Enter Paystack OTP"
                    />
                    <button
                      onClick={handleFinalizeOtp}
                      disabled={loading}
                      className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-medium text-white transition hover:bg-amber-600 disabled:opacity-60"
                    >
                      🔐 Submit OTP
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {hasPermission('PAYOUTS_PROCESS') && transitions.length > 0 ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Manual status actions
              </h3>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="Reason or internal note when needed..."
              />
              <div className="flex flex-wrap gap-2">
                {transitions.map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    className="rounded-lg bg-white px-3 py-1.5 text-xs text-gray-800 transition hover:bg-gray-100 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/15"
                  >
                    {STATUS_EMOJI[status] ?? '⚪'} Mark as {status}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title}
        message={confirmAction?.message}
        isDestructive={confirmAction?.isDestructive}
        isLoading={loading}
        onConfirm={executeConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
};

export default PayoutProcessModal;
