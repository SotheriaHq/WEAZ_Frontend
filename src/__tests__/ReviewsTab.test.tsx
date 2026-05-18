import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReviewsTab from '@/components/profile/tabs/ReviewsTab';
import type { ProductReviewResponse } from '@/api/ReviewsApi';

vi.mock('@/components/ui/Card', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/media/MediaRenderer', () => ({
  default: () => <div data-testid="media-renderer" />,
}));

vi.mock('@/components/ui/Modal', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const review: ProductReviewResponse = {
  id: 'review-1',
  rating: 5,
  title: 'Excellent',
  content: 'Strong fit and finish.',
  helpfulCount: 4,
  viewerHasMarkedHelpful: false,
  status: 'PUBLISHED',
  createdAt: '2026-03-10T10:00:00.000Z',
  updatedAt: '2026-03-10T10:00:00.000Z',
  editedAt: null,
  variantSummary: 'Size: M / Color: Navy',
  media: [],
  reviewer: {
    id: 'user-1',
    username: 'buyerone',
    firstName: 'Buyer',
    lastName: 'One',
    profileImage: null,
    profileImageId: null,
    profileImageFile: null,
  },
  brandReply: null,
};

describe('ReviewsTab', () => {
  it('hides owner reply actions when brand replies are disabled', () => {
    render(
      <ReviewsTab
        reviews={[review]}
        averageRating={5}
        totalReviews={1}
        ratingDistribution={[]}
        isOwner
        brandRepliesEnabled={false}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Report review' })).toBeNull();
  });
});
