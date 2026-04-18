import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import type { ProductReviewResponse } from '../api/ReviewsApi';
import type { RootState } from '../store';
import { brandApi } from '../api/BrandApi';
import type {
  CollectionDto,
  ReviewRatingDistributionItem,
  BrandProfileDto,
} from '../types/profile';
import type { AuthUserDto } from '../types/auth';
import { env } from '../config/env';
import { useReviewRuntimeFlags } from './useReviewRuntimeFlags';

const areStringArraysEqual = (left: string[] | null | undefined, right: string[] | null | undefined) => {
  if (left === right) return true;
  if (!left || !right) return left === right;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
};

const areStableUserFieldsEqual = (previous: AuthUserDto | null, next: AuthUserDto | null) => {
  if (previous === next) return true;
  if (!previous || !next) return previous === next;

  return (
    previous.id === next.id &&
    previous.username === next.username &&
    previous.email === next.email &&
    previous.firstName === next.firstName &&
    previous.lastName === next.lastName &&
    previous.role === next.role &&
    previous.type === next.type &&
    previous.phoneNumber === next.phoneNumber &&
    previous.address === next.address &&
    previous.brandFullName === next.brandFullName &&
    previous.brandDescription === next.brandDescription &&
    previous.brandCountry === next.brandCountry &&
    previous.brandState === next.brandState &&
    previous.brandCity === next.brandCity &&
    areStringArraysEqual(previous.brandTags, next.brandTags) &&
    previous.brandBusinessType === next.brandBusinessType &&
    previous.socialInstagram === next.socialInstagram &&
    previous.socialFacebook === next.socialFacebook &&
    previous.socialTwitter === next.socialTwitter &&
    previous.socialWebsite === next.socialWebsite &&
    previous.cacNumber === next.cacNumber &&
    previous.tin === next.tin &&
    previous.ceoNin === next.ceoNin &&
    previous.ceoFirstName === next.ceoFirstName &&
    previous.ceoLastName === next.ceoLastName &&
    previous.companyLocation === next.companyLocation &&
    previous.isEmailVerified === next.isEmailVerified &&
    previous.storeId === next.storeId &&
    previous.verificationStatus === next.verificationStatus &&
    previous.isVerifiedBrand === next.isVerifiedBrand &&
    previous.verificationBadgeVisible === next.verificationBadgeVisible &&
    previous.verifiedExplanationUrl === next.verifiedExplanationUrl &&
    previous.isActive === next.isActive &&
    previous.status === next.status &&
    previous.mustResetPassword === next.mustResetPassword &&
    previous.createdAt === next.createdAt &&
    previous.updatedAt === next.updatedAt
  );
};

export const useBrandProfile = () => {
  const user = useSelector(
    (state: RootState) => state.user.profile,
    areStableUserFieldsEqual,
  );
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
  const collectionsFetchPromiseRef = useRef<Promise<void> | null>(null);

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
    if (collectionsFetchPromiseRef.current) {
      return collectionsFetchPromiseRef.current;
    }

    setCollectionsLoading(true);
    setCollectionsError(null);

    const requestPromise = (async () => {
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
    })();

    const trackedPromise = requestPromise.finally(() => {
      collectionsFetchPromiseRef.current = null;
    });
    collectionsFetchPromiseRef.current = trackedPromise;
    return trackedPromise;
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
  }, [user?.id, user?.type, fetchCollections, fetchBrandProfile, fetchReviews, brandDetailEndpointsEnabled, reviewFlags.readEnabled, reviewFlagsLoading]);

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
    bannerImage: brandProfile?.bannerImage ?? null,
    bannerImageMeta: brandProfile?.bannerImageMeta ?? null,
    logoImage: brandProfile?.logoImage ?? null,
    logoImageMeta: brandProfile?.logoImageMeta ?? null,
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
