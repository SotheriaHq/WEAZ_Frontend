import { apiClient } from './httpClient';
import { WEB_UPLOAD_POLICIES, assertValidUploadFile } from '@/utils/uploadValidation';

const extractData = <T,>(response: { data: unknown }): T => {
  const payload = response.data as { data?: T } | T;
  if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    return (payload as { data: T }).data;
  }

  return payload as T;
};

export type ReviewSortOption = 'newest' | 'highest_rating' | 'lowest_rating' | 'most_helpful';
export type ReviewFilterOption = 'all' | '1' | '2' | '3' | '4' | '5' | 'with_media';
export type ReviewReportReason =
  | 'SPAM'
  | 'HARASSMENT'
  | 'HATE'
  | 'OFF_TOPIC'
  | 'COUNTERFEIT'
  | 'MEDIA_POLICY'
  | 'OTHER';

export interface ReviewReviewer {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profileImage: string | null;
  profileImageId: string | null;
  profileImageFile: { id: string; s3Url: string } | null;
}

export interface ReviewMediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
}

export interface BrandReplyPayload {
  content: string;
  brandId: string;
  brandName: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface ProductReviewResponse {
  id: string;
  rating: number;
  title: string | null;
  content: string;
  helpfulCount: number;
  viewerHasMarkedHelpful: boolean;
  status: 'PUBLISHED';
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  variantSummary: string | null;
  media: ReviewMediaItem[];
  reviewer: ReviewReviewer;
  brandReply: BrandReplyPayload | null;
}

export interface ProductReviewListResponse {
  items: ProductReviewResponse[];
  summary: {
    averageRating: number;
    totalReviews: number;
    ratingBreakdown: { 1: number; 2: number; 3: number; 4: number; 5: number };
  };
  nextCursor: string | null;
}

export interface ReviewRuntimeFlags {
  readEnabled: boolean;
  writeEnabled: boolean;
  brandRepliesEnabled: boolean;
}

export interface CreateProductReviewPayload {
  productId: string;
  orderItemId: string;
  rating: number;
  title?: string;
  content: string;
  mediaIds?: string[];
}

export interface UpdateProductReviewPayload {
  rating?: number;
  title?: string;
  content?: string;
  mediaIds?: string[];
}

export interface UploadedReviewAsset {
  id: string;
  url: string;
  mimeType: string;
  fileType: string;
}

type GetProductReviewParams = {
  cursor?: string;
  limit?: number;
  sort?: ReviewSortOption;
  filter?: ReviewFilterOption;
};

const uploadReviewFile = async (
  file: File,
  endpoint: 'review-image' | 'review-video',
): Promise<UploadedReviewAsset> => {
  assertValidUploadFile(
    file,
    endpoint === 'review-video'
      ? WEB_UPLOAD_POLICIES.reviewVideo
      : WEB_UPLOAD_POLICIES.reviewImage,
  );
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiClient.post(`/uploads/${endpoint}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return extractData<UploadedReviewAsset>(response);
};

export const reviewsApi = {
  async getRuntimeFlags(): Promise<ReviewRuntimeFlags> {
    const response = await apiClient.get('/store/reviews/runtime-flags');
    return extractData<ReviewRuntimeFlags>(response);
  },

  async getProductReviews(
    productId: string,
    params?: GetProductReviewParams,
  ): Promise<ProductReviewListResponse> {
    const response = await apiClient.get(`/store/products/${productId}/reviews`, {
      params,
    });
    return extractData<ProductReviewListResponse>(response);
  },

  async getBrandReviews(
    brandId: string,
    params?: GetProductReviewParams,
  ): Promise<ProductReviewListResponse> {
    const response = await apiClient.get(`/brands/${brandId}/reviews`, {
      params,
    });
    return extractData<ProductReviewListResponse>(response);
  },

  async getMyReview(reviewId: string): Promise<ProductReviewResponse> {
    const response = await apiClient.get(`/store/reviews/${reviewId}`);
    return extractData<ProductReviewResponse>(response);
  },

  async createReview(payload: CreateProductReviewPayload): Promise<ProductReviewResponse> {
    const response = await apiClient.post('/store/reviews', payload);
    return extractData<ProductReviewResponse>(response);
  },

  async updateReview(
    reviewId: string,
    payload: UpdateProductReviewPayload,
  ): Promise<ProductReviewResponse> {
    const response = await apiClient.patch(`/store/reviews/${reviewId}`, payload);
    return extractData<ProductReviewResponse>(response);
  },

  async deleteReview(reviewId: string): Promise<void> {
    await apiClient.delete(`/store/reviews/${reviewId}`);
  },

  async addHelpfulVote(reviewId: string): Promise<void> {
    await apiClient.post(`/store/reviews/${reviewId}/helpful`);
  },

  async removeHelpfulVote(reviewId: string): Promise<void> {
    await apiClient.delete(`/store/reviews/${reviewId}/helpful`);
  },

  async reportReview(
    reviewId: string,
    payload: { reason: ReviewReportReason; details?: string },
  ): Promise<void> {
    await apiClient.post(`/store/reviews/${reviewId}/report`, payload);
  },

  async replyToBrandReview(reviewId: string, payload: { brandReply: string }): Promise<ProductReviewResponse> {
    const response = await apiClient.patch(`/brands/reviews/${reviewId}/reply`, payload);
    return extractData<ProductReviewResponse>(response);
  },

  async reportBrandReview(
    reviewId: string,
    payload: { reason: ReviewReportReason; details?: string },
  ): Promise<void> {
    await apiClient.post(`/brands/reviews/${reviewId}/report`, payload);
  },

  async uploadReviewImage(file: File): Promise<UploadedReviewAsset> {
    return uploadReviewFile(file, 'review-image');
  },

  async uploadReviewVideo(file: File): Promise<UploadedReviewAsset> {
    return uploadReviewFile(file, 'review-video');
  },
};
