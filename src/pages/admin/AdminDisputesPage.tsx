import React, { useCallback, useMemo, useState } from 'react';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { adminDisputesApi } from '@/api/AdminApi';
import type { AdminDispute } from '@/types/admin';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { unwrapApiResponse } from '@/types/auth';
import { CreateDisputeModal, DisputeDetailModal } from './modals/DisputeModals';

const STATUS_EMOJI: Record<string, string> = {
  OPEN: '🟡',
  ASSIGNED: '📌',
  IN_PROGRESS: '🔵',
  RESOLVED: '🟢',
  CLOSED: '⚪',
  REOPENED: '🟠',
};

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'REOPENED', label: 'Reopened' },
];

function formatAssigned(dispute: AdminDispute) {
  if (!dispute.assignedTo) return 'Unclaimed';
  return `${dispute.assignedTo.firstName} ${dispute.assignedTo.lastName}`.trim();
}

const AdminDisputesPage: React.FC = () => {
  const { hasPermission } = useAdminPermissions();
  const [selectedDispute, setSelectedDispute] = useState<AdminDispute | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchPage = useCallback(
    async (cursor?: string, limit?: number) => {
      const params: Record<string, string> = {};
      if (cursor) params.cursor = cursor;
      if (limit) params.limit = String(limit);
      if (statusFilter) params.status = statusFilter;
      const res = await adminDisputesApi.list(params);
      const data = unwrapApiResponse<
        { items?: AdminDispute[]; nextCursor?: string } | AdminDispute[]
      >(res.data as any);
      if (Array.isArray(data)) return { items: data };
      return { items: data.items ?? [], nextCursor: data.nextCursor };
    },
    [statusFilter],
  );

  const {
    items: disputes,
    isLoading: loading,
    isLoadingMore,
    hasMore,
    error,
    sentinelRef,
    reset,
  } = useInfiniteScroll<AdminDispute>(fetchPage, { limit: 30 });

  const statusOptions = useMemo(() => STATUS_OPTIONS, []);

  return (
    <div className="space-y-6">
      <AdminBreadcrumb segments={[{ label: 'Disputes' }]} />
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">⚖️ Disputes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Dispute actions stay inside the detail modal. One admin owns a dispute at a time.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row md:items-end">
          <div className="w-full md:w-64">
            <UniversalSelect
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
              placeholder="Filter by status"
            />
          </div>
          {hasPermission('DISPUTES_RESOLVE') && (
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white transition hover:bg-primary/90"
            >
              Create dispute
            </button>
          )}
        </div>
      </div>

      {error && <div className="text-red-500 text-sm">{error}</div>}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-gray-700 dark:text-gray-400">
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Type</th>
                <th className="px-3 py-3">Owner</th>
                <th className="px-3 py-3">Description</th>
                <th className="px-3 py-3">Created</th>
                {hasPermission('DISPUTES_RESOLVE') && <th className="px-3 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {disputes.map((dispute) => (
                <tr
                  key={dispute.id}
                  className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900/50"
                >
                  <td className="px-3 py-2.5">
                    {STATUS_EMOJI[dispute.status] ?? '⚪'} {dispute.status}
                  </td>
                  <td className="px-3 py-2.5">{dispute.type}</td>
                  <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">
                    {formatAssigned(dispute)}
                  </td>
                  <td className="max-w-xs truncate px-3 py-2.5 text-gray-600 dark:text-gray-400">
                    {dispute.description}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">
                    {new Date(dispute.createdAt).toLocaleDateString()}
                  </td>
                  {hasPermission('DISPUTES_RESOLVE') && (
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => setSelectedDispute(dispute)}
                        className="text-primary hover:underline text-xs"
                      >
                        Manage
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {disputes.length === 0 && (
                <tr>
                  <td
                    colSpan={hasPermission('DISPUTES_RESOLVE') ? 6 : 5}
                    className="py-8 text-center text-gray-500"
                  >
                    No disputes found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {isLoadingMore && (
            <div className="text-center text-gray-500 text-sm py-4">Loading more...</div>
          )}
          {hasMore && <div ref={sentinelRef} />}
          {!hasMore && disputes.length > 0 && (
            <div className="text-center text-gray-400 text-xs py-4">End of list</div>
          )}
        </div>
      )}

      <CreateDisputeModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          reset();
        }}
      />
      <DisputeDetailModal
        dispute={selectedDispute}
        open={!!selectedDispute}
        onClose={() => setSelectedDispute(null)}
        onUpdated={() => {
          setSelectedDispute(null);
          reset();
        }}
      />
    </div>
  );
};

export default AdminDisputesPage;
