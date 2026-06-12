import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import Modal from '@/components/ui/Modal';
import MediaRenderer from '@/components/media/MediaRenderer';
import { reviewsApi, type ProductReviewResponse, type ReviewMediaItem } from '@/api/ReviewsApi';
import { useReviewRuntimeFlags } from '@/hooks/useReviewRuntimeFlags';

type ReviewableOrderItem = {
  orderItemId?: string;
  id?: string;
  productId: string;
  productName?: string | null;
  thumbnail?: string | null;
  selectedSize?: string | null;
  selectedColor?: string | null;
  reviewState?: 'CAN_CREATE' | 'ALREADY_REVIEWED' | 'BLOCKED_BY_DISPUTE' | 'NOT_DELIVERED';
  existingReviewId?: string | null;
};

type ReviewComposerModalProps = {
  open: boolean;
  onClose: () => void;
  orderItem: ReviewableOrderItem | null;
  reviewId?: string | null;
  onSaved?: (review: ProductReviewResponse) => void | Promise<void>;
  onDeleted?: (reviewId: string) => void | Promise<void>;
};

type DraftMediaItem = ReviewMediaItem & {
  previewUrl?: string;
  uploading?: boolean;
};

const MAX_ATTACHMENTS = 4;

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

const normalizeMediaType = (file: File): 'image' | 'video' =>
  file.type.toLowerCase().startsWith('video/') ? 'video' : 'image';

const renderVariantSummary = (item: ReviewableOrderItem | null) => {
  if (!item) return null;
  const parts = [
    item.selectedSize ? `Size ${item.selectedSize}` : null,
    item.selectedColor ? `Color ${item.selectedColor}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : null;
};

const ReviewComposerModal: React.FC<ReviewComposerModalProps> = ({
  open,
  onClose,
  orderItem,
  reviewId,
  onSaved,
  onDeleted,
}) => {
  const { flags, isLoading: flagsLoading } = useReviewRuntimeFlags();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<DraftMediaItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!open || flagsLoading || flags.writeEnabled) {
      return;
    }

    toast.info('Reviews are currently unavailable.');
    onClose();
  }, [flags.writeEnabled, flagsLoading, onClose, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (flagsLoading) {
      return;
    }

    if (!flags.writeEnabled) {
      setLoading(false);
      return;
    }

    if (!reviewId) {
      setRating(5);
      setTitle('');
      setContent('');
      setMedia([]);
      return;
    }

    let active = true;
    setLoading(true);
    void reviewsApi
      .getMyReview(reviewId)
      .then((review) => {
        if (!active) return;
        setRating(review.rating);
        setTitle(review.title ?? '');
        setContent(review.content);
        setMedia(review.media);
      })
      .catch((error) => {
        if (!active) return;
        toast.error(getApiErrorMessage(error, 'Failed to load review'));
        onClose();
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [open, reviewId, onClose, flags.writeEnabled, flagsLoading]);

  useEffect(() => {
    const previewUrls = previewUrlsRef.current;
    if (!open) {
      for (const previewUrl of previewUrls) {
        URL.revokeObjectURL(previewUrl);
      }
      previewUrls.clear();
    }

    return () => {
      for (const previewUrl of previewUrls) {
        URL.revokeObjectURL(previewUrl);
      }
      previewUrls.clear();
    };
  }, [open]);

  const variantSummary = useMemo(() => renderVariantSummary(orderItem), [orderItem]);
  const mediaIds = media.filter((item) => !item.uploading).map((item) => item.id);
  const isEditing = Boolean(reviewId);

  const handleFileSelection = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (files.length === 0) {
      return;
    }

    const existingVideoCount = media.filter((item) => item.type === 'video').length;
    const incomingVideoCount = files.filter((file) => normalizeMediaType(file) === 'video').length;
    if (media.length + files.length > MAX_ATTACHMENTS) {
      toast.error(`You can attach up to ${MAX_ATTACHMENTS} files.`);
      return;
    }
    if (existingVideoCount + incomingVideoCount > 1) {
      toast.error('You can attach at most one video to a review.');
      return;
    }

    for (const file of files) {
      const type = normalizeMediaType(file);
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.add(previewUrl);
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setMedia((current) => [
        ...current,
        { id: tempId, url: previewUrl, type, previewUrl, uploading: true },
      ]);

      try {
        const uploaded = type === 'video'
          ? await reviewsApi.uploadReviewVideo(file)
          : await reviewsApi.uploadReviewImage(file);

        URL.revokeObjectURL(previewUrl);
        previewUrlsRef.current.delete(previewUrl);

        setMedia((current) =>
          current.map((item) =>
            item.id === tempId
              ? {
                  id: uploaded.id,
                  url: uploaded.url,
                  type,
                }
              : item,
          ),
        );
      } catch (error) {
        URL.revokeObjectURL(previewUrl);
        previewUrlsRef.current.delete(previewUrl);
        setMedia((current) => current.filter((item) => item.id !== tempId));
        toast.error(getApiErrorMessage(error, 'Failed to upload review media'));
      }
    }
  };

  const handleRemoveMedia = (mediaId: string) => {
    setMedia((current) => {
      const target = current.find((item) => item.id === mediaId);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
        previewUrlsRef.current.delete(target.previewUrl);
      }
      return current.filter((item) => item.id !== mediaId);
    });
  };

  const handleSave = async () => {
    if (!flags.writeEnabled) {
      toast.error('Reviews are currently unavailable.');
      return;
    }
    if (!orderItem?.productId || !(orderItem.orderItemId || orderItem.id)) {
      toast.error('Review context is missing.');
      return;
    }
    if (!content.trim()) {
      toast.error('Write a short review before saving.');
      return;
    }
    if (media.some((item) => item.uploading)) {
      toast.error('Wait for uploads to finish before saving.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        rating,
        title: title.trim() || undefined,
        content: content.trim(),
        mediaIds,
      };
      const saved = reviewId
        ? await reviewsApi.updateReview(reviewId, payload)
        : await reviewsApi.createReview({
            productId: orderItem.productId,
            orderItemId: orderItem.orderItemId || orderItem.id || '',
            ...payload,
          });

      toast.success(reviewId ? 'Review updated.' : 'Review published.');
      await onSaved?.(saved);
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to save review'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!flags.writeEnabled) {
      toast.error('Reviews are currently unavailable.');
      return;
    }
    if (!reviewId) {
      return;
    }
    if (!window.confirm('Delete this review? This hides it from public feeds.')) {
      return;
    }

    setDeleting(true);
    try {
      await reviewsApi.deleteReview(reviewId);
      toast.success('Review deleted.');
      await onDeleted?.(reviewId);
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to delete review'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Edit Review' : 'Write Review'}
      size="lg"
    >
      {!orderItem ? null : (
        <div className="space-y-5">
          <div className="rounded-3xl border border-gray-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex items-start gap-4">
              {orderItem.thumbnail ? (
                <div className="h-20 w-20 overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10">
                  <MediaRenderer
                    kind="image"
                    src={orderItem.thumbnail}
                    alt={orderItem.productName || 'Review item'}
                    className="h-full w-full"
                    mediaClassName="h-full w-full object-cover"
                  />
                </div>
              ) : null}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {orderItem.productName || 'Purchased item'}
                </div>
                {variantSummary ? (
                  <div className="text-xs text-gray-500 dark:text-gray-400">✅ {variantSummary}</div>
                ) : null}
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Reviews are tied to delivered purchases only.
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-6 text-sm text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
              Loading review...
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
                  ⭐ Rating
                </div>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition-colors ${
                        rating === value
                          ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-200'
                          : 'border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-700 dark:border-white/10 dark:text-gray-300 dark:hover:border-amber-400/40 dark:hover:text-amber-200'
                      }`}
                    >
                      {`${'⭐'.repeat(value)}`}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
                  Headline
                </span>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={200}
                  className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none ring-0 transition-colors focus:border-emerald-400 dark:border-white/10 dark:bg-[#111118] dark:text-white"
                  placeholder="What stood out?"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
                  Review
                </span>
                <textarea
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  maxLength={5000}
                  rows={6}
                  className="w-full rounded-3xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none ring-0 transition-colors focus:border-emerald-400 dark:border-white/10 dark:bg-[#111118] dark:text-white"
                  placeholder="Share fit, quality, and what another buyer should know."
                />
              </label>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400">
                      📷 Media
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Up to four files. Use one video max.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={media.length >= MAX_ATTACHMENTS}
                    className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-gray-200 dark:hover:border-emerald-400/40 dark:hover:text-emerald-200"
                  >
                    Add media
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                  onChange={handleFileSelection}
                />

                {media.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 px-5 py-6 text-sm text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
                    Add photos or a short video if it helps show fit or finish.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {media.map((item) => (
                      <div key={item.id} className="overflow-hidden rounded-3xl border border-gray-200 bg-white dark:border-white/10 dark:bg-white/5">
                        <div className="relative h-28 w-full overflow-hidden bg-gray-50 dark:bg-white/5">
                          <MediaRenderer
                            kind={item.type}
                            src={item.url}
                            alt="Review media"
                            className="h-full w-full"
                            mediaClassName="h-full w-full object-cover"
                          />
                          {item.uploading ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-xs font-semibold text-white">
                              Uploading...
                            </div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMedia(item.id)}
                          className="w-full px-3 py-2 text-left text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-400/10"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4 dark:border-white/10">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {content.trim().length}/5000 characters
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {isEditing ? (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-rose-400/20 dark:text-rose-300 dark:hover:bg-rose-400/10"
                    >
                      {deleting ? 'Deleting...' : '🗑 Delete'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : isEditing ? '✅ Save Changes' : '✅ Publish Review'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
};

export default ReviewComposerModal;
