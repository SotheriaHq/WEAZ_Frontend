import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { adminPayoutsApi } from '@/api/AdminApi';
import type { AdminPayout } from '@/types/admin';
import { toast } from 'sonner';

interface Props {
  payout: AdminPayout | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

const STATUS_EMOJI: Record<string, string> = {
  PENDING: '🟡',
  PROCESSING: '🔵',
  PAID: '🟢',
  FAILED: '🔴',
};

const TRANSITIONS: Record<string, string[]> = {
  PENDING: ['PROCESSING'],
  PROCESSING: ['PAID', 'FAILED'],
  PAID: [],
  FAILED: [],
};

const PayoutProcessModal: React.FC<Props> = ({ payout, open, onClose, onUpdated }) => {
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    isDestructive: boolean;
    newStatus: string;
  } | null>(null);

  if (!payout) return null;

  const transitions = TRANSITIONS[payout.status] ?? [];

  const handleStatusChange = (newStatus: string) => {
    setConfirmAction({
      title: `Mark payout as ${newStatus}?`,
      message: `Payout of ${payout.amount} ${payout.currency} for ${payout.brand?.name ?? payout.brandId} will be set to ${newStatus}.`,
      isDestructive: newStatus === 'FAILED',
      newStatus,
    });
  };

  const executeConfirm = async () => {
    if (!confirmAction) return;
    setLoading(true);
    try {
      await adminPayoutsApi.updateStatus(payout.id, confirmAction.newStatus);
      toast.success(`Payout marked as ${confirmAction.newStatus}`);
      onUpdated();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update payout');
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  };

  return (
    <>pro
      <Modal open={open} onClose={onClose} title="💰 Payout Details" size="md">
        <div className="space-y-6">
          {/* Payout Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Brand</span>
              <p className="font-medium text-gray-900 dark:text-white">{payout.brand?.name ?? payout.brandId}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Status</span>
              <p className="font-medium">{STATUS_EMOJI[payout.status] ?? '⚪'} {payout.status}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Amount</span>
              <p className="font-medium text-gray-900 dark:text-white text-lg">{payout.amount} {payout.currency}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Reference</span>
              <p className="text-gray-600 dark:text-gray-300">{payout.reference || '—'}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Created</span>
              <p className="text-gray-600 dark:text-gray-300">{new Date(payout.createdAt).toLocaleString()}</p>
            </div>
          </div>

          {/* Actions */}
          {transitions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Process Payout</h3>
              <div className="flex flex-wrap gap-2">
                {transitions.map((status) => (
                  <button key={status} onClick={() => handleStatusChange(status)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition ${
                      status === 'FAILED'
                        ? 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/20'
                        : status === 'PAID'
                          ? 'bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-500/20'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-500/20'
                    }`}>
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
