import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
import type { AuthUserDto } from '../../types/auth';
import { setUser } from '../../features/userSlice';
import { brandApi } from '../../api/BrandApi';
import ProfileImageModal from '../../components/profile/ProfileImageModal';
import ProfileHeaderQuickEditModal from '../../components/profile/ProfileHeaderQuickEditModal';
import ImageCropModal from '../../components/upload/ImageCropModal';

type TabType = 'Collections' | 'Reviews' | 'About';
// CollectionType removed — dropdown opens modal directly

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
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
  const isBrandOwner = user?.type === 'BRAND';
  const dispatch = useDispatch();

  const [searchQuery, setSearchQuery] = useState('');
  const filteredCollections = (collections || []).filter(c =>
    (c.name || c.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [activeTab, setActiveTab] = useState<TabType>('Collections');
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
    if (bannerPreviewUrl && displayData.bannerImage && displayData.bannerImage !== bannerPreviewUrl) {
      updateBannerPreview(null);
    }
  }, [displayData.bannerImage, bannerPreviewUrl]);

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

  // Always try to resolve a signed avatar URL when we have a profileImageId to ensure visibility after refresh
  useEffect(() => {
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
  }, [user?.profileImageId]);

  useEffect(() => {
    if (
      displayData.logoImage &&
      (!localAvatarPreview || localAvatarPreview.startsWith('blob:'))
    ) {
      updateAvatarPreview(displayData.logoImage);
    }
  }, [displayData.logoImage, localAvatarPreview]);

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
    if (activeTab === 'Reviews' && isBrandOwner && reviews.length === 0 && !reviewsLoading) {
      void fetchReviews(user.id);
    }
  }, [activeTab, isBrandOwner, user, reviews.length, reviewsLoading, fetchReviews]);

  const requiresProfileSetup = useMemo(() => {
    if (!isBrandOwner || !user) {
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

    return description.length < 20 || tags.length === 0 || !hasLocation;
  }, [isBrandOwner, user, brandProfile]);

  useEffect(() => {
    if (
      isBrandOwner &&
      !brandProfileLoading &&
      requiresProfileSetup &&
      !hasDismissedSetup &&
      !isEditModalOpen
    ) {
      setOpenedFromPrompt(true);
      setIsEditModalOpen(true);
    }
  }, [
    isBrandOwner,
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
    if (isBrandOwner) {
      avatarInputRef.current?.click();
    }
  };

  const handleTriggerBannerUpload = () => {
    if (isBrandOwner) {
      bannerInputRef.current?.click();
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

  const brandData = {
    brandName: displayData.brandName,
    title: 'About Brand',
    description:
      displayData.description || (isBrandOwner
        ? `${displayData.brandName} is a Lagos-based fashion brand where indigenous Nigerian textiles meet modern fashion innovation.`
        : 'Welcome to our profile!'),
    socialLinks: displayData.socialLinks,
    contactInfo: displayData.contactInfo,
    tags: displayData.hashtags || [],
    businessType: displayData.contactInfo?.businessType,
    country: displayData.country,
    state: displayData.state,
    city: displayData.city,
    bannerImage: displayData.bannerImage,
    established: undefined, // Could be added to backend later
  };

  if (!user) {
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
      {user && (
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
      {isBrandOwner && (
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
          name: displayData.brandName,
          location: displayData.location,
          username: displayData.username,
          avatar: (localAvatarPreview ?? displayData.logoImage) ?? '',
          banner: bannerPreviewUrl ?? displayData.bannerImage ?? '',
          tags: displayData.hashtags || [],
        }}
        canEdit={isBrandOwner}
        onEditProfile={() => setIsHeaderQuickEditOpen(true)}
        onShareProfile={() => undefined}
        onEditAvatar={handleTriggerAvatarUpload}
        onEditBanner={handleTriggerBannerUpload}
        avatarLoading={avatarUploading}
        bannerLoading={bannerUploading}
        avatarHighlight={avatarHighlight}
        onViewAvatar={() => {
          if (localAvatarPreview || displayData.logoImage) {
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
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <div className="flex-1 w-full sm:w-auto">
                    <SearchField placeholder="Search collections..." onSearch={setSearchQuery} />
                  </div>
                  {isBrandOwner && (
                    <AddCollectionDropdown openModal={() => handleOpenAddModal()} />
                  )}
                </div>

                {/* For now use CollectionsSkeleton when loading, otherwise show grid or placeholder */}
                {/* Note: fetchCollections is called on modal create; new users will see the EmptyState */}
                {collectionsLoading ? (
                  <CollectionsSkeleton />
                ) : collections && collections.length > 0 ? (
                  <CollectionsGrid
                    collections={filteredCollections}
                    onEdit={isBrandOwner ? () => {} : undefined}
                    onDelete={isBrandOwner ? () => {} : undefined}
                    onCollectionClick={(id) => navigate(`/collections/${id}`)}
                  />
                ) : (
                  isBrandOwner ? (
                    <EmptyState
                      title="No collections yet"
                      description="Create a collection to save and curate posts."
                      cta={<AddCollectionDropdown openModal={() => handleOpenAddModal()} asLink />}
                    />
                  ) : (
                    <div className="text-center text-gray-500">No collections available.</div>
                  )
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

      {isBrandOwner && (
        <AddCollectionModal
          isOpen={isAddOpen}
          onClose={() => setIsAddOpen(false)}
          onCreate={async () => {
            setIsAddOpen(false);
            if (user) await fetchCollections(user.id);
          }}
        />
      )}

      {isBrandOwner && (
        <EditProfileModal
          isOpen={isEditModalOpen}
          user={user}
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
