// Collection Types
export interface CollectionDto {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  title: string;
  isPublic: boolean;
  visibility?: 'PUBLIC' | 'PRIVATE';
  type?: 'MALE' | 'FEMALE' | 'EVERYBODY';
  categoryId?: string;
  coverImage?: string;
  coverFileId?: string;
  itemCount?: number;
  createdAt: string;
  updatedAt: string;
  postsCount?: number;
  likesCount?: number;
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
  tags?: string[];
  isLiked?: boolean; // Backend includes this for authenticated users
  // Client-only status metadata for optimistic publish/progress states
  clientStatus?: 'publishing' | 'publish-failed';
  clientStatusMessage?: string;
  clientStatusMeta?: { startedAt?: number; attempts?: number; offline?: boolean };
}

// Review Types
export interface ReviewDto {
  id: string;
  userId: string;
  userName: string;
  userImage?: string;
  brandId: string;
  rating: number;
  comment: string;
  helpful: number;
  images?: string[];
  verified?: boolean;
  createdAt: string;
  updatedAt: string;
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
  brandFullName: string;
  description: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  location: string | null;
  bannerImage: string | null;
  bannerImageMeta?: BrandMediaAssetDto | null;
  logoImage: string | null;
  logoImageMeta?: BrandMediaAssetDto | null;
  socialLinks: {
    instagram?: string | null;
    facebook?: string | null;
    twitter?: string | null;
    website?: string | null;
  };
  contactInfo: {
    email: string;
    phone?: string | null;
    businessType?: string | null;
  };
  tags: string[];
  hashtags?: string[];
  cacNumber?: string | null;
  tin?: string | null;
  verified?: boolean;
  averageRating?: number;
  totalReviews?: number;
  collectionsCount?: number;
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

export interface ReviewsResponse {
  reviews: ReviewDto[];
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    stars: number;
    count: number;
    percentage: number;
  }[];
}
