import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import UniversalSelect from '@/components/forms/UniversalSelect';
import {
  adminReviewsApi,
  type AdminLifecycleReview,
  type AdminLifecycleReviewListResponse,
  type AdminLifecycleReviewStatus,
} from '@/api/AdminApi';
import { unwrapApiResponse } from '@/types/auth';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { toast } from 'sonner';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PENDING_MODERATION', label: 'Pending moderation' },
  { value: 'HIDDEN', label: 'Hidden' },
  { value: 'FLAGGED', label: 'Flagged' },
  { value: 'DELETED', label: 'Deleted' },
];

const TARGET_OPTIONS = [
  { value: 'ALL', label: 'All targets' },
  { value: 'PRODUCT', label: 'Product' },
  { value: 'COLLECTION', label: 'Collection' },
  { value: 'DESIGN', label: 'Design' },
  { value: 'CUSTOM_ORDER', label: 'Custom order' },
  { value: 'BRAND', label: 'Brand' },
];

const RATING_OPTIONS = [
  { value: 'ALL', label: 'Any rating' },
  { value: '5', label: '5 stars' },
  { value: '4', label: '4 stars' },
  { value: '3', label: '3 stars' },
  { value: '2', label: '2 stars' },
  { value: '1', label: '1 star' },
];

const statusTone: Record<AdminLifecycleReviewStatus, string> = {
  APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  PENDING_MODERATION: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  HIDDEN: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300',
  FLAGGED: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  DELETED: 'bg-slate-100 text-slate-600 dark:bg-white/8 dark:text-slate-300',
};

type ReviewFilters = {
  status: string;
  targetType: string;
  rating: string;
  brandId: string;
  dateFrom: string;
  dateTo: string;
};

type PendingAction = {
  review: AdminLifecycleReview;
  action: 'HIDE' | 'FLAG';
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const excerpt = (value?: string | null) => {
  if (!value?.trim()) return 'No text review.';
  return value.length > 140 ? `${value.slice(0, 137)}...` : value;
};

const getTargetLabel = (review: AdminLifecycleReview) =>
  review.target?.name || review.productId || review.customOrderId || review.designId || review.collectionId || review.brandId || '-';

const buildQuery = (filters: ReviewFilters, cursor?: string | null) => {
  const params: Record<string, string> = { limit: '30' };
  if (cursor) params.cursor = cursor;
  if (filters.status !== 'ALL') params.status = filters.status;
  if (filters.targetType !== 'ALL') params.targetType = filters.targetType;
  if (filters.rating !== 'ALL') params.rating = filters.rating;
  if (filters.brandId.trim()) params.brandId = filters.brandId.trim();
  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;
  return params;
};

const AdminReviewsPage: React.FC = () => {
  const { hasPermission } = useAdminPermissions();
  const canModerate = hasPermission('MODERATION_REVIEW');
  const [filters, setFilters] = useState<ReviewFilters>({
    status: 'ALL',
    targetType: 'ALL',
    rating: 'ALL',
    brandId: '',
    dateFrom: '',
    dateTo: '',
  });
  const [reviews, setReviews] = useState<AdminLifecycleReview[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminLifecycleReview | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState('');

  const activeFilterCount = useMemo(
    () =>
      Number(filters.status !== 'ALL') +
      Number(filters.targetType !== 'ALL') +
      Number(filters.rating !== 'ALL') +
      Number(Boolean(filters.brandId.trim())) +
      Number(Boolean(filters.dateFrom)) +
      Number(Boolean(filters.dateTo)),
    [filters],
  );

  const loadReviews = useCallback(
    async (cursor?: string | null) => {
      if (cursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await adminReviewsApi.getLifecycleReviews(buildQuery(filters, cursor));
        const payload = unwrapApiResponse<AdminLifecycleReviewListResponse>(response.data as any);
        const nextItems = payload?.items ?? [];
        setReviews((current) => (cursor ? [...current, ...nextItems] : nextItems));
        setNextCursor(payload?.nextCursor ?? null);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to load lifecycle reviews');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const loadDetail = async (reviewId: string) => {
    setDetailLoading(true);
    try {
      const response = await adminReviewsApi.getLifecycleReview(reviewId);
      const payload = unwrapApiResponse<AdminLifecycleReview>(response.data as any);
      setDetail(payload ?? null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load review detail');
    } finally {
      setDetailLoading(false);
    }
  };

  const runModeration = async (review: AdminLifecycleReview, action: 'APPROVE' | 'HIDE' | 'FLAG', actionReason?: string) => {
    if (!canModerate) {
      toast.error('You do not have permission to moderate reviews.');
      return;
    }

    try {
      if (action === 'APPROVE') {
        await adminReviewsApi.approveLifecycleReview(review.id);
      } else if (action === 'HIDE') {
        await adminReviewsApi.hideLifecycleReview(review.id, { reason: actionReason?.trim() || undefined });
      } else {
        await adminReviewsApi.flagLifecycleReview(review.id, { reason: actionReason?.trim() || undefined });
      }
      toast.success(action === 'APPROVE' ? 'Review approved' : action === 'HIDE' ? 'Review hidden' : 'Review flagged');
      setPendingAction(null);
      setReason('');
      await loadReviews();
      if (detail?.id === review.id) {
        await loadDetail(review.id);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update review status');
    }
  };

  return (
    <div className="space-y-6">
      <AdminBreadcrumb segments={[{ label: 'Reviews' }]} />

      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Review Moderation</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Lifecycle reviews only. Buyer deletes stay soft-delete only; admin actions hide, approve, or flag.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadReviews()}
          className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
        >
          Refresh
        </button>
      </div>

      <section className="rounded-xl border border-gray-200/70 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <UniversalSelect
            value={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
            options={STATUS_OPTIONS}
            placeholder="Status"
          />
          <UniversalSelect
            value={filters.targetType}
            onChange={(value) => setFilters((current) => ({ ...current, targetType: value }))}
            options={TARGET_OPTIONS}
            placeholder="Target"
          />
          <UniversalSelect
            value={filters.rating}
            onChange={(value) => setFilters((current) => ({ ...current, rating: value }))}
            options={RATING_OPTIONS}
            placeholder="Rating"
          />
          <input
            value={filters.brandId}
            onChange={(event) => setFilters((current) => ({ ...current, brandId: event.target.value }))}
            placeholder="Brand ID"
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
          />
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
            aria-label="Created after"
          />
          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
            aria-label="Created before"
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {activeFilterCount === 0 ? 'No filters applied' : `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} applied`}
          </span>
          <button
            type="button"
            onClick={() => setFilters({ status: 'ALL', targetType: 'ALL', rating: 'ALL', brandId: '', dateFrom: '', dateTo: '' })}
            className="text-xs font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-300"
          >
            Clear filters
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-xl border border-gray-200/70 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-white/8" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No lifecycle reviews match these filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Reviewer</th>
                  <th className="px-4 py-3">Brand</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3">Review</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/8">
                {reviews.map((review) => (
                  <tr key={review.id} className="align-top text-gray-700 dark:text-gray-200">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">{review.reviewer?.displayName ?? review.reviewerId}</div>
                      <div className="text-xs text-gray-500">{review.reviewer?.email ?? review.reviewerId}</div>
                    </td>
                    <td className="px-4 py-3">{review.brand?.name ?? review.brandId ?? '-'}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{review.targetType}</div>
                      <div className="text-xs text-gray-500">{getTargetLabel(review)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{review.rating}/5</div>
                      <div className="text-xs text-gray-500">{review.satisfaction}</div>
                    </td>
                    <td className="max-w-[260px] px-4 py-3">
                      <p className="line-clamp-3">{excerpt(review.reviewText)}</p>
                      {review.verifiedPurchase && (
                        <span className="mt-1 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                          Verified purchase
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusTone[review.status]}`}>
                        {review.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(review.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void loadDetail(review.id)}
                          className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/8"
                        >
                          View detail
                        </button>
                        {canModerate && review.status !== 'DELETED' && (
                          <>
                            <button
                              type="button"
                              onClick={() => void runModeration(review, 'APPROVE')}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingAction({ review, action: 'HIDE' })}
                              className="rounded-lg bg-gray-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
                            >
                              Hide
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingAction({ review, action: 'FLAG' })}
                              className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                            >
                              Flag
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {nextCursor && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void loadReviews(nextCursor)}
            disabled={loadingMore}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}

      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-label="Review detail">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-950">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Review Detail</h2>
                <p className="text-xs text-gray-500">Lifecycle review audit and moderation context.</p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-white/8"
              >
                Close
              </button>
            </div>

            {detailLoading || !detail ? (
              <div className="mt-4 h-48 animate-pulse rounded-xl bg-gray-100 dark:bg-white/8" />
            ) : (
              <div className="mt-5 space-y-5">
                <div className="rounded-xl border border-gray-200 p-4 dark:border-white/10">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {detail.rating}/5 - {detail.satisfaction}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">
                        {detail.reviewText || 'No text review.'}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusTone[detail.status]}`}>
                      {detail.status}
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    ['Review ID', detail.id],
                    ['Reviewer ID', detail.reviewerId],
                    ['Reviewer', detail.reviewer?.email ?? '-'],
                    ['Brand ID', detail.brandId ?? '-'],
                    ['Brand', detail.brand?.name ?? '-'],
                    ['Target type', detail.targetType],
                    ['Target', getTargetLabel(detail)],
                    ['Order ID', detail.orderId ?? '-'],
                    ['Order item ID', detail.orderItemId ?? '-'],
                    ['Custom order ID', detail.customOrderId ?? '-'],
                    ['Product ID', detail.productId ?? '-'],
                    ['Collection ID', detail.collectionId ?? '-'],
                    ['Design ID', detail.designId ?? '-'],
                    ['Created at', formatDate(detail.createdAt)],
                    ['Edited at', formatDate(detail.editedAt)],
                    ['Edit window expires', formatDate(detail.editWindowExpiresAt)],
                    ['Deleted at', formatDate(detail.deletedAt)],
                    ['Deleted by', detail.deletedBy?.email ?? detail.deletedById ?? '-'],
                    ['Hidden reason', detail.hiddenReason ?? '-'],
                    ['Verified purchase', detail.verifiedPurchase ? 'Yes' : 'No'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-white/5">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
                      <div className="mt-1 break-all text-gray-900 dark:text-white">{value}</div>
                    </div>
                  ))}
                </div>

                {canModerate && detail.status !== 'DELETED' && (
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => void runModeration(detail, 'APPROVE')}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingAction({ review: detail, action: 'HIDE' })}
                      className="rounded-lg bg-gray-700 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                    >
                      Hide
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingAction({ review: detail, action: 'FLAG' })}
                      className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    >
                      Flag
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {pendingAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4" role="dialog" aria-label={`${pendingAction.action} review`}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-950">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              {pendingAction.action === 'HIDE' ? 'Hide review' : 'Flag review'}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Add a moderation reason. This does not hard-delete the buyer review.
            </p>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              maxLength={500}
              className="mt-4 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
              placeholder="Reason visible in admin detail"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingAction(null);
                  setReason('');
                }}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/8"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void runModeration(pendingAction.review, pendingAction.action, reason)}
                className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReviewsPage;
