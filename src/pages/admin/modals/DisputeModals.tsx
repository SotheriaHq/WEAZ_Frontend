import React, { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { adminDisputesApi } from '@/api/AdminApi';
import type { AdminDispute } from '@/types/admin';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { toast } from 'sonner';

/* ── Create Dispute Modal ── */
interface CreateProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export const CreateDisputeModal: React.FC<CreateProps> = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState({
    type: 'GENERAL' as AdminDispute['type'],
    reporterId: '',
    targetType: '',
    targetId: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);

  const set = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.reporterId || !form.description) {
      toast.error('Reporter ID and description are required');
      return;
    }
    setLoading(true);
    try {
      await adminDisputesApi.create(form);
      toast.success('Dispute created');
      setForm({ type: 'GENERAL', reporterId: '', targetType: '', targetId: '', description: '' });
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create dispute');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="➕ Create Dispute" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
          <select value={form.type} onChange={(e) => set('type', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
            <option value="ORDER">Order</option>
            <option value="PRODUCT">Product</option>
            <option value="SIZING">Sizing</option>
            <option value="GENERAL">General</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reporter User ID</label>
          <input type="text" value={form.reporterId} onChange={(e) => set('reporterId', e.target.value)} required
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            placeholder="User ID of the reporter" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Type</label>
            <input type="text" value={form.targetType} onChange={(e) => set('targetType', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              placeholder="e.g. ORDER, PRODUCT" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target ID</label>
            <input type="text" value={form.targetId} onChange={(e) => set('targetId', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              placeholder="ID of the target entity" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
          <textarea value={form.description} onChange={(e) => set('description', e.target.value)} required rows={4}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            placeholder="Describe the issue..." />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={loading}
            className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition">
            {loading ? 'Creating...' : 'Create Dispute'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

/* ── Dispute Detail / Manage Modal ── */
interface DetailProps {
  dispute: AdminDispute | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

const STATUS_EMOJI: Record<string, string> = {
  OPEN: '🟡',
  IN_PROGRESS: '🔵',
  RESOLVED: '🟢',
  CLOSED: '⚪',
};

const TRANSITIONS: Record<string, string[]> = {
  OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

export const DisputeDetailModal: React.FC<DetailProps> = ({ dispute, open, onClose, onUpdated }) => {
  const { hasPermission } = useAdminPermissions();
  const [newStatus, setNewStatus] = useState('');
  const [resolution, setResolution] = useState('');
  const [notes, setNotes] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReopen, setShowReopen] = useState(false);

  if (!dispute) return null;

  const transitions = TRANSITIONS[dispute.status] ?? [];

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
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update dispute');
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
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to reopen dispute');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`⚖️ Dispute — ${dispute.type}`} size="lg">
      <div className="space-y-6">
        {/* Detail Grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Status</span>
            <p className="font-medium">{STATUS_EMOJI[dispute.status] ?? '⚪'} {dispute.status}</p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Type</span>
            <p className="font-medium text-gray-900 dark:text-white">{dispute.type}</p>
          </div>
          <div className="col-span-2">
            <span className="text-gray-500 dark:text-gray-400">Description</span>
            <p className="text-gray-700 dark:text-gray-300 mt-1">{dispute.description}</p>
          </div>
          {dispute.resolution && (
            <div className="col-span-2">
              <span className="text-gray-500 dark:text-gray-400">Resolution</span>
              <p className="text-gray-700 dark:text-gray-300 mt-1">{dispute.resolution}</p>
            </div>
          )}
          {dispute.adminNotes && (
            <div className="col-span-2">
              <span className="text-gray-500 dark:text-gray-400">Admin Notes</span>
              <p className="text-gray-700 dark:text-gray-300 mt-1">{dispute.adminNotes}</p>
            </div>
          )}
          <div>
            <span className="text-gray-500 dark:text-gray-400">Created</span>
            <p className="text-gray-600 dark:text-gray-300">{new Date(dispute.createdAt).toLocaleString()}</p>
          </div>
        </div>

        {/* Status Update Section */}
        {hasPermission('DISPUTES_RESOLVE') && transitions.length > 0 && (
          <div className="space-y-3 p-4 rounded-lg bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Update Status</h3>
            <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm">
              <option value="">Select status...</option>
              {transitions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {(newStatus === 'RESOLVED' || newStatus === 'CLOSED') && (
              <textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={2}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
                placeholder="Resolution details..." />
            )}
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              placeholder="Admin notes (optional)..." />
            <button onClick={handleUpdate} disabled={loading || !newStatus}
              className="px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition">
              {loading ? 'Updating...' : 'Update Dispute'}
            </button>
          </div>
        )}

        {/* Reopen Section */}
        {hasPermission('DISPUTES_RESOLVE') && dispute.status === 'CLOSED' && (
          <div className="space-y-3">
            {!showReopen ? (
              <button onClick={() => setShowReopen(true)}
                className="px-3 py-1.5 text-xs rounded-lg bg-yellow-100 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-500/20 transition">
                🔄 Reopen Dispute
              </button>
            ) : (
              <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-500/5 border border-yellow-200 dark:border-yellow-500/20 space-y-2">
                <textarea value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-yellow-200 dark:border-yellow-700 bg-white dark:bg-gray-900 text-sm"
                  placeholder="Reason for reopening (required)..." />
                <div className="flex gap-2">
                  <button onClick={handleReopen} disabled={loading || !reopenReason.trim()}
                    className="px-3 py-1.5 text-xs rounded-lg bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-50 transition">
                    {loading ? 'Reopening...' : 'Confirm Reopen'}
                  </button>
                  <button onClick={() => { setShowReopen(false); setReopenReason(''); }}
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">
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
