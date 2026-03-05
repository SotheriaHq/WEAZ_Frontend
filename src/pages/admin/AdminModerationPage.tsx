import React, { useEffect, useState, useCallback } from 'react';
import { adminModerationApi } from '@/api/AdminApi';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';

const AdminModerationPage: React.FC = () => {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { hasPermission } = useAdminPermissions();

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminModerationApi.getQueue();
      const data = res.data;
      setQueue(Array.isArray(data) ? data : (data as any)?.items ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load moderation queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleReview = async (id: string, action: string) => {
    try {
      await adminModerationApi.reviewItem(id, { action });
      fetchQueue();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Review action failed');
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
    </div>
  );
};

export default AdminModerationPage;
