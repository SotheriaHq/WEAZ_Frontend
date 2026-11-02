import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { useCachedResource } from '@/hooks/useCachedResource';
import { queryKeys } from '@/query/queryKeys';
import reviewApi, {
  type BrandLifecycleBreakdownTargetDto,
  type BrandLifecycleDashboardDto,
  type ReviewDto,
  type ReviewReportReason,
  type ReviewStatus,
  type ReviewTargetType,
} from '@/api/ReviewApi';

type DashboardFilters = {
  status: 'ALL' | ReviewStatus;
  targetType: 'ALL' | ReviewTargetType;
  rating: 'ALL' | '1' | '2' | '3' | '4' | '5';
};

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All active statuses' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PENDING_MODERATION', label: 'Pending moderation' },
  { value: 'HIDDEN', label: 'Hidden' },
  { value: 'FLAGGED', label: 'Flagged' },
  { value: 'DELETED', label: 'Deleted' },
];

const TARGET_OPTIONS = [
  { value: 'ALL', label: 'All targets' },
  { value: 'PRODUCT', label: 'Products' },
  { value: 'COLLECTION', label: 'Collections' },
  { value: 'DESIGN', label: 'Designs' },
  { value: 'CUSTOM_ORDER', label: 'Custom orders' },
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

const REPORT_REASON_OPTIONS: Array<{ value: ReviewReportReason; label: string }> = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'HATE', label: 'Hate or abusive content' },
  { value: 'OFF_TOPIC', label: 'Off topic' },
  { value: 'COUNTERFEIT', label: 'Counterfeit claim' },
  { value: 'MEDIA_POLICY', label: 'Media policy' },
  { value: 'OTHER', label: 'Other' },
];

const formatNumber = (value: number) => new Intl.NumberFormat('en-NG').format(value);

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
};

const targetName = (review: ReviewDto) =>
  review.target?.name ||
  review.productId ||
  review.collectionId ||
  review.legacyCollectionId ||
  review.designId ||
  review.customOrderId ||
  review.brandId ||
  '-';

const emptyDashboard: BrandLifecycleDashboardDto = {
  items: [],
  summary: {
    averageRating: 0,
    reviewCount: 0,
    ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    satisfactionDistribution: {
      NONE: 0,
      ANGRY: 0,
      SAD: 0,
      OKAY: 0,
      HAPPY: 0,
      EXCITED: 0,
    },
    statusCounts: {
      APPROVED: 0,
      PENDING_MODERATION: 0,
      HIDDEN: 0,
      FLAGGED: 0,
      DELETED: 0,
    },
    targetTypeCounts: {
      PRODUCT: 0,
      COLLECTION: 0,
      DESIGN: 0,
      CUSTOM_ORDER: 0,
      BRAND: 0,
    },
    flaggedCount: 0,
    hiddenCount: 0,
    deletedCount: 0,
    pendingModerationCount: 0,
  },
  breakdown: { targets: [] },
  nextCursor: null,
};

function buildTargetParams(target: BrandLifecycleBreakdownTargetDto | null) {
  if (!target?.targetId) return {};
  if (target.targetType === 'PRODUCT') return { productId: target.targetId };
  if (target.targetType === 'COLLECTION') return { collectionId: target.targetId };
  if (target.targetType === 'DESIGN') return { designId: target.targetId };
  return {};
}

export default function BrandReviewsDashboardPage() {
  // Hybrid cache-first dashboard: cached revisits paint instantly; local state
  // stays the working copy so the report action can update rows optimistically.
  const [dashboard, setDashboard] = useState<BrandLifecycleDashboardDto>(emptyDashboard);
  const [filters, setFilters] = useState<DashboardFilters>({
    status: 'ALL',
    targetType: 'ALL',
    rating: 'ALL',
  });
  const [selectedTarget, setSelectedTarget] = useState<BrandLifecycleBreakdownTargetDto | null>(null);
  const [reportingReview, setReportingReview] = useState<ReviewDto | null>(null);
  const [reportReason, setReportReason] = useState<ReviewReportReason>('OFF_TOPIC');
  const [reportDetails, setReportDetails] = useState('');
  const [reporting, setReporting] = useState(false);

  const query = useMemo(() => ({
    limit: 50,
    ...(filters.status !== 'ALL' ? { status: filters.status } : {}),
    ...(filters.targetType !== 'ALL' ? { targetType: filters.targetType } : {}),
    ...(filters.rating !== 'ALL' ? { rating: Number(filters.rating) } : {}),
    ...buildTargetParams(selectedTarget),
  }), [filters, selectedTarget]);

  const dashboardResource = useCachedResource<BrandLifecycleDashboardDto>({
    queryKey: queryKeys.brand.reviewsDashboard(query),
    queryFn: () => reviewApi.getBrandLifecycleDashboard(query),
  });
  const loading = dashboardResource.loading;
  const error = dashboardResource.error
    ? dashboardResource.error.message || 'Unable to load review dashboard'
    : null;
  const loadDashboard = dashboardResource.refetch;
  const dashboardData = dashboardResource.data;
  const dashboardErrored = Boolean(dashboardResource.error);

  useEffect(() => {
    if (dashboardData) setDashboard(dashboardData);
  }, [dashboardData]);

  useEffect(() => {
    if (dashboardErrored) setDashboard(emptyDashboard);
  }, [dashboardErrored]);

  const activeFilterCount =
    Number(filters.status !== 'ALL') +
    Number(filters.targetType !== 'ALL') +
    Number(filters.rating !== 'ALL') +
    Number(Boolean(selectedTarget));

  const handleReport = async () => {
    if (!reportingReview || reporting) return;
    setReporting(true);
    try {
      const updated = await reviewApi.reportBrandLifecycleReview(reportingReview.id, {
        reason: reportReason,
        details: reportDetails.trim() || undefined,
      });
      setDashboard((current) => ({
        ...current,
        items: current.items.map((item) => (item.id === updated.id ? updated : item)),
      }));
      toast.success('Review reported for admin moderation');
      setReportingReview(null);
      setReportDetails('');
      setReportReason('OFF_TOPIC');
      await loadDashboard();
    } catch (nextError) {
      toast.error(nextError instanceof Error ? nextError.message : 'Unable to report review');
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-300">
            Verified buyer feedback
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">Reviews Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            Read-only lifecycle reviews for your brand. You can report a review for admin moderation, but you cannot hide or delete buyer reviews.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadDashboard()}
          className="rounded-xl border-0 bg-white/80 dark:bg-white/[0.06] px-4 py-2 text-xs font-bold text-theme hover:bg-black/5 dark:hover:bg-white/10 shadow-sm transition active:scale-95"
        >
          Refresh
        </button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Average rating', `${dashboard.summary.averageRating.toFixed(1)}/5`],
          ['Total reviews', formatNumber(dashboard.summary.reviewCount)],
          ['Flagged', formatNumber(dashboard.summary.flaggedCount)],
          ['Hidden', formatNumber(dashboard.summary.hiddenCount)],
          ['Pending', formatNumber(dashboard.summary.pendingModerationCount)],
        ].map(([label, value]) => (
          <div key={label} className="wiez-card-base rounded-2xl p-4 border-0 shadow-sm transition hover:shadow-md">
            <p className="text-xs font-bold uppercase tracking-wider text-theme-secondary">{label}</p>
            <p className="mt-2 text-2xl font-black bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 dark:from-purple-400 dark:via-indigo-400 dark:to-pink-400 bg-clip-text text-transparent">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border-0 bg-white/80 dark:bg-white/[0.04] p-4 shadow-md backdrop-blur-md">
        <div className="grid gap-3 md:grid-cols-3">
          <UniversalSelect
            value={filters.status}
            onChange={(value) => setFilters((current) => ({ ...current, status: value as DashboardFilters['status'] }))}
            options={STATUS_OPTIONS}
            placeholder="Status"
          />
          <UniversalSelect
            value={filters.targetType}
            onChange={(value) => {
              setFilters((current) => ({ ...current, targetType: value as DashboardFilters['targetType'] }));
              setSelectedTarget(null);
            }}
            options={TARGET_OPTIONS}
            placeholder="Target type"
          />
          <UniversalSelect
            value={filters.rating}
            onChange={(value) => setFilters((current) => ({ ...current, rating: value as DashboardFilters['rating'] }))}
            options={RATING_OPTIONS}
            placeholder="Rating"
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {activeFilterCount === 0 ? 'No filters applied' : `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} applied`}
          </span>
          <button
            type="button"
            onClick={() => {
              setFilters({ status: 'ALL', targetType: 'ALL', rating: 'ALL' });
              setSelectedTarget(null);
            }}
            className="text-xs font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-300"
          >
            Clear filters
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Target breakdown</h2>
          {selectedTarget ? (
            <button
              type="button"
              onClick={() => setSelectedTarget(null)}
              className="text-xs font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-300"
            >
              Clear target
            </button>
          ) : null}
        </div>
        {dashboard.breakdown.targets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-5 text-sm text-gray-500 dark:border-white/15 dark:text-gray-400">
            No target breakdown available yet.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {dashboard.breakdown.targets.map((target) => {
              const selected = selectedTarget?.targetType === target.targetType && selectedTarget?.targetId === target.targetId;
              return (
                <button
                  type="button"
                  key={`${target.targetType}:${target.targetId ?? 'unknown'}`}
                  onClick={() => {
                    setSelectedTarget(selected ? null : target);
                    setFilters((current) => ({ ...current, targetType: target.targetType }));
                  }}
                  className={`rounded-xl border p-4 text-left transition ${
                    selected
                      ? 'border-gray-300 bg-purple-50 text-purple-900 dark:border-white/20 dark:bg-purple-500/10 dark:text-purple-100'
                      : 'border-0 bg-white/80 dark:bg-white/[0.04] hover:bg-white dark:hover:bg-white/[0.08] shadow-sm'
                  }`}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{target.targetType}</p>
                  <p className="mt-1 truncate text-sm font-bold text-gray-900 dark:text-white">{target.name ?? target.targetId ?? 'Unknown target'}</p>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {target.reviewCount} review{target.reviewCount === 1 ? '' : 's'} · {target.averageRating.toFixed(1)}/5
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
          <p className="font-semibold">Reviews could not load</p>
          <p className="mt-1">{error}</p>
          <button type="button" onClick={() => void loadDashboard()} className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500 border-0">
            Retry
          </button>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-gray-200/70 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        {loading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-white/[0.08]" />
            ))}
          </div>
        ) : dashboard.items.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
            No lifecycle reviews match these filters.
          </div>
        ) : (
          <div className="grid gap-3 p-3 sm:p-4">
            {dashboard.items.map((review) => (
              <div
                key={review.id}
                className="wiez-card-base rounded-2xl p-4 sm:p-5 border-0 shadow-sm space-y-3 transition-all hover:shadow-md"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-600/15 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 font-bold text-sm">
                      {(review.reviewer?.displayName || 'V')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-theme leading-tight break-words">
                        {review.reviewer?.displayName ?? 'Verified buyer'}
                      </p>
                      <p className="text-xs text-theme-secondary">
                        {review.targetType} • {targetName(review)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <div className="flex items-center gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full text-xs font-bold">
                      <span>⭐</span>
                      <span>{review.rating}/5</span>
                    </div>
                    {review.satisfaction ? (
                      <span className="inline-flex rounded-full bg-purple-500/15 px-2.5 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300">
                        {review.satisfaction}
                      </span>
                    ) : null}
                    {review.verifiedPurchase ? (
                      <span className="inline-flex rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        ✓ Verified purchase
                      </span>
                    ) : null}
                  </div>
                </div>

                {review.reviewText ? (
                  <p className="text-sm text-theme leading-relaxed break-words">
                    {review.reviewText}
                  </p>
                ) : null}

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/5 dark:border-white/5 text-xs text-theme-secondary">
                  <span>{formatDate(review.createdAt)}</span>
                  <button
                    type="button"
                    onClick={() => setReportingReview(review)}
                    disabled={review.status === 'DELETED'}
                    className="rounded-xl px-3 py-1 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition active:scale-95 disabled:opacity-40"
                  >
                    Report
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {reportingReview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" role="dialog" aria-label="Report review">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-950">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Report review</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              This sends the review to admin moderation. It does not remove the buyer review directly.
            </p>
            <div className="mt-4 space-y-3">
              <UniversalSelect
                value={reportReason}
                onChange={(value) => setReportReason(value as ReviewReportReason)}
                options={REPORT_REASON_OPTIONS}
                placeholder="Reason"
              />
              <textarea
                value={reportDetails}
                onChange={(event) => setReportDetails(event.target.value)}
                rows={4}
                maxLength={1000}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 dark:border-white/10 dark:bg-white/5 dark:text-white"
                placeholder="Optional context for admins"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setReportingReview(null);
                  setReportDetails('');
                  setReportReason('OFF_TOPIC');
                }}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/[0.08]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleReport()}
                disabled={reporting || !reportReason}
                className="rounded-lg bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {reporting ? 'Reporting...' : 'Report review'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
