import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import reviewApi, { type ReviewDto, type ReviewListDto, type ReviewSummaryDto, type UpdateReviewPayload } from '@/api/ReviewApi';
import DeleteReviewConfirmDialog from './DeleteReviewConfirmDialog';
import ReviewCard from './ReviewCard';
import ReviewFormModal from './ReviewFormModal';
import ReviewSummary from './ReviewSummary';

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

type ReviewsTabProps = {
  brandId?: string | null;
  currentUserId?: string | null;
  initialItems?: ReviewDto[];
  initialSummary?: ReviewSummaryDto;
};

function ReviewSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-36 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/10" />
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-32 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/10" />
      ))}
    </div>
  );
}

export default function ReviewsTab({
  brandId,
  currentUserId,
  initialItems = [],
  initialSummary = emptySummary,
}: ReviewsTabProps) {
  const [items, setItems] = useState<ReviewDto[]>(initialItems);
  const [summary, setSummary] = useState<ReviewSummaryDto>(initialSummary);
  const [loading, setLoading] = useState(Boolean(brandId));
  const [error, setError] = useState<string | null>(null);
  const [featureDisabled, setFeatureDisabled] = useState(false);
  const [editingReview, setEditingReview] = useState<ReviewDto | null>(null);
  const [deleteReview, setDeleteReview] = useState<ReviewDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const applyList = useCallback((list: ReviewListDto) => {
    setItems(list.items);
    setSummary(list.summary);
  }, []);

  const load = useCallback(async () => {
    if (!brandId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setFeatureDisabled(false);
    try {
      const response = await reviewApi.getBrandReviews(brandId, { limit: 20 }, currentUserId);
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
  }, [applyList, brandId, currentUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasReviews = items.length > 0;
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
      setSummary((current) => ({
        ...current,
        reviewCount: Math.max(0, current.reviewCount - 1),
      }));
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

  if (loading) {
    return <ReviewSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/20 dark:bg-red-500/10">
        <p className="text-sm font-semibold text-red-700 dark:text-red-200">Reviews are unavailable</p>
        <p className="mt-1 text-sm text-red-600 dark:text-red-200/80">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 dark:border-red-500/20 dark:text-red-200 dark:hover:bg-red-500/10"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-6xl space-y-5">
      <ReviewSummary summary={summary} />

      {!hasReviews ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white/80 p-10 text-center dark:border-white/15 dark:bg-white/[0.03]">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">No verified reviews yet.</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Buyer feedback will appear here after completed orders are reviewed.
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
}
