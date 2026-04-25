import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import type { RootState } from '@/store';
import Modal from '@/components/ui/Modal';
import MediaRenderer from '@/components/media/MediaRenderer';
import { reviewsApi, type ProductReviewListResponse, type ProductReviewResponse, type ReviewFilterOption, type ReviewReportReason, type ReviewSortOption } from '@/api/ReviewsApi';
import { useReviewRuntimeFlags } from '@/hooks/useReviewRuntimeFlags';
import { getAvatarFallback, resolveProfileImageSource } from '@/utils/profileImage';

type ProductReviewSectionProps = {
  productId: string;
};

const REPORT_REASONS: Array<{ value: ReviewReportReason; label: string }> = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'HATE', label: 'Hate' },
  { value: 'OFF_TOPIC', label: 'Off topic' },
  { value: 'COUNTERFEIT', label: 'Counterfeit concern' },
  { value: 'MEDIA_POLICY', label: 'Media policy issue' },
  { value: 'OTHER', label: 'Other' },
];

const SORT_OPTIONS: Array<{ value: ReviewSortOption; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'most_helpful', label: 'Most helpful' },
  { value: 'highest_rating', label: 'Highest rating' },
  { value: 'lowest_rating', label: 'Lowest rating' },
];

const FILTER_OPTIONS: Array<{ value: ReviewFilterOption; label: string }> = [
  { value: 'all', label: 'All' },
  { value: '5', label: '5 stars' },
  { value: '4', label: '4 stars' },
  { value: '3', label: '3 stars' },
  { value: '2', label: '2 stars' },
  { value: '1', label: '1 star' },
  { value: 'with_media', label: 'With media' },
];

const emptySummary: ProductReviewListResponse['summary'] = {
  averageRating: 0,
  totalReviews: 0,
  ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

const getDisplayName = (review: ProductReviewResponse) => {
  const fullName = `${review.reviewer.firstName ?? ''} ${review.reviewer.lastName ?? ''}`.trim();
  return fullName || review.reviewer.username || 'Threadly user';
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const response = (error as { response?: { data?: { message?: string | string[] } } })?.response;
  const message = response?.data?.message;
  if (Array.isArray(message)) {
    return message[0] || fallback;
  }
  if (typeof message === 'string' && message.trim()) {
    return message;
  }
  return fallback;
};

const ProductReviewSection: React.FC<ProductReviewSectionProps> = ({ productId }) => {
  const isAuthenticated = useSelector((state: RootState) => state.user.isAuthenticated);
  const { flags, isLoading: flagsLoading } = useReviewRuntimeFlags();
  const [items, setItems] = useState<ProductReviewResponse[]>([]);
  const [summary, setSummary] = useState(emptySummary);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [featureDisabled, setFeatureDisabled] = useState(false);
  const [sort, setSort] = useState<ReviewSortOption>('newest');
  const [filter, setFilter] = useState<ReviewFilterOption>('all');
  const [activeMedia, setActiveMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [reportingReview, setReportingReview] = useState<ProductReviewResponse | null>(null);
  const [reportReason, setReportReason] = useState<ReviewReportReason>('OTHER');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  const loadReviews = async (cursor?: string) => {
    const isLoadMore = Boolean(cursor);
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setFeatureDisabled(false);
    }

    try {
      const response = await reviewsApi.getProductReviews(productId, {
        cursor,
        sort,
        filter,
      });
      setSummary(response.summary);
      setNextCursor(response.nextCursor);
      setItems((current) => (isLoadMore ? [...current, ...response.items] : response.items));
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        setFeatureDisabled(true);
        setSummary(emptySummary);
        setItems([]);
        setNextCursor(null);
      } else {
        toast.error(getApiErrorMessage(error, 'Failed to load reviews'));
      }
    } finally {
      if (isLoadMore) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (flagsLoading || !flags.readEnabled) {
      return;
    }
    void loadReviews();
  }, [productId, sort, filter, flags.readEnabled, flagsLoading]);

  const handleHelpfulToggle = async (review: ProductReviewResponse) => {
    if (!isAuthenticated) {
      toast.info('Sign in to vote on reviews.');
      return;
    }

    const wasHelpful = review.viewerHasMarkedHelpful;
    setItems((current) =>
      current.map((item) =>
        item.id === review.id
          ? {
              ...item,
              viewerHasMarkedHelpful: !wasHelpful,
              helpfulCount: wasHelpful ? Math.max(0, item.helpfulCount - 1) : item.helpfulCount + 1,
            }
          : item,
      ),
    );

    try {
      if (wasHelpful) {
        await reviewsApi.removeHelpfulVote(review.id);
      } else {
        await reviewsApi.addHelpfulVote(review.id);
      }
    } catch (error) {
      setItems((current) =>
        current.map((item) =>
          item.id === review.id
            ? {
                ...item,
                viewerHasMarkedHelpful: wasHelpful,
                helpfulCount: review.helpfulCount,
              }
            : item,
        ),
      );
      toast.error(getApiErrorMessage(error, 'Unable to update helpful vote'));
    }
  };

  const handleSubmitReport = async () => {
    if (!reportingReview) {
      return;
    }
    if (!isAuthenticated) {
      toast.info('Sign in to report a review.');
      return;
    }

    setSubmittingReport(true);
    try {
      await reviewsApi.reportReview(reportingReview.id, {
        reason: reportReason,
        details: reportDetails.trim() || undefined,
      });
      toast.success('Report submitted.');
      setReportingReview(null);
      setReportReason('OTHER');
      setReportDetails('');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to submit report'));
    } finally {
      setSubmittingReport(false);
    }
  };

  const reviewBars = useMemo(
    () => [5, 4, 3, 2, 1].map((value) => {
      const count = summary.ratingBreakdown[value as 1 | 2 | 3 | 4 | 5] ?? 0;
      const percentage = summary.totalReviews > 0 ? (count / summary.totalReviews) * 100 : 0;
      return { value, count, percentage };
    }),
    [summary],
  );

  if (flagsLoading || !flags.readEnabled || featureDisabled) {
    return null;
  }

  return (
    <section className="mt-10 space-y-6 rounded-[32px] border border-gray-200 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.06)] backdrop-blur dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_38%),rgba(17,17,24,0.9)] md:p-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">
            Reviews
          </div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-white">
            Buyer feedback that stays tied to delivered orders.
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Write your own review from the delivered items section in your orders.
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
            <span>Sort</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as ReviewSortOption)}
              className="bg-transparent text-sm outline-none"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value} className="text-gray-900">
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="space-y-4 rounded-[28px] border border-gray-200 bg-[#f7fbf8] p-5 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-end gap-3">
            <div className="text-5xl font-semibold text-gray-900 dark:text-white">
              {summary.averageRating.toFixed(1)}
            </div>
            <div className="pb-2 text-sm text-gray-500 dark:text-gray-400">
              ⭐ {summary.totalReviews} reviews
            </div>
          </div>
          <div className="space-y-2">
            {reviewBars.map((bar) => (
              <button
                key={bar.value}
                type="button"
                onClick={() => setFilter(filter === String(bar.value) ? 'all' : String(bar.value) as ReviewFilterOption)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors ${
                  filter === String(bar.value)
                    ? 'bg-emerald-50 dark:bg-emerald-400/10'
                    : 'hover:bg-white dark:hover:bg-white/5'
                }`}
              >
                <span className="w-10 text-sm font-semibold text-gray-700 dark:text-gray-200">{bar.value} ⭐</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                  <span
                    className="block h-full rounded-full bg-emerald-500"
                    style={{ width: `${bar.percentage}%` }}
                  />
                </span>
                <span className="w-8 text-right text-xs text-gray-500 dark:text-gray-400">{bar.count}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filter === option.value
                    ? 'bg-emerald-500 text-black'
                    : 'border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:text-gray-300 dark:hover:border-emerald-400/40 dark:hover:text-emerald-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="rounded-[28px] border border-gray-200 bg-gray-50 p-6 text-sm text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
              Loading reviews...
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-[28px] border border-dashed border-gray-200 bg-gray-50 p-8 text-center dark:border-white/10 dark:bg-white/5">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">No reviews yet</div>
              <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Once verified buyers leave feedback, it will appear here.
              </div>
            </div>
          ) : (
            items.map((review) => {
              const displayName = getDisplayName(review);
              const avatar = resolveProfileImageSource(review.reviewer);
              const avatarFallback = getAvatarFallback(displayName, review.reviewer.username);

              return (
                <article key={review.id} className="space-y-4 rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-start gap-4">
                    {avatar.src ? (
                      <div className="h-12 w-12 overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
                        <MediaRenderer
                          kind="image"
                          src={avatar.src}
                          alt={displayName}
                          className="h-full w-full"
                          mediaClassName="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 text-sm font-semibold text-black">
                        {avatarFallback}
                      </div>
                    )}

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="font-semibold text-gray-900 dark:text-white">{displayName}</span>
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">
                          ✅ Verified buyer
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {'⭐'.repeat(review.rating)}
                        <span className="ml-2">{new Date(review.createdAt).toLocaleDateString()}</span>
                        {review.editedAt ? <span className="ml-2">Edited</span> : null}
                      </div>
                      {review.variantSummary ? (
                        <div className="text-xs text-gray-500 dark:text-gray-400">{review.variantSummary}</div>
                      ) : null}
                    </div>
                  </div>

                  {review.title ? (
                    <div className="text-base font-semibold text-gray-900 dark:text-white">{review.title}</div>
                  ) : null}

                  <div className="text-sm leading-7 text-gray-700 dark:text-gray-200">{review.content}</div>

                  {review.media.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {review.media.map((media) => (
                        <button
                          key={media.id}
                          type="button"
                          onClick={() => setActiveMedia({ url: media.url, type: media.type })}
                          className="overflow-hidden rounded-3xl border border-gray-200 bg-gray-50 text-left dark:border-white/10 dark:bg-white/5"
                        >
                          <div className="relative h-24 w-full">
                            <MediaRenderer
                              kind={media.type}
                              src={media.url}
                              alt="Review media"
                              className="h-full w-full"
                              mediaClassName="h-full w-full object-cover"
                            />
                          </div>
                          <div className="px-3 py-2 text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                            {media.type === 'video' ? '🎥 Video' : '📷 Photo'}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {review.brandReply ? (
                    <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-400/20 dark:bg-emerald-400/10">
                      <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700 dark:text-emerald-200">
                        {review.brandReply.brandName} replied
                      </div>
                      <div className="mt-2 text-sm leading-7 text-emerald-900 dark:text-emerald-50">
                        {review.brandReply.content}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-3 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => void handleHelpfulToggle(review)}
                      className={`rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
                        review.viewerHasMarkedHelpful
                          ? 'bg-emerald-500 text-black'
                          : 'border border-gray-200 text-gray-600 hover:border-emerald-300 hover:text-emerald-700 dark:border-white/10 dark:text-gray-300 dark:hover:border-emerald-400/40 dark:hover:text-emerald-200'
                      }`}
                    >
                      👍 Helpful ({review.helpfulCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReportingReview(review);
                        setReportReason('OTHER');
                        setReportDetails('');
                      }}
                      className="rounded-full border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-rose-300 hover:text-rose-600 dark:border-white/10 dark:text-gray-300 dark:hover:border-rose-400/40 dark:hover:text-rose-200"
                    >
                      🛑 Report
                    </button>
                  </div>
                </article>
              );
            })
          )}

          {nextCursor ? (
            <button
              type="button"
              onClick={() => void loadReviews(nextCursor)}
              disabled={loadingMore}
              className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-gray-200 dark:hover:border-emerald-400/40 dark:hover:text-emerald-200"
            >
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          ) : null}
        </div>
      </div>

      <Modal
        open={Boolean(reportingReview)}
        onClose={() => setReportingReview(null)}
        title="Report Review"
        size="md"
      >
        <div className="space-y-4">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Reports go to admin moderation. Use this only for policy issues.
          </div>
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
              Reason
            </span>
            <select
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value as ReviewReportReason)}
              className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none dark:border-white/10 dark:bg-[#111118] dark:text-white"
            >
              {REPORT_REASONS.map((option) => (
                <option key={option.value} value={option.value} className="text-gray-900">
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
              Details
            </span>
            <textarea
              value={reportDetails}
              onChange={(event) => setReportDetails(event.target.value)}
              rows={4}
              className="w-full rounded-3xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none dark:border-white/10 dark:bg-[#111118] dark:text-white"
              placeholder="Add context for the moderation team if needed."
            />
          </label>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void handleSubmitReport()}
              disabled={submittingReport}
              className="rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submittingReport ? 'Sending...' : 'Submit report'}
            </button>
          </div>
        </div>
      </Modal>

      {activeMedia ? (
        <div
          className="fixed inset-0 z-layer-modal flex items-center justify-center p-4"
          onClick={() => setActiveMedia(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
          <div className="relative w-full max-w-5xl rounded-[32px] border border-white/10 bg-white/10 p-3 backdrop-blur-xl">
            <div className="max-h-[85vh] overflow-y-auto no-scrollbar overflow-x-hidden rounded-[28px] bg-white/5 dark:bg-black/20">
              <MediaRenderer
                kind={activeMedia.type}
                src={activeMedia.url}
                alt="Review media"
                className="w-full"
                mediaClassName="w-full h-auto min-h-full object-cover"
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default ProductReviewSection;
