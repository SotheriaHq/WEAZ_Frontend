import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import UniversalSelect from '@/components/forms/UniversalSelect';
import DeleteReviewConfirmDialog from '@/components/reviews/DeleteReviewConfirmDialog';
import ReviewCard from '@/components/reviews/ReviewCard';
import ReviewFormModal from '@/components/reviews/ReviewFormModal';
import reviewApi, {
  type ReviewDto,
  type ReviewTargetType,
  type UpdateReviewPayload,
} from '@/api/ReviewApi';

type ReviewFilter = 'ALL' | 'EDITABLE' | 'EXPIRED' | ReviewTargetType;

const FILTER_OPTIONS: Array<{ value: ReviewFilter; label: string }> = [
  { value: 'ALL', label: 'All reviews' },
  { value: 'EDITABLE', label: 'Editable' },
  { value: 'EXPIRED', label: 'Edit window expired' },
  { value: 'PRODUCT', label: 'Products' },
  { value: 'BRAND', label: 'Brands' },
  { value: 'COLLECTION', label: 'Collections' },
  { value: 'DESIGN', label: 'Designs' },
  { value: 'CUSTOM_ORDER', label: 'Custom orders' },
];

const targetName = (review: ReviewDto) =>
  review.target?.name ||
  review.productId ||
  review.collectionId ||
  review.legacyCollectionId ||
  review.designId ||
  review.customOrderId ||
  review.brandId ||
  'Verified purchase';

const editWindowLabel = (review: ReviewDto) => {
  if (review.canEdit) return 'Editable now';
  if (!review.editWindowExpiresAt) return 'Edit unavailable';
  return `Edit window expired ${new Date(review.editWindowExpiresAt).toLocaleString()}`;
};

export default function MyReviewsPage() {
  const [reviews, setReviews] = useState<ReviewDto[]>([]);
  const [filter, setFilter] = useState<ReviewFilter>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingReview, setEditingReview] = useState<ReviewDto | null>(null);
  const [deleteReview, setDeleteReview] = useState<ReviewDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await reviewApi.getMyReviews({ limit: 50 });
      setReviews(response.items);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load your reviews');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const filteredReviews = useMemo(() => {
    const sorted = [...reviews].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    if (filter === 'ALL') return sorted;
    if (filter === 'EDITABLE') return sorted.filter((review) => review.canEdit);
    if (filter === 'EXPIRED') {
      return sorted.filter((review) => !review.canEdit && review.status !== 'DELETED');
    }
    return sorted.filter((review) => review.targetType === filter);
  }, [filter, reviews]);

  const handleEdit = async (payload: UpdateReviewPayload) => {
    if (!editingReview) return;
    const updated = await reviewApi.updateReview(editingReview.id, payload);
    setReviews((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setEditingReview(null);
    toast.success('Review updated');
  };

  const handleDelete = async () => {
    if (!deleteReview) return;
    setDeleting(true);
    try {
      await reviewApi.deleteReview(deleteReview.id);
      setReviews((current) => current.filter((item) => item.id !== deleteReview.id));
      toast.success('Review deleted');
      setDeleteReview(null);
    } catch (nextError) {
      toast.error(nextError instanceof Error ? nextError.message : 'Unable to delete review');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-300">
            Verified lifecycle reviews
          </p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900 dark:text-white">My Reviews</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            Manage reviews tied to completed orders. Edit controls disappear when the original 24-hour window closes; delete remains available anytime.
          </p>
        </div>
        <div className="w-full md:w-64">
          <UniversalSelect
            value={filter}
            onChange={(value) => setFilter(value as ReviewFilter)}
            options={FILTER_OPTIONS}
            placeholder="Filter reviews"
          />
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
          <p className="font-semibold">Reviews could not load</p>
          <p className="mt-1">{error}</p>
          <button
            type="button"
            onClick={() => void loadReviews()}
            className="mt-3 rounded-full border border-red-200 px-4 py-2 text-xs font-semibold hover:bg-red-100 dark:border-red-500/20 dark:hover:bg-red-500/10"
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/10" />
          ))}
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white/80 p-10 text-center dark:border-white/15 dark:bg-white/[0.03]">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">No reviews match this view.</p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Completed-order reviews you submit will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReviews.map((review) => (
            <div key={review.id} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs dark:border-white/10 dark:bg-white/[0.03]">
                <span className="font-semibold text-gray-700 dark:text-gray-200">
                  {review.targetType} · {targetName(review)}
                </span>
                <span className="text-gray-500 dark:text-gray-400">{editWindowLabel(review)}</span>
              </div>
              <ReviewCard
                review={review}
                currentUserId={review.reviewerId}
                onEdit={setEditingReview}
                onDelete={setDeleteReview}
              />
            </div>
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
    </main>
  );
}
