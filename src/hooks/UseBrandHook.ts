import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import type { ProductReviewResponse } from '../api/ReviewsApi';
import type { RootState } from '../store';
import { brandApi } from '../api/BrandApi';
import type {
  CollectionDto,
  ReviewRatingDistributionItem,
  BrandProfileDto,
  BrandMediaAssetDto,
} from '../types/profile';
import type { AuthProfileImageFileDto } from '../types/auth';
import { env } from '../config/env';
import { useSignedFileUrl } from './useSignedFileUrl';
import { useReviewRuntimeFlags } from './useReviewRuntimeFlags';

export const useBrandProfile = () => {
  const { profile: user } = useSelector((state: RootState) => state.user);
  const brandDetailEndpointsEnabled = env.featureFlags.brandDetailEndpoints;
  const { flags: reviewFlags, isLoading: reviewFlagsLoading } = useReviewRuntimeFlags();

  // Brand profile state
  const [brandProfile, setBrandProfile] = useState<BrandProfileDto | null>(null);
  const [brandProfileLoading, setBrandProfileLoading] = useState(false);
  const [brandProfileError, setBrandProfileError] = useState<string | null>(null);

  // Collections state
  const [collections, setCollections] = useState<CollectionDto[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);

  // Reviews state
  const [reviews, setReviews] = useState<ProductReviewResponse[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [ratingDistribution, setRatingDistribution] = useState<ReviewRatingDistributionItem[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [loadedReviewsBrandId, setLoadedReviewsBrandId] = useState<string | null>(null);

  // Fetch brand profile
  const fetchBrandProfile = useCallback(async (brandId: string) => {
    setBrandProfileLoading(true);
    setBrandProfileError(null);
    try {
      const profile = await brandApi.getBrandProfile(brandId);
      if (profile) {
        setBrandProfile(profile);
      } else {
        setBrandProfileError('Failed to load brand profile');
      }
    } catch (error) {
      setBrandProfileError('An error occurred while loading brand profile');
      console.error('Error fetching brand profile:', error);
    } finally {
      setBrandProfileLoading(false);
    }
  }, []);

  // Fetch collections
  const fetchCollections = useCallback(async (ownerId: string) => {
    setCollectionsLoading(true);
    setCollectionsError(null);
    try {
      console.debug('[useBrandProfile.fetchCollections] start', { ownerId });
      // Request both public and approved-private collections by default
      const data = await brandApi.getCollections(ownerId, { visibility: 'all' });
      setCollections(data);
      try {
        const totals = data.reduce((acc, c) => {
          acc.all += 1;
          if (c.visibility === 'PRIVATE' || c.isPublic === false) acc.private += 1; else acc.public += 1;
          return acc;
        }, { all: 0, public: 0, private: 0 } as any);
        console.debug('[useBrandProfile.fetchCollections] done', { count: data.length, ...totals });
      } catch {}
    } catch (error) {
      setCollectionsError('Failed to load collections');
      console.error('Error fetching collections:', error);
    } finally {
      setCollectionsLoading(false);
    }
  }, []);

  // Fetch reviews
  const fetchReviews = useCallback(async (brandId: string) => {
    if (reviewFlagsLoading) {
      return;
    }

    if (!reviewFlags.readEnabled) {
      setReviews([]);
      setAverageRating(0);
      setTotalReviews(0);
      setRatingDistribution([]);
      setReviewsError(null);
      setReviewsLoading(false);
      setLoadedReviewsBrandId(null);
      return;
    }

    setReviewsLoading(true);
    setReviewsError(null);
    try {
      const data = await brandApi.getReviews(brandId);
      setReviews(data.reviews);
      setAverageRating(data.averageRating);
      setTotalReviews(data.totalReviews);
      setRatingDistribution(data.ratingDistribution);
      setLoadedReviewsBrandId(brandId);
    } catch (error) {
      setReviewsError('Failed to load reviews');
      setLoadedReviewsBrandId(null);
      console.error('Error fetching reviews:', error);
    } finally {
      setReviewsLoading(false);
    }
  }, [reviewFlags.readEnabled, reviewFlagsLoading]);

  // Create collection
  const createCollection = useCallback(async (data: { name: string; description?: string; isPublic?: boolean }) => {
    const result = await brandApi.createCollection(data);
    if (result && user?.id) {
      await fetchCollections(user.id);
    }
    return result;
  }, [user, fetchCollections]);

  // Update collection
  const updateCollection = useCallback(async (collectionId: string, data: Partial<CollectionDto>) => {
    const result = await brandApi.updateCollection(collectionId, data);
    if (result && user?.id) {
      await fetchCollections(user.id);
    }
    return result;
  }, [user, fetchCollections]);

  // Delete collection
  const deleteCollection = useCallback(async (collectionId: string) => {
    const success = await brandApi.deleteCollection(collectionId);
    if (success) {
      setCollections(prev => prev.filter(c => c.id !== collectionId));
    }
    return success;
  }, []);

  // Initial data fetch
  useEffect(() => {
    if (!user?.id) {
      setCollectionsLoading(false);
      return;
    }

    // Fetch collections for all users
    void fetchCollections(user.id);

    // Fetch brand-specific data only for BRAND users
    if (user.type === 'BRAND' && brandDetailEndpointsEnabled) {
      void fetchBrandProfile(user.id);
      if (!reviewFlagsLoading && reviewFlags.readEnabled) {
        void fetchReviews(user.id);
      }
    }
  }, [user, fetchCollections, fetchBrandProfile, fetchReviews, brandDetailEndpointsEnabled, reviewFlags.readEnabled, reviewFlagsLoading]);

  // Get display values with fallbacks
  const defaultFallbackTags =
    user?.brandTags && user.brandTags.length > 0
      ? user.brandTags
      : user?.type === 'BRAND'
        ? ['Fashion', 'Clothing', 'Accessories']
        : [];

  const socialFallback = {
    instagram: user?.socialInstagram ?? 'https://instagram.com',
    facebook: user?.socialFacebook ?? 'https://facebook.com',
    twitter: user?.socialTwitter ?? 'https://twitter.com',
    website: user?.socialWebsite ?? 'https://example.com',
  };

  const mapUserAsset = (
    file: AuthProfileImageFileDto | null | undefined,
  ): BrandMediaAssetDto | null => {
    if (!file || !file.s3Url) {
      return null;
    }
    return {
      fileId: file.id,
      url: file.s3Url,
      originalName: file.originalName,
      fileName: file.fileName,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  };

  const bannerAsset: BrandMediaAssetDto | null = useMemo(() => {
    const primary = brandProfile?.bannerImageMeta ?? mapUserAsset(user?.bannerImageFile);
    if (primary) return primary;
    // Fallback to bannerImageId if metadata is absent
    if (user?.bannerImageId) {
      return {
        fileId: user.bannerImageId,
        url: user.bannerImage ?? '',
        originalName: null,
        fileName: null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    }
    return null;
  }, [brandProfile?.bannerImageMeta, user?.bannerImageFile, user?.bannerImageId, user?.bannerImage, user?.createdAt, user?.updatedAt]);

  const logoAsset: BrandMediaAssetDto | null = useMemo(() => {
    const primary = brandProfile?.logoImageMeta ?? mapUserAsset(user?.profileImageFile);
    if (primary) return primary;
    // Fallback to profileImageId if metadata is absent
    if (user?.profileImageId) {
      return {
        fileId: user.profileImageId,
        url: user.profileImage ?? '',
        originalName: null,
        fileName: null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    }
    return null;
  }, [brandProfile?.logoImageMeta, user?.profileImageFile, user?.profileImageId, user?.profileImage, user?.createdAt, user?.updatedAt]);

  const bannerInitial = user?.bannerImage ?? brandProfile?.bannerImage ?? bannerAsset?.url ?? null;
  const logoInitial = user?.profileImage ?? brandProfile?.logoImage ?? logoAsset?.url ?? null;
  const { url: resolvedBannerUrl } = useSignedFileUrl(bannerAsset?.fileId ?? null, bannerInitial);
  const { url: resolvedLogoUrl } = useSignedFileUrl(logoAsset?.fileId ?? null, logoInitial);

  const displayData = {
    brandName:
      user?.brandFullName ||
      `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
      user?.username ||
      'Brand Name',
  // brandProfile type may not include username in some API shapes; use a safe access here
  username: ((brandProfile as unknown) as { username?: string })?.username ?? user?.username ?? '',
    location:
      brandProfile?.location ||
      user?.companyLocation ||
      [user?.brandCity, user?.brandState, user?.brandCountry]
        .filter((segment) => segment && segment.length > 0)
        .join(', ') ||
      user?.address ||
      'Lagos, Nigeria',
  bannerImage: resolvedBannerUrl || resolvedLogoUrl,
    bannerImageMeta: bannerAsset,
    logoImage: resolvedLogoUrl,
    logoImageMeta: logoAsset,
    hashtags: brandProfile?.tags ?? brandProfile?.hashtags ?? defaultFallbackTags,
    description: brandProfile?.description ?? user?.brandDescription ?? null,
    socialLinks: {
      instagram: brandProfile?.socialLinks?.instagram ?? socialFallback.instagram,
      facebook: brandProfile?.socialLinks?.facebook ?? socialFallback.facebook,
      twitter: brandProfile?.socialLinks?.twitter ?? socialFallback.twitter,
      website: brandProfile?.socialLinks?.website ?? socialFallback.website,
    },
    contactInfo: {
      email: brandProfile?.contactInfo?.email || user?.email || 'contact@brand.com',
      phone: brandProfile?.contactInfo?.phone || user?.phoneNumber || '+234 800 0000 000',
      businessType:
        brandProfile?.contactInfo?.businessType ||
        user?.brandBusinessType ||
        (user?.type === 'BRAND' ? 'Fashion Brand' : 'Individual'),
    },
    country: brandProfile?.country ?? user?.brandCountry ?? null,
    state: brandProfile?.state ?? user?.brandState ?? null,
    city: brandProfile?.city ?? user?.brandCity ?? null,
    verificationBadgeVisible:
      Boolean(brandProfile?.verificationBadgeVisible) ||
      Boolean(user?.verificationBadgeVisible),
    isVerifiedBrand:
      Boolean(brandProfile?.verified) ||
      Boolean(user?.isVerifiedBrand),
    verifiedExplanationUrl:
      brandProfile?.verifiedExplanationUrl ??
      user?.verifiedExplanationUrl ??
      '/help/verified-badge',
  };

  return {
    user,
    brandProfile,
    brandProfileLoading,
    brandProfileError,
    collections,
    collectionsLoading,
    collectionsError,
    reviews,
    averageRating,
    totalReviews,
    ratingDistribution,
    reviewsLoading,
    reviewsError,
    loadedReviewsBrandId,
    reviewFlags,
    reviewFlagsLoading,
    displayData,
    fetchBrandProfile,
    fetchCollections,
    fetchReviews,
    createCollection,
    updateCollection,
    deleteCollection,
  };
};
