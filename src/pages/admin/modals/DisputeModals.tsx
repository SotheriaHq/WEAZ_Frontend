import React, { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { adminDisputesApi } from '@/api/AdminApi';
import type { AdminDispute } from '@/types/admin';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { toast } from 'sonner';

interface CreateProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const DISPUTE_TYPE_OPTIONS = [
  { value: 'ORDER', label: 'Order' },
  { value: 'PRODUCT', label: 'Product' },
  { value: 'SIZING', label: 'Sizing' },
  { value: 'GENERAL', label: 'General' },
];

export const CreateDisputeModal: React.FC<CreateProps> = ({
  open,
  onClose,
  onCreated,
}) => {
  const [form, setForm] = useState({
    type: 'GENERAL' as AdminDispute['type'],
    reporterId: '',
    targetType: '',
    targetId: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.reporterId || !form.description) {
      toast.error('Reporter ID and description are required');
      return;
    }

    setLoading(true);
    try {
      await adminDisputesApi.create(form);
      toast.success('Dispute created');
      setForm({
        type: 'GENERAL',
        reporterId: '',
        targetType: '',
        targetId: '',
        description: '',
      });
      onCreated();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create dispute');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Dispute" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <UniversalSelect
          label="Type"
          value={form.type}
          onChange={(value) => set('type', value)}
          options={DISPUTE_TYPE_OPTIONS}
          placeholder="Select dispute type"
        />

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Reporter User ID
          </label>
          <input
            type="text"
            value={form.reporterId}
            onChange={(event) => set('reporterId', event.target.value)}
            required
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            placeholder="User ID of the reporter"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Target Type
            </label>
            <input
              type="text"
              value={form.targetType}
              onChange={(event) => set('targetType', event.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="e.g. ORDER"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Target ID
            </label>
            <input
              type="text"
              value={form.targetId}
              onChange={(event) => set('targetId', event.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="ID of the target entity"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
            required
            rows={4}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            placeholder="Describe the issue..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create dispute'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

interface DetailProps {
  dispute: AdminDispute | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

const STATUS_EMOJI: Record<string, string> = {
  OPEN: '🟡',
  ASSIGNED: '📌',
  IN_PROGRESS: '🔵',
  RESOLVED: '🟢',
  CLOSED: '⚪',
  REOPENED: '🟠',
};

const TRANSITIONS: Record<string, string[]> = {
  OPEN: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  ASSIGNED: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
  REOPENED: ['ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'],
};

export const DisputeDetailModal: React.FC<DetailProps> = ({
  dispute,
  open,
  onClose,
  onUpdated,
}) => {
  const { hasPermission } = useAdminPermissions();
  const [newStatus, setNewStatus] = useState('');
  const [resolution, setResolution] = useState('');
  const [notes, setNotes] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [releaseReason, setReleaseReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReopen, setShowReopen] = useState(false);

  const statusOptions = useMemo(
    () =>
      (dispute ? TRANSITIONS[dispute.status] ?? [] : []).map((status) => ({
        value: status,
        label: status.replace(/_/g, ' '),
      })),
    [dispute],
  );

  useEffect(() => {
    if (!open) {
      setNewStatus('');
      setResolution('');
      setNotes('');
      setReopenReason('');
      setReleaseReason('');
      setLoading(false);
      setShowReopen(false);
    }
  }, [open, dispute?.id]);

  if (!dispute) return null;

  const handleUpdate = async () => {
    if (!newStatus) {
      toast.error('Select a new status');
      return;
    }
    setLoading(true);
    try {
      const data: Record<string, unknown> = { status: newStatus };
      if (resolution.trim()) data.resolution = resolution.trim();
      if (notes.trim()) data.adminNotes = notes.trim();
      await adminDisputesApi.update(dispute.id, data);
      toast.success(`Dispute updated to ${newStatus}`);
      onUpdated();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update dispute');
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    setLoading(true);
    try {
      await adminDisputesApi.claim(dispute.id);
      toast.success('Dispute claimed');
      onUpdated();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to claim dispute');
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async () => {
    setLoading(true);
    try {
      await adminDisputesApi.release(dispute.id, releaseReason.trim() || undefined);
      toast.success('Dispute released');
      onUpdated();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to release dispute');
    } finally {
      setLoading(false);
    }
  };

  const handleReopen = async () => {
    if (!reopenReason.trim()) {
      toast.error('Reopen reason is required');
      return;
    }
    setLoading(true);
    try {
      await adminDisputesApi.reopen(dispute.id, reopenReason.trim());
      toast.success('Dispute reopened');
      onUpdated();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to reopen dispute');
    } finally {
      setLoading(false);
    }
  };

  const ownerLabel = dispute.assignedTo
    ? `${dispute.assignedTo.firstName} ${dispute.assignedTo.lastName}`.trim()
    : 'Unclaimed';

  return (
    <Modal open={open} onClose={onClose} title={`⚖️ Dispute - ${dispute.type}`} size="lg">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Status</span>
            <p className="font-medium">
              {STATUS_EMOJI[dispute.status] ?? '⚪'} {dispute.status}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Owner</span>
            <p className="font-medium text-gray-900 dark:text-white">{ownerLabel}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Type</span>
            <p className="font-medium text-gray-900 dark:text-white">{dispute.type}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Created</span>
            <p className="text-gray-600 dark:text-gray-300">
              {new Date(dispute.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="md:col-span-2">
            <span className="text-gray-500 dark:text-gray-400">Description</span>
            <p className="mt-1 text-gray-700 dark:text-gray-300">{dispute.description}</p>
          </div>
          {dispute.resolution && (
            <div className="md:col-span-2">
              <span className="text-gray-500 dark:text-gray-400">Resolution</span>
              <p className="mt-1 text-gray-700 dark:text-gray-300">{dispute.resolution}</p>
            </div>
          )}
          {dispute.adminNotes && (
            <div className="md:col-span-2">
              <span className="text-gray-500 dark:text-gray-400">Admin Notes</span>
              <p className="mt-1 text-gray-700 dark:text-gray-300">{dispute.adminNotes}</p>
            </div>
          )}
        </div>

        {hasPermission('DISPUTES_RESOLVE') && (
          <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Ownership</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleClaim}
                disabled={loading}
                className="rounded-lg bg-blue-100 px-3 py-1.5 text-xs text-blue-800 transition hover:bg-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20 disabled:opacity-50"
              >
                Claim
              </button>
              <button
                onClick={handleRelease}
                disabled={loading}
                className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs text-gray-800 transition hover:bg-gray-300 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/15 disabled:opacity-50"
              >
                Release
              </button>
            </div>
            <textarea
              value={releaseReason}
              onChange={(event) => setReleaseReason(event.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="Release note if needed..."
            />
          </div>
        )}

        {hasPermission('DISPUTES_RESOLVE') && statusOptions.length > 0 && (
          <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-white/5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Actions</h3>
            <UniversalSelect
              value={newStatus}
              onChange={setNewStatus}
              options={statusOptions}
              placeholder="Select status"
            />
            {(newStatus === 'RESOLVED' || newStatus === 'CLOSED') && (
              <textarea
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                placeholder="Resolution details..."
              />
            )}
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              placeholder="Admin notes..."
            />
            <button
              onClick={handleUpdate}
              disabled={loading || !newStatus}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-white transition hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update dispute'}
            </button>
          </div>
        )}

        {hasPermission('DISPUTES_RESOLVE') &&
          (dispute.status === 'CLOSED' || dispute.status === 'RESOLVED') && (
            <div className="space-y-3">
              {!showReopen ? (
                <button
                  onClick={() => setShowReopen(true)}
                  className="rounded-lg bg-yellow-100 px-3 py-1.5 text-xs text-yellow-800 transition hover:bg-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-300 dark:hover:bg-yellow-500/20"
                >
                  Reopen dispute
                </button>
              ) : (
                <div className="space-y-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-500/20 dark:bg-yellow-500/5">
                  <textarea
                    value={reopenReason}
                    onChange={(event) => setReopenReason(event.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-yellow-200 bg-white px-3 py-2 text-sm dark:border-yellow-700 dark:bg-gray-900"
                    placeholder="Reason for reopening..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleReopen}
                      disabled={loading || !reopenReason.trim()}
                      className="rounded-lg bg-yellow-600 px-3 py-1.5 text-xs text-white transition hover:bg-yellow-700 disabled:opacity-50"
                    >
                      {loading ? 'Reopening...' : 'Confirm reopen'}
                    </button>
                    <button
                      onClick={() => {
                        setShowReopen(false);
                        setReopenReason('');
                      }}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
      </div>
    </Modal>
  );
};
