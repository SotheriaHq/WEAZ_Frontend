import React, { useCallback, useMemo, useState } from 'react';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { adminPayoutsApi } from '@/api/AdminApi';
import type { AdminPayout } from '@/types/admin';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { unwrapApiResponse } from '@/types/auth';
import PayoutProcessModal from './modals/PayoutProcessModal';

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

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING_APPROVAL', label: 'Pending approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'PAID', label: 'Paid' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ON_HOLD', label: 'On hold' },
  { value: 'RECONCILIATION_REVIEW', label: 'Reconciliation review' },
];

function formatOwner(payout: AdminPayout) {
  if (!payout.assignedAdmin) return 'Unclaimed';
  return `${payout.assignedAdmin.firstName} ${payout.assignedAdmin.lastName}`.trim();
}

const AdminPayoutsPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedPayout, setSelectedPayout] = useState<AdminPayout | null>(null);
  const { hasPermission } = useAdminPermissions();

  const fetchPage = useCallback(
    async (cursor?: string, take?: number) => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (cursor) params.cursor = cursor;
      if (take) params.take = String(take);
      const res = await adminPayoutsApi.list(params);
      const data = unwrapApiResponse<
        { items?: AdminPayout[]; nextCursor?: string } | AdminPayout[]
      >(res.data as any);
      if (Array.isArray(data)) return { items: data };
      return { items: data.items ?? [], nextCursor: data.nextCursor };
    },
    [statusFilter],
  );

  const {
    items: payouts,
    isLoading: loading,
    isLoadingMore,
    hasMore,
    error,
    sentinelRef,
    reset,
  } = useInfiniteScroll<AdminPayout>(fetchPage, { limit: 30 });

  const canProcess = hasPermission('PAYOUTS_PROCESS');
  const statusOptions = useMemo(() => STATUS_OPTIONS, []);

  return (
    <div className="space-y-6">
      <AdminBreadcrumb segments={[{ label: 'Payouts' }]} />
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">💰 Payouts</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Only one admin can actively work a payout at a time.
          </p>
        </div>

        <div className="w-full md:w-72">
          <UniversalSelect
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions}
            placeholder="Filter by status"
          />
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
                <th className="px-3 py-3">Brand</th>
                <th className="px-3 py-3">Amount</th>
                <th className="px-3 py-3">Transfer</th>
                <th className="px-3 py-3">Owner</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout) => (
                <tr
                  key={payout.id}
                  className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900/50"
                >
                  <td className="px-3 py-2.5">
                    {STATUS_EMOJI[payout.status] ?? '⚪'} {payout.status}
                  </td>
                  <td className="px-3 py-2.5 font-medium">
                    {payout.brand?.name ?? payout.brandId}
                  </td>
                  <td className="px-3 py-2.5">
                    {payout.amount} {payout.currency}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">
                    {payout.providerTransferStatus || 'Not started'}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400">
                    {formatOwner(payout)}
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">
                    {new Date(payout.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => setSelectedPayout(payout)}
                      className="text-primary hover:underline text-xs"
                    >
                      {canProcess ? 'Manage' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
              {payouts.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    No payouts found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {isLoadingMore && (
            <div className="text-center text-gray-500 text-sm py-4">Loading more...</div>
          )}
          {hasMore && <div ref={sentinelRef} />}
          {!hasMore && payouts.length > 0 && (
            <div className="text-center text-gray-400 text-xs py-4">End of list</div>
          )}
        </div>
      )}

      <PayoutProcessModal
        payout={selectedPayout}
        open={!!selectedPayout}
        onClose={() => setSelectedPayout(null)}
        onUpdated={(updatedPayout) => {
          setSelectedPayout(updatedPayout ?? null);
          reset();
        }}
      />
    </div>
  );
};

export default AdminPayoutsPage;
