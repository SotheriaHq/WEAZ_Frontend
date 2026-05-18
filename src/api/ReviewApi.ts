import { apiClient } from './httpClient';
import { createIdempotencyKey } from './idempotency';

const extractData = <T,>(response: { data: unknown }): T => {
  const payload = response.data as { data?: T } | T;
  if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    return (payload as { data: T }).data;
  }
  return payload as T;
};

export type ReviewTargetType = 'PRODUCT' | 'COLLECTION' | 'DESIGN' | 'CUSTOM_ORDER' | 'BRAND';
export type ReviewSatisfaction = 'NONE' | 'ANGRY' | 'SAD' | 'OKAY' | 'HAPPY' | 'EXCITED';
export type ReviewStatus = 'APPROVED' | 'PENDING_MODERATION' | 'HIDDEN' | 'FLAGGED' | 'DELETED';
export type ReviewPromptStatus = 'PENDING' | 'SHOWN' | 'SKIPPED' | 'SUBMITTED' | 'EXPIRED';
export type ReviewReportReason = 'SPAM' | 'HARASSMENT' | 'HATE' | 'OFF_TOPIC' | 'COUNTERFEIT' | 'MEDIA_POLICY' | 'OTHER';

export type RatingBreakdown = { 1: number; 2: number; 3: number; 4: number; 5: number };
export type SatisfactionDistribution = Record<ReviewSatisfaction, number>;

export interface ReviewSummaryDto {
  averageRating: number;
  reviewCount: number;
  ratingBreakdown: RatingBreakdown;
  satisfactionDistribution: SatisfactionDistribution;
}

export interface ReviewDto {
  id: string;
  reviewerId: string;
  brandId: string | null;
  productId: string | null;
  collectionId: string | null;
  legacyCollectionId: string | null;
  designId: string | null;
  orderId: string | null;
  orderItemId: string | null;
  customOrderId: string | null;
  targetType: ReviewTargetType;
  rating: number;
  satisfaction: ReviewSatisfaction;
  reviewText: string | null;
  verifiedPurchase: boolean;
  status?: ReviewStatus;
  editWindowExpiresAt: string | null;
  editedAt: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string | null;
  canEdit: boolean;
  canDelete: boolean;
  hiddenReason?: string | null;
  target?: {
    type: ReviewTargetType;
    id?: string | null;
    name?: string | null;
    mediaUrl?: string | null;
    product?: Record<string, unknown> | null;
    collection?: Record<string, unknown> | null;
    legacyCollection?: Record<string, unknown> | null;
    design?: Record<string, unknown> | null;
    orderItem?: Record<string, unknown> | null;
    customOrder?: Record<string, unknown> | null;
  } | null;
  reviewer?: {
    id: string;
    username?: string | null;
    displayName?: string | null;
    profileImage?: string | null;
    email?: string | null;
  } | null;
}

export interface ReviewPromptDto {
  id: string;
  buyerId: string;
  orderId: string | null;
  orderItemId: string | null;
  customOrderId: string | null;
  productId: string | null;
  collectionId: string | null;
  legacyCollectionId: string | null;
  designId: string | null;
  brandId: string | null;
  targetType: ReviewTargetType;
  status: ReviewPromptStatus;
  shownAt: string | null;
  skippedAt: string | null;
  submittedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface ReviewEligibilityTargetDto {
  promptId?: string | null;
  buyerId: string;
  brandId?: string | null;
  productId?: string | null;
  collectionId?: string | null;
  legacyCollectionId?: string | null;
  designId?: string | null;
  orderId?: string | null;
  orderItemId?: string | null;
  customOrderId?: string | null;
  targetType: ReviewTargetType;
  eligible: boolean;
  reason?: string;
}

export interface ReviewEligibilityDto {
  orderId?: string;
  customOrderId?: string;
  targets: ReviewEligibilityTargetDto[];
}

export interface ReviewListDto {
  items: ReviewDto[];
  summary: ReviewSummaryDto;
  nextCursor: string | null;
}

export interface MyReviewsListDto {
  items: ReviewDto[];
  nextCursor: string | null;
}

export interface BrandLifecycleReviewSummaryDto extends ReviewSummaryDto {
  statusCounts: Record<ReviewStatus, number>;
  targetTypeCounts: Record<ReviewTargetType, number>;
  flaggedCount: number;
  hiddenCount: number;
  deletedCount: number;
  pendingModerationCount: number;
}

export interface BrandLifecycleBreakdownTargetDto {
  targetType: ReviewTargetType;
  targetId: string | null;
  name: string | null;
  reviewCount: number;
  averageRating: number;
}

export interface BrandLifecycleDashboardDto {
  items: ReviewDto[];
  summary: BrandLifecycleReviewSummaryDto;
  breakdown: {
    targets: BrandLifecycleBreakdownTargetDto[];
  };
  nextCursor: string | null;
}

export interface SubmitReviewPayload {
  promptId?: string;
  targetType: ReviewTargetType;
  orderId?: string | null;
  orderItemId?: string | null;
  customOrderId?: string | null;
  productId?: string | null;
  collectionId?: string | null;
  legacyCollectionId?: string | null;
  designId?: string | null;
  brandId?: string | null;
  rating: number;
  satisfaction: ReviewSatisfaction;
  reviewText?: string;
}

export interface UpdateReviewPayload {
  rating?: number;
  satisfaction?: ReviewSatisfaction;
  reviewText?: string;
}

export type ReviewQueryParams = {
  cursor?: string;
  limit?: number;
  sort?: 'newest' | 'highest_rating' | 'lowest_rating' | 'most_helpful';
  filter?: 'all' | '1' | '2' | '3' | '4' | '5' | 'with_media';
};

export type MyReviewQueryParams = {
  cursor?: string;
  limit?: number;
  status?: ReviewStatus;
  targetType?: ReviewTargetType;
  includeDeleted?: boolean;
};

export type BrandLifecycleReviewQueryParams = {
  cursor?: string;
  limit?: number;
  status?: ReviewStatus;
  targetType?: ReviewTargetType;
  productId?: string;
  collectionId?: string;
  legacyCollectionId?: string;
  designId?: string;
  rating?: number;
  dateFrom?: string;
  dateTo?: string;
};

export class ReviewApiError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, options?: { status?: number; code?: string }) {
    super(message);
    this.name = 'ReviewApiError';
    this.status = options?.status;
    this.code = options?.code;
  }
}

const toDateString = (value: unknown): string | null => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
};

const emptyRatingBreakdown: RatingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
const emptySatisfactionDistribution: SatisfactionDistribution = {
  NONE: 0,
  ANGRY: 0,
  SAD: 0,
  OKAY: 0,
  HAPPY: 0,
  EXCITED: 0,
};

export const normalizeReviewApiError = (error: unknown, fallback = 'Review request failed') => {
  const response = (error as { response?: { status?: number; data?: { message?: string | string[]; code?: string } } })?.response;
  const rawMessage = response?.data?.message;
  const message = Array.isArray(rawMessage) ? rawMessage[0] : rawMessage;
  return new ReviewApiError(message || fallback, {
    status: response?.status,
    code: response?.data?.code || message,
  });
};

export const normalizeReview = (raw: any, viewerId?: string | null): ReviewDto => {
  const editWindowExpiresAt = toDateString(raw?.editWindowExpiresAt);
  const status = raw?.status as ReviewStatus | undefined;
  const isOwner = Boolean(viewerId && raw?.reviewerId === viewerId);
  const editWindowOpen = editWindowExpiresAt ? Date.now() < new Date(editWindowExpiresAt).getTime() : false;
  const hiddenOrDeleted = status === 'DELETED' || status === 'HIDDEN';

  return {
    id: String(raw?.id ?? ''),
    reviewerId: String(raw?.reviewerId ?? ''),
    brandId: raw?.brandId ?? null,
    productId: raw?.productId ?? null,
    collectionId: raw?.collectionId ?? null,
    legacyCollectionId: raw?.legacyCollectionId ?? null,
    designId: raw?.designId ?? null,
    orderId: raw?.orderId ?? null,
    orderItemId: raw?.orderItemId ?? null,
    customOrderId: raw?.customOrderId ?? null,
    targetType: (raw?.targetType ?? 'PRODUCT') as ReviewTargetType,
    rating: Number(raw?.rating ?? 0),
    satisfaction: (raw?.satisfaction ?? 'NONE') as ReviewSatisfaction,
    reviewText: raw?.reviewText ?? null,
    verifiedPurchase: Boolean(raw?.verifiedPurchase ?? true),
    status,
    editWindowExpiresAt,
    editedAt: toDateString(raw?.editedAt),
    deletedAt: toDateString(raw?.deletedAt),
    createdAt: toDateString(raw?.createdAt) ?? new Date(0).toISOString(),
    updatedAt: toDateString(raw?.updatedAt),
    canEdit: typeof raw?.canEdit === 'boolean' ? raw.canEdit : Boolean(isOwner && editWindowOpen && !hiddenOrDeleted),
    canDelete: typeof raw?.canDelete === 'boolean' ? raw.canDelete : Boolean(isOwner && status !== 'DELETED'),
    hiddenReason: raw?.hiddenReason ?? null,
    target: raw?.target ?? null,
    reviewer: raw?.reviewer ?? null,
  };
};

const normalizePrompt = (raw: any): ReviewPromptDto => ({
  id: String(raw?.id ?? ''),
  buyerId: String(raw?.buyerId ?? ''),
  orderId: raw?.orderId ?? null,
  orderItemId: raw?.orderItemId ?? null,
  customOrderId: raw?.customOrderId ?? null,
  productId: raw?.productId ?? null,
  collectionId: raw?.collectionId ?? null,
  legacyCollectionId: raw?.legacyCollectionId ?? null,
  designId: raw?.designId ?? null,
  brandId: raw?.brandId ?? null,
  targetType: (raw?.targetType ?? 'PRODUCT') as ReviewTargetType,
  status: (raw?.status ?? 'PENDING') as ReviewPromptStatus,
  shownAt: toDateString(raw?.shownAt),
  skippedAt: toDateString(raw?.skippedAt),
  submittedAt: toDateString(raw?.submittedAt),
  expiresAt: toDateString(raw?.expiresAt),
  createdAt: toDateString(raw?.createdAt) ?? new Date(0).toISOString(),
  updatedAt: toDateString(raw?.updatedAt),
});

const normalizeSummary = (raw: any): ReviewSummaryDto => ({
  averageRating: Number(raw?.averageRating ?? 0),
  reviewCount: Number(raw?.reviewCount ?? raw?.totalReviews ?? 0),
  ratingBreakdown: {
    ...emptyRatingBreakdown,
    ...(raw?.ratingBreakdown ?? {}),
  },
  satisfactionDistribution: {
    ...emptySatisfactionDistribution,
    ...(raw?.satisfactionDistribution ?? {}),
  },
});

const normalizeList = (raw: any, viewerId?: string | null): ReviewListDto => ({
  items: Array.isArray(raw?.items) ? raw.items.map((item: unknown) => normalizeReview(item, viewerId)) : [],
  summary: normalizeSummary(raw?.summary),
  nextCursor: raw?.nextCursor ?? null,
});

const normalizeMyReviewsList = (raw: any, viewerId?: string | null): MyReviewsListDto => ({
  items: Array.isArray(raw?.items) ? raw.items.map((item: unknown) => normalizeReview(item, viewerId)) : [],
  nextCursor: raw?.nextCursor ?? null,
});

const normalizeDashboardSummary = (raw: any): BrandLifecycleReviewSummaryDto => ({
  ...normalizeSummary(raw),
  statusCounts: {
    APPROVED: 0,
    PENDING_MODERATION: 0,
    HIDDEN: 0,
    FLAGGED: 0,
    DELETED: 0,
    ...(raw?.statusCounts ?? {}),
  },
  targetTypeCounts: {
    PRODUCT: 0,
    COLLECTION: 0,
    DESIGN: 0,
    CUSTOM_ORDER: 0,
    BRAND: 0,
    ...(raw?.targetTypeCounts ?? {}),
  },
  flaggedCount: Number(raw?.flaggedCount ?? raw?.statusCounts?.FLAGGED ?? 0),
  hiddenCount: Number(raw?.hiddenCount ?? raw?.statusCounts?.HIDDEN ?? 0),
  deletedCount: Number(raw?.deletedCount ?? raw?.statusCounts?.DELETED ?? 0),
  pendingModerationCount: Number(raw?.pendingModerationCount ?? raw?.statusCounts?.PENDING_MODERATION ?? 0),
});

const normalizeBrandDashboard = (raw: any, viewerId?: string | null): BrandLifecycleDashboardDto => ({
  items: Array.isArray(raw?.items) ? raw.items.map((item: unknown) => normalizeReview(item, viewerId)) : [],
  summary: normalizeDashboardSummary(raw?.summary),
  breakdown: {
    targets: Array.isArray(raw?.breakdown?.targets)
      ? raw.breakdown.targets.map((item: any) => ({
          targetType: (item?.targetType ?? 'PRODUCT') as ReviewTargetType,
          targetId: item?.targetId ?? null,
          name: item?.name ?? null,
          reviewCount: Number(item?.reviewCount ?? 0),
          averageRating: Number(item?.averageRating ?? 0),
        }))
      : [],
  },
  nextCursor: raw?.nextCursor ?? null,
});

const idempotencyHeaders = () => ({ 'Idempotency-Key': createIdempotencyKey() });

export const reviewApi = {
  async listReviewPrompts(): Promise<ReviewPromptDto[]> {
    try {
      const response = await apiClient.get('/reviews/prompts');
      const data = extractData<unknown[]>(response);
      return Array.isArray(data) ? data.map(normalizePrompt) : [];
    } catch (error) {
      throw normalizeReviewApiError(error, 'Unable to load review prompts');
    }
  },

  async getReviewEligibility(params: { orderId?: string; customOrderId?: string }): Promise<ReviewEligibilityDto> {
    try {
      const response = await apiClient.get('/reviews/eligibility', { params });
      return extractData<ReviewEligibilityDto>(response);
    } catch (error) {
      throw normalizeReviewApiError(error, 'Unable to load review eligibility');
    }
  },

  async getMyReviews(params?: MyReviewQueryParams, viewerId?: string | null): Promise<MyReviewsListDto> {
    try {
      const response = await apiClient.get('/reviews/me', { params });
      return normalizeMyReviewsList(extractData(response), viewerId);
    } catch (error) {
      throw normalizeReviewApiError(error, 'Unable to load your reviews');
    }
  },

  async submitReview(payload: SubmitReviewPayload): Promise<ReviewDto> {
    try {
      const response = await apiClient.post('/reviews', payload, { headers: idempotencyHeaders() });
      return normalizeReview(extractData(response));
    } catch (error) {
      throw normalizeReviewApiError(error, 'Unable to submit review');
    }
  },

  async updateReview(reviewId: string, payload: UpdateReviewPayload): Promise<ReviewDto> {
    try {
      const response = await apiClient.patch(`/reviews/${reviewId}`, payload, { headers: idempotencyHeaders() });
      return normalizeReview(extractData(response));
    } catch (error) {
      throw normalizeReviewApiError(error, 'Unable to update review');
    }
  },

  async deleteReview(reviewId: string): Promise<void> {
    try {
      await apiClient.delete(`/reviews/${reviewId}`, { headers: idempotencyHeaders() });
    } catch (error) {
      throw normalizeReviewApiError(error, 'Unable to delete review');
    }
  },

  async skipReviewPrompt(promptId: string): Promise<void> {
    try {
      await apiClient.post(`/reviews/prompts/${promptId}/skip`, {}, { headers: idempotencyHeaders() });
    } catch (error) {
      throw normalizeReviewApiError(error, 'Unable to skip review prompt');
    }
  },

  async getProductReviews(productId: string, params?: ReviewQueryParams, viewerId?: string | null): Promise<ReviewListDto> {
    try {
      const response = await apiClient.get(`/reviews/product/${productId}`, { params });
      return normalizeList(extractData(response), viewerId);
    } catch (error) {
      throw normalizeReviewApiError(error, 'Unable to load product reviews');
    }
  },

  async getCollectionReviews(collectionId: string, params?: ReviewQueryParams, viewerId?: string | null): Promise<ReviewListDto> {
    try {
      const response = await apiClient.get(`/reviews/collection/${collectionId}`, { params });
      return normalizeList(extractData(response), viewerId);
    } catch (error) {
      throw normalizeReviewApiError(error, 'Unable to load collection reviews');
    }
  },

  async getDesignReviews(designId: string, params?: ReviewQueryParams, viewerId?: string | null): Promise<ReviewListDto> {
    try {
      const response = await apiClient.get(`/reviews/design/${designId}`, { params });
      return normalizeList(extractData(response), viewerId);
    } catch (error) {
      throw normalizeReviewApiError(error, 'Unable to load design reviews');
    }
  },

  async getBrandReviews(brandId: string, params?: ReviewQueryParams, viewerId?: string | null): Promise<ReviewListDto> {
    try {
      const response = await apiClient.get(`/reviews/brand/${brandId}`, { params });
      return normalizeList(extractData(response), viewerId);
    } catch (error) {
      throw normalizeReviewApiError(error, 'Unable to load brand reviews');
    }
  },

  async getBrandReviewSummary(brandId: string): Promise<ReviewSummaryDto> {
    try {
      const response = await apiClient.get(`/reviews/brand/${brandId}/summary`);
      return normalizeSummary(extractData(response));
    } catch (error) {
      throw normalizeReviewApiError(error, 'Unable to load brand review summary');
    }
  },

  async getBrandLifecycleDashboard(params?: BrandLifecycleReviewQueryParams, viewerId?: string | null): Promise<BrandLifecycleDashboardDto> {
    try {
      const response = await apiClient.get('/brands/reviews/lifecycle', { params });
      return normalizeBrandDashboard(extractData(response), viewerId);
    } catch (error) {
      throw normalizeReviewApiError(error, 'Unable to load brand review dashboard');
    }
  },

  async reportBrandLifecycleReview(
    reviewId: string,
    payload: { reason: ReviewReportReason; details?: string },
    viewerId?: string | null,
  ): Promise<ReviewDto> {
    try {
      const response = await apiClient.post(`/brands/reviews/lifecycle/${reviewId}/report`, payload, { headers: idempotencyHeaders() });
      return normalizeReview(extractData(response), viewerId);
    } catch (error) {
      throw normalizeReviewApiError(error, 'Unable to report review');
    }
  },
};

export default reviewApi;
