import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import reviewApi, { type ReviewDto, type ReviewListDto, type ReviewSummaryDto, type UpdateReviewPayload } from '@/api/ReviewApi';
import type { RootState } from '@/store';
import DeleteReviewConfirmDialog from './DeleteReviewConfirmDialog';
import ReviewCard from './ReviewCard';
import ReviewFormModal from './ReviewFormModal';
import ReviewSummary from './ReviewSummary';

type ProductReviewSectionProps = {
  productId: string;
};

const emptySummary: ReviewSummaryDto = {
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
};

const ProductReviewSection: React.FC<ProductReviewSectionProps> = ({ productId }) => {
  const currentUserId = useSelector((state: RootState) => state.user.profile?.id ?? null);
  const [items, setItems] = useState<ReviewDto[]>([]);
  const [summary, setSummary] = useState<ReviewSummaryDto>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featureDisabled, setFeatureDisabled] = useState(false);
  const [editingReview, setEditingReview] = useState<ReviewDto | null>(null);
  const [deleteReview, setDeleteReview] = useState<ReviewDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const applyList = useCallback((response: ReviewListDto) => {
    setItems(response.items);
    setSummary(response.summary);
  }, []);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    setFeatureDisabled(false);
    try {
      const response = await reviewApi.getProductReviews(productId, { limit: 20 }, currentUserId);
      applyList(response);
    } catch (nextError) {
      const status = (nextError as { status?: number })?.status;
      if (status === 403) {
        setFeatureDisabled(true);
        setItems([]);
        setSummary(emptySummary);
      } else {
        setError(nextError instanceof Error ? nextError.message : 'Unable to load reviews.');
      }
    } finally {
      setLoading(false);
    }
  }, [applyList, currentUserId, productId]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [items],
  );

  const handleEdit = async (payload: UpdateReviewPayload) => {
    if (!editingReview) return;
    const updated = await reviewApi.updateReview(editingReview.id, payload);
    setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setEditingReview(null);
    toast.success('Review updated');
  };

  const handleDelete = async () => {
    if (!deleteReview) return;
    setDeleting(true);
    try {
      await reviewApi.deleteReview(deleteReview.id);
      setItems((current) => current.filter((item) => item.id !== deleteReview.id));
      setSummary((current) => ({ ...current, reviewCount: Math.max(0, current.reviewCount - 1) }));
      toast.success('Review deleted');
      setDeleteReview(null);
    } catch (nextError) {
      toast.error(nextError instanceof Error ? nextError.message : 'Unable to delete review');
    } finally {
      setDeleting(false);
    }
  };

  if (featureDisabled) {
    return null;
  }

  return (
    <section className="mt-10 space-y-5 rounded-2xl border border-gray-200 bg-white/85 p-6 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.03] md:p-8">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
          Reviews
        </div>
        <h2 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
          Verified buyer feedback
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Reviews come from completed Threadly orders and are optional for buyers.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-32 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/10" />
          <div className="h-28 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/10" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
          <p className="font-semibold">Reviews are unavailable</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={() => void loadReviews()}
            className="mt-4 rounded-full border border-red-200 px-4 py-2 text-sm font-semibold hover:bg-red-100 dark:border-red-500/20 dark:hover:bg-red-500/10"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <ReviewSummary summary={summary} />

          {sortedItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-white/15">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">No verified reviews yet.</p>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                The first completed-order review for this product will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedItems.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  currentUserId={currentUserId}
                  onEdit={setEditingReview}
                  onDelete={setDeleteReview}
                />
              ))}
            </div>
          )}
        </>
      )}

      <ReviewFormModal
        open={Boolean(editingReview)}
        mode="edit"
        review={editingReview}
        onClose={() => setEditingReview(null)}
        onSubmit={(payload) => handleEdit(payload as UpdateReviewPayload)}
      />
      <DeleteReviewConfirmDialog
        open={Boolean(deleteReview)}
        loading={deleting}
        onCancel={() => setDeleteReview(null)}
        onConfirm={handleDelete}
      />
    </section>
  );
};

export default ProductReviewSection;
