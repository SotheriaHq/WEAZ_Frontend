import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import { adminModerationApi, adminReviewsApi } from '@/api/AdminApi';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { unwrapApiResponse } from '@/types/auth';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';

type ModerationTab = 'queue' | 'reviews' | 'reports';
type ReviewModerationAction = 'KEEP' | 'HIDE' | 'RESTORE' | 'DELETE';

type GenericQueueItem = {
  id: string;
  type?: string;
  name?: string;
  createdAt?: string;
};

type AdminReviewItem = {
  id: string;
  rating: number;
  title?: string | null;
  content: string;
  status: string;
  createdAt: string;
  productId: string;
  brandId: string;
  helpfulCount: number;
  reports?: Array<{
    id: string;
    reason: string;
    details?: string | null;
    createdAt: string;
    reporter?: { id: string; username: string } | null;
  }>;
  user?: {
    id: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

type AdminReviewReportItem = {
  id: string;
  reason: string;
  details?: string | null;
  createdAt: string;
  reporter?: { id: string; username: string } | null;
  review: {
    id: string;
    rating: number;
    title?: string | null;
    content: string;
    status: string;
    productId: string;
    brandId: string;
  };
};

const REVIEW_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'HIDDEN_BY_ADMIN', label: 'Hidden' },
  { value: 'DELETED_BY_USER', label: 'Deleted by user' },
];

const REVIEW_ACTION_LABELS: Record<ReviewModerationAction, string> = {
  KEEP: 'Keep live',
  HIDE: 'Hide review',
  RESTORE: 'Restore review',
  DELETE: 'Delete review',
};

const AdminModerationPage: React.FC = () => {
  const { hasPermission } = useAdminPermissions();
  const notifications = useSelector((state: RootState) => state.notifications.items);
  const lastMeasurementNotificationIdRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<ModerationTab>('queue');
  const [reviewStatusFilter, setReviewStatusFilter] = useState('');
  const [genericQueue, setGenericQueue] = useState<GenericQueueItem[]>([]);
  const [reviewQueue, setReviewQueue] = useState<AdminReviewItem[]>([]);
  const [reviewReports, setReviewReports] = useState<AdminReviewReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    isDestructive: boolean;
    action: () => Promise<void>;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const canReview = hasPermission('MODERATION_REVIEW');

  const fetchGenericQueue = useCallback(async () => {
    const res = await adminModerationApi.getQueue({ limit: '30' });
    const data = unwrapApiResponse<any>(res.data as any);
    if (Array.isArray(data)) {
      return data as GenericQueueItem[];
    }

    const items = ((data as { items?: GenericQueueItem[] })?.items ?? []) as GenericQueueItem[];
    if (items.length > 0) {
      return items;
    }

    const freeformPoints = Array.isArray((data as { freeformPoints?: any[] })?.freeformPoints)
      ? (data as { freeformPoints: any[] }).freeformPoints
      : [];
    const sizeCharts = Array.isArray((data as { sizeCharts?: any[] })?.sizeCharts)
      ? (data as { sizeCharts: any[] }).sizeCharts
      : [];

    return [
      ...freeformPoints.map((point) => ({
        id: point.id,
        type: 'Measurement Point',
        name: point.label ?? point.key ?? point.id,
        createdAt: point.createdAt,
      })),
      ...sizeCharts.map((chart) => ({
        id: chart.id,
        type: 'Size Chart',
        name: chart.notes?.trim() || `Version ${chart.version}`,
        createdAt: chart.createdAt,
      })),
    ].sort((left, right) => {
      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
      return rightTime - leftTime;
    });
  }, []);

  const fetchReviewQueue = useCallback(async () => {
    const params: Record<string, string> = { limit: '30' };
    if (reviewStatusFilter) {
      params.status = reviewStatusFilter;
    }
    const res = await adminReviewsApi.getReviews(params);
    const data = unwrapApiResponse<{ items?: AdminReviewItem[] }>(res.data as any);
    return data?.items ?? [];
  }, [reviewStatusFilter]);

  const fetchReviewReports = useCallback(async () => {
    const res = await adminReviewsApi.getReports({ limit: '30' });
    const data = unwrapApiResponse<{ items?: AdminReviewReportItem[] }>(res.data as any);
    return data?.items ?? [];
  }, []);

  const loadActiveTab = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'queue') {
        setGenericQueue(await fetchGenericQueue());
      } else if (activeTab === 'reviews') {
        setReviewQueue(await fetchReviewQueue());
      } else {
        setReviewReports(await fetchReviewReports());
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to load moderation data');
    } finally {
      setLoading(false);
    }
  }, [activeTab, fetchGenericQueue, fetchReviewQueue, fetchReviewReports]);

  useEffect(() => {
    void loadActiveTab();
  }, [loadActiveTab]);

  useEffect(() => {
    if (activeTab !== 'queue') return;

    const latestMeasurementNotification = notifications.find((notification) => {
      const payload = notification.payload as Record<string, unknown> | undefined;
      return notification.type === 'ADMIN_ACTION' && payload?.action === 'MEASUREMENT_FREEFORM_SUBMITTED';
    });

    if (!latestMeasurementNotification) return;
    if (lastMeasurementNotificationIdRef.current === latestMeasurementNotification.id) return;

    lastMeasurementNotificationIdRef.current = latestMeasurementNotification.id;

    void loadActiveTab();
  }, [activeTab, loadActiveTab, notifications]);

  const metrics = useMemo(
    () => ({
      queue: genericQueue.length,
      reviews: reviewQueue.length,
      reports: reviewReports.length,
    }),
    [genericQueue.length, reviewQueue.length, reviewReports.length],
  );

  const handleQueueReview = (id: string, action: string) => {
    setConfirmAction({
      title: `${action === 'APPROVE' ? 'Approve' : 'Reject'} this item?`,
      message: `This moderation item will be marked as ${action.toLowerCase()}.`,
      isDestructive: action === 'REJECT',
      action: async () => {
        await adminModerationApi.reviewItem(id, { action });
        toast.success(`Item ${action.toLowerCase()}d`);
        await loadActiveTab();
      },
    });
  };

  const handleReviewModeration = (reviewId: string, action: ReviewModerationAction) => {
    setConfirmAction({
      title: `${REVIEW_ACTION_LABELS[action]}?`,
      message: 'This review moderation action will be written to the audit log and may notify the customer.',
      isDestructive: action === 'DELETE',
      action: async () => {
        await adminReviewsApi.moderateReview(reviewId, { action });
        toast.success('Review moderation updated');
        await loadActiveTab();
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
      <AdminBreadcrumb segments={[{ label: 'Moderation' }]} />
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🛡️ Moderation Workspace</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Review the generic queue, customer review feed state, and reports from one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadActiveTab()}
          className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { key: 'queue', label: 'General queue', count: metrics.queue, emoji: '📥' },
          { key: 'reviews', label: 'Product reviews', count: metrics.reviews, emoji: '⭐' },
          { key: 'reports', label: 'Review reports', count: metrics.reports, emoji: '🚩' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as ModerationTab)}
            className={`rounded-2xl border p-4 text-left transition ${
              activeTab === tab.key
                ? 'border-emerald-300 bg-emerald-50 shadow-sm dark:border-emerald-400/30 dark:bg-emerald-400/10'
                : 'border-gray-200 bg-white hover:border-gray-300 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20'
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
              {tab.emoji} {tab.label}
            </div>
            <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{tab.count}</div>
          </button>
        ))}
      </div>

      {activeTab === 'reviews' ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-200">Status</label>
          <select
            value={reviewStatusFilter}
            onChange={(event) => setReviewStatusFilter(event.target.value)}
            className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-400 dark:border-white/10 dark:bg-[#0f1116] dark:text-white"
          >
            {REVIEW_STATUS_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {error ? <div className="text-sm text-red-500">{error}</div> : null}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
          Loading moderation data...
        </div>
      ) : null}

      {!loading && activeTab === 'queue' ? (
        genericQueue.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">General moderation queue is empty.</div>
        ) : (
          <div className="space-y-3">
            {genericQueue.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-purple-200/30 bg-white/60 p-4 backdrop-blur-sm dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.type ?? 'Item'} — {item.name ?? item.id}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      Submitted {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
                    </div>
                  </div>
                  {canReview ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleQueueReview(item.id, 'APPROVE')}
                        className="rounded-lg bg-green-100 px-3 py-1 text-xs text-green-700 transition hover:bg-green-200"
                      >
                        ✅ Approve
                      </button>
                      <button
                        onClick={() => handleQueueReview(item.id, 'REJECT')}
                        className="rounded-lg bg-red-100 px-3 py-1 text-xs text-red-700 transition hover:bg-red-200"
                      >
                        ❌ Reject
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}

      {!loading && activeTab === 'reviews' ? (
        reviewQueue.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No reviews matched the selected filter.</div>
        ) : (
          <div className="space-y-4">
            {reviewQueue.map((review) => (
              <article
                key={review.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {review.user?.firstName || review.user?.lastName
                          ? `${review.user?.firstName ?? ''} ${review.user?.lastName ?? ''}`.trim()
                          : review.user?.username ?? 'Customer'}
                      </span>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-300">
                        {review.status}
                      </span>
                      <span className="text-amber-600 dark:text-amber-200">{'⭐'.repeat(review.rating)}</span>
                    </div>
                    {review.title ? (
                      <div className="text-base font-semibold text-gray-900 dark:text-white">{review.title}</div>
                    ) : null}
                    <div className="text-sm leading-6 text-gray-700 dark:text-gray-200">{review.content}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Product {review.productId} • Brand {review.brandId} • Helpful {review.helpfulCount}
                    </div>
                    {review.reports && review.reports.length > 0 ? (
                      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-400/20 dark:bg-rose-400/10">
                        <div className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-700 dark:text-rose-200">
                          Reports
                        </div>
                        <div className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-200">
                          {review.reports.slice(0, 3).map((report) => (
                            <div key={report.id}>
                              {report.reason} by {report.reporter?.username ?? 'user'}
                              {report.details ? ` — ${report.details}` : ''}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  {canReview ? (
                    <div className="flex flex-wrap gap-2 lg:max-w-[220px] lg:justify-end">
                      <button
                        type="button"
                        onClick={() => handleReviewModeration(review.id, 'KEEP')}
                        className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-400/20 dark:text-emerald-200 dark:hover:bg-emerald-400/10"
                      >
                        Keep
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewModeration(review.id, 'HIDE')}
                        className="rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 dark:border-amber-400/20 dark:text-amber-200 dark:hover:bg-amber-400/10"
                      >
                        Hide
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewModeration(review.id, 'RESTORE')}
                        className="rounded-full border border-sky-200 px-3 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-50 dark:border-sky-400/20 dark:text-sky-200 dark:hover:bg-sky-400/10"
                      >
                        Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewModeration(review.id, 'DELETE')}
                        className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-400/20 dark:text-rose-200 dark:hover:bg-rose-400/10"
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )
      ) : null}

      {!loading && activeTab === 'reports' ? (
        reviewReports.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">No review reports are waiting.</div>
        ) : (
          <div className="space-y-4">
            {reviewReports.map((report) => (
              <article
                key={report.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">
                        {report.reason}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        by {report.reporter?.username ?? 'user'}
                      </span>
                    </div>
                    <div className="text-sm leading-6 text-gray-700 dark:text-gray-200">
                      {report.details || 'No extra details provided.'}
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {report.review.title || 'Untitled review'}
                      </div>
                      <div className="mt-2">{report.review.content}</div>
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {'⭐'.repeat(report.review.rating)} • {report.review.status} • Product {report.review.productId}
                      </div>
                    </div>
                  </div>
                  {canReview ? (
                    <div className="flex flex-wrap gap-2 lg:max-w-[220px] lg:justify-end">
                      <button
                        type="button"
                        onClick={() => handleReviewModeration(report.review.id, 'KEEP')}
                        className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-400/20 dark:text-emerald-200 dark:hover:bg-emerald-400/10"
                      >
                        Keep review
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewModeration(report.review.id, 'HIDE')}
                        className="rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 dark:border-amber-400/20 dark:text-amber-200 dark:hover:bg-amber-400/10"
                      >
                        Hide review
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewModeration(report.review.id, 'DELETE')}
                        className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-400/20 dark:text-rose-200 dark:hover:bg-rose-400/10"
                      >
                        Delete review
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )
      ) : null}

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
