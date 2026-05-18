import { useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import type { ReviewDto, ReviewPromptDto, ReviewSatisfaction, SubmitReviewPayload, UpdateReviewPayload } from '@/api/ReviewApi';
import SatisfactionSelector from './SatisfactionSelector';
import StarRatingInput from './StarRatingInput';
import { promptTitle, REVIEW_TEXT_MAX_LENGTH, targetLabel } from './reviewDisplay';

type ReviewFormModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  prompt?: ReviewPromptDto | null;
  review?: ReviewDto | null;
  onClose: () => void;
  onSubmit: (payload: SubmitReviewPayload | UpdateReviewPayload) => Promise<void>;
};

export default function ReviewFormModal({
  open,
  mode,
  prompt,
  review,
  onClose,
  onSubmit,
}: ReviewFormModalProps) {
  const [rating, setRating] = useState(0);
  const [satisfaction, setSatisfaction] = useState<ReviewSatisfaction>('NONE');
  const [reviewText, setReviewText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRating(review?.rating ?? 0);
    setSatisfaction(review?.satisfaction ?? 'NONE');
    setReviewText(review?.reviewText ?? '');
    setError(null);
    setSubmitting(false);
  }, [open, review]);

  const title = useMemo(() => {
    if (mode === 'edit') return 'Edit review';
    if (prompt) return promptTitle(prompt);
    return 'Write a review';
  }, [mode, prompt]);

  const isValid = rating >= 1 && rating <= 5 && reviewText.length <= REVIEW_TEXT_MAX_LENGTH;

  const buildCreatePayload = (): SubmitReviewPayload => {
    if (!prompt) {
      return {
        targetType: review?.targetType ?? 'PRODUCT',
        orderId: review?.orderId,
        orderItemId: review?.orderItemId,
        customOrderId: review?.customOrderId,
        productId: review?.productId,
        collectionId: review?.collectionId,
        legacyCollectionId: review?.legacyCollectionId,
        designId: review?.designId,
        brandId: review?.brandId,
        rating,
        satisfaction,
        reviewText: reviewText.trim() || undefined,
      };
    }

    return {
      promptId: prompt.id,
      targetType: prompt.targetType,
      orderId: prompt.orderId,
      orderItemId: prompt.orderItemId,
      customOrderId: prompt.customOrderId,
      productId: prompt.productId,
      collectionId: prompt.collectionId,
      legacyCollectionId: prompt.legacyCollectionId,
      designId: prompt.designId,
      brandId: prompt.brandId,
      rating,
      satisfaction,
      reviewText: reviewText.trim() || undefined,
    };
  };

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(
        mode === 'edit'
          ? { rating, satisfaction, reviewText: reviewText.trim() || undefined }
          : buildCreatePayload(),
      );
      onClose();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to save review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={submitting ? () => undefined : onClose} title={title} size="md">
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Rating</p>
          <StarRatingInput value={rating} onChange={setRating} disabled={submitting} />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">How did it feel?</p>
          <SatisfactionSelector value={satisfaction} onChange={setSatisfaction} disabled={submitting} />
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            Written review <span className="font-normal text-gray-500">(optional)</span>
          </span>
          <textarea
            value={reviewText}
            maxLength={REVIEW_TEXT_MAX_LENGTH}
            onChange={(event) => setReviewText(event.target.value)}
            disabled={submitting}
            placeholder={`Share what stood out about this ${targetLabel(prompt?.targetType ?? review?.targetType ?? 'PRODUCT')}.`}
            className="min-h-32 w-full resize-y rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 disabled:opacity-60 dark:border-white/10 dark:bg-slate-950 dark:text-white"
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span>{reviewText.length}/{REVIEW_TEXT_MAX_LENGTH}</span>
          {mode === 'edit' && review?.editWindowExpiresAt ? (
            <span>Edit window expires {new Date(review.editWindowExpiresAt).toLocaleString()}</span>
          ) : null}
        </div>

        {error ? (
          <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} loading={submitting} disabled={!isValid || submitting}>
            {mode === 'edit' ? 'Save review' : 'Submit review'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
