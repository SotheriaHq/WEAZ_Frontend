import type { CatalogEntityType } from '@/constants/catalogDomain';
import type { ContentPublicationStatus } from '@/utils/contentIntegrity';
import type { ProfilePhotoViewState } from './profilePhoto';

// Collection Types
export interface CollectionDto {
  id: string;
  entityType?: CatalogEntityType;
  status?: ContentPublicationStatus | 'ARCHIVED' | 'REMOVED' | string;
  publicationStatus?: ContentPublicationStatus | string | null;
  reviewMode?: string | null;
  submissionId?: string | null;
  name: string;
  description?: string;
  ownerId: string;
  title: string;
  isPublic: boolean;
  visibility?: 'PUBLIC' | 'PRIVATE';
  type?: 'MALE' | 'FEMALE' | 'EVERYBODY';
  domain?: 'DESIGN' | 'STORE';
  categoryId?: string;
  subCategoryId?: string;
  categoryTypeId?: string;
  coverImage?: string;
  coverFileId?: string;
  previewImages?: Array<{ url?: string | null; fileId?: string | null }>;
  deletedAt?: string | null;
  deleteExpiresAt?: string | null;
  itemCount?: number;
  createdAt: string;
  updatedAt: string;
  postsCount?: number;
  threadsCount?: number;
  commentsCount?: number;
  minPrice?: number;
  maxPrice?: number;
  saleMinPrice?: number | null;
  saleMaxPrice?: number | null;
  saleStartAt?: string | null;
  saleEndAt?: string | null;
  brandName?: string;
  username?: string;
  brandLogo?: string;
  brandLogoFileId?: string;
  isAvailableInStore?: boolean;
  isSystemGenerated?: boolean;
  tags?: string[];
  isThreaded?: boolean; // Backend includes this for authenticated users
  // Client-only status metadata for optimistic publish/progress states
  clientStatus?: 'publishing' | 'publish-failed';
  clientStatusMessage?: string;
  clientStatusMeta?: {
    startedAt?: number;
    attempts?: number;
    offline?: boolean;
    progress?: number;
    previewUrl?: string;
    taskId?: string;
    kind?: 'publish' | 'draft';
  };
}

export interface ReviewRatingDistributionItem {
  stars: number;
  count: number;
  percentage: number;
}

// Brand Profile Types
export interface BrandMediaAssetDto {
  fileId: string;
  url: string;
  originalName: string | null;
  fileName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BrandProfileDto {
  id: string;
  /** Public handle for `/u/:username` links. */
  username?: string | null;
  brandFullName: string;
  description: string | null;
  isStoreOpen?: boolean;
  country: string | null;
  state: string | null;
  city: string | null;
  location: string | null;
  /** Exact street address. Owner-only, and null when "show my location" is off. */
  streetAddress?: string | null;
  bannerImage: string | null;
  bannerImageMeta?: BrandMediaAssetDto | null;
  logoImage: string | null;
  logoImageMeta?: BrandMediaAssetDto | null;
  profilePhotoUpdatedAt?: string | null;
  profilePhotoViewState?: ProfilePhotoViewState | null;
  socialLinks: {
    instagram?: string | null;
    facebook?: string | null;
    twitter?: string | null;
    website?: string | null;
  };
  contactInfo: {
    /** Null for public/QR viewers — account email is owner-only. */
    email: string | null;
    phone?: string | null;
    businessType?: string | null;
  };
  tags: string[];
  hashtags?: string[];
  cacNumber?: string | null;
  tin?: string | null;
  verified?: boolean;
  verificationStatus?: 'NOT_SUBMITTED' | 'PENDING' | 'IN_REVIEW' | 'ADDITIONAL_INFO_REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  verificationBadgeVisible?: boolean;
  verifiedExplanationUrl?: string | null;
  averageRating?: number;
  totalReviews?: number;
  collectionsCount?: number;
  designsCount?: number;
  productsCount?: number;
  patchesCount?: number;
  followersCount?: number;
  totalThreads?: number;
  totalLikes?: number;
  totalShares?: number | null;
  storeStatus?: 'OPEN' | 'CLOSED' | 'PENDING_VERIFICATION' | 'UNAVAILABLE' | null;
  publicProfileUrl?: string | null;
  qrTargetUrl?: string | null;
  shareUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Tab Types
export type ProfileTabType = 'Collections' | 'About' | 'Reviews';

// API Response Types
export interface CollectionsResponse {
  collections: CollectionDto[];
  total: number;
}
