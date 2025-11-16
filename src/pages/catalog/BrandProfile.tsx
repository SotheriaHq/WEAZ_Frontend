import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useBrandProfile } from '../../hooks/UseBrandHook';
import { useDispatch } from 'react-redux';

import { toast } from 'react-toastify';
import ProfileHeader from '../../components/catalog(profile)/ProfileHeader';
import Tabs from '../../components/Tabs';
import AddCollectionModal from '../../components/profile/AddCollectionModal';
import CollectionsGrid from '../../components/profile/CollectionsGrid';
import CollectionsSkeleton from '../../components/profile/CollectionsSkeleton';
import SearchField from '../../components/SearchField';
import EmptyState from '../../components/EmptyState';
import AddCollectionDropdown from '../../components/profile/AddCollectionDropdown';
import ProfileHeaderSkeleton from '../../components/profile/ProfileHeaderSkeleton';
import EditProfileModal from '../../components/profile/EditProfileModal';
import AboutTab from '../../components/profile/tabs/AboutTab';
import ReviewsTab from '../../components/profile/tabs/ReviewsTab';
import InlineCollectionViewer from '../../components/collections/InlineCollectionViewer';
import type { AuthUserDto } from '../../types/auth';
import { setUser } from '../../features/userSlice';
import { brandApi } from '../../api/BrandApi';
import ProfileImageModal from '../../components/profile/ProfileImageModal';
import ProfileHeaderQuickEditModal from '../../components/profile/ProfileHeaderQuickEditModal';
import ImageCropModal from '../../components/upload/ImageCropModal';
import type { BrandProfileDto, CollectionDto } from '../../types/profile';
import { useSignedFileUrl as useSignedFileUrlHook } from '../../hooks/useSignedFileUrl';

type TabType = 'Collections' | 'Reviews' | 'About';
// CollectionType removed — dropdown opens modal directly

const ProfilePage: React.FC = () => {
  const { id: routeBrandId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    user,
    brandProfile,
    brandProfileLoading,
    collections,
    collectionsLoading,
    reviews,
    reviewsLoading,
    displayData,
    fetchCollections,
    fetchReviews,
    fetchBrandProfile,
  } = useBrandProfile();
  // Owner view when no route param or when the param matches the logged-in brand user's id
  const isOwner = Boolean(user?.type === 'BRAND' && (!routeBrandId || routeBrandId === user?.id));
  const isVisitorView = !isOwner && Boolean(routeBrandId);
  
  const dispatch = useDispatch();

  const [searchQuery, setSearchQuery] = useState('');
  // 🔧 FIX #1: Initialize from URL params to persist on refresh
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(
    searchParams.get('collectionId') || null
  );
  
  // 🔧 FIX #1: Sync URL params when selectedCollectionId changes
  useEffect(() => {
    console.log('🔧 [FIX #1 - Routing Persistence] Collection ID changed:', selectedCollectionId);
    if (selectedCollectionId) {
      setSearchParams({ collectionId: selectedCollectionId }, { replace: true });
      console.log('✅ [FIX #1] URL updated with collectionId:', selectedCollectionId);
    } else {
      setSearchParams({}, { replace: true });
      console.log('✅ [FIX #1] URL cleared (back to collections grid)');
    }
  }, [selectedCollectionId, setSearchParams]);
  
  // 🔧 FIX #1: Initialize from URL on mount
  useEffect(() => {
    const urlCollectionId = searchParams.get('collectionId');
    if (urlCollectionId && urlCollectionId !== selectedCollectionId) {
      console.log('🔧 [FIX #1] Restoring collection view from URL:', urlCollectionId);
      setSelectedCollectionId(urlCollectionId);
    }
  }, []);

  const [activeTab, setActiveTab] = useState<TabType>('Collections');
  const [visibilityFilter, setVisibilityFilter] = useState<'Public' | 'Private'>('Public');
  const [isAddOpen, setIsAddOpen] = useState(false);
  // collectionType state removed; modal is opened with the selected type via handler
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [hasDismissedSetup, setHasDismissedSetup] = useState(false);
  const [openedFromPrompt, setOpenedFromPrompt] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [avatarHighlight, setAvatarHighlight] = useState(false);
  const [bannerPreviewUrl, setBannerPreviewUrlState] = useState<string | null>(null);
  const [localAvatarPreview, setLocalAvatarPreviewState] = useState<string | null>(null);
  const [cropTask, setCropTask] = useState<{ type: 'avatar' | 'banner'; file: File } | null>(null);
  const [isHeaderQuickEditOpen, setIsHeaderQuickEditOpen] = useState(false);
  const [isSavingHeader, setIsSavingHeader] = useState(false);
  const avatarPreviewObjectUrl = useRef<string | null>(null);
  const bannerPreviewObjectUrl = useRef<string | null>(null);

  const updateAvatarPreview = (url: string | null) => {
    const current = avatarPreviewObjectUrl.current;
    if (current && current !== url) {
      URL.revokeObjectURL(current);
      avatarPreviewObjectUrl.current = null;
    }
    if (url && url.startsWith('blob:')) {
      avatarPreviewObjectUrl.current = url;
    } else if (!url) {
      avatarPreviewObjectUrl.current = null;
    }
    setLocalAvatarPreviewState(url);
  };

  const updateBannerPreview = (url: string | null) => {
    const current = bannerPreviewObjectUrl.current;
    if (current && current !== url) {
      URL.revokeObjectURL(current);
      bannerPreviewObjectUrl.current = null;
    }
    if (url && url.startsWith('blob:')) {
      bannerPreviewObjectUrl.current = url;
    } else if (!url) {
      bannerPreviewObjectUrl.current = null;
    }
    setBannerPreviewUrlState(url);
  };

  useEffect(() => {
    if (!isOwner) return;
    if (bannerPreviewUrl && displayData.bannerImage && displayData.bannerImage !== bannerPreviewUrl) {
      updateBannerPreview(null);
    }
  }, [isOwner, displayData.bannerImage, bannerPreviewUrl]);

  useEffect(() => {
    return () => {
      if (avatarPreviewObjectUrl.current) {
        URL.revokeObjectURL(avatarPreviewObjectUrl.current);
      }
      if (bannerPreviewObjectUrl.current) {
        URL.revokeObjectURL(bannerPreviewObjectUrl.current);
      }
    };
  }, []);

  // Always try to resolve a signed avatar URL for owner after refresh
  useEffect(() => {
    if (!isOwner) return;
    const run = async () => {
      if (!user?.profileImageId) return;
      try {
        const signed = await brandApi.getSignedFileUrl(user.profileImageId);
        if (signed) {
          updateAvatarPreview(signed);
        }
      } catch (e) {
        console.warn('Failed to resolve signed avatar URL', e);
      }
    };
    void run();
  }, [isOwner, user?.profileImageId]);

  useEffect(() => {
    if (!isOwner) return;
    if (
      displayData.logoImage &&
      (!localAvatarPreview || localAvatarPreview.startsWith('blob:'))
    ) {
      updateAvatarPreview(displayData.logoImage);
    }
  }, [isOwner, displayData.logoImage, localAvatarPreview]);

  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const bannerInputRef = useRef<HTMLInputElement | null>(null);

  const handleOpenAddModal = () => {
    // collection type passed from dropdown; modal uses internal defaults for now
    setIsAddOpen(true);
  };

  useEffect(() => {
    setHasDismissedSetup(false);
    setOpenedFromPrompt(false);
  }, [user?.id]);

  useEffect(() => {
    if (activeTab === 'Reviews') {
      if (isOwner && user && reviews.length === 0 && !reviewsLoading) {
        void fetchReviews(user.id);
      }
      if (isVisitorView && routeBrandId) {
        void (async () => {
          try { await brandApi.getReviews(routeBrandId); } catch {/* noop */}
        })();
      }
    }
  }, [activeTab, isOwner, isVisitorView, user, reviews.length, reviewsLoading, fetchReviews, routeBrandId]);

  const requiresProfileSetup = useMemo(() => {
    if (!isOwner || !user) {
      return false;
    }
    const description = (brandProfile?.description ?? user.brandDescription ?? '').trim();
    const tags =
      brandProfile?.tags ??
      brandProfile?.hashtags ??
      user.brandTags ??
      [];
    const hasLocation =
      Boolean((brandProfile?.country ?? user.brandCountry ?? '').trim()) ||
      Boolean((brandProfile?.state ?? user.brandState ?? '').trim());

    const needsSetup = description.length < 20 || tags.length === 0 || !hasLocation;
    
    return needsSetup;
  }, [isOwner, user, brandProfile]);

  useEffect(() => {
    if (
      isOwner &&
      !brandProfileLoading &&
      requiresProfileSetup &&
      !hasDismissedSetup &&
      !isEditModalOpen
    ) {
      setOpenedFromPrompt(true);
      setIsEditModalOpen(true);
    }
  }, [
    isOwner,
    brandProfileLoading,
    requiresProfileSetup,
    hasDismissedSetup,
    isEditModalOpen,
  ]);

  const handleOpenEditModal = (openedByPrompt = false) => {
    setOpenedFromPrompt(openedByPrompt);
    setIsEditModalOpen(true);
  };

  const handleDismissModal = () => {
    setIsEditModalOpen(false);
    if (openedFromPrompt) {
      setHasDismissedSetup(true);
    }
    setOpenedFromPrompt(false);
  };

  const handleProfileSaved = async (updatedUser: AuthUserDto) => {
    dispatch(setUser(updatedUser));
    setHasDismissedSetup(true);
    setIsEditModalOpen(false);
    setOpenedFromPrompt(false);
    await fetchBrandProfile(updatedUser.id);
    setAvatarHighlight(false);
  };

  const ensureDescriptionFallback = (): string => {
    const existing =
      brandProfile?.description ??
      user?.brandDescription ??
      '';
    const trimmed = existing.trim();
    if (trimmed.length >= 20) return trimmed;
    return 'We are refreshing our brand story and will share more details with you shortly.';
  };

  const handleHeaderQuickSubmit = async (values: {
    brandFullName: string;
    brandCountry?: string;
    brandState?: string;
    brandCity?: string;
    brandTags: string[];
  }) => {
    if (!user) return;
    setIsSavingHeader(true);
    try {
      const payload = {
        brandFullName: values.brandFullName.trim(),
        brandCountry: values.brandCountry?.trim() || undefined,
        brandState: values.brandState?.trim() || undefined,
        brandCity: values.brandCity?.trim() || undefined,
        brandTags: values.brandTags,
        brandDescription: ensureDescriptionFallback(),
      };
      const updatedUser = await brandApi.updateBrandProfile(user.id, payload);
      if (!updatedUser) {
        throw new Error('No user returned');
      }
      dispatch(setUser(updatedUser));
      await fetchBrandProfile(user.id);
      toast.success('Profile details updated');
      setIsHeaderQuickEditOpen(false);
    } catch (error) {
      console.error('Failed to update profile header', error);
      toast.error('Could not update profile details. Please try again.');
    } finally {
      setIsSavingHeader(false);
    }
  };

  const handleTriggerAvatarUpload = () => {
    if (isOwner) {
      avatarInputRef.current?.click();
    }
  };

  const handleTriggerBannerUpload = () => {
    if (isOwner) {
      bannerInputRef.current?.click();
    }
  };

  const handleShareProfile = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: viewDisplayData.brandName,
          text: `Check out ${viewDisplayData.brandName} on Threadly`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Profile link copied to clipboard');
      }
    } catch {
      // Silently ignore cancellation
    }
  };

  const processAvatarUpload = async (file: File, previewUrl: string) => {
    if (!user) return;
    const currentUser = user;
    const previousPreview = localAvatarPreview;
    updateAvatarPreview(previewUrl);
    setAvatarUploading(true);
    try {
      const uploaded = await brandApi.uploadLogo(currentUser.id, file);
      if (!uploaded) {
        throw new Error('No upload payload returned');
      }
      const signedUrl = (await brandApi.getSignedFileUrl(uploaded.id)) ?? uploaded.url;
      toast.success('Profile photo updated');
      // Use signed for immediate preview, but persist stable URL in user state
      updateAvatarPreview(signedUrl);
      const updatedUser: AuthUserDto = {
        ...currentUser,
        profileImage: uploaded.url,
        profileImageId: uploaded.id,
        profileImageFile: {
          id: uploaded.id,
          s3Url: uploaded.url,
          fileName: uploaded.fileName,
          originalName: uploaded.originalName,
          createdAt: uploaded.createdAt,
          updatedAt: uploaded.updatedAt,
        },
      };
      dispatch(setUser(updatedUser));
      await fetchBrandProfile(currentUser.id);
      setAvatarHighlight(true);
    } catch (error) {
      console.error('Failed to upload profile photo', error);
      toast.error('Could not update profile photo. Please try again.');
      updateAvatarPreview(previousPreview ?? null);
    } finally {
      setAvatarUploading(false);
    }
  };

  const processBannerUpload = async (file: File, previewUrl: string) => {
    if (!user) return;
    const currentUser = user;
    const previousPreview = bannerPreviewUrl;
    updateBannerPreview(previewUrl);
    setBannerUploading(true);
    try {
      const uploaded = await brandApi.uploadBanner(currentUser.id, file);
      if (!uploaded) {
        throw new Error('No banner upload payload returned');
      }

      const signedUrl = (await brandApi.getSignedFileUrl(uploaded.id)) ?? uploaded.url;
      toast.success('Banner image updated');
      // Use signed for immediate preview, but persist stable URL in user state
      updateBannerPreview(signedUrl);
      const updatedUser: AuthUserDto = {
        ...currentUser,
        bannerImage: uploaded.url,
        bannerImageId: uploaded.id,
        bannerImageFile: {
          id: uploaded.id,
          s3Url: uploaded.url,
          fileName: uploaded.fileName,
          originalName: uploaded.originalName,
          createdAt: uploaded.createdAt,
          updatedAt: uploaded.updatedAt,
        },
      };
      dispatch(setUser(updatedUser));
      try {
        await fetchBrandProfile(currentUser.id);
      } catch (fetchError) {
        console.warn('Banner uploaded but profile refresh failed', fetchError);
      }
    } catch (error) {
      console.error('Failed to upload banner image', error);
      toast.error('Could not update banner. Please try again.');
      updateBannerPreview(previousPreview ?? null);
    } finally {
      setBannerUploading(false);
    }
  };

  const handleAvatarSelected: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    if (!file || !user) {
      event.target.value = '';
      return;
    }
    setCropTask({ type: 'avatar', file });
    event.target.value = '';
  };

  const handleBannerSelected: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    if (!file || !user) {
      event.target.value = '';
      return;
    }
    setCropTask({ type: 'banner', file });
    event.target.value = '';
  };

  const handleCropConfirm = async (result: { file: File; previewUrl: string }) => {
    const activeTask = cropTask;
    setCropTask(null);
    if (!activeTask) return;

    if (activeTask.type === 'avatar') {
      await processAvatarUpload(result.file, result.previewUrl);
    } else {
      await processBannerUpload(result.file, result.previewUrl);
    }
  };

  const handleCropUseOriginal = async (result: { file: File; previewUrl: string }) => {
    const activeTask = cropTask;
    setCropTask(null);
    if (!activeTask || activeTask.type !== 'avatar') return;
    await processAvatarUpload(result.file, result.previewUrl);
  };

  // ---------------- Visitor data fetch ----------------
  const [visitorProfile, setVisitorProfile] = useState<BrandProfileDto | null>(null);
  const [visitorCollections, setVisitorCollections] = useState<CollectionDto[]>([]);
  const [visitorLoading, setVisitorLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!isVisitorView || !routeBrandId) return;
      setVisitorLoading(true);
      try {
        const [p, cols] = await Promise.all([
          brandApi.getBrandProfile(routeBrandId),
          brandApi.getCollections(routeBrandId),
        ]);
        if (!mounted) return;
        setVisitorProfile(p ?? null);
        setVisitorCollections(cols ?? []);
      } finally {
        if (mounted) setVisitorLoading(false);
      }
    };
    void run();
    return () => { mounted = false; };
  }, [isVisitorView, routeBrandId]);

  const activeCollections = (isVisitorView ? visitorCollections : collections) || [];
  const visibilityFiltered = activeCollections.filter((c) =>
    visibilityFilter === 'Public' ? (c.isPublic || c.visibility === 'PUBLIC') : (!c.isPublic || c.visibility === 'PRIVATE')
  );
  const searchAndVisibilityFiltered = visibilityFiltered.filter(c =>
    (c.name || c.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Resolve signed URLs for visitor profile assets if necessary
  const visitorBannerInitial = visitorProfile?.bannerImage ?? visitorProfile?.bannerImageMeta?.url ?? null;
  const visitorLogoInitial = visitorProfile?.logoImage ?? visitorProfile?.logoImageMeta?.url ?? null;
  const { url: visitorBannerUrl } = useSignedFileUrlHook(visitorProfile?.bannerImageMeta?.fileId ?? null, visitorBannerInitial);
  const { url: visitorLogoUrl } = useSignedFileUrlHook(visitorProfile?.logoImageMeta?.fileId ?? null, visitorLogoInitial);

  const viewDisplayData = isVisitorView && visitorProfile
    ? {
        brandName: visitorProfile.brandFullName,
        location: visitorProfile.location ?? [visitorProfile.city, visitorProfile.state, visitorProfile.country].filter(Boolean).join(', '),
        username: '',
        logoImage: visitorLogoUrl ?? undefined,
        bannerImage: visitorBannerUrl ?? undefined,
        hashtags: visitorProfile.hashtags ?? visitorProfile.tags ?? [],
        description: visitorProfile.description ?? '',
        socialLinks: visitorProfile.socialLinks,
        contactInfo: visitorProfile.contactInfo,
        country: visitorProfile.country,
        state: visitorProfile.state,
        city: visitorProfile.city,
      }
    : displayData;

  const brandData = {
    brandName: viewDisplayData.brandName,
    title: 'About Brand',
    description:
      viewDisplayData.description || (isOwner
        ? `${viewDisplayData.brandName} is a Lagos-based fashion brand where indigenous Nigerian textiles meet modern fashion innovation.`
        : 'Welcome to our profile!'),
    socialLinks: {
      instagram: viewDisplayData.socialLinks?.instagram || undefined,
      facebook: viewDisplayData.socialLinks?.facebook || undefined,
      twitter: viewDisplayData.socialLinks?.twitter || undefined,
      website: viewDisplayData.socialLinks?.website || undefined,
    },
    contactInfo: {
      email: viewDisplayData.contactInfo?.email ?? 'contact@brand.com',
      phone: viewDisplayData.contactInfo?.phone ?? '',
    },
    tags: viewDisplayData.hashtags || [],
    businessType: viewDisplayData.contactInfo?.businessType || undefined,
    country: viewDisplayData.country,
    state: viewDisplayData.state,
    city: viewDisplayData.city,
    bannerImage: viewDisplayData.bannerImage,
    established: undefined,
  };

  if (!isOwner && isVisitorView && visitorLoading) {
    return (
      <div className="w-full">
        <div className="max-w-screen-xl mx-auto p-4 space-y-6">
          <ProfileHeaderSkeleton />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-3">
              <div className="h-64 w-full rounded-2xl bg-gray-100 dark:bg-gray-900/40 animate-pulse" />
            </div>
            <div className="lg:col-span-9">
              <CollectionsSkeleton />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isOwner && isVisitorView && !visitorProfile) {
    return <div className="max-w-screen-xl mx-auto p-6">Brand not found.</div>;
  }

  if (!user && !isVisitorView) {
    return (
      <div className="w-full">
        <div className="max-w-screen-xl mx-auto p-4 space-y-6">
          <ProfileHeaderSkeleton />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-3">
              <div className="h-64 w-full rounded-2xl bg-gray-100 dark:bg-gray-900/40 animate-pulse" />
            </div>
            <div className="lg:col-span-9">
              <CollectionsSkeleton />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <ProfileImageModal
        open={isAvatarModalOpen && Boolean(localAvatarPreview ?? displayData.logoImage)}
        src={(localAvatarPreview ?? displayData.logoImage) ?? undefined}
        alt={displayData.brandName}
        onClose={() => setIsAvatarModalOpen(false)}
      />
      {isOwner && user && (
        <ProfileHeaderQuickEditModal
          open={isHeaderQuickEditOpen}
          onClose={() => {
            if (!isSavingHeader) setIsHeaderQuickEditOpen(false);
          }}
          onSubmit={handleHeaderQuickSubmit}
          saving={isSavingHeader}
          initialValues={{
            brandFullName: displayData.brandName,
            brandCountry: displayData.country,
            brandState: displayData.state,
            brandCity: displayData.city,
            brandTags: displayData.hashtags || [],
            username: displayData.username,
          }}
          onOpenFullEditor={() => handleOpenEditModal(false)}
        />
      )}
      {isOwner && (
        <>
          {/* Keep inputs in the DOM (sr-only) so programmatic click reliably opens the picker */}
          <input
            id="avatar-file-input"
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleAvatarSelected}
          />
          <input
            id="banner-file-input"
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleBannerSelected}
          />
        </>
      )}
      <ProfileHeader
        profileData={{
          name: viewDisplayData.brandName,
          location: viewDisplayData.location,
          username: viewDisplayData.username,
          avatar: (localAvatarPreview ?? viewDisplayData.logoImage) ?? '',
          banner: bannerPreviewUrl ?? viewDisplayData.bannerImage ?? '',
          tags: viewDisplayData.hashtags || [],
        }}
        canEdit={isOwner}
        onEditProfile={() => setIsHeaderQuickEditOpen(true)}
        onShareProfile={handleShareProfile}
        onEditAvatar={handleTriggerAvatarUpload}
        onEditBanner={handleTriggerBannerUpload}
        avatarLoading={avatarUploading}
        bannerLoading={bannerUploading}
        avatarHighlight={avatarHighlight}
        onViewAvatar={() => {
          if (localAvatarPreview || viewDisplayData.logoImage) {
            setIsAvatarModalOpen(true);
            if (avatarHighlight) {
              setAvatarHighlight(false);
            }
          }
        }}
      />
      <ImageCropModal
        open={Boolean(cropTask)}
        file={cropTask?.file ?? null}
        aspect={cropTask?.type === 'banner' ? 3.2 : 1}
        title={cropTask?.type === 'banner' ? 'Crop banner image' : 'Adjust profile photo'}
        enforceAspect={cropTask?.type === 'banner'}
        allowUseOriginal={cropTask?.type === 'avatar'}
        onConfirm={handleCropConfirm}
        onUseOriginal={cropTask?.type === 'avatar' ? handleCropUseOriginal : undefined}
        onClose={() => setCropTask(null)}
      />

      <div className="w-full px-4 sm:px-6 pb-12">
        <div className="mt-6">
          <Tabs
            tabs={["Collections", "Reviews", "About"]}
            activeTab={activeTab}
            onTabChange={(tab) => setActiveTab(tab as TabType)}
          />

          <div className="mt-6">
            {activeTab === 'Collections' && (
              <div>
                {selectedCollectionId ? (
                  // Show inline collection viewer
                    <InlineCollectionViewer
                    collectionId={selectedCollectionId}
                    onBack={() => setSelectedCollectionId(null)}
                    brandName={displayData?.brandName || displayData?.username || 'Brand'}
                    onPriceUpdated={async () => {
                      // Refresh collections to show updated prices on cards
                      if (isVisitorView && routeBrandId) {
                        const cols = await brandApi.getCollections(routeBrandId);
                        setVisitorCollections(cols ?? []);
                      } else if (user) {
                        await fetchCollections(user.id);
                      }
                    }}
                  />
                ) : (
                  // Show collections grid
                  <>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                      <div className="flex-1 w-full sm:w-auto">
                        <SearchField placeholder="Search collections..." onSearch={setSearchQuery} />
                      </div>
                      {/* Show create controls only for owner */}
                      {isOwner && (
                        <AddCollectionDropdown openModal={() => handleOpenAddModal()} />
                      )}
                    </div>

                    {/* Visibility filter chips */}
                    <div className="mb-4">
                      <div className="inline-flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                        {(['Public','Private'] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setVisibilityFilter(opt)}
                            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                              visibilityFilter === opt
                                ? 'bg-purple-600 text-white'
                                : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Collections Grid */}
                    {(isOwner ? collectionsLoading : visitorLoading) ? (
                      <CollectionsSkeleton />
                    ) : (isVisitorView ? visitorCollections : collections) && (isVisitorView ? visitorCollections : collections).length > 0 ? (
                      <CollectionsGrid
                        collections={searchAndVisibilityFiltered}
                        onEdit={isOwner ? () => {} : undefined}
                        onDelete={isOwner ? () => {} : undefined}
                        onCollectionClick={(id) => setSelectedCollectionId(id)}
                      />
                    ) : (
                      isOwner ? (
                        <EmptyState
                          title="No collections yet"
                          description="Create a collection to save and curate posts."
                          cta={<AddCollectionDropdown openModal={() => handleOpenAddModal()} asLink />}
                        />
                      ) : (
                        <div className="text-center text-gray-500">No collections available.</div>
                      )
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'Reviews' && (
              <ReviewsTab />
            )}

            {activeTab === 'About' && (
              <AboutTab brandData={brandData} />
            )}
          </div>
        </div>
      </div>

      {isOwner && (
        <AddCollectionModal
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          onCreate={async () => {
            setIsAddOpen(false);
            if (user) await fetchCollections(user.id);
          }}
        />
      )}

      {isOwner && (
        <EditProfileModal
          isOpen={isEditModalOpen}
          user={user!}
          brandProfile={brandProfile}
          showSkip={openedFromPrompt}
          onSkip={handleDismissModal}
          onClose={handleDismissModal}
          onSaved={handleProfileSaved}
        />
      )}
    </div>
  );
};

export default ProfilePage;
