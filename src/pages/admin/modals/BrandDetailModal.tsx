import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { adminBrandsApi } from '@/api/AdminApi';
import type { AdminBrand } from '@/types/admin';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { toast } from 'sonner';

interface Props {
  brand: AdminBrand | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

const BrandDetailModal: React.FC<Props> = ({ brand, open, onClose, onUpdated }) => {
  const { hasPermission } = useAdminPermissions();
  const [loading, setLoading] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [showSuspendForm, setShowSuspendForm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    isDestructive: boolean;
    action: () => Promise<void>;
  } | null>(null);

  if (!brand) return null;

  const handleStoreToggle = () => {
    const newState = !brand.isStoreOpen;
    setConfirmAction({
      title: `${newState ? 'Open' : 'Close'} store for ${brand.name}?`,
      message: `The store will be ${newState ? 'visible to customers' : 'hidden from customers'}.`,
      isDestructive: !newState,
      action: async () => {
        await adminBrandsApi.overrideStoreOpen(brand.id, newState);
        toast.success(`Store ${newState ? 'opened' : 'closed'}`);
        onUpdated();
        onClose();
      },
    });
  };

  const handleSuspend = async () => {
    if (!suspendReason.trim()) {
      toast.error('Suspension reason is required');
      return;
    }
    setLoading(true);
    try {
      await adminBrandsApi.suspend(brand.id, suspendReason.trim());
      toast.success('Brand suspended');
      setSuspendReason('');
      setShowSuspendForm(false);
      onUpdated();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to suspend brand');
    } finally {
      setLoading(false);
    }
  };

  const executeConfirm = async () => {
    if (!confirmAction) return;
    setLoading(true);
    try {
      await confirmAction.action();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Action failed');
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title={`🏷️ ${brand.name || 'Unnamed Brand'}`} size="md">
        <div className="space-y-6">
          {/* Brand Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">Brand Name</span>
              <p className="font-medium text-gray-900 dark:text-white">{brand.name || '—'}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Owner Email</span>
              <p className="font-medium text-gray-900 dark:text-white">{brand.owner?.email ?? '—'}</p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Owner Name</span>
              <p className="text-gray-600 dark:text-gray-300">
                {brand.owner ? `${brand.owner.firstName} ${brand.owner.lastName}` : '—'}
              </p>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Store Status</span>
              <p className="font-medium">{brand.isStoreOpen ? '🟢 Open' : '🔴 Closed'}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Actions</h3>
            <div className="flex flex-wrap gap-2">
              {hasPermission('BRANDS_STORE_OVERRIDE') && (
                <button onClick={handleStoreToggle}
                  className="px-3 py-1.5 text-xs rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-500/20 transition">
                  {brand.isStoreOpen ? '🔴 Force Close Store' : '🟢 Force Open Store'}
                </button>
              )}
              {hasPermission('BRANDS_SUSPEND') && (
                <button onClick={() => setShowSuspendForm(!showSuspendForm)}
                  className="px-3 py-1.5 text-xs rounded-lg bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-500/20 transition">
                  🚫 Suspend Brand
                </button>
              )}
            </div>

            {showSuspendForm && (
              <div className="space-y-2 p-3 rounded-lg bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20">
                <label className="block text-sm font-medium text-red-800 dark:text-red-300">Suspension Reason</label>
                <textarea
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-red-200 dark:border-red-700 bg-white dark:bg-gray-900 text-sm"
                  placeholder="Reason for suspension (required)..."
                />
                <div className="flex gap-2">
                  <button onClick={handleSuspend} disabled={loading || !suspendReason.trim()}
                    className="px-3 py-1.5 text-xs rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition">
                    {loading ? 'Suspending...' : 'Confirm Suspend'}
                  </button>
                  <button onClick={() => { setShowSuspendForm(false); setSuspendReason(''); }}
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
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

export default BrandDetailModal;
