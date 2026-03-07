import React, { useCallback, useState } from 'react';
import { adminModerationApi } from '@/api/AdminApi';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { unwrapApiResponse } from '@/types/auth';

const AdminModerationPage: React.FC = () => {
  const { hasPermission } = useAdminPermissions();
  const [confirmAction, setConfirmAction] = useState<{
    title: string; message: string; isDestructive: boolean; action: () => Promise<void>;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const fetchPage = useCallback(
    async (cursor?: string, limit?: number) => {
      const params: Record<string, string> = {};
      if (cursor) params.cursor = cursor;
      if (limit) params.limit = String(limit);
      const res = await adminModerationApi.getQueue(params);
      const data = unwrapApiResponse<any>(res.data as any);
      if (Array.isArray(data)) return { items: data };
      return { items: (data as any)?.items ?? [], nextCursor: (data as any)?.nextCursor };
    },
    [],
  );

  const { items: queue, isLoading: loading, isLoadingMore, hasMore, error, sentinelRef, reset } =
    useInfiniteScroll<any>(fetchPage, { limit: 30 });

  const handleReview = (id: string, action: string) => {
    setConfirmAction({
      title: `${action === 'APPROVE' ? 'Approve' : 'Reject'} this item?`,
      message: `This moderation item will be marked as ${action.toLowerCase()}.`,
      isDestructive: action === 'REJECT',
      action: async () => {
        await adminModerationApi.reviewItem(id, { action });
        toast.success(`Item ${action.toLowerCase()}d`);
        reset();
      },
    });
  };

  const executeConfirm = async () => {
    if (!confirmAction) return;
    setConfirmLoading(true);
    try {
      await confirmAction.action();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Action failed');
    } finally {
      setConfirmLoading(false);
      setConfirmAction(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🛡️ Moderation Queue</h1>

      {error && <div className="text-red-500 text-sm">{error}</div>}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : queue.length === 0 ? (
        <div className="text-gray-500 text-sm py-8 text-center">Moderation queue is empty 🎉</div>
      ) : (
        <div className="space-y-3">
          {queue.map((item: any) => (
            <div
              key={item.id}
              className="p-4 rounded-xl border border-purple-200/30 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {item.type ?? 'Item'} — {item.name ?? item.id}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Submitted {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
                  </div>
                </div>
                {hasPermission('MODERATION_REVIEW') && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReview(item.id, 'APPROVE')}
                      className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition"
                    >
                      ✅ Approve
                    </button>
                    <button
                      onClick={() => handleReview(item.id, 'REJECT')}
                      className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                    >
                      ❌ Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {isLoadingMore && <div className="text-center text-gray-500 text-sm py-4">Loading more...</div>}
      {hasMore && <div ref={sentinelRef} />}
      {!hasMore && queue.length > 0 && <div className="text-center text-gray-400 text-xs py-4">End of list</div>}

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title}
        message={confirmAction?.message}
        isDestructive={confirmAction?.isDestructive}
        isLoading={confirmLoading}
        onConfirm={executeConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};

export default AdminModerationPage;
