import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminBrandsApi } from '@/api/AdminApi';
import type { VerificationQueueItem } from '@/types/verification';
import { unwrapApiResponse } from '@/types/auth';

/**
 * In Review panel for the unified admin Users console.
 *
 * Lists brands whose shop is pending verification review and links into the
 * existing per-brand review flow. Extracted from the old AdminBrandsPage
 * verification-queue block / AdminVerificationQueuePage; the returnTo now
 * points back to the Users console In Review tab.
 */

const RETURN_TO = '/admin/users?tab=in-review';

const verificationStatusTone = (status: string) => {
  if (status === 'IN_REVIEW') return 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200';
  if (status === 'ADDITIONAL_INFO_REQUESTED') return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200';
  return 'border-gray-200 bg-gray-50 text-gray-700 dark:border-white/20 dark:bg-white/10 dark:text-gray-200';
};

const InReviewPanel: React.FC = () => {
  const [queue, setQueue] = useState<VerificationQueueItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminBrandsApi.getVerificationQueue({ limit: '20' });
      const data = unwrapApiResponse<{ items?: VerificationQueueItem[]; nextCursor?: string; totalPending?: number }>(response.data as any);
      setQueue(data.items ?? []);
      setCursor(data.nextCursor ?? null);
      setPendingCount(data.totalPending ?? 0);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to load the review queue');
      setQueue([]);
      setPendingCount(0);
      setCursor(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    try {
      setLoadingMore(true);
      const response = await adminBrandsApi.getVerificationQueue({ limit: '20', cursor });
      const data = unwrapApiResponse<{ items?: VerificationQueueItem[]; nextCursor?: string; totalPending?: number }>(response.data as any);
      setQueue((current) => [...current, ...(data.items ?? [])]);
      setCursor(data.nextCursor ?? null);
      if (typeof data.totalPending === 'number') setPendingCount(data.totalPending);
    } catch {
      // Keep the existing list on load-more failure.
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-sky-200/80 bg-sky-50/70 p-5 shadow-sm dark:border-sky-500/20 dark:bg-sky-500/10">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Shops pending review</p>
        <h2 className="mt-2 text-xl font-black text-gray-900 dark:text-white">
          {pendingCount} active review item{pendingCount === 1 ? '' : 's'}
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Brands whose store verification still needs an admin decision.</p>
      </section>

      <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white/90 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        {error ? (
          <div className="p-6 text-center">
            <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>
            <button type="button" onClick={() => void loadFirst()} className="mt-3 rounded-xl border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10">Retry</button>
          </div>
        ) : loading ? (
          <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-300">Loading review queue...</div>
        ) : queue.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-3xl">✅</p>
            <h3 className="mt-2 text-lg font-bold text-gray-900 dark:text-white">Nothing waiting for review</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">No brand shops are pending verification right now.</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="space-y-2 p-3 md:hidden">
              {queue.map((item) => (
                <article key={item.id} className="rounded-xl border border-sky-200/70 bg-white px-3 py-3 dark:border-sky-500/20 dark:bg-white/5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.name || 'Unnamed brand'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.owner?.firstName} {item.owner?.lastName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.owner?.email ?? 'No owner email'}</p>
                    </div>
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${verificationStatusTone(String(item.verificationStatus))}`}>
                      {String(item.verificationStatus).replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="mt-2">
                    <Link to={`/admin/brands/${item.id}/verification-review`} state={{ returnTo: RETURN_TO }} className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">Open review</Link>
                  </div>
                </article>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-sky-100/80 bg-sky-50/60 text-left text-[11px] uppercase tracking-[0.16em] text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300">
                    <th className="px-4 py-3">Brand</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Attempt</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Assigned</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((item) => (
                    <tr key={item.id} className="border-b border-sky-100/80 hover:bg-sky-50/40 dark:border-sky-500/10 dark:hover:bg-sky-500/10">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900 dark:text-white">{item.name || 'Unnamed brand'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.id.slice(0, 8)}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                        <p>{item.owner?.firstName} {item.owner?.lastName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.owner?.email ?? 'No owner email'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${verificationStatusTone(String(item.verificationStatus))}`}>{String(item.verificationStatus).replace(/_/g, ' ')}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-200">{item.verificationAttemptNumber ?? 0}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{item.verificationSubmittedAt ? new Date(item.verificationSubmittedAt).toLocaleString() : 'Not available'}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{item.verificationReviewedById ? 'Claimed' : 'Unclaimed'}</td>
                      <td className="px-4 py-3">
                        <Link to={`/admin/brands/${item.id}/verification-review`} state={{ returnTo: RETURN_TO }} className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-800 transition hover:border-sky-300 hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200">Open</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sky-100/80 px-4 py-3 text-xs text-gray-500 dark:border-sky-500/20 dark:text-gray-300">
              <span>Showing {queue.length} of {pendingCount} active item{pendingCount === 1 ? '' : 's'}</span>
              <div className="flex items-center gap-2">
                {loadingMore && <span>Loading more...</span>}
                {cursor ? (
                  <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="rounded-full border border-sky-200 bg-white px-3 py-1.5 font-semibold uppercase tracking-[0.16em] text-sky-700 transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-500/30 dark:bg-white/5 dark:text-sky-200">Load more</button>
                ) : (<span>End of queue</span>)}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default InReviewPanel;
