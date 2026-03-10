import React, { useMemo, useState } from 'react';
import Card from '../../ui/Card';
import MediaRenderer from '../../media/MediaRenderer';
import Modal from '../../ui/Modal';
import { toast } from 'sonner';
import type { ReviewRatingDistributionItem } from '../../../types/profile';
import { getAvatarFallback, resolveProfileImageSource } from '../../../utils/profileImage';
import {
  reviewsApi,
  type ProductReviewResponse,
  type ReviewReportReason,
} from '../../../api/ReviewsApi';

interface ReviewsTabProps {
  reviews: ProductReviewResponse[];
  averageRating: number;
  totalReviews: number;
  ratingDistribution: ReviewRatingDistributionItem[];
  isLoading?: boolean;
  isOwner?: boolean;
  brandRepliesEnabled?: boolean;
}

interface RatingStarsProps {
  rating: number;
  size?: 'sm' | 'md';
}

const RatingStars: React.FC<RatingStarsProps> = ({ rating, size = 'md' }) => {
  const sizeClass = size === 'sm' ? 'text-sm' : 'text-lg';
  return <div className={sizeClass}>{'⭐'.repeat(Math.max(1, rating))}</div>;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;

  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

type SortOption = 'recent' | 'highest';

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

const ReviewsTab: React.FC<ReviewsTabProps> = ({
  reviews,
  averageRating,
  totalReviews,
  ratingDistribution,
  isLoading = false,
  isOwner = false,
  brandRepliesEnabled = false,
}) => {
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [localReviews, setLocalReviews] = useState(reviews);
  const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<ReviewReportReason>('OFF_TOPIC');
  const [reportDetails, setReportDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    setLocalReviews(reviews);
  }, [reviews]);

  const normalizedDistribution = useMemo(() => {
    if (ratingDistribution.length > 0) {
      return ratingDistribution;
    }

    return [5, 4, 3, 2, 1].map((stars) => {
      const count = localReviews.filter((review) => review.rating === stars).length;
      return {
        stars,
        count,
        percentage: totalReviews > 0 ? (count / totalReviews) * 100 : 0,
      };
    });
  }, [localReviews, ratingDistribution, totalReviews]);

  const sortedReviews = useMemo(() => {
    return [...localReviews].sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }

      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }

      return b.helpfulCount - a.helpfulCount;
    });
  }, [localReviews, sortBy]);

  const replyingReview = replyingReviewId
    ? localReviews.find((review) => review.id === replyingReviewId) ?? null
    : null;

  const openReplyModal = (review: ProductReviewResponse) => {
    setReplyingReviewId(review.id);
    setReplyDraft(review.brandReply?.content ?? '');
  };

  const submitReply = async () => {
    if (!brandRepliesEnabled) {
      toast.info('Brand replies are currently unavailable.');
      return;
    }

    if (!replyingReviewId || !replyDraft.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      const updated = await reviewsApi.replyToBrandReview(replyingReviewId, {
        brandReply: replyDraft.trim(),
      });

      setLocalReviews((current) =>
        current.map((review) =>
          review.id === replyingReviewId
            ? {
                ...review,
                brandReply: updated.brandReply,
              }
            : review,
        ),
      );
      toast.success('Reply saved');
      setReplyingReviewId(null);
      setReplyDraft('');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to save reply'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitReport = async () => {
    if (!brandRepliesEnabled) {
      toast.info('Review reporting is currently unavailable.');
      return;
    }

    if (!reportingReviewId) {
      return;
    }

    setSubmitting(true);
    try {
      await reviewsApi.reportBrandReview(reportingReviewId, {
        reason: reportReason,
        details: reportDetails.trim() || undefined,
      });
      toast.success('Review reported for moderation');
      setReportingReviewId(null);
      setReportReason('OFF_TOPIC');
      setReportDetails('');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Unable to report review'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="rounded-[28px] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-8 dark:border-amber-300/20 dark:from-amber-500/10 dark:via-white/5 dark:to-emerald-500/10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div className="text-center md:text-left">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700 dark:text-amber-200">
              Customer sentiment
            </div>
            <div className="mt-2 text-6xl font-bold text-gray-900 dark:text-white">
              {averageRating.toFixed(1)}
            </div>
            <div className="mt-2 text-lg text-gray-700 dark:text-gray-200">
              <RatingStars rating={Math.max(1, Math.round(averageRating || 0))} />
            </div>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Based on {totalReviews} published reviews
            </p>
          </div>

          <div className="space-y-2">
            {normalizedDistribution.map(({ stars, count, percentage }) => (
              <div key={stars} className="flex items-center gap-3">
                <span className="w-12 text-sm font-medium text-gray-700 dark:text-gray-300">
                  {stars} star
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="w-8 text-right text-sm text-gray-600 dark:text-gray-400">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Customer Reviews</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('recent')}
            className={`rounded-lg px-4 py-2 font-medium transition-all ${
              sortBy === 'recent'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            Most Recent
          </button>
          <button
            onClick={() => setSortBy('highest')}
            className={`rounded-lg px-4 py-2 font-medium transition-all ${
              sortBy === 'highest'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            Highest Rated
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-[28px] border border-gray-200 bg-gray-50 p-8 text-sm text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
          Loading reviews...
        </div>
      ) : sortedReviews.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-gray-200 p-8 text-center dark:border-white/10">
          <div className="text-lg font-semibold text-gray-900 dark:text-white">No reviews yet</div>
          <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Verified buyer feedback will appear here once customers start sharing their experience.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {sortedReviews.map((review) => {
            const displayName = getDisplayName(review);
            const avatar = resolveProfileImageSource(review.reviewer);
            const avatarFallback = getAvatarFallback(displayName, review.reviewer.username);
            const imageMedia = review.media.filter((media) => media.type === 'image');

            return (
              <Card key={review.id} variant="bordered" padding="lg" className="transition-shadow hover:shadow-lg">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
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
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-gray-900 dark:text-white">{displayName}</h4>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">
                            ✅ Verified buyer
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(review.createdAt)}
                        </p>
                        {review.variantSummary ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{review.variantSummary}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="shrink-0 text-amber-600 dark:text-amber-200">
                      <RatingStars rating={review.rating} size="sm" />
                    </div>
                  </div>

                  <p className="leading-relaxed text-gray-700 dark:text-gray-300">{review.content}</p>

                  {imageMedia.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {imageMedia.slice(0, 4).map((image, index) => (
                        <div
                          key={image.id || `${review.id}-${index}`}
                          className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 dark:border-white/10 dark:bg-white/5"
                        >
                          <MediaRenderer
                            kind="image"
                            src={image.url}
                            alt={`Review media ${index + 1}`}
                            className="h-28 w-full"
                            mediaClassName="h-full w-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {review.brandReply ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-400/20 dark:bg-emerald-400/10">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-200">
                        {review.brandReply.brandName} replied
                      </div>
                      <div className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-200">
                        {review.brandReply.content}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-3 text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
                    <div>👍 Helpful to {review.helpfulCount} shoppers</div>
                    {isOwner && brandRepliesEnabled ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openReplyModal(review)}
                          className="rounded-full border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-400/20 dark:text-emerald-200 dark:hover:bg-emerald-400/10"
                        >
                          {review.brandReply ? 'Edit reply' : 'Reply'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setReportingReviewId(review.id)}
                          className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 dark:border-rose-400/20 dark:text-rose-200 dark:hover:bg-rose-400/10"
                        >
                          Report review
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(replyingReview)}
        onClose={() => {
          if (!submitting) {
            setReplyingReviewId(null);
            setReplyDraft('');
          }
        }}
        title="Reply to review"
        size="md"
      >
        <div className="space-y-4">
          {replyingReview ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
              {replyingReview.content}
            </div>
          ) : null}
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">
              Brand reply
            </label>
            <textarea
              value={replyDraft}
              onChange={(event) => setReplyDraft(event.target.value)}
              rows={6}
              maxLength={2000}
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-emerald-400 dark:border-white/10 dark:bg-[#0f1116] dark:text-white"
              placeholder="Share a clear, professional response for the buyer."
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setReplyingReviewId(null);
                setReplyDraft('');
              }}
              className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submitReply()}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting || !replyDraft.trim()}
            >
              {submitting ? 'Saving...' : 'Save reply'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(reportingReviewId)}
        onClose={() => {
          if (!submitting) {
            setReportingReviewId(null);
            setReportReason('OFF_TOPIC');
            setReportDetails('');
          }
        }}
        title="Report review"
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">
              Reason
            </label>
            <select
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value as ReviewReportReason)}
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-rose-400 dark:border-white/10 dark:bg-[#0f1116] dark:text-white"
            >
              <option value="SPAM">Spam</option>
              <option value="HARASSMENT">Harassment</option>
              <option value="HATE">Hate</option>
              <option value="OFF_TOPIC">Off topic</option>
              <option value="COUNTERFEIT">Counterfeit claim</option>
              <option value="MEDIA_POLICY">Media policy</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">
              Details
            </label>
            <textarea
              value={reportDetails}
              onChange={(event) => setReportDetails(event.target.value)}
              rows={4}
              maxLength={1000}
              className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-rose-400 dark:border-white/10 dark:bg-[#0f1116] dark:text-white"
              placeholder="Add any context moderators should review."
            />
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setReportingReviewId(null);
                setReportReason('OFF_TOPIC');
                setReportDetails('');
              }}
              className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submitReport()}
              className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? 'Reporting...' : 'Send report'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ReviewsTab;
