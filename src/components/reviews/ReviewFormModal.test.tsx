import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReviewFormModal from './ReviewFormModal';
import type { ReviewPromptDto } from '@/api/ReviewApi';

vi.mock('@/components/ui/Modal', () => ({
  default: ({ open, title, children }: { open: boolean; title?: string; children: React.ReactNode }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

const prompt: ReviewPromptDto = {
  id: 'prompt-1',
  buyerId: 'buyer-1',
  orderId: 'order-1',
  orderItemId: 'item-1',
  customOrderId: null,
  productId: 'product-1',
  collectionId: null,
  legacyCollectionId: null,
  designId: null,
  brandId: 'brand-1',
  targetType: 'PRODUCT',
  status: 'SHOWN',
  shownAt: null,
  skippedAt: null,
  submittedAt: null,
  expiresAt: null,
  createdAt: '2026-05-18T10:00:00.000Z',
  updatedAt: null,
};

describe('ReviewFormModal', () => {
  it('requires a rating before submitting a lifecycle review', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ReviewFormModal
        open
        mode="create"
        prompt={prompt}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole('button', { name: 'Submit review' })).toHaveProperty('disabled', true);

    fireEvent.click(screen.getByRole('radio', { name: '5 stars' }));
    fireEvent.change(screen.getByPlaceholderText(/Share what stood out/i), {
      target: { value: 'Excellent tailoring.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit review' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      promptId: 'prompt-1',
      rating: 5,
      satisfaction: 'NONE',
      reviewText: 'Excellent tailoring.',
    }));
  });
});
