import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MyReviewsPage from './MyReviewsPage';

const { getMyReviews, updateReview, deleteReview } = vi.hoisted(() => ({
  getMyReviews: vi.fn(),
  updateReview: vi.fn(),
  deleteReview: vi.fn(),
}));

vi.mock('@/api/ReviewApi', () => ({
  default: {
    getMyReviews,
    updateReview,
    deleteReview,
  },
}));

vi.mock('@/components/forms/UniversalSelect', () => ({
  default: ({
    value,
    onChange,
    options,
    placeholder,
  }: {
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
    placeholder?: string;
  }) => (
    <select aria-label={placeholder} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  ),
}));

vi.mock('@/components/reviews/ReviewCard', () => ({
  default: ({ review, onEdit, onDelete }: any) => (
    <article>
      <p>{review.reviewText}</p>
      {review.canEdit ? <button type="button" onClick={() => onEdit(review)}>Edit</button> : null}
      <button type="button" onClick={() => onDelete(review)}>Delete</button>
    </article>
  ),
}));

vi.mock('@/components/reviews/ReviewFormModal', () => ({
  default: ({ open, onSubmit }: any) =>
    open ? <button type="button" onClick={() => onSubmit({ rating: 4 })}>Save mocked review</button> : null,
}));

vi.mock('@/components/reviews/DeleteReviewConfirmDialog', () => ({
  default: ({ open, onConfirm }: any) =>
    open ? <button type="button" onClick={onConfirm}>Confirm delete</button> : null,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const review = {
  id: 'review-1',
  reviewerId: 'buyer-1',
  brandId: 'brand-1',
  productId: 'product-1',
  collectionId: null,
  legacyCollectionId: null,
  designId: null,
  orderId: 'order-1',
  orderItemId: 'item-1',
  customOrderId: null,
  targetType: 'PRODUCT',
  rating: 5,
  satisfaction: 'HAPPY',
  reviewText: 'Loved the fit.',
  verifiedPurchase: true,
  status: 'APPROVED',
  editWindowExpiresAt: '2026-05-19T10:00:00.000Z',
  editedAt: null,
  deletedAt: null,
  createdAt: '2026-05-18T10:00:00.000Z',
  updatedAt: '2026-05-18T10:00:00.000Z',
  canEdit: true,
  canDelete: true,
  target: { type: 'PRODUCT', id: 'product-1', name: 'Review Product' },
};

describe('MyReviewsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMyReviews.mockResolvedValue({ items: [review], nextCursor: null });
    updateReview.mockResolvedValue({ ...review, rating: 4 });
    deleteReview.mockResolvedValue(undefined);
  });

  it('loads buyer reviews and supports local edit/delete management', async () => {
    render(<MyReviewsPage />);

    expect(await screen.findByText('Loved the fit.')).toBeTruthy();
    expect(screen.getByText(/PRODUCT · Review Product/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save mocked review' }));
    await waitFor(() => expect(updateReview).toHaveBeenCalledWith('review-1', { rating: 4 }));

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    await waitFor(() => expect(deleteReview).toHaveBeenCalledWith('review-1'));
  });
});
