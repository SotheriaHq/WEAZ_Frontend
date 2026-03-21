import React, { useCallback, useState } from 'react';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import { adminDisputesApi } from '@/api/AdminApi';
import type { AdminDispute } from '@/types/admin';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { unwrapApiResponse } from '@/types/auth';
import { CreateDisputeModal, DisputeDetailModal } from './modals/DisputeModals';

const STATUS_EMOJI: Record<string, string> = {
  OPEN: '🟡',
  IN_PROGRESS: '🔵',
  RESOLVED: '🟢',
  CLOSED: '⚪',
};

const AdminDisputesPage: React.FC = () => {
  const { hasPermission } = useAdminPermissions();
  const [selectedDispute, setSelectedDispute] = useState<AdminDispute | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchPage = useCallback(
    async (cursor?: string, limit?: number) => {
      const params: Record<string, string> = {};
      if (cursor) params.cursor = cursor;
      if (limit) params.limit = String(limit);
      const res = await adminDisputesApi.list(params);
      const data = unwrapApiResponse<{ items?: AdminDispute[]; nextCursor?: string } | AdminDispute[]>(
        res.data as any,
      );
      if (Array.isArray(data)) return { items: data };
      return { items: data.items ?? [], nextCursor: data.nextCursor };
    },
    [],
  );

  const { items: disputes, isLoading: loading, isLoadingMore, hasMore, error, sentinelRef } =
    useInfiniteScroll<AdminDispute>(fetchPage, { limit: 30 });

  return (
    <div className="space-y-6">
      <AdminBreadcrumb segments={[{ label: 'Disputes' }]} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">⚖️ Disputes</h1>
        {hasPermission('DISPUTES_RESOLVE') && (
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition">
            + Create Dispute
          </button>
        )}
      </div>

      {error && <div className="text-red-500 text-sm">{error}</div>}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Description</th>
                <th className="py-3 px-3">Created</th>
                {hasPermission('DISPUTES_RESOLVE') && <th className="py-3 px-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {disputes.map((dispute) => (
                <tr key={dispute.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="py-2.5 px-3">{STATUS_EMOJI[dispute.status] ?? '⚪'} {dispute.status}</td>
                  <td className="py-2.5 px-3">{dispute.type}</td>
                  <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400 max-w-xs truncate">{dispute.description}</td>
                  <td className="py-2.5 px-3 text-gray-500">{new Date(dispute.createdAt).toLocaleDateString()}</td>
                  {hasPermission('DISPUTES_RESOLVE') && (
                    <td className="py-2.5 px-3">
                      <button onClick={() => setSelectedDispute(dispute)} className="text-primary hover:underline text-xs">Manage</button>
                    </td>
                  )}
                </tr>
              ))}
              {disputes.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">No disputes found</td>
                </tr>
              )}
            </tbody>
          </table>
          {isLoadingMore && <div className="text-center text-gray-500 text-sm py-4">Loading more...</div>}
          {hasMore && <div ref={sentinelRef} />}
          {!hasMore && disputes.length > 0 && <div className="text-center text-gray-400 text-xs py-4">End of list</div>}
        </div>
      )}

      <CreateDisputeModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {}}
      />
      <DisputeDetailModal
        dispute={selectedDispute}
        open={!!selectedDispute}
        onClose={() => setSelectedDispute(null)}
        onUpdated={() => {}}
      />
    </div>
  );
};

export default AdminDisputesPage;
