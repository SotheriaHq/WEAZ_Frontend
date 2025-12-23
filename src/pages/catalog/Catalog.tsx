import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useBrandProfile } from '../../hooks/UseBrandHook';
import { useDispatch } from 'react-redux';

import { toast } from 'sonner';
import ProfileHeader from '../../components/catalog/ProfileHeader';
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
import CollectionCard from '../../components/profile/CollectionCard';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import type { AuthUserDto } from '../../types/auth';
import { setUser } from '../../features/userSlice';
import { brandApi } from '../../api/BrandApi';
import ProfileImageModal from '../../components/profile/ProfileImageModal';
import ProfileHeaderQuickEditModal from '../../components/profile/ProfileHeaderQuickEditModal';
import ImageCropModal from '../../components/upload/ImageCropModal';
import type { BrandProfileDto, CollectionDto } from '../../types/profile';
import { useSignedFileUrl as useSignedFileUrlHook } from '../../hooks/useSignedFileUrl';

import ComingSoon from '../placeholders/ComingSoon';

type TabType = 'Collections' | 'Reviews' | 'About' | 'Drafts';
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
    collectionsError,
    reviews,
    reviewsLoading,
    reviewsError,
    displayData,
    fetchCollections,
    fetchReviews,
    fetchBrandProfile,
    brandProfileError,
  } = useBrandProfile();
  
  const [drafts, setDrafts] = useState<CollectionDto[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftsError, setDraftsError] = useState<string | null>(null);
  const [draftsInitialized, setDraftsInitialized] = useState(false);
  const [publishingStates, setPublishingStates] = useState<Record<string, { status: 'publishing' | 'failed'; startedAt: number; attempts: number; message?: string }>>({});

  const navigate = useNavigate();
  const location = useLocation();
  // Owner view when no route param or when the param matches the logged-in brand user's id
  const isOwner = Boolean(user?.type === 'BRAND' && (!routeBrandId || routeBrandId === user?.id));
  const isVisitorView = !isOwner && Boolean(routeBrandId);
  
  const dispatch = useDispatch();

  const [searchQuery, setSearchQuery] = useState('');
  
  // State for inline collection viewer
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  // Handle URL params for tab, collection, and visibility filter
  useEffect(() => {
    const urlCollectionId = searchParams.get('collectionId');
    if (urlCollectionId) {
      setSelectedCollectionId(urlCollectionId);
    }
    const tab = searchParams.get('tab');
    if (tab && ['Collections', 'Reviews', 'About'].includes(tab)) {
      setActiveTab(tab as TabType);
    }
    // Handle visibility filter from URL (e.g., after draft save redirect)
    const visibility = searchParams.get('visibility');
    if (visibility && ['Public', 'Private', 'Drafts'].includes(visibility)) {
      setVisibilityFilter(visibility as 'Public' | 'Private' | 'Drafts');
    }
  }, [searchParams]);

  const [activeTab, setActiveTab] = useState<TabType>('Collections');
  const [visibilityFilter, setVisibilityFilter] = useState<'Public' | 'Private' | 'Drafts'>('Public');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [pendingAccessConfirm, setPendingAccessConfirm] = useState<string | null>(null);
  const [collectionToDelete, setCollectionToDelete] = useState<string | null>(null);
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

  // Capture navigation state from publish flow to show inline publishing badge on card
  useEffect(() => {
    const navState = (location.state as any) || {};
    if (navState.publishingCollectionId) {
      const id = String(navState.publishingCollectionId);
      const startedAt = typeof navState.publishingStartedAt === 'number' ? navState.publishingStartedAt : Date.now();
      setPublishingStates((prev) => ({
        ...prev,
        [id]: {
          status: 'publishing',
          startedAt,
          attempts: 0,
          message: navState.publishingTitle ? `Publishing "${navState.publishingTitle}"` : 'Publishing your collection',
        },
      }));
      // Clear state so refresh/back does not re-run
      navigate(`${location.pathname}${location.search}`, { replace: true });
    }
  }, [location.pathname, location.search, location.state, navigate]);

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

  useEffect(() => {
    if (visibilityFilter === 'Drafts' && isOwner) {
      setDraftsLoading(true);
      setDraftsError(null);
      brandApi.getMyDraftCollections()
        .then(items => {
          // Deduplicate by ID to prevent showing duplicate draft cards
          const uniqueDrafts = items.reduce((acc, draft) => {
            if (!acc.some(d => d.id === draft.id)) {
              acc.push(draft);
            }
            return acc;
          }, [] as typeof items);
          setDrafts(uniqueDrafts);
          setDraftsInitialized(true);
        })
        .catch(err => {
          console.error(err);
          setDraftsError('Unable to connect to server. Please check your connection.');
        })
        .finally(() => setDraftsLoading(false));
    }
  }, [visibilityFilter, isOwner]);

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
  const [visitorError, setVisitorError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!isVisitorView || !routeBrandId) return;
      setVisitorLoading(true);
      setVisitorError(null);
      try {
        const [p, cols] = await Promise.all([
          brandApi.getBrandProfile(routeBrandId),
          brandApi.getCollections(routeBrandId, { visibility: 'all' }),
        ]);
        if (!mounted) return;
        setVisitorProfile(p ?? null);
        setVisitorCollections(cols ?? []);
      } catch (e) {
        if (mounted) setVisitorError('Failed to load profile data');
      } finally {
        if (mounted) setVisitorLoading(false);
      }
    };
    void run();
    return () => { mounted = false; };
  }, [isVisitorView, routeBrandId]);

  // Visitor: fetch private access states for Private view
  const [privateStates, setPrivateStates] = useState<Array<{ collectionId: string; title: string; coverUrl?: string | null; coverFileId?: string | null; itemCount?: number; state: 'APPROVED' | 'PENDING' | 'REVOKED' | 'NONE' }>>([]);
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!isVisitorView || !routeBrandId) return;
      try {
        const items = await brandApi.getBrandPrivateStates(routeBrandId);
        if (mounted) setPrivateStates(items);
      } catch {}
    };
    void run();
    return () => { mounted = false; };
  }, [isVisitorView, routeBrandId]);

  const activeCollections = (isVisitorView ? visitorCollections : collections) || [];
  
  // Filter logic updated to handle Drafts
  let displayCollections: CollectionDto[] = [];
  if (visibilityFilter === 'Drafts') {
    displayCollections = drafts;
  } else {
    displayCollections = activeCollections.filter((c) =>
      visibilityFilter === 'Public' ? (c.isPublic || c.visibility === 'PUBLIC') : (!c.isPublic || c.visibility === 'PRIVATE')
    );
  }

  const searchAndVisibilityFiltered = displayCollections.filter(c =>
    (c.name || c.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const decoratedCollections = useMemo(() => {
    return searchAndVisibilityFiltered.map((c) => {
      const pub = publishingStates[c.id];
      if (!pub) return c;
      return {
        ...c,
        clientStatus: pub.status === 'publishing' ? 'publishing' : 'publish-failed',
        clientStatusMessage: pub.message ?? (pub.status === 'publishing' ? 'Publishing...' : 'Publish failed'),
        clientStatusMeta: { startedAt: pub.startedAt, attempts: pub.attempts, offline: !navigator.onLine },
      } as CollectionDto;
    });
  }, [publishingStates, searchAndVisibilityFiltered]);

  const handleRetryPublishCheck = useCallback(async (collectionId: string) => {
    if (!collectionId) return;
    try {
      setPublishingStates((prev) => ({
        ...prev,
        [collectionId]: {
          status: 'publishing',
          startedAt: prev[collectionId]?.startedAt ?? Date.now(),
          attempts: (prev[collectionId]?.attempts ?? 0) + 1,
          message: 'Checking publish status...',
        },
      }));
      await brandApi.getCollectionDetail(collectionId);
      if (!isVisitorView && user?.id) {
        await fetchCollections(user.id);
      } else if (isVisitorView && routeBrandId) {
        const cols = await brandApi.getCollections(routeBrandId, { visibility: 'all' });
        setVisitorCollections(cols ?? []);
      }
      setPublishingStates((prev) => {
        const next = { ...prev };
        delete next[collectionId];
        return next;
      });
      toast.success('Collection is live');
    } catch (error) {
      console.error('Publish status check failed', error);
      setPublishingStates((prev) => ({
        ...prev,
        [collectionId]: {
          status: 'failed',
          startedAt: prev[collectionId]?.startedAt ?? Date.now(),
          attempts: (prev[collectionId]?.attempts ?? 0) + 1,
          message: 'Publish is still processing. Try again shortly.',
        },
      }));
    }
  }, [fetchCollections, isVisitorView, routeBrandId, user]);

  // Poll publish status for any pending ids
  useEffect(() => {
    const pending = Object.entries(publishingStates).filter(([, state]) => state.status === 'publishing');
    if (pending.length === 0) return;

    const poll = async () => {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine;
      if (offline) {
        setPublishingStates((prev) => {
          const next = { ...prev };
          pending.forEach(([id, state]) => {
            next[id] = { ...state, message: 'Offline. We will resume when back online.' };
          });
          return next;
        });
        return;
      }

      await Promise.all(pending.map(async ([id, state]) => {
        try {
          await brandApi.getCollectionDetail(id);
          if (!isVisitorView && user?.id) {
            await fetchCollections(user.id);
          } else if (isVisitorView && routeBrandId) {
            const cols = await brandApi.getCollections(routeBrandId, { visibility: 'all' });
            setVisitorCollections(cols ?? []);
          }
          setPublishingStates((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        } catch (error: any) {
          const attempts = state.attempts + 1;
          const tookTooLong = Date.now() - state.startedAt > 90_000;
          setPublishingStates((prev) => ({
            ...prev,
            [id]: {
              ...state,
              attempts,
              status: tookTooLong ? 'failed' : 'publishing',
              message: tookTooLong
                ? 'Publishing is taking longer than usual. Retry to check again.'
                : 'Still processing your collection...'
            },
          }));
        }
      }));
    };

    const interval = setInterval(() => {
      void poll();
    }, 5000);

    void poll();

    return () => clearInterval(interval);
  }, [publishingStates, fetchCollections, isVisitorView, routeBrandId, user]);

  // Debug: track filtering pipeline when tab or lists change
  useEffect(() => {
    try {
      const totals = activeCollections.reduce((acc, c) => {
        acc.all += 1;
        if (c.visibility === 'PRIVATE' || c.isPublic === false) acc.private += 1; else acc.public += 1;
        return acc;
      }, { all: 0, public: 0, private: 0 } as any);
      console.debug('[BrandProfile] view', {
        isOwner,
        isVisitorView,
        activeTab,
        visibilityFilter,
        total: activeCollections.length,
        ...totals,
        filtered: displayCollections.length,
        searched: searchAndVisibilityFiltered.length,
      });
    } catch {}
  }, [isOwner, isVisitorView, activeTab, visibilityFilter, activeCollections, displayCollections.length, searchAndVisibilityFiltered.length]);

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
    title: 'About Catalog',
    description:
      viewDisplayData.description || (isOwner
        ? `${viewDisplayData.brandName} is a Lagos-based fashion brand where indigenous Nigerian textiles meet modern fashion innovation.`
        : 'Welcome to our catalog!'),
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
    return <div className="max-w-screen-xl mx-auto p-6">Catalog not found.</div>;
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
        storeId={user?.storeId}
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
            tabs={isOwner ? ["Collections", "Reviews", "About"] : ["Collections", "Reviews", "About"]}
            activeTab={activeTab}
            onTabChange={(tab) => {
                setActiveTab(tab as TabType);
                setSearchParams(prev => {
                    prev.set('tab', tab);
                    return prev;
                });
            }}
          />

          <div className="mt-6 min-h-[420px] motion-safe:transition-opacity motion-safe:duration-200">
            {activeTab === 'Collections' && (
              <div>
                {selectedCollectionId ? (
                  // Show inline collection viewer
                  <InlineCollectionViewer
                    collectionId={selectedCollectionId}
                    onBack={() => {
                      setSelectedCollectionId(null);
                      setSearchParams(prev => {
                        prev.delete('collectionId');
                        return prev;
                      });
                    }}
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
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                      <div className="flex-1 w-full sm:w-auto">
                        <SearchField placeholder="Search collections..." onSearch={setSearchQuery} />
                      </div>
                      {/* Show create controls only for owner */}
                      {isOwner && (
                        <div className="flex gap-2">
                          <AddCollectionDropdown openModal={() => handleOpenAddModal()} />
                        </div>
                      )}
                    </div>

                    {/* Visibility filter chips */}
                    <div className="mb-6">
                      <div className="inline-flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                        {(['Public','Private', ...(isOwner ? ['Drafts'] : [])] as const).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setVisibilityFilter(opt as any)}
                            className={`px-4 py-1.5 text-sm font-medium transition-colors flex items-center gap-2 ${
                              visibilityFilter === opt
                                ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 text-white'
                                : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            <span>{opt === 'Public' ? '🌍' : opt === 'Private' ? '🔒' : '📝'}</span>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Collections Grid (Owner or Visitor/Public) */}
                    {isVisitorView && visibilityFilter === 'Private' ? (
                      // Visitor Private view: Show approved collections or permission request
                      (() => {
                        const approvedCollections = privateStates.filter(s => s.state === 'APPROVED');
                        const hasUnapproved = privateStates.some(s => s.state !== 'APPROVED');
                        const hasPending = privateStates.some(s => s.state === 'PENDING');
                        const hasRevoked = privateStates.some(s => s.state === 'REVOKED');

                        // If user has approved access, show those collections using regular collection cards
                        if (approvedCollections.length > 0) {
                          // Get full collection data for approved collections from visitorCollections
                          const approvedCollectionData = visitorCollections.filter(c => 
                            approvedCollections.some(ac => ac.collectionId === c.id)
                          );
                          
                          return (
                            <div className="space-y-6">
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                {approvedCollectionData.map((collection) => (
                                  <CollectionCard
                                    key={collection.id}
                                    collection={collection}
                                    onClick={() => {
                                      setSelectedCollectionId(collection.id);
                                      setSearchParams(prev => {
                                        prev.set('collectionId', collection.id);
                                        return prev;
                                      });
                                    }}
                                    showActions={false}
                                  />
                                ))}
                              </div>
                              
                              {/* Show request card for remaining collections */}
                              {hasUnapproved && (
                                <div className="mt-8 max-w-2xl mx-auto">
                                  <div className="glass-panel rounded-2xl p-6 border border-purple-200/50 dark:border-purple-500/20 bg-gradient-to-br from-white/80 via-purple-50/30 to-white/80 dark:from-purple-900/10 dark:via-purple-800/5 dark:to-gray-900/20 backdrop-blur-xl shadow-lg">
                                    <div className="text-center space-y-3">
                                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/40">
                                        <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                        </svg>
                                      </div>
                                      <p className="text-sm text-gray-700 dark:text-gray-300">
                                        {hasPending ? '✓ Access request pending for other collections' : hasRevoked ? 'Some requests were declined (wait 72h to re-request)' : 'Request access to view all private collections'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }

                        // No approved collections - show single permission request card
                        if (privateStates.length > 0) {
                          return (
                            <div className="max-w-2xl mx-auto py-8">
                              <div className="glass-panel rounded-2xl p-8 border border-purple-200/50 dark:border-purple-500/20 bg-gradient-to-br from-white/90 via-purple-50/50 to-white/90 dark:from-purple-900/20 dark:via-purple-800/10 dark:to-gray-900/40 backdrop-blur-xl shadow-xl">
                                <div className="flex flex-col items-center text-center space-y-4">
                                  {/* Icon */}
                                  <div className="relative">
                                    <div className="absolute inset-0 bg-purple-400/30 dark:bg-purple-500/20 blur-2xl rounded-full" />
                                    <div className="relative bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/60 dark:to-purple-800/40 p-5 rounded-2xl border border-purple-300/50 dark:border-purple-500/30 shadow-lg">
                                      <svg className="w-10 h-10 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                      </svg>
                                    </div>
                                  </div>

                                  {/* Title & Message */}
                                  <div className="space-y-2">
                                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                      Private Collections
                                    </h2>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                      You do not have permission to view private collections from this brand. Request access to view exclusive drops and content.
                                    </p>
                                  </div>

                                  {/* Collection Count */}
                                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 dark:bg-white/5 border border-gray-200 dark:border-gray-700">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{privateStates.length} private collection{privateStates.length !== 1 ? 's' : ''}</span>
                                  </div>

                                  {/* Request State */}
                                  <div className="pt-2 w-full">
                                    {hasPending ? (
                                      <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/30">
                                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                        <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Access request pending</span>
                                      </div>
                                    ) : hasRevoked ? (
                                      <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700/30">
                                        <p className="text-sm font-medium text-red-700 dark:text-red-300">Access request was declined</p>
                                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">Wait 72 hours before requesting again</p>
                                      </div>
                                    ) : (
                                      <button
                                        className="w-full px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 text-white hover:opacity-90 transition-opacity font-medium shadow-md"
                                        onClick={() => {
                                          if (!user) {
                                            const returnTo = `${window.location.pathname}${window.location.search}`;
                                            navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
                                            return;
                                          }
                                          // Use first collection to request access (applies to all)
                                          if (privateStates[0]) {
                                            setPendingAccessConfirm(privateStates[0].collectionId);
                                          }
                                        }}
                                      >
                                        Request Access
                                      </button>
                                    )}
                                  </div>

                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    One request gives you access to all private collections from this brand
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // No private collections at all
                        return (
                          <div className="text-center py-12">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                              </svg>
                            </div>
                            <p className="text-gray-600 dark:text-gray-400 font-medium">No private collections available</p>
                            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">This brand hasn't created any private collections yet</p>
                          </div>
                        );
                      })()
                    ) : (
                      (isOwner ? (visibilityFilter === 'Drafts' ? !!draftsError : !!collectionsError) : !!visitorError) ? (
                        <div className="relative h-[60vh] min-h-[400px] w-full rounded-3xl overflow-hidden border border-gray-200 dark:border-gray-800">
                          <ComingSoon
                            title="Connection Issue"
                            description="We couldn't connect to the server to load your collections. Please check your internet connection."
                            emoji="🔌"
                            showNotify={false}
                            backPath="#"
                            variant="default"
                            minHeight="min-h-full"
                            className="bg-gray-50 dark:bg-[#0a0a0a]"
                          />
                        </div>
                      ) : (isOwner ? (visibilityFilter === 'Drafts' ? (draftsLoading || !draftsInitialized) : collectionsLoading) : visitorLoading) ? (
                        <CollectionsSkeleton />
                      ) : searchAndVisibilityFiltered.length > 0 ? (
                        <CollectionsGrid
                          collections={decoratedCollections}
                          isDraft={visibilityFilter === 'Drafts'}
                          onEdit={isOwner ? (id) => navigate(`/profile/collections/edit/${id}`) : undefined}
                          onDelete={isOwner ? (id) => setCollectionToDelete(id) : undefined}
                          onCollectionClick={(id) => {
                            if (visibilityFilter === 'Drafts') {
                              navigate(`/profile/collections/edit/${id}`);
                            } else {
                              setSelectedCollectionId(id);
                              setSearchParams(prev => {
                                prev.set('collectionId', id);
                                return prev;
                              });
                            }
                          }}
                          onRetryPublish={handleRetryPublishCheck}
                        />
                      ) : (
                        isOwner ? (
                          <EmptyState
                            title={visibilityFilter === 'Drafts' ? "No drafts" : "No collections yet"}
                            description={visibilityFilter === 'Drafts' ? "You don't have any unfinished collections." : "Create a collection to save and curate posts."}
                            // Removed redundant CTA button as requested
                          />
                        ) : (
                          <div className="text-center text-gray-500">
                            No collections available.
                          </div>
                        )
                      )
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'Reviews' && (
              reviewsError ? (
                <div className="relative h-[60vh] min-h-[400px] w-full rounded-3xl overflow-hidden border border-gray-200 dark:border-gray-800">
                  <ComingSoon
                    title="Reviews Unavailable"
                    description="We couldn't connect to the server to load reviews."
                    emoji="💬"
                    showNotify={false}
                    backPath="#"
                    variant="default"
                    minHeight="min-h-full"
                    className="bg-gray-50 dark:bg-[#0a0a0a]"
                  />
                </div>
              ) : (
                <ReviewsTab />
              )
            )}

            {activeTab === 'About' && (
              brandProfileError ? (
                <div className="relative h-[60vh] min-h-[400px] w-full rounded-3xl overflow-hidden border border-gray-200 dark:border-gray-800">
                  <ComingSoon
                    title="Profile Unavailable"
                    description="We couldn't load the profile information."
                    emoji="📋"
                    showNotify={false}
                    backPath="#"
                    variant="default"
                    minHeight="min-h-full"
                    className="bg-gray-50 dark:bg-[#0a0a0a]"
                  />
                </div>
              ) : (
                <AboutTab brandData={brandData} />
              )
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

      {/* Confirm access request dialog for visitor */}
      <ConfirmDialog
        open={Boolean(pendingAccessConfirm)}
        title="Request Private Access"
        message="Request access to this private collection? If the brand rejects your request, you must wait 72 hours before trying again."
        confirmText="Request Access"
        cancelText="Cancel"
        onCancel={() => setPendingAccessConfirm(null)}
        onConfirm={async () => {
          const collectionId = pendingAccessConfirm;
          setPendingAccessConfirm(null);
          if (!collectionId || !user) return;
          const res = await brandApi.requestPrivateAccess(collectionId);
          if (res) {
            if ((res as any).cooldownActive) {
              const nextStr = (res as any).nextAllowedAt as string | undefined;
              let label = 'later';
              if (nextStr) {
                const next = new Date(nextStr);
                const now = new Date();
                const sameDay = next.toDateString() === now.toDateString();
                label = sameDay
                  ? next.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                  : next.toLocaleString([], { month: 'short', day: 'numeric', minute: '2-digit' });
              }
              toast.info(`Try again after ${label}`);
              return;
            }
            setPrivateStates(prev => prev.map(p => p.collectionId === collectionId ? { ...p, state: res.state } : p));
            if (res.state === 'PENDING') {
              toast.success('Access requested');
            }
          } else {
            toast.error('Failed to request access');
          }
        }}
      />

      {/* Confirm Delete Collection Dialog */}
      <ConfirmDialog
        open={Boolean(collectionToDelete)}
        title={drafts.some(d => d.id === collectionToDelete) ? "Delete Draft" : "Delete Collection"}
        message={drafts.some(d => d.id === collectionToDelete) 
          ? "Are you sure you want to discard this draft? This action cannot be undone." 
          : "Are you sure you want to delete this collection? This action cannot be undone."}
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive
        onCancel={() => setCollectionToDelete(null)}
        onConfirm={async () => {
          if (!collectionToDelete || !user) return;
          const id = collectionToDelete;
          const isDraft = drafts.some(d => d.id === id);
          setCollectionToDelete(null);
          try {
            const success = await brandApi.deleteCollection(id);
            if (success) {
              toast.success(isDraft ? 'Draft discarded' : 'Collection deleted');
              if (isDraft) {
                // Refresh drafts list
                setDraftsLoading(true);
                brandApi.getMyDraftCollections()
                  .then(items => setDrafts(items))
                  .catch(err => console.error(err))
                  .finally(() => setDraftsLoading(false));
              } else {
                // Refresh published collections
                await fetchCollections(user.id);
              }
            } else {
              toast.error(isDraft ? 'Failed to discard draft' : 'Failed to delete collection');
            }
          } catch (error) {
            console.error('Error deleting collection:', error);
            toast.error('An error occurred');
          }
        }}
      />

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
