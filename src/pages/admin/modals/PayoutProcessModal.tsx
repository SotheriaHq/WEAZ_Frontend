import React, { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { adminPayoutsApi } from '@/api/AdminApi';
import type { AdminPayout } from '@/types/admin';
import { toast } from 'sonner';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';

interface Props {
  payout: AdminPayout | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

const STATUS_EMOJI: Record<string, string> = {
  PENDING_APPROVAL: '🟡',
  APPROVED: '🟦',
  PROCESSING: '🔵',
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

const PayoutProcessModal: React.FC<Props> = ({
  payout,
  open,
  onClose,
  onUpdated,
}) => {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmAction, setConfirmAction] = useState<{
    kind: 'status' | 'claim' | 'release';
    title: string;
    message: string;
    isDestructive?: boolean;
    newStatus?: string;
  } | null>(null);
  const { hasPermission } = useAdminPermissions();

  const transitions = useMemo(
    () => (payout ? TRANSITIONS[payout.status] ?? [] : []),
    [payout],
  );

  useEffect(() => {
    if (!open) {
      setReason('');
      setConfirmAction(null);
      setLoading(false);
    }
  }, [open, payout?.id]);

  if (!payout) return null;

  const handleStatusChange = (newStatus: string) => {
    setConfirmAction({
      kind: 'status',
      title: `Mark payout as ${newStatus}?`,
      message: `Payout of ${payout.amount} ${payout.currency} for ${
        payout.brand?.name ?? payout.brandId
      } will be set to ${newStatus}.`,
      isDestructive: newStatus === 'FAILED' || newStatus === 'REJECTED',
      newStatus,
    });
  };

  const executeConfirm = async () => {
    if (!confirmAction) return;
    setLoading(true);
    try {
      if (confirmAction.kind === 'status' && confirmAction.newStatus) {
        await adminPayoutsApi.updateStatus(
          payout.id,
          confirmAction.newStatus,
          reason.trim() || undefined,
        );
        toast.success(`Payout marked as ${confirmAction.newStatus}`);
      } else if (confirmAction.kind === 'claim') {
        await adminPayoutsApi.claim(payout.id);
        toast.success('Payout claimed');
      } else if (confirmAction.kind === 'release') {
        await adminPayoutsApi.release(payout.id, reason.trim() || undefined);
        toast.success('Payout released');
      }

      setReason('');
      setConfirmAction(null);
      onUpdated();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update payout');
    } finally {
      setLoading(false);
    }
  };

  const ownerLabel = payout.assignedAdmin
    ? `${payout.assignedAdmin.firstName} ${payout.assignedAdmin.lastName}`.trim()
    : 'Unclaimed';

  return (
    <>
      <Modal open={open} onClose={onClose} title="💰 Payout Details" size="md">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Brand</span>
              <p className="font-medium text-gray-900 dark:text-white">
                {payout.brand?.name ?? payout.brandId}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Status</span>
              <p className="font-medium">
                {STATUS_EMOJI[payout.status] ?? '⚪'} {payout.status}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Amount</span>
              <p className="font-medium text-gray-900 dark:text-white text-lg">
                {payout.amount} {payout.currency}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Owner</span>
              <p className="text-gray-600 dark:text-gray-300">{ownerLabel}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Reference</span>
              <p className="text-gray-600 dark:text-gray-300">
                {payout.reference || '—'}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Created</span>
              <p className="text-gray-600 dark:text-gray-300">
                {new Date(payout.createdAt).toLocaleString()}
              </p>
            </div>
            {(payout.statusReason || payout.failureReason) && (
              <div className="md:col-span-2">
                <span className="text-gray-500 dark:text-gray-400">Latest note</span>
                <p className="text-gray-700 dark:text-gray-300 mt-1">
                  {payout.failureReason || payout.statusReason}
                </p>
              </div>
            )}
          </div>

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

          {hasPermission('PAYOUTS_PROCESS') && transitions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Status Actions
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
                    {STATUS_EMOJI[status]} Mark as {status}
                  </button>
                ))}
              </div>
            </div>
          )}
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
