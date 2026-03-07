import React, { useCallback, useEffect, useState } from 'react';
import { adminModerationApi } from '@/api/AdminApi';
import { unwrapApiResponse } from '@/types/auth';

const AdminMeasurementsPage: React.FC = () => {
  const [freeformPoints, setFreeformPoints] = useState<any[]>([]);
  const [sizeCharts, setSizeCharts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminModerationApi.getQueue();
      const data = unwrapApiResponse<{ freeformPoints?: any[]; sizeCharts?: any[] }>(res.data as any);
      setFreeformPoints(data.freeformPoints ?? []);
      setSizeCharts(data.sizeCharts ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load measurement moderation queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleReview = async (id: string, action: 'approve' | 'reject') => {
    try {
      await adminModerationApi.reviewItem(id, { action });
      fetchQueue();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to review item');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">📐 Measurements</h1>
      {error && <div className="text-red-500 text-sm">{error}</div>}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Freeform Measurement Points</h2>
            {freeformPoints.length === 0 ? (
              <div className="text-sm text-gray-500">No pending freeform points.</div>
            ) : (
              <div className="space-y-2">
                {freeformPoints.map((item) => (
                  <div key={item.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{item.label}</div>
                      <div className="text-xs text-gray-500">{item.source} · {item.status}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleReview(item.id, 'approve')} className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-lg">✅ Approve</button>
                      <button onClick={() => handleReview(item.id, 'reject')} className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-lg">❌ Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Brand Size Charts</h2>
            {sizeCharts.length === 0 ? (
              <div className="text-sm text-gray-500">No pending size charts.</div>
            ) : (
              <div className="space-y-2">
                {sizeCharts.map((item) => (
                  <div key={item.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{item.name ?? item.id}</div>
                      <div className="text-xs text-gray-500">Status: {item.status}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleReview(item.id, 'approve')} className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-lg">✅ Publish</button>
                      <button onClick={() => handleReview(item.id, 'reject')} className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded-lg">❌ Send Back</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default AdminMeasurementsPage;
