import React from 'react';
import ProductReviewSection from '@/components/reviews/ProductReviewSection';
import type { ProductReviewListResponse, ProductReviewResponse, ReviewReviewer } from '@/api/ReviewsApi';

export type ProductReview = ProductReviewResponse;
export type ReviewsSummary = ProductReviewListResponse['summary'];
export type ReviewUser = ReviewReviewer;

interface ProductReviewsProps {
  productId: string;
}

const ProductReviews: React.FC<ProductReviewsProps> = ({ productId }) => {
  return <ProductReviewSection productId={productId} />;
};

export default ProductReviews;