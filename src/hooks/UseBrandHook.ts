import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
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
import { hasActiveBrandMembership } from '@/lib/brandAccess';
import {
  fetchBrandCollectionsQuery,
  fetchBrandProfileQuery,
  useBrandCollectionsQuery,
  useBrandProfileQuery,
} from '@/query/queries';
import { queryKeys } from '@/query/queryKeys';

type BrandReviewsData = {
  reviews: ProductReviewResponse[];
  averageRating: number;
  totalReviews: number;
  ratingDistribution: ReviewRatingDistributionItem[];
};

const EMPTY_BRAND_REVIEWS: BrandReviewsData = {
  reviews: [],
  averageRating: 0,
  totalReviews: 0,
  ratingDistribution: [],
};

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

const buildBrandLocationFromUser = (user: AuthUserDto) =>
  [user.brandCity, user.brandState, user.brandCountry]
    .filter((segment): segment is string => Boolean(segment && segment.length > 0))
    .join(', ');

const mapAuthFileToBrandMediaAsset = (
  file: AuthUserDto['profileImageFile'] | AuthUserDto['bannerImageFile'],
) => {
  if (!file?.id || !file.s3Url) {
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

const areBrandProfileTagsEqual = (
  previous: string[] | null | undefined,
  next: string[] | null | undefined,
) => areStringArraysEqual(previous, next);

const areBrandProfileSnapshotsEqual = (
  previous: BrandProfileDto | null,
  next: BrandProfileDto | null,
) => {
  if (previous === next) return true;
  if (!previous || !next) return previous === next;

  return (
    previous.id === next.id &&
    previous.brandFullName === next.brandFullName &&
    previous.description === next.description &&
    previous.country === next.country &&
    previous.state === next.state &&
    previous.city === next.city &&
    previous.location === next.location &&
    previous.bannerImage === next.bannerImage &&
    previous.bannerImageMeta?.fileId === next.bannerImageMeta?.fileId &&
    previous.logoImage === next.logoImage &&
    previous.logoImageMeta?.fileId === next.logoImageMeta?.fileId &&
    previous.profilePhotoUpdatedAt === next.profilePhotoUpdatedAt &&
    previous.profilePhotoViewState?.profilePhotoUpdatedAt ===
      next.profilePhotoViewState?.profilePhotoUpdatedAt &&
    previous.profilePhotoViewState?.viewed === next.profilePhotoViewState?.viewed &&
    previous.profilePhotoViewState?.hasUnviewedUpdate ===
      next.profilePhotoViewState?.hasUnviewedUpdate &&
    previous.profilePhotoViewState?.canMarkViewed ===
      next.profilePhotoViewState?.canMarkViewed &&
    previous.socialLinks.instagram === next.socialLinks.instagram &&
    previous.socialLinks.facebook === next.socialLinks.facebook &&
    previous.socialLinks.twitter === next.socialLinks.twitter &&
    previous.socialLinks.website === next.socialLinks.website &&
    previous.contactInfo.email === next.contactInfo.email &&
    previous.contactInfo.phone === next.contactInfo.phone &&
    previous.contactInfo.businessType === next.contactInfo.businessType &&
    areBrandProfileTagsEqual(previous.tags, next.tags) &&
    areBrandProfileTagsEqual(previous.hashtags, next.hashtags) &&
    previous.cacNumber === next.cacNumber &&
    previous.tin === next.tin &&
    previous.verified === next.verified &&
    previous.verificationStatus === next.verificationStatus &&
    previous.verificationBadgeVisible === next.verificationBadgeVisible &&
    previous.verifiedExplanationUrl === next.verifiedExplanationUrl &&
    previous.averageRating === next.averageRating &&
    previous.totalReviews === next.totalReviews &&
    previous.collectionsCount === next.collectionsCount &&
    previous.designsCount === next.designsCount &&
    previous.productsCount === next.productsCount &&
    previous.patchesCount === next.patchesCount &&
    previous.followersCount === next.followersCount &&
    previous.totalThreads === next.totalThreads &&
    previous.totalLikes === next.totalLikes &&
    previous.totalShares === next.totalShares &&
    previous.storeStatus === next.storeStatus &&
    previous.publicProfileUrl === next.publicProfileUrl &&
    previous.qrTargetUrl === next.qrTargetUrl &&
    previous.shareUrl === next.shareUrl &&
    previous.createdAt === next.createdAt &&
    previous.updatedAt === next.updatedAt
  );
};

const syncBrandProfileWithUser = (
  current: BrandProfileDto | null,
  user: AuthUserDto | null,
): BrandProfileDto | null => {
  if (!user || user.type !== 'BRAND') {
    return current;
  }

  const locationFromUser = buildBrandLocationFromUser(user);
  const next: BrandProfileDto = {
    id: current?.id ?? user.id,
    brandFullName:
      user.brandFullName ||
      `${user.firstName} ${user.lastName}`.trim() ||
      user.username,
    description: user.brandDescription,
    isStoreOpen: current?.isStoreOpen,
    country: user.brandCountry,
    state: user.brandState,
    city: user.brandCity,
    location: locationFromUser || current?.location || null,
    bannerImage: user.bannerImage,
    bannerImageMeta: mapAuthFileToBrandMediaAsset(user.bannerImageFile),
    logoImage: user.profileImage,
    logoImageMeta: mapAuthFileToBrandMediaAsset(user.profileImageFile),
    profilePhotoUpdatedAt: user.profilePhotoUpdatedAt ?? current?.profilePhotoUpdatedAt ?? null,
    profilePhotoViewState: current?.profilePhotoViewState ?? null,
    socialLinks: {
      instagram: user.socialInstagram,
      facebook: user.socialFacebook,
      twitter: user.socialTwitter,
      website: user.socialWebsite,
    },
    contactInfo: {
      email: user.email,
      phone: user.phoneNumber,
      businessType: user.brandBusinessType,
    },
    tags: user.brandTags ?? [],
    hashtags: user.brandTags ?? [],
    cacNumber: user.cacNumber,
    tin: user.tin,
    verified: user.isVerifiedBrand,
    verificationStatus: user.verificationStatus ?? undefined,
    verificationBadgeVisible: user.verificationBadgeVisible,
    verifiedExplanationUrl: user.verifiedExplanationUrl ?? null,
    averageRating: current?.averageRating,
    totalReviews: current?.totalReviews,
    collectionsCount: current?.collectionsCount,
    designsCount: current?.designsCount,
    productsCount: current?.productsCount,
    patchesCount: current?.patchesCount,
    followersCount: current?.followersCount,
    totalThreads: current?.totalThreads,
    totalLikes: current?.totalLikes,
    totalShares: current?.totalShares,
    storeStatus: current?.storeStatus,
    publicProfileUrl: current?.publicProfileUrl,
    qrTargetUrl: current?.qrTargetUrl,
    shareUrl: current?.shareUrl,
    createdAt: current?.createdAt ?? user.createdAt,
    updatedAt: user.updatedAt,
  };

  return areBrandProfileSnapshotsEqual(current, next) ? current : next;
};

export const useBrandProfile = () => {
  const user = useSelector(
    (state: RootState) => state.user.profile,
    areStableUserFieldsEqual,
  );
  const ownerBrandId = user?.id ?? user?.id ?? null;
  const hasBrandMembership = hasActiveBrandMembership(user);
  const brandDetailEndpointsEnabled = env.featureFlags.brandDetailEndpoints;
  const { flags: reviewFlags, isLoading: reviewFlagsLoading } = useReviewRuntimeFlags();
  const queryClient = useQueryClient();
  const initialOwnerReviews = ownerBrandId
    ? queryClient.getQueryData<BrandReviewsData>(queryKeys.reviews.brand(ownerBrandId))
    : undefined;

  const ownerCollectionsQuery = useBrandCollectionsQuery(
    { ownerId: ownerBrandId, visibility: 'all', scope: 'design' },
    { enabled: Boolean(ownerBrandId) },
  );
  const ownerBrandProfileQuery = useBrandProfileQuery(ownerBrandId, {
    enabled: Boolean(ownerBrandId && hasBrandMembership && brandDetailEndpointsEnabled),
  });

  // Brand profile state — seed from react-query cache so revisits never flash
  // a full-page skeleton while the network revalidates.
  const [brandProfile, setBrandProfile] = useState<BrandProfileDto | null>(
    () => ownerBrandProfileQuery.data ?? null,
  );
  const [brandProfileLoading, setBrandProfileLoading] = useState(
    () => Boolean(ownerBrandId && hasBrandMembership && !ownerBrandProfileQuery.data),
  );
  const [brandProfileError, setBrandProfileError] = useState<string | null>(null);
  const brandProfileRef = useRef<BrandProfileDto | null>(ownerBrandProfileQuery.data ?? null);
  const brandProfileFetchPromiseRef = useRef<Promise<void> | null>(null);

  // Collections state — same cache-first seed as profile.
  const [collections, setCollections] = useState<CollectionDto[]>(
    () => ownerCollectionsQuery.data ?? [],
  );
  const [collectionsLoading, setCollectionsLoading] = useState(
    () => Boolean(ownerBrandId) && !ownerCollectionsQuery.data,
  );
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const collectionsFetchPromiseRef = useRef<Promise<void> | null>(null);
  const collectionsRef = useRef<CollectionDto[]>(ownerCollectionsQuery.data ?? []);

  useEffect(() => {
    collectionsRef.current = collections;
  }, [collections]);

  useEffect(() => {
    brandProfileRef.current = brandProfile;
  }, [brandProfile]);

  // Reviews state
  const [reviews, setReviews] = useState<ProductReviewResponse[]>(
    () => initialOwnerReviews?.reviews ?? [],
  );
  const [averageRating, setAverageRating] = useState(
    () => initialOwnerReviews?.averageRating ?? 0,
  );
  const [totalReviews, setTotalReviews] = useState(
    () => initialOwnerReviews?.totalReviews ?? 0,
  );
  const [ratingDistribution, setRatingDistribution] = useState<ReviewRatingDistributionItem[]>(
    () => initialOwnerReviews?.ratingDistribution ?? [],
  );
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [loadedReviewsBrandId, setLoadedReviewsBrandId] = useState<string | null>(
    () => (initialOwnerReviews ? ownerBrandId : null),
  );

  // Render-phase mirror (NOT an effect): with a warm react-query cache the
  // first committed frame already carries the owner's collections. The effect
  // below still reconciles loading/error state, but effects run after paint —
  // relying on them alone guaranteed a one-frame skeleton flash on EVERY
  // owner profile visit even when cached data was already present.
  if (ownerCollectionsQuery.data && collections !== ownerCollectionsQuery.data) {
    setCollections(ownerCollectionsQuery.data);
  }
  if (
    ownerBrandProfileQuery.data &&
    brandProfile !== ownerBrandProfileQuery.data
  ) {
    setBrandProfile(ownerBrandProfileQuery.data);
  }

  // Blocking-skeleton signal derived at render time: once any data exists
  // (cached rows or a resolved-empty response) the skeleton must never cover
  // it; background refetches stay silent per stale-while-revalidate.
  const collectionsBlockingLoading =
    Boolean(ownerBrandId) &&
    collections.length === 0 &&
    !ownerCollectionsQuery.data &&
    (collectionsLoading || ownerCollectionsQuery.isLoading);

  const brandProfileBlockingLoading =
    Boolean(ownerBrandId && hasBrandMembership && brandDetailEndpointsEnabled) &&
    !brandProfile &&
    !ownerBrandProfileQuery.data &&
    (brandProfileLoading || ownerBrandProfileQuery.isLoading);

  // Fetch brand profile
  const fetchBrandProfile = useCallback(async (brandId: string, options?: { forceRefresh?: boolean }) => {
    if (brandProfileFetchPromiseRef.current && !options?.forceRefresh) {
      return brandProfileFetchPromiseRef.current;
    }

    if (!brandProfileRef.current) {
      setBrandProfileLoading(true);
    }
    setBrandProfileError(null);

    const request = (async () => {
      try {
        const profile = await fetchBrandProfileQuery(queryClient, brandId, {
          forceRefresh: options?.forceRefresh,
        });
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
    })();

    brandProfileFetchPromiseRef.current = request.finally(() => {
      brandProfileFetchPromiseRef.current = null;
    });
    return brandProfileFetchPromiseRef.current;
  }, [queryClient]);

  useEffect(() => {
    setBrandProfile((current) => syncBrandProfileWithUser(current, user));
  }, [user]);

  // Fetch collections
  const fetchCollections = useCallback(async (ownerId: string, options?: { forceRefresh?: boolean }) => {
    if (collectionsFetchPromiseRef.current && !options?.forceRefresh) {
      return collectionsFetchPromiseRef.current;
    }

    const shouldShowBlockingLoading = collectionsRef.current.length === 0;
    if (shouldShowBlockingLoading) {
      setCollectionsLoading(true);
    }
    setCollectionsError(null);

    const requestPromise = (async () => {
      try {
        const data = await fetchBrandCollectionsQuery(
          queryClient,
          { ownerId, visibility: 'all', scope: 'design' },
          { forceRefresh: options?.forceRefresh },
        );
        setCollections(data);
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
  }, [queryClient]);

  // Fetch reviews
  const fetchReviews = useCallback(async (brandId: string) => {
    const applyReviews = (data: BrandReviewsData) => {
      setReviews(data.reviews);
      setAverageRating(data.averageRating);
      setTotalReviews(data.totalReviews);
      setRatingDistribution(data.ratingDistribution);
      setLoadedReviewsBrandId(brandId);
    };

    if (reviewFlagsLoading) {
      return;
    }

    if (!reviewFlags.readEnabled) {
      applyReviews(EMPTY_BRAND_REVIEWS);
      setReviewsError(null);
      setReviewsLoading(false);
      setLoadedReviewsBrandId(null);
      return;
    }

    const cacheKey = queryKeys.reviews.brand(brandId);
    const cached = queryClient.getQueryData<BrandReviewsData>(cacheKey);
    if (cached) {
      applyReviews(cached);
      setReviewsLoading(false);
    } else {
      setReviews([]);
      setAverageRating(0);
      setTotalReviews(0);
      setRatingDistribution([]);
      setReviewsLoading(true);
    }
    setReviewsError(null);
    try {
      const data = await queryClient.fetchQuery({
        queryKey: cacheKey,
        queryFn: () => brandApi.getReviews(brandId),
      });
      applyReviews(data);
    } catch (error) {
      setReviewsError('Failed to load reviews');
      setLoadedReviewsBrandId(null);
      console.error('Error fetching reviews:', error);
    } finally {
      setReviewsLoading(false);
    }
  }, [queryClient, reviewFlags.readEnabled, reviewFlagsLoading]);

  // Create collection
  const createCollection = useCallback(async (data: { name: string; description?: string; isPublic?: boolean }) => {
    const result = await brandApi.createCollection(data);
    if (result && ownerBrandId) {
      await fetchCollections(ownerBrandId, { forceRefresh: true });
    }
    return result;
  }, [ownerBrandId, fetchCollections]);

  // Update collection
  const updateCollection = useCallback(async (collectionId: string, data: Partial<CollectionDto>) => {
    const result = await brandApi.updateCollection(collectionId, data);
    if (result && ownerBrandId) {
      queryClient.invalidateQueries({ queryKey: queryKeys.brand.collectionDetail(collectionId) });
      await fetchCollections(ownerBrandId, { forceRefresh: true });
    }
    return result;
  }, [fetchCollections, ownerBrandId, queryClient]);

  // Delete collection
  const deleteCollection = useCallback(async (collectionId: string) => {
    const success = await brandApi.deleteCollection(collectionId);
    if (success) {
      setCollections(prev => prev.filter(c => c.id !== collectionId));
      queryClient.setQueryData<CollectionDto[]>(
        queryKeys.brand.collections(ownerBrandId, { visibility: 'all', scope: 'design' }),
        (current) => (current ?? []).filter((collection) => collection.id !== collectionId),
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.brand.collectionDetail(collectionId) });
    }
    return success;
  }, [ownerBrandId, queryClient]);

  useEffect(() => {
    if (!ownerBrandId) {
      setCollections([]);
      setCollectionsLoading(false);
      setCollectionsError(null);
      return;
    }
    if (ownerCollectionsQuery.data) {
      setCollections(ownerCollectionsQuery.data);
      setCollectionsError(null);
    }
    setCollectionsLoading(ownerCollectionsQuery.isLoading && collectionsRef.current.length === 0);
    if (ownerCollectionsQuery.error) {
      setCollectionsError('Failed to load collections');
      console.error('Error fetching collections:', ownerCollectionsQuery.error);
    }
  }, [ownerBrandId, ownerCollectionsQuery.data, ownerCollectionsQuery.error, ownerCollectionsQuery.isLoading]);

  useEffect(() => {
    if (!ownerBrandId || !hasBrandMembership) {
      return;
    }
    if (ownerBrandProfileQuery.data !== undefined) {
      setBrandProfile(ownerBrandProfileQuery.data ?? null);
      setBrandProfileError(ownerBrandProfileQuery.data ? null : 'Failed to load brand profile');
    }
    setBrandProfileLoading(ownerBrandProfileQuery.isLoading && !brandProfileRef.current);
    if (ownerBrandProfileQuery.error) {
      setBrandProfileError('An error occurred while loading brand profile');
      console.error('Error fetching brand profile:', ownerBrandProfileQuery.error);
    }
  }, [
    hasBrandMembership,
    ownerBrandId,
    ownerBrandProfileQuery.data,
    ownerBrandProfileQuery.error,
    ownerBrandProfileQuery.isLoading,
  ]);

  useEffect(() => {
    if (!user?.id || !hasBrandMembership) {
      setBrandProfile(null);
      setBrandProfileError(null);
      setBrandProfileLoading(false);
    }
  }, [user?.id, hasBrandMembership]);

  useEffect(() => {
    if (!ownerBrandId || !hasBrandMembership || reviewFlagsLoading || !reviewFlags.readEnabled) {
      return;
    }

    void fetchReviews(ownerBrandId);
  }, [ownerBrandId, hasBrandMembership, fetchReviews, reviewFlags.readEnabled, reviewFlagsLoading]);

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
    // Empty arrays fall through: a profile snapshot with no tags must not
    // mask real tags on the fresher redux user (e.g. right after a save).
    hashtags: brandProfile?.tags?.length
      ? brandProfile.tags
      : brandProfile?.hashtags?.length
        ? brandProfile.hashtags
        : defaultFallbackTags,
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
    // Derived: never skeleton when cache already has a profile snapshot.
    brandProfileLoading: brandProfileBlockingLoading,
    brandProfileError,
    collections,
    // Derived blocking flag (render-time), NOT the raw state: the raw state
    // starts true and is only reconciled after paint, which skeleton-flashed
    // every owner profile visit even with warm cached data.
    collectionsLoading: collectionsBlockingLoading,
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
