import type { ReviewDto } from '@/api/ReviewApi';
import { formatEditWindow, formatReviewDate, getSatisfactionOption, targetLabel } from './reviewDisplay';

type ReviewCardProps = {
  review: ReviewDto;
  currentUserId?: string | null;
  onEdit?: (review: ReviewDto) => void;
  onDelete?: (review: ReviewDto) => void;
};

export default function ReviewCard({ review, currentUserId, onEdit, onDelete }: ReviewCardProps) {
  const mood = getSatisfactionOption(review.satisfaction);
  const isOwner = Boolean(currentUserId && review.reviewerId === currentUserId);
  const canEdit = Boolean(review.canEdit && isOwner);
  const canDelete = Boolean(review.canDelete && isOwner);

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-gray-900 dark:text-white">Verified buyer</span>
            {review.verifiedPurchase ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                Verified purchase
              </span>
            ) : null}
            {review.editedAt ? (
              <span className="text-[11px] text-gray-400 dark:text-gray-500">Edited</span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{formatReviewDate(review.createdAt)}</span>
            <span>•</span>
            <span>{targetLabel(review.targetType)}</span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm font-semibold text-amber-500" aria-label={`${review.rating} star review`}>
            {'★'.repeat(Math.max(0, Math.min(5, review.rating))).padEnd(5, '☆')}
          </div>
          <div className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${mood.toneClass}`}>
            <span aria-hidden="true">{mood.emoji}</span>
            {mood.label}
          </div>
        </div>
      </div>

      {review.reviewText ? (
        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-700 dark:text-gray-200">
          {review.reviewText}
        </p>
      ) : (
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">No written review.</p>
      )}

      {isOwner ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-white/10">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatEditWindow(review.editWindowExpiresAt)}
          </span>
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit?.(review);
                }}
                className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/10"
              >
                Edit
              </button>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete?.(review);
                }}
                className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-500/20 dark:text-red-300 dark:hover:bg-red-500/10"
              >
                Delete
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
