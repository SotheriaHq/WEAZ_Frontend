import React, { useState, useCallback } from 'react';
import { adminPayoutsApi } from '@/api/AdminApi';
import type { AdminPayout } from '@/types/admin';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { unwrapApiResponse } from '@/types/auth';
import PayoutProcessModal from './modals/PayoutProcessModal';

const STATUS_EMOJI: Record<string, string> = {
  PENDING: '🟡',
  PROCESSING: '🔵',
  PAID: '🟢',
  FAILED: '🔴',
};

const AdminPayoutsPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedPayout, setSelectedPayout] = useState<AdminPayout | null>(null);
  const { hasPermission } = useAdminPermissions();

  const fetchPage = useCallback(
    async (cursor?: string, limit?: number) => {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      if (cursor) params.cursor = cursor;
      if (limit) params.limit = String(limit);
      const res = await adminPayoutsApi.list(params);
      const data = unwrapApiResponse<{ items?: AdminPayout[]; nextCursor?: string } | AdminPayout[]>(
        res.data as any,
      );
      if (Array.isArray(data)) return { items: data };
      return { items: data.items ?? [], nextCursor: data.nextCursor };
    },
    [statusFilter],
  );

  const { items: payouts, isLoading: loading, isLoadingMore, hasMore, error, sentinelRef } =
    useInfiniteScroll<AdminPayout>(fetchPage, { limit: 30 });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">💰 Payouts</h1>

      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
      >
        <option value="">All statuses</option>
        <option value="PENDING">Pending</option>
        <option value="PROCESSING">Processing</option>
        <option value="PAID">Paid</option>
        <option value="FAILED">Failed</option>
      </select>

      {error && <div className="text-red-500 text-sm">{error}</div>}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Brand</th>
                <th className="py-3 px-3">Amount</th>
                <th className="py-3 px-3">Currency</th>
                <th className="py-3 px-3">Date</th>
                {hasPermission('PAYOUTS_PROCESS') && <th className="py-3 px-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout) => (
                <tr key={payout.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="py-2.5 px-3">{STATUS_EMOJI[payout.status] ?? '⚪'} {payout.status}</td>
                  <td className="py-2.5 px-3 font-medium">{payout.brand?.name ?? payout.brandId}</td>
                  <td className="py-2.5 px-3">{payout.amount}</td>
                  <td className="py-2.5 px-3">{payout.currency}</td>
                  <td className="py-2.5 px-3 text-gray-500">{new Date(payout.createdAt).toLocaleDateString()}</td>
                  {hasPermission('PAYOUTS_PROCESS') && (
                    <td className="py-2.5 px-3">
                      <button onClick={() => setSelectedPayout(payout)} className="text-primary hover:underline text-xs">Process</button>
                    </td>
                  )}
                </tr>
              ))}
              {payouts.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">No payouts found</td>
                </tr>
              )}
            </tbody>
          </table>
          {isLoadingMore && <div className="text-center text-gray-500 text-sm py-4">Loading more...</div>}
          {hasMore && <div ref={sentinelRef} />}
          {!hasMore && payouts.length > 0 && <div className="text-center text-gray-400 text-xs py-4">End of list</div>}
        </div>
      )}

      <PayoutProcessModal
        payout={selectedPayout}
        open={!!selectedPayout}
        onClose={() => setSelectedPayout(null)}
        onUpdated={() => {}}
      />
    </div>
  );
};

export default AdminPayoutsPage;
