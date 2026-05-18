import React, { useMemo } from 'react';
import LifecycleReviewsTab from '@/components/reviews/ReviewsTab';
import type { ReviewDto, ReviewSummaryDto } from '@/api/ReviewApi';
import type { ProductReviewResponse } from '@/api/ReviewsApi';
import type { ReviewRatingDistributionItem } from '@/types/profile';

interface ReviewsTabProps {
  reviews: ProductReviewResponse[];
  averageRating: number;
  totalReviews: number;
  ratingDistribution: ReviewRatingDistributionItem[];
  isLoading?: boolean;
  isOwner?: boolean;
  brandRepliesEnabled?: boolean;
  brandId?: string | null;
  currentUserId?: string | null;
}

const emptySatisfactionDistribution: ReviewSummaryDto['satisfactionDistribution'] = {
  NONE: 0,
  ANGRY: 0,
  SAD: 0,
  OKAY: 0,
  HAPPY: 0,
  EXCITED: 0,
};

const ReviewsTab: React.FC<ReviewsTabProps> = ({
  reviews,
  averageRating,
  totalReviews,
  ratingDistribution,
  isLoading = false,
  brandId,
  currentUserId,
}) => {
  const legacySummary = useMemo<ReviewSummaryDto>(() => {
    const ratingBreakdown: ReviewSummaryDto['ratingBreakdown'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const item of ratingDistribution) {
      if (item.stars >= 1 && item.stars <= 5) {
        ratingBreakdown[item.stars as 1 | 2 | 3 | 4 | 5] = item.count;
      }
    }

    if (ratingDistribution.length === 0) {
      for (const review of reviews) {
        const rating = Math.max(1, Math.min(5, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5;
        ratingBreakdown[rating] += 1;
      }
    }

    return {
      averageRating,
      reviewCount: totalReviews,
      ratingBreakdown,
      satisfactionDistribution: emptySatisfactionDistribution,
    };
  }, [averageRating, ratingDistribution, reviews, totalReviews]);

  const legacyItems = useMemo<ReviewDto[]>(
    () =>
      reviews.map((review) => ({
        id: review.id,
        reviewerId: review.reviewer.id,
        brandId: null,
        productId: null,
        collectionId: null,
        legacyCollectionId: null,
        designId: null,
        orderId: null,
        orderItemId: null,
        customOrderId: null,
        targetType: 'PRODUCT',
        rating: review.rating,
        satisfaction: 'NONE',
        reviewText: review.content,
        verifiedPurchase: true,
        status: 'APPROVED',
        editWindowExpiresAt: null,
        editedAt: review.editedAt,
        deletedAt: null,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt,
        canEdit: false,
        canDelete: false,
      })),
    [reviews],
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-3">
        <div className="h-36 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/10" />
        <div className="h-32 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/10" />
        <div className="h-32 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/10" />
      </div>
    );
  }

  return (
    <LifecycleReviewsTab
      brandId={brandId}
      currentUserId={currentUserId}
      initialItems={legacyItems}
      initialSummary={legacySummary}
    />
  );
};

export default ReviewsTab;
