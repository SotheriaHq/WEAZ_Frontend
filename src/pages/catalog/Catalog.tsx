import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useBrandProfile } from '../../hooks/UseBrandHook';
import { useDispatch } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';

import { toast } from 'sonner';
import ProfileHeader from '../../components/catalog/ProfileHeader';
import OwnerCatalogMediaHeader from '../../components/catalog/OwnerCatalogMediaHeader';
import Tabs from '../../components/Tabs';
import AddCollectionModal from '../../components/profile/AddCollectionModal';
import CollectionsGrid from '../../components/profile/CollectionsGrid';
import CollectionsSkeleton from '../../components/profile/CollectionsSkeleton';
import EmptyState from '../../components/EmptyState';
import AddCollectionDropdown from '../../components/profile/AddCollectionDropdown';
import ProfileHeaderSkeleton from '../../components/profile/ProfileHeaderSkeleton';
import ProfileImageModal from '../../components/profile/ProfileImageModal';
import ReviewsTab from '../../components/profile/tabs/ReviewsTab';
import AboutTab from '../../components/profile/tabs/AboutTab';
import InlineCollectionViewer from '../../components/collections/InlineCollectionViewer';
import CatalogEntityCard from '../../components/profile/CatalogEntityCard';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { setUser } from '../../features/userSlice';
import { brandApi } from '../../api/BrandApi';
import { ProfilePhotoViewApi } from '@/api/ProfilePhotoViewApi';
import { useBrandPatchState } from '@/context/BrandPatchContext';
import { finalizeCollectionUploads } from '@/api/collectionUploads';
import ProfileHeaderQuickEditModal from '../../components/profile/ProfileHeaderQuickEditModal';
import type { BrandProfileDto, CollectionDto } from '../../types/profile';
import { useSignedFileUrl as useSignedFileUrlHook } from '../../hooks/useSignedFileUrl';
import type { StoreStatusResponse } from '../../api/StoreApi';
import CatalogShopTab from '@/components/catalog/CatalogShopTab';
import BrandQrModal from '@/components/qr/BrandQrModal';
import { resolveBannerImageSource, resolveProfileImageSource } from '@/utils/profileImage';
import { buildProfileUrl } from '@/utils/publicLinks';
import {
  type PublishTask,
  type PublishTaskKind,
  readPublishTasks,
  subscribePublishTasks,
  prunePublishTasks,
  removePublishTask,
  getPublishTaskDesignId,
  getPublishTaskLegacyCollectionId,
  getCompactPublishTaskStatusLabel,
} from '@/utils/publishTracker';
import { buildDesignRoute } from '@/utils/catalogRoutes';
import {
  resolveVisibilityFilterFromQuery,
  type CatalogVisibilityFilter,
} from '@/utils/catalogVisibilityQuery';
import { canManageCatalog, getActiveBrandId } from '@/lib/brandAccess';
import {
  fetchBrandCollectionsQuery,
  fetchCollectionDetailQuery,
  useBrandPrivateAccessStatesQuery,
  useBrandCollectionsQuery,
  useBrandProfileQuery,
  useStoreStatusQuery,
} from '@/query/queries';
import { queryKeys } from '@/query/queryKeys';

import ComingSoon from '../placeholders/ComingSoon';

type TabType = 'Content' | 'Store' | 'Reviews' | 'Us' | 'Drafts';
type VisibilityFilter = CatalogVisibilityFilter;
const VISIBILITY_FILTERS: VisibilityFilter[] = ['Public', 'Private'];
const OWNER_VISIBILITY_FILTERS: VisibilityFilter[] = [
  'Public',
  'Private',
  'Drafts',
  'In Review',
  'Changes Requested',
  'Rejected',
  'Deleted',
];
const REVIEW_VISIBILITY_STATUS: Partial<Record<VisibilityFilter, string>> = {
  'In Review': 'IN_REVIEW',
  'Changes Requested': 'CHANGES_REQUESTED',
  Rejected: 'REJECTED',
};

type PrivateAccessState = {
  collectionId: string;
  title: string;
  coverUrl?: string | null;
  coverFileId?: string | null;
  itemCount?: number;
  state: 'APPROVED' | 'PENDING' | 'REVOKED' | 'NONE';
};

const arePrivateAccessStatesEqual = (left: PrivateAccessState[], right: PrivateAccessState[]) => {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const previous = left[index];
    const next = right[index];
    if (
      previous.collectionId !== next.collectionId ||
      previous.title !== next.title ||
      previous.coverUrl !== next.coverUrl ||
      previous.coverFileId !== next.coverFileId ||
      previous.itemCount !== next.itemCount ||
      previous.state !== next.state
    ) {
      return false;
    }
  }
  return true;
};
// CollectionType removed — dropdown opens modal directly

type CatalogTabNoticeProps = {
  title: string;
  description: string;
};

const CatalogTabNotice: React.FC<CatalogTabNoticeProps> = ({ title, description }) => (
  <div className="flex min-h-[400px] w-full items-center justify-center rounded-3xl bg-gray-50/50 px-8 py-16 text-center dark:bg-white/[0.03]">
    <div className="max-w-2xl space-y-4">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] bg-white text-4xl shadow-sm dark:bg-white/5">
        💬
      </div>
      <div className="space-y-2">
        <h2 className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">{title}</h2>
        <p className="text-base text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </div>
  </div>
);

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
    averageRating,
    totalReviews,
    ratingDistribution,
    reviewsLoading,
    reviewsError,
    loadedReviewsBrandId,
    reviewFlags,
    reviewFlagsLoading,
    displayData,
    fetchCollections,
    fetchReviews,
    fetchBrandProfile,
    brandProfileError,
    deleteCollection: deleteOwnedCollection,
  } = useBrandProfile();
  
  const [drafts, setDrafts] = useState<CollectionDto[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [draftsError, setDraftsError] = useState<string | null>(null);
  const [draftsInitialized, setDraftsInitialized] = useState(false);
  const [isBrandQrOpen, setIsBrandQrOpen] = useState(false);
  const [publishingStates, setPublishingStates] = useState<Record<string, { status: 'publishing' | 'failed'; startedAt: number; attempts: number; progress?: number; message?: string; previewUrl?: string; taskId?: string; title?: string; visibility?: 'PUBLIC' | 'PRIVATE'; kind?: PublishTaskKind; reviewStatus?: string | null }>>({});
  const [publishTasks, setPublishTasks] = useState<PublishTask[]>([]);

  const navigate = useNavigate();
  const location = useLocation();
  const normalizedRouteBrandId = routeBrandId ? decodeURIComponent(routeBrandId) : undefined;
  const activeBrandId = getActiveBrandId(user);
  const ownerBrandId = activeBrandId ?? user?.storeId ?? user?.id;
  // Owner/staff view when no route param or the param matches the active brand context.
  const isOwner = Boolean(
    canManageCatalog(user) &&
    (!normalizedRouteBrandId ||
      normalizedRouteBrandId === ownerBrandId ||
      normalizedRouteBrandId === user?.id),
  );
  const isVisitorView = !isOwner && Boolean(normalizedRouteBrandId);
  
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  
  // State for inline collection viewer
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  // Handle URL params for tab, collection, and visibility filter
  useEffect(() => {
    const urlCollectionId = searchParams.get('collectionId');
    if (urlCollectionId) {
      setSelectedCollectionId(urlCollectionId);
    }
    const tab = String(searchParams.get('tab') ?? '').trim().toLowerCase();
    const tabAlias: Record<string, TabType> = {
      collections: 'Content',
      content: 'Content',
      shop: 'Store',
      store: 'Store',
      reviews: 'Reviews',
      us: 'Us',
    };
    if (tabAlias[tab]) {
      const normalized = tabAlias[tab];
      setActiveTab(normalized as TabType);
    }
    // Handle visibility/status filter from URL (e.g., after draft save or review submit redirect)
    const visibility = resolveVisibilityFilterFromQuery(searchParams);
    if (visibility && OWNER_VISIBILITY_FILTERS.includes(visibility)) {
      setVisibilityFilter(visibility);
    }
  }, [searchParams]);

  const [activeTab, setActiveTab] = useState<TabType>('Content');
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>('Public');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [pendingAccessConfirm, setPendingAccessConfirm] = useState<string | null>(null);
  const [collectionToDelete, setCollectionToDelete] = useState<string | null>(null);
  const [collectionToRestore, setCollectionToRestore] = useState<string | null>(null);
  const [collectionToPermanentDelete, setCollectionToPermanentDelete] = useState<string | null>(null);
  const [recentlyDeletedDesign, setRecentlyDeletedDesign] = useState<{ isDraft: boolean } | null>(null);
  const [locallyRemovedCollectionIds, setLocallyRemovedCollectionIds] = useState<Set<string>>(new Set());
  const [deletedDesigns, setDeletedDesigns] = useState<CollectionDto[]>([]);
  const [deletedDesignsLoading, setDeletedDesignsLoading] = useState(false);
  const [deletedDesignsError, setDeletedDesignsError] = useState<string | null>(null);
  // collectionType state removed; modal is opened with the selected type via handler
  const [storeStatus, setStoreStatus] = useState<StoreStatusResponse | null>(null);
  const [storeStatusLoading, setStoreStatusLoading] = useState(false);
  const [hasDismissedStoreSetup, setHasDismissedStoreSetup] = useState(false);
  const [isStoreSetupNavigating, setIsStoreSetupNavigating] = useState(false);
  const [isHeaderQuickEditOpen, setIsHeaderQuickEditOpen] = useState(false);
  const [isSavingHeader, setIsSavingHeader] = useState(false);
  const storeStatusQuery = useStoreStatusQuery({ enabled: isOwner });

  const publishTaskScope = useMemo(
    () => ({ ownerId: user?.id ?? undefined }),
    [user?.id],
  );

  useEffect(() => {
    prunePublishTasks();
    setPublishTasks(readPublishTasks(publishTaskScope));
    return subscribePublishTasks(() => {
      setPublishTasks(readPublishTasks(publishTaskScope));
    });
  }, [publishTaskScope]);

  const handleOpenAddModal = () => {
    // collection type passed from dropdown; modal uses internal defaults for now
    setIsAddOpen(true);
  };

  // Capture navigation state from publish flow to show inline publishing badge on card
  useEffect(() => {
    const navState = (location.state as any) || {};
    const navToast = navState.toast as { type?: 'success' | 'info' | 'warning' | 'error'; message?: string } | undefined;
    if (navState.publishingTaskId) {
      const taskId = String(navState.publishingTaskId);
      const task = publishTasks.find((entry) => entry.id === taskId);
      const lookupId = (task ? getPublishTaskDesignId(task) : null) || taskId;
      const kind: PublishTaskKind = navState.publishingKind === 'draft' || task?.kind === 'draft' ? 'draft' : 'publish';
      const startedAt = typeof navState.publishingStartedAt === 'number' ? navState.publishingStartedAt : task?.startedAt ?? Date.now();
      setPublishingStates((prev) => ({
        ...prev,
        [lookupId]: {
          status: task?.status === 'failed' ? 'failed' : 'publishing',
          startedAt,
          attempts: 0,
          progress: task?.progress,
          previewUrl: task?.coverPreviewUrl,
          taskId,
          kind,
          reviewStatus:
            typeof navState.publishingReviewStatus === 'string'
              ? String(navState.publishingReviewStatus).toUpperCase()
              : null,
          visibility:
            navState.publishingVisibility === 'PRIVATE'
              ? 'PRIVATE'
              : task?.visibility === 'PRIVATE'
                ? 'PRIVATE'
                : 'PUBLIC',
          message: task?.message || getCompactPublishTaskStatusLabel({
            status: 'uploading',
            kind,
            progress: task?.progress,
          }),
        },
      }));
      if (kind === 'draft') {
        setDraftsInitialized(true);
        setDraftsLoading(false);
      }
      navigate(`${location.pathname}${location.search}`, { replace: true });
      return;
    }

    if (navState.publishingCollectionId) {
      const id = String(navState.publishingCollectionId);
      const startedAt = typeof navState.publishingStartedAt === 'number' ? navState.publishingStartedAt : Date.now();
      setPublishingStates((prev) => ({
        ...prev,
        [id]: {
          status: 'publishing',
          startedAt,
          attempts: 0,
          progress: typeof navState.publishingProgress === 'number' ? navState.publishingProgress : undefined,
          visibility: navState.publishingVisibility === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
          kind: 'publish',
          message: getCompactPublishTaskStatusLabel({
            status: 'uploading',
            kind: 'publish',
            progress: typeof navState.publishingProgress === 'number' ? navState.publishingProgress : undefined,
          }),
        },
      }));
      // Clear state so refresh/back does not re-run
      navigate(`${location.pathname}${location.search}`, { replace: true });
      return;
    }

    if (navToast?.message) {
      const message = String(navToast.message);
      const type = navToast.type ?? 'info';
      if (type === 'success') toast.success(message);
      else if (type === 'warning') toast.warning(message);
      else if (type === 'error') toast.error(message);
      else toast.info(message);
      navigate(`${location.pathname}${location.search}`, { replace: true });
    }
  }, [fetchCollections, isOwner, location.pathname, location.search, location.state, navigate, publishTasks, user?.id]);

  const isEditModalOpen = searchParams.get('modal') === 'brand-setup';

  const getHasDismissedBrandSetup = useCallback(() => {
    const DISMISS_KEY = 'threadly.brandProfileSetup.dismissedUntil';
    if (typeof window === 'undefined') return false;
    const dismissedUntilRaw = window.localStorage.getItem(DISMISS_KEY);
    const dismissedUntil = dismissedUntilRaw ? Number(dismissedUntilRaw) : 0;
    return Boolean(dismissedUntil && dismissedUntil > Date.now());
  }, []);

  useEffect(() => {
    if (activeTab !== 'Reviews' || reviewFlagsLoading || !reviewFlags.readEnabled) {
      return;
    }

    if (isOwner && user?.id && loadedReviewsBrandId !== user.id && !reviewsLoading) {
      void fetchReviews(user.id);
    }

    if (isVisitorView && routeBrandId && loadedReviewsBrandId !== routeBrandId && !reviewsLoading) {
      void fetchReviews(routeBrandId);
    }
  }, [
    activeTab,
    fetchReviews,
    isOwner,
    isVisitorView,
    loadedReviewsBrandId,
    reviewFlags.readEnabled,
    reviewFlagsLoading,
    reviewsLoading,
    routeBrandId,
    user?.id,
  ]);

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

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (visibilityFilter !== 'Deleted' || !isOwner || !user?.id) return;
      setDeletedDesignsLoading(true);
      setDeletedDesignsError(null);
      try {
        const items = await brandApi.getCollections(user.id, {
          scope: 'design',
          visibility: 'all',
          onlyDeleted: true,
        });
        if (!mounted) return;
        setDeletedDesigns(items);
      } catch (error) {
        if (!mounted) return;
        console.error(error);
        setDeletedDesignsError('Unable to load deleted designs.');
      } finally {
        if (mounted) setDeletedDesignsLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [visibilityFilter, isOwner, user?.id]);

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
    const DISMISS_KEY = 'threadly.storeSetup.dismissedUntil';
    if (!isOwner) {
      setStoreStatus(null);
      setStoreStatusLoading(false);
      setHasDismissedStoreSetup(false);
      return;
    }

    const dismissedUntilRaw = localStorage.getItem(DISMISS_KEY);
    const dismissedUntil = dismissedUntilRaw ? Number(dismissedUntilRaw) : 0;
    setHasDismissedStoreSetup(Boolean(dismissedUntil && dismissedUntil > Date.now()));
  }, [isOwner]);

  useEffect(() => {
    if (!isOwner) return;
    if (storeStatusQuery.data !== undefined) {
      setStoreStatus(storeStatusQuery.data);
    }
    if (storeStatusQuery.error) {
      setStoreStatus(null);
    }
    setStoreStatusLoading(storeStatusQuery.isLoading && !storeStatus);
  }, [isOwner, storeStatus, storeStatusQuery.data, storeStatusQuery.error, storeStatusQuery.isLoading]);

  const showStoreSetupNudge = useMemo(() => {
    if (!isOwner) return false;
    if (hasDismissedStoreSetup) return false;
    if (storeStatusLoading) return false;
    // Encourage setup until the store is marked live/open.
    if (!storeStatus) return false;
    return storeStatus.isStoreOpen === false;
  }, [hasDismissedStoreSetup, isOwner, storeStatus, storeStatusLoading]);

  const showStoreSetupChip = useMemo(() => {
    if (!isOwner) return false;
    if (!hasDismissedStoreSetup) return false;
    if (storeStatusLoading) return false;
    if (!storeStatus) return false;
    return storeStatus.isStoreOpen === false;
  }, [hasDismissedStoreSetup, isOwner, storeStatus, storeStatusLoading]);

  const dismissStoreSetupNudge = useCallback(() => {
    const DISMISS_KEY = 'threadly.storeSetup.dismissedUntil';
    const until = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    localStorage.setItem(DISMISS_KEY, String(until));
    setHasDismissedStoreSetup(true);
  }, []);

  const handleOpenStoreSetup = useCallback(() => {
    if (isStoreSetupNavigating) return;
    setIsStoreSetupNavigating(true);
    navigate('/studio/store');
  }, [isStoreSetupNavigating, navigate]);

  useEffect(() => {
    if (!isStoreSetupNavigating) return;
    const timer = window.setTimeout(() => {
      setIsStoreSetupNavigating(false);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [isStoreSetupNavigating]);

  useEffect(() => {
    const hasDismissedSetup = getHasDismissedBrandSetup();
    if (
      isOwner &&
      !brandProfileLoading &&
      requiresProfileSetup &&
      !hasDismissedSetup &&
      !isEditModalOpen
    ) {
      const next = new URLSearchParams(searchParams);
      next.set('modal', 'brand-setup');
      next.set('modalOrigin', 'prompt');
      setSearchParams(next);
    }
  }, [
    isOwner,
    brandProfileLoading,
    requiresProfileSetup,
    getHasDismissedBrandSetup,
    isEditModalOpen,
    searchParams,
    setSearchParams,
  ]);

  const handleOpenEditModal = (openedByPrompt = false) => {
    const next = new URLSearchParams(searchParams);
    next.set('modal', 'brand-setup');
    if (openedByPrompt) {
      next.set('modalOrigin', 'prompt');
    } else {
      next.delete('modalOrigin');
    }
    setSearchParams(next);
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

  // ---------------- Visitor data fetch ----------------
  const [visitorProfile, setVisitorProfile] = useState<BrandProfileDto | null>(null);
  const [visitorCollections, setVisitorCollections] = useState<CollectionDto[]>([]);
  const [visitorLoading, setVisitorLoading] = useState<boolean>(() => Boolean(isVisitorView));
  const [visitorError, setVisitorError] = useState<string | null>(null);
  const [isVisitorAvatarModalOpen, setIsVisitorAvatarModalOpen] = useState(false);
  const visitorProfileQuery = useBrandProfileQuery(normalizedRouteBrandId, {
    enabled: Boolean(isVisitorView && normalizedRouteBrandId),
  });
  const visitorCollectionsQuery = useBrandCollectionsQuery(
    { ownerId: normalizedRouteBrandId, visibility: 'all', scope: 'design' },
    { enabled: Boolean(isVisitorView && normalizedRouteBrandId) },
  );
  const {
    getPatched,
    isLoading: isPatchLoading,
    ensureStatus,
    toggleStatus,
  } = useBrandPatchState();

  const showPatchAction = Boolean(isVisitorView && user?.type === 'REGULAR' && routeBrandId);
  const isPatched = showPatchAction ? getPatched(routeBrandId) : false;
  const patchLoading = showPatchAction ? isPatchLoading(routeBrandId) : false;

  useEffect(() => {
    if (!isVisitorView || !normalizedRouteBrandId) {
      setVisitorProfile(null);
      setVisitorCollections([]);
      setVisitorLoading(false);
      setVisitorError(null);
      return;
    }

    if (visitorProfileQuery.data !== undefined) {
      setVisitorProfile(visitorProfileQuery.data ?? null);
    }
    if (visitorCollectionsQuery.data) {
      setVisitorCollections(visitorCollectionsQuery.data);
    }
    const hasCachedVisitorData = Boolean(visitorProfile || visitorCollections.length > 0);
    setVisitorLoading(
      !hasCachedVisitorData &&
        (visitorProfileQuery.isLoading || visitorCollectionsQuery.isLoading),
    );
    if (visitorProfileQuery.error || visitorCollectionsQuery.error) {
      setVisitorError('Failed to load profile data');
    } else {
      setVisitorError(null);
    }
  }, [
    isVisitorView,
    normalizedRouteBrandId,
    visitorCollections.length,
    visitorCollectionsQuery.data,
    visitorCollectionsQuery.error,
    visitorCollectionsQuery.isLoading,
    visitorProfile,
    visitorProfileQuery.data,
    visitorProfileQuery.error,
    visitorProfileQuery.isLoading,
  ]);

  useEffect(() => {
    if (!showPatchAction || !routeBrandId) return;
    void ensureStatus(routeBrandId);
  }, [ensureStatus, routeBrandId, showPatchAction]);

  const handleTogglePatch = useCallback(async () => {
    if (!routeBrandId) return;
    if (!user) {
      navigate('/login');
      return;
    }
    try {
      const nextPatchedState = await toggleStatus(routeBrandId);
      toast.success(
        nextPatchedState
          ? 'Patched successfully. You will now receive brand updates.'
          : 'Unpatched successfully. You will no longer receive patch-only updates.',
      );
    } catch {
      toast.error('Failed to update patch status.');
    }
  }, [navigate, routeBrandId, toggleStatus, user]);

  const viewIsStoreOpen = useMemo(() => {
    if (isVisitorView) return Boolean(visitorProfile?.isStoreOpen);
    return Boolean(storeStatus?.isStoreOpen);
  }, [isVisitorView, visitorProfile?.isStoreOpen, storeStatus?.isStoreOpen]);

  const shopBrandId = routeBrandId ?? ownerBrandId ?? '';
  
  const ownerHasStoreProfile = useMemo(() => {
    if (!isOwner) return undefined;
    if (storeStatusLoading) return undefined;
    return Boolean(storeStatus?.profile);
  }, [isOwner, storeStatus?.profile, storeStatusLoading]);

  // Visitor private-access state is user-specific; keep it query-owned and non-persisted.
  const [privateStates, setPrivateStates] = useState<PrivateAccessState[]>([]);
  const privateStatesQuery = useBrandPrivateAccessStatesQuery(routeBrandId, user?.id, {
    enabled: Boolean(isVisitorView && routeBrandId && user?.id),
  });
  useEffect(() => {
    if (!isVisitorView || !routeBrandId || !user?.id) {
      setPrivateStates((current) => (current.length === 0 ? current : []));
      return;
    }
    if (privateStatesQuery.data) {
      setPrivateStates((current) =>
        arePrivateAccessStatesEqual(current, privateStatesQuery.data) ? current : privateStatesQuery.data,
      );
    }
  }, [isVisitorView, privateStatesQuery.data, routeBrandId, user?.id]);

  const activeCollections = useMemo(
    () => (isVisitorView ? visitorCollections : collections) ?? [],
    [isVisitorView, visitorCollections, collections]
  );

  useEffect(() => {
    if (publishTasks.length === 0) return;
    setPublishingStates((prev) => {
      let changed = false;
      const next = { ...prev };
      publishTasks.forEach((task) => {
        const key = getPublishTaskDesignId(task) || task.id;
        if (key !== task.id && next[task.id]) {
          delete next[task.id];
          changed = true;
        }
        const current = next[key];
        const nextStatus = task.status === 'failed' ? 'failed' : 'publishing';
        const isDraftTask = task.kind === 'draft';
        const nextMessage =
          task.error ||
          task.message ||
          getCompactPublishTaskStatusLabel({
            status: task.status === 'failed' ? 'failed' : task.status === 'finalizing' ? 'finalizing' : 'uploading',
            kind: isDraftTask ? 'draft' : 'publish',
            progress: task.progress,
          });
        if (
          !current ||
          current.status !== nextStatus ||
          current.progress !== task.progress ||
          current.message !== nextMessage ||
          current.previewUrl !== task.coverPreviewUrl ||
          current.taskId !== task.id ||
          current.title !== task.title ||
          current.kind !== task.kind
        ) {
          next[key] = {
            status: nextStatus,
            startedAt: task.startedAt,
            attempts: current?.attempts ?? 0,
            progress: task.progress,
            previewUrl: task.coverPreviewUrl,
            taskId: task.id,
            title: task.title,
            visibility: task.visibility,
            kind: task.kind,
            message: nextMessage,
          };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [publishTasks]);

  useEffect(() => {
    const completed = publishTasks.filter((task) => task.kind !== 'draft' && task.status === 'published' && getPublishTaskDesignId(task));
    if (completed.length === 0) return;

    const checkAndCleanup = async () => {
      for (const task of completed) {
        const designId = getPublishTaskDesignId(task);
        const legacyCollectionId = getPublishTaskLegacyCollectionId(task);
        if (!designId) continue;
        try {
          if (!isVisitorView && user?.id) {
            await fetchCollections(user.id, { forceRefresh: true });
          }
          const latest = !isVisitorView ? collections : visitorCollections;
          const isLive = latest.some((entry) => entry.id === designId || entry.id === legacyCollectionId);
          if (isLive) {
            removePublishTask(task.id, publishTaskScope);
            setPublishingStates((prev) => {
              const next = { ...prev };
              delete next[task.id];
              delete next[designId];
              if (legacyCollectionId) delete next[legacyCollectionId];
              return next;
            });
          }
        } catch {
          // Ignore transient failures; polling and task updates will retry.
        }
      }
    };

    void checkAndCleanup();
  }, [collections, fetchCollections, isVisitorView, publishTaskScope, publishTasks, user?.id, visitorCollections]);

  useEffect(() => {
    if (!isOwner || visibilityFilter !== 'Drafts') return;
    const savedDraftTasks = publishTasks.filter((task) => task.kind === 'draft' && task.status === 'saved');
    if (savedDraftTasks.length === 0) return;

    let cancelled = false;
    const refreshDrafts = async () => {
      try {
        const items = await brandApi.getMyDraftCollections();
        if (cancelled) return;
        const uniqueDrafts = items.reduce((acc, draft) => {
          if (!acc.some((entry) => entry.id === draft.id)) {
            acc.push(draft);
          }
          return acc;
        }, [] as typeof items);
        setDrafts(uniqueDrafts);
        setDraftsInitialized(true);
        setDraftsLoading(false);
        savedDraftTasks.forEach((task) => removePublishTask(task.id, publishTaskScope));
        setPublishingStates((prev) => {
          const next = { ...prev };
          savedDraftTasks.forEach((task) => {
            delete next[task.id];
            const designId = getPublishTaskDesignId(task);
            const legacyCollectionId = getPublishTaskLegacyCollectionId(task);
            if (designId) delete next[designId];
            if (legacyCollectionId) delete next[legacyCollectionId];
          });
          return next;
        });
      } catch (error) {
        console.warn('Draft refresh after background save failed', error);
      }
    };

    void refreshDrafts();
    return () => {
      cancelled = true;
    };
  }, [isOwner, publishTaskScope, publishTasks, visibilityFilter]);

  // Auto-clear stale failed publish states for collections that exist on the server
  useEffect(() => {
    if (activeCollections.length === 0 || Object.keys(publishingStates).length === 0) return;
    const serverIds = new Set(activeCollections.map((c) => c.id));
    const staleFailed = Object.entries(publishingStates).filter(
      ([id, state]) => state.status === 'failed' && serverIds.has(id),
    );
    if (staleFailed.length === 0) return;
    setPublishingStates((prev) => {
      const next = { ...prev };
      for (const [id, state] of staleFailed) {
        delete next[id];
        if (state.taskId) removePublishTask(state.taskId, publishTaskScope);
      }
      return next;
    });
  }, [activeCollections, publishTaskScope, publishingStates]);

  const handleCollectionViewerBack = useCallback(() => {
    setSelectedCollectionId(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('collectionId');
      return next;
    });
  }, [setSearchParams]);

  const handleDismissFailedCard = useCallback((id: string) => {
    if (!id) return;
    setPublishingStates((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      const state = prev[id];
      if (state?.taskId) {
        delete next[state.taskId];
      }
      delete next[id];
      return next;
    });
  }, []);

  const removeCollectionFromView = useCallback((collectionId: string) => {
    if (!collectionId) return;

    setLocallyRemovedCollectionIds((prev) => {
      if (prev.has(collectionId)) return prev;
      const next = new Set(prev);
      next.add(collectionId);
      return next;
    });
    setDrafts((prev) => prev.filter((item) => item.id !== collectionId));
    setVisitorCollections((prev) => prev.filter((item) => item.id !== collectionId));
    setPublishingStates((prev) => {
      if (!prev[collectionId]) return prev;
      const next = { ...prev };
      delete next[collectionId];
      return next;
    });
    setSelectedCollectionId((prev) => (prev === collectionId ? null : prev));
    setSearchParams((prev) => {
      if (prev.get('collectionId') !== collectionId) return prev;
      const next = new URLSearchParams(prev);
      next.delete('collectionId');
      return next;
    });
  }, [setSearchParams]);

  const restoreCollectionInView = useCallback((
    collectionId: string,
    snapshot?: CollectionDto,
    restoreDraft = false,
  ) => {
    if (!collectionId) return;
    setLocallyRemovedCollectionIds((prev) => {
      if (!prev.has(collectionId)) return prev;
      const next = new Set(prev);
      next.delete(collectionId);
      return next;
    });
    if (restoreDraft && snapshot) {
      setDrafts((prev) => (
        prev.some((item) => item.id === snapshot.id) ? prev : [snapshot, ...prev]
      ));
    }
  }, []);

  const handleEditCollection = useCallback((id: string) => {
    navigate(buildDesignRoute({ designId: id, legacyCollectionId: id, mode: 'edit' }));
  }, [navigate]);

  const handleRequestCollectionDelete = useCallback((id: string) => {
    setCollectionToDelete(id);
  }, []);

  const handleRequestCollectionRestore = useCallback((id: string) => {
    setCollectionToRestore(id);
  }, []);

  const handleRequestPermanentDelete = useCallback((id: string) => {
    setCollectionToPermanentDelete(id);
  }, []);

  const handleCollectionClick = useCallback((id: string) => {
    if (visibilityFilter === 'Drafts') {
      handleEditCollection(id);
      return;
    }
    if (visibilityFilter === 'Deleted') return;
    setSelectedCollectionId(id);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('collectionId', id);
      return next;
    });
  }, [handleEditCollection, setSearchParams, visibilityFilter]);
  
  // Filter logic updated to handle Drafts
  let displayCollections: CollectionDto[] = [];
  if (visibilityFilter === 'Drafts') {
    displayCollections = drafts;
  } else if (visibilityFilter === 'Deleted') {
    displayCollections = deletedDesigns;
  } else if (REVIEW_VISIBILITY_STATUS[visibilityFilter]) {
    const targetStatus = REVIEW_VISIBILITY_STATUS[visibilityFilter];
    displayCollections = activeCollections.filter((c) => {
      const status = String(c.publicationStatus ?? c.status ?? '').toUpperCase();
      return status === targetStatus;
    });
  } else {
    displayCollections = activeCollections.filter((c) => {
      const status = String(c.publicationStatus ?? c.status ?? '').toUpperCase();
      // Public/Private tabs only ever show fully PUBLISHED content. Review,
      // processing, archived, removed, draft, or unknown states must never
      // appear here — they have dedicated tabs or stay hidden. Fail closed so
      // no unapproved status can leak onto the public-facing tab.
      if (status !== 'PUBLISHED') return false;
      return visibilityFilter === 'Public'
        ? c.isPublic || c.visibility === 'PUBLIC'
        : !c.isPublic || c.visibility === 'PRIVATE';
    });
  }
  displayCollections = displayCollections.filter((collection) => !locallyRemovedCollectionIds.has(collection.id));

  const filteredDisplayCollections = displayCollections.filter((c) => {
    const title = String(c.name || c.title || '').trim();
    return !(c.isAvailableInStore && title === 'Store Products');
  });

  const searchAndVisibilityFiltered = filteredDisplayCollections.filter(c =>
    (c.name || c.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const decoratedCollections = useMemo(() => {
    const decorated = searchAndVisibilityFiltered.map((c) => {
      const pub = publishingStates[c.id];
      if (!pub) return c;
      // If the collection already exists on the server (has real data)
      // and the publish state is failed, the server-side publish actually
      // succeeded — skip the stale failed overlay.
      if (pub.status === 'failed' && c.status && String(c.status).toUpperCase() === 'PUBLISHED') {
        return c;
      }
      return {
        ...c,
        clientStatus: pub.status === 'publishing' ? 'publishing' : 'publish-failed',
        clientStatusMessage: getCompactPublishTaskStatusLabel({
          status: pub.status === 'publishing' ? 'uploading' : 'failed',
          kind: pub.kind,
          progress: pub.progress,
        }),
        clientStatusMeta: {
          startedAt: pub.startedAt,
          attempts: pub.attempts,
          offline: !navigator.onLine,
          progress: pub.progress,
          previewUrl: pub.previewUrl,
          taskId: pub.taskId,
          kind: pub.kind,
        },
      } as CollectionDto;
    });

    if (visibilityFilter !== 'Public' && visibilityFilter !== 'Private' && visibilityFilter !== 'Drafts') {
      const targetReviewStatus = REVIEW_VISIBILITY_STATUS[visibilityFilter];
      if (!targetReviewStatus) return decorated;
      const decoratedIds = new Set(decorated.map((entry) => entry.id));
      const reviewPlaceholders: CollectionDto[] = Object.entries(publishingStates)
        .filter(([key, state]) => {
          if (decoratedIds.has(key)) return false;
          if (state.kind === 'draft') return false;
          if (state.status !== 'publishing' && state.status !== 'failed') return false;
          return String(state.reviewStatus ?? '').toUpperCase() === targetReviewStatus;
        })
        .map(([key, state]) => {
          const nowIso = new Date(state.startedAt || Date.now()).toISOString();
          const compactMessage = getCompactPublishTaskStatusLabel({
            status: state.status === 'failed' ? 'failed' : 'uploading',
            kind: state.kind,
            progress: state.progress,
          });
          return {
            id: key,
            status: targetReviewStatus,
            publicationStatus: targetReviewStatus,
            name: state.title || 'Design submitted for review',
            description: compactMessage,
            ownerId: user?.id || '',
            title: state.title || 'Design submitted for review',
            isPublic: state.visibility !== 'PRIVATE',
            visibility: state.visibility ?? 'PUBLIC',
            type: 'EVERYBODY',
            coverImage: state.previewUrl,
            createdAt: nowIso,
            updatedAt: nowIso,
            clientStatus: state.status === 'failed' ? 'publish-failed' : 'publishing',
            clientStatusMessage: compactMessage,
            clientStatusMeta: {
              startedAt: state.startedAt,
              attempts: state.attempts,
              offline: !navigator.onLine,
              progress: state.progress,
              previewUrl: state.previewUrl,
              taskId: state.taskId,
              kind: state.kind,
            },
          } as CollectionDto;
        });
      return [...reviewPlaceholders, ...decorated];
    }

    const decoratedIds = new Set(decorated.map((entry) => entry.id));
    const isDraftView = visibilityFilter === 'Drafts';
    const targetVisibility = visibilityFilter === 'Private' || isDraftView ? 'PRIVATE' : 'PUBLIC';
    const placeholders: CollectionDto[] = Object.entries(publishingStates)
      .filter(([key, state]) => {
        if (decoratedIds.has(key)) return false;
        // Show both in-progress uploads AND failed tasks (so failed tasks surface as ghost cards)
        if (state.status !== 'publishing' && state.status !== 'failed') return false;
        if (isDraftView) {
          if (state.kind !== 'draft') return false;
        } else if (state.kind === 'draft') {
          return false;
        }
        if ((state.visibility ?? 'PUBLIC') !== targetVisibility) return false;
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        return `${state.title ?? ''} ${state.message ?? ''}`.toLowerCase().includes(query);
      })
      .map(([key, state]) => {
        const nowIso = new Date(state.startedAt || Date.now()).toISOString();
        const isFailed = state.status === 'failed';
        const compactMessage = getCompactPublishTaskStatusLabel({
          status: isFailed ? 'failed' : 'uploading',
          kind: state.kind,
          progress: state.progress,
        });
        return {
          id: key,
          status: 'DRAFT',
          name: state.title || (isFailed ? (isDraftView ? 'Draft save failed' : 'Publish failed') : (isDraftView ? 'Saving draft' : 'Publishing design')),
          description: compactMessage,
          ownerId: user?.id || '',
          title: state.title || (isFailed ? (isDraftView ? 'Draft save failed' : 'Publish failed') : (isDraftView ? 'Saving draft' : 'Publishing design')),
          isPublic: targetVisibility !== 'PRIVATE',
          visibility: targetVisibility,
          type: 'EVERYBODY',
          coverImage: state.previewUrl,
          createdAt: nowIso,
          updatedAt: nowIso,
          clientStatus: isFailed ? 'publish-failed' : 'publishing',
          clientStatusMessage: compactMessage,
          clientStatusMeta: {
            startedAt: state.startedAt,
            attempts: state.attempts,
            offline: !navigator.onLine,
            progress: state.progress,
            previewUrl: state.previewUrl,
            taskId: state.taskId,
            kind: state.kind,
          },
        } as CollectionDto;
      });

    return [...placeholders, ...decorated];
  }, [publishingStates, searchAndVisibilityFiltered, searchQuery, user?.id, visibilityFilter]);

  const hasPendingDraftTask = useMemo(
    () => Object.values(publishingStates).some((state) => state.kind === 'draft' && (state.status === 'publishing' || state.status === 'failed')),
    [publishingStates],
  );
  const hasPendingLiveTask = useMemo(
    () => Object.values(publishingStates).some((state) => state.kind !== 'draft' && (state.status === 'publishing' || state.status === 'failed')),
    [publishingStates],
  );

  const ownerContentError =
    visibilityFilter === 'Drafts'
      ? draftsError
      : visibilityFilter === 'Deleted'
        ? deletedDesignsError
        : collectionsError;
  const ownerContentLoading =
    visibilityFilter === 'Drafts'
      ? draftsLoading || (!draftsInitialized && !hasPendingDraftTask)
      : visibilityFilter === 'Deleted'
        ? deletedDesignsLoading
        : collectionsLoading && !hasPendingLiveTask;
  const isDraftVisibility = visibilityFilter === 'Drafts';
  const isDeletedVisibility = visibilityFilter === 'Deleted';
  const isReviewVisibility = Boolean(REVIEW_VISIBILITY_STATUS[visibilityFilter]);

  const ownerEmptyStateDescription = isDraftVisibility
    ? "You don't have any unfinished designs."
    : isDeletedVisibility
      ? 'Deleted designs will appear here until permanently removed.'
      : isReviewVisibility
        ? `No designs are currently marked ${visibilityFilter.toLowerCase()}.`
      : requiresProfileSetup
        ? 'Complete your brand profile so buyers understand your story, then publish your first design.'
        : (showStoreSetupNudge || showStoreSetupChip)
          ? 'Your design feed is empty. Continue store setup so new designs are ready for storefront publishing.'
          : 'Create your first design to showcase your work.';

  const ownerEmptyStateCta = isDraftVisibility || isDeletedVisibility || isReviewVisibility
    ? null
    : requiresProfileSetup
      ? (
          <button
            type="button"
            onClick={() => handleOpenEditModal(true)}
            className="inline-flex items-center rounded-lg bg-[color:var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--brand-primary-strong)]"
          >
            Complete brand profile
          </button>
        )
      : (showStoreSetupNudge || showStoreSetupChip)
        ? (
            <button
              type="button"
              onClick={handleOpenStoreSetup}
              disabled={isStoreSetupNavigating}
              className="inline-flex items-center rounded-lg bg-[color:var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--brand-primary-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isStoreSetupNavigating ? 'Opening setup...' : 'Continue store setup'}
            </button>
          )
        : (
            <button
              type="button"
              onClick={() => navigate(buildDesignRoute({ mode: 'create' }))}
              className="inline-flex items-center rounded-lg bg-[color:var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--brand-primary-strong)]"
            >
              Create first design
            </button>
          );

  const handleRetryPublishCheck = useCallback(async (collectionId: string) => {
    if (!collectionId) return;
    const state = publishingStates[collectionId];
    const linkedTask = state?.taskId
      ? publishTasks.find((entry) => entry.id === state.taskId)
      : publishTasks.find((entry) => entry.id === collectionId);
    const targetCollectionId = linkedTask
      ? getPublishTaskLegacyCollectionId(linkedTask)
      : (state?.taskId && state.taskId === collectionId ? null : collectionId);

    if (!targetCollectionId) {
      setPublishingStates((prev) => ({
        ...prev,
        [collectionId]: {
          status: 'publishing',
          startedAt: prev[collectionId]?.startedAt ?? Date.now(),
          attempts: prev[collectionId]?.attempts ?? 0,
          progress: prev[collectionId]?.progress,
          previewUrl: prev[collectionId]?.previewUrl,
          taskId: prev[collectionId]?.taskId,
          visibility: prev[collectionId]?.visibility,
          message: 'Upload session is still initializing. Progress will continue automatically.',
        },
      }));
      toast.info('Upload session is still initializing. Retry in a few seconds.');
      return;
    }

    try {
      setPublishingStates((prev) => ({
        ...prev,
        [collectionId]: {
          status: 'publishing',
          startedAt: prev[collectionId]?.startedAt ?? Date.now(),
          attempts: (prev[collectionId]?.attempts ?? 0) + 1,
          progress: prev[collectionId]?.progress,
          previewUrl: prev[collectionId]?.previewUrl,
          taskId: prev[collectionId]?.taskId,
          visibility: prev[collectionId]?.visibility,
          message: 'Re-checking publish status...',
        },
      }));

      const current = await fetchCollectionDetailQuery(queryClient, targetCollectionId);
      const RETRY_RESOLVED = new Set(['PUBLISHED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'REJECTED']);
      if (!RETRY_RESOLVED.has(current?.status ?? '')) {
        await finalizeCollectionUploads(targetCollectionId, [], true, { action: 'publish' });
      }

      const refreshedDetail = await fetchCollectionDetailQuery(queryClient, targetCollectionId, 'design', { forceRefresh: true });
      if (!RETRY_RESOLVED.has(refreshedDetail?.status ?? '')) {
        setPublishingStates((prev) => ({
          ...prev,
          [collectionId]: {
            status: 'publishing',
            startedAt: prev[collectionId]?.startedAt ?? Date.now(),
            attempts: (prev[collectionId]?.attempts ?? 0) + 1,
            progress: prev[collectionId]?.progress,
            previewUrl: prev[collectionId]?.previewUrl,
            taskId: prev[collectionId]?.taskId,
            visibility: prev[collectionId]?.visibility,
            message: 'Reprocessing started. We will keep checking in the background.',
          },
        }));
        toast.info('Reprocessing started. We will keep checking status.');
        return;
      }

      if (!isVisitorView && user?.id) {
        await fetchCollections(user.id, { forceRefresh: true });
      } else if (isVisitorView && routeBrandId) {
        const cols = await fetchBrandCollectionsQuery(
          queryClient,
          { ownerId: routeBrandId, visibility: 'all', scope: 'design' },
          { forceRefresh: true },
        );
        setVisitorCollections(cols ?? []);
      }

      setPublishingStates((prev) => {
        const next = { ...prev };
        delete next[collectionId];
        delete next[targetCollectionId];
        if (state?.taskId) {
          delete next[state.taskId];
        }
        return next;
      });

      if (state?.taskId) {
        removePublishTask(state.taskId, publishTaskScope);
      }

      toast.success('Design is live');
    } catch (error) {
      console.error('Publish status check failed', error);

      const rawMessage =
        (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message ??
        (error as Error)?.message ??
        'Publish is still processing. Try again shortly.';
      const nextMessage = Array.isArray(rawMessage)
        ? rawMessage[0] ?? 'Publish is still processing. Try again shortly.'
        : String(rawMessage);

      setPublishingStates((prev) => ({
        ...prev,
        [collectionId]: {
          status: 'failed',
          startedAt: prev[collectionId]?.startedAt ?? Date.now(),
          attempts: (prev[collectionId]?.attempts ?? 0) + 1,
          progress: prev[collectionId]?.progress,
          previewUrl: prev[collectionId]?.previewUrl,
          taskId: prev[collectionId]?.taskId,
          visibility: prev[collectionId]?.visibility,
          message: nextMessage,
        },
      }));
    }
  }, [fetchCollections, isVisitorView, publishTaskScope, publishTasks, publishingStates, queryClient, routeBrandId, user]);

  // Poll publish status for any pending ids
  useEffect(() => {
    const pending = Object.entries(publishingStates)
      .filter(([, state]) => state.status === 'publishing' && state.kind !== 'draft')
      .map(([id, state]) => {
        const task = state.taskId
          ? publishTasks.find((entry) => entry.id === state.taskId)
          : publishTasks.find((entry) => entry.id === id);
        const resolvedCollectionId = task
          ? getPublishTaskLegacyCollectionId(task)
          : (state.taskId && state.taskId === id ? null : id);
        return { id, state, resolvedCollectionId };
      });

    if (pending.length === 0) return;

    const poll = async () => {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine;
      if (offline) {
        setPublishingStates((prev) => {
          const next = { ...prev };
          pending.forEach(({ id, state }) => {
            next[id] = { ...state, message: 'Offline. We will resume when back online.' };
          });
          return next;
        });
        return;
      }

      await Promise.all(pending.map(async ({ id, state, resolvedCollectionId }) => {
        if (!resolvedCollectionId) {
          setPublishingStates((prev) => ({
            ...prev,
            [id]: {
              ...state,
              message: 'Upload session is still initializing. We will continue checking automatically.',
            },
          }));
          return;
        }

        try {
          const detail = await fetchCollectionDetailQuery(queryClient, resolvedCollectionId, 'design', { forceRefresh: true });
          // Resolve on any moderation-terminal status, not just PUBLISHED.
          // IN_REVIEW means brand review picked it up; CHANGES_REQUESTED/REJECTED means moderation acted.
          const MODERATION_RESOLVED = new Set(['PUBLISHED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'REJECTED']);
          if (!MODERATION_RESOLVED.has(detail?.status ?? '')) {
            const attempts = state.attempts + 1;
            const tookTooLong = Date.now() - state.startedAt > 90_000;
            setPublishingStates((prev) => ({
              ...prev,
              [id]: {
                ...state,
                attempts,
                status: tookTooLong ? 'failed' : 'publishing',
                message: tookTooLong
                  ? 'Publishing is taking longer than usual. Retry to force another publish attempt.'
                  : 'Still processing your design...',
              },
            }));
            return;
          }

          if (!isVisitorView && user?.id) {
            await fetchCollections(user.id, { forceRefresh: true });
          } else if (isVisitorView && routeBrandId) {
            const cols = await fetchBrandCollectionsQuery(
              queryClient,
              { ownerId: routeBrandId, visibility: 'all', scope: 'design' },
              { forceRefresh: true },
            );
            setVisitorCollections(cols ?? []);
          }

          setPublishingStates((prev) => {
            const next = { ...prev };
            delete next[id];
            delete next[resolvedCollectionId];
            if (state.taskId) {
              delete next[state.taskId];
            }
            return next;
          });

          if (state.taskId) {
            removePublishTask(state.taskId, publishTaskScope);
          }
        } catch {
          const attempts = state.attempts + 1;
          const tookTooLong = Date.now() - state.startedAt > 90_000;
          setPublishingStates((prev) => ({
            ...prev,
            [id]: {
              ...state,
              attempts,
              status: tookTooLong ? 'failed' : 'publishing',
              message: tookTooLong
                ? 'Publishing is taking longer than usual. Retry to force another publish attempt.'
                : 'Still processing your design...',
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
  }, [fetchCollections, isVisitorView, publishTaskScope, publishTasks, publishingStates, queryClient, routeBrandId, user]);

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
  const visitorBannerAsset = useMemo(
    () =>
      resolveBannerImageSource({
        bannerImage: visitorProfile?.bannerImage ?? null,
        bannerImageMeta: visitorProfile?.bannerImageMeta ?? null,
      }),
    [visitorProfile?.bannerImage, visitorProfile?.bannerImageMeta],
  );
  const visitorLogoAsset = useMemo(
    () =>
      resolveProfileImageSource({
        profileImage: visitorProfile?.logoImage ?? null,
        profileImageFile: visitorProfile?.logoImageMeta ?? null,
      }),
    [visitorProfile?.logoImage, visitorProfile?.logoImageMeta],
  );
  const visitorBannerInitial = visitorBannerAsset.src;
  const visitorLogoInitial = visitorLogoAsset.src;
  const { url: visitorBannerUrl } = useSignedFileUrlHook(visitorBannerAsset.fileId, visitorBannerInitial);
  const { url: visitorLogoUrl } = useSignedFileUrlHook(visitorLogoAsset.fileId, visitorLogoInitial);

  const viewDisplayData = useMemo(() => {
    if (isVisitorView && visitorProfile) {
      return {
        brandName: visitorProfile.brandFullName,
        location:
          visitorProfile.location ??
          [visitorProfile.city, visitorProfile.state, visitorProfile.country]
            .filter(Boolean)
            .join(', '),
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
        verificationBadgeVisible: Boolean(visitorProfile.verificationBadgeVisible),
        isVerifiedBrand: Boolean(visitorProfile.verified),
        verifiedExplanationUrl:
          visitorProfile.verifiedExplanationUrl ?? '/help/verified-badge',
      };
    }
    return displayData;
  }, [displayData, isVisitorView, visitorBannerUrl, visitorLogoUrl, visitorProfile]);

  const activeBrandProfile = isVisitorView ? visitorProfile : brandProfile;
  const fallbackProfileUrl = useMemo(() => {
    const profileId = isVisitorView ? routeBrandId : user?.id;
    if (!profileId) return null;

    return buildProfileUrl({
      id: profileId,
      username: viewDisplayData.username || undefined,
    });
  }, [isVisitorView, routeBrandId, user?.id, viewDisplayData.username]);
  const profileShareUrl =
    activeBrandProfile?.shareUrl ??
    activeBrandProfile?.publicProfileUrl ??
    activeBrandProfile?.qrTargetUrl ??
    fallbackProfileUrl;
  const profileQrTargetUrl =
    activeBrandProfile?.qrTargetUrl ??
    activeBrandProfile?.publicProfileUrl ??
    activeBrandProfile?.shareUrl ??
    fallbackProfileUrl;

  const handleViewVisitorAvatar = useCallback(() => {
    if (!visitorLogoUrl && !visitorLogoAsset.fileId) return;
    setIsVisitorAvatarModalOpen(true);

    const currentState = visitorProfile?.profilePhotoViewState;
    if (!routeBrandId || !user || !currentState?.canMarkViewed) return;

    void ProfilePhotoViewApi.markViewed(routeBrandId)
      .then((nextState) => {
        setVisitorProfile((current) =>
          current
            ? {
                ...current,
                profilePhotoUpdatedAt: nextState.profilePhotoUpdatedAt,
                profilePhotoViewState: nextState,
              }
            : current,
        );
        queryClient.setQueryData(
          queryKeys.brand.profile(routeBrandId),
          (current: BrandProfileDto | null | undefined) =>
            current
              ? {
                  ...current,
                  profilePhotoUpdatedAt: nextState.profilePhotoUpdatedAt,
                  profilePhotoViewState: nextState,
                }
              : current,
        );
        brandApi.invalidateBrandProfileCache(routeBrandId);
      })
      .catch((error) => {
        console.error('Failed to mark profile photo viewed', error);
      });
  }, [
    queryClient,
    routeBrandId,
    user,
    visitorLogoAsset.fileId,
    visitorLogoUrl,
    visitorProfile?.profilePhotoViewState,
  ]);

  const handleShareProfile = useCallback(async () => {
    const shareBrandName = viewDisplayData.brandName || 'WIEZ';
    const url = profileShareUrl;
    if (!url) {
      toast.error('Profile link is not available yet.');
      return;
    }
    const message = `Check out ${shareBrandName} on WIEZ: ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: shareBrandName,
          text: message,
          url,
        });
      } else {
        await navigator.clipboard.writeText(message);
        toast.success('Profile link copied to clipboard');
      }
    } catch {
      // Silently ignore cancellation
    }
  }, [profileShareUrl, viewDisplayData.brandName]);

  const handleOpenHeaderQuickEdit = useCallback(() => {
    setIsHeaderQuickEditOpen(true);
  }, []);

  const ownerHeaderProfile = useMemo(
    () => ({
      id: user?.id ?? '',
      username: displayData.username ?? '',
      firstName: displayData.brandName ?? '',
      lastName: '',
      address: displayData.location ?? undefined,
      location: displayData.location ?? undefined,
      tags: displayData.hashtags ?? [],
      description: displayData.description ?? '',
      verificationBadgeVisible: Boolean(displayData.verificationBadgeVisible),
      isVerifiedBrand: Boolean(displayData.isVerifiedBrand),
      verifiedExplanationUrl:
        displayData.verifiedExplanationUrl ?? '/help/verified-badge',
      isOwner: true as const,
      profileVisibility: 'UNLOCKED' as const,
      profilePhotoViewState: brandProfile?.profilePhotoViewState ?? null,
    }),
    [
      brandProfile?.profilePhotoViewState,
      displayData.brandName,
      displayData.hashtags,
      displayData.description,
      displayData.isVerifiedBrand,
      displayData.location,
      displayData.username,
      displayData.verifiedExplanationUrl,
      displayData.verificationBadgeVisible,
      user?.id,
    ],
  );

  const visitorHeaderProfile = useMemo(
    () => ({
      id: routeBrandId ?? '',
      username: viewDisplayData.username ?? '',
      firstName: viewDisplayData.brandName ?? '',
      lastName: '',
      profileImage: viewDisplayData.logoImage ?? undefined,
      profileImageFileId: visitorLogoAsset.fileId,
      bannerImage: viewDisplayData.bannerImage ?? undefined,
      bannerImageFileId: visitorBannerAsset.fileId,
      address: viewDisplayData.location ?? undefined,
      location: viewDisplayData.location ?? undefined,
      tags: viewDisplayData.hashtags ?? [],
      description: viewDisplayData.description ?? '',
      verificationBadgeVisible: Boolean(viewDisplayData.verificationBadgeVisible),
      isVerifiedBrand: Boolean(viewDisplayData.isVerifiedBrand),
      verifiedExplanationUrl:
        viewDisplayData.verifiedExplanationUrl ?? '/help/verified-badge',
      isOwner: false,
      profileVisibility: 'UNLOCKED' as const,
      profilePhotoViewState: visitorProfile?.profilePhotoViewState ?? null,
    }),
    [
      routeBrandId,
      visitorProfile?.profilePhotoViewState,
      viewDisplayData.bannerImage,
      viewDisplayData.brandName,
      viewDisplayData.hashtags,
      viewDisplayData.description,
      viewDisplayData.isVerifiedBrand,
      viewDisplayData.location,
      viewDisplayData.logoImage,
      viewDisplayData.username,
      viewDisplayData.verifiedExplanationUrl,
      viewDisplayData.verificationBadgeVisible,
      visitorBannerAsset.fileId,
      visitorLogoAsset.fileId,
    ],
  );

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
          <div className="mt-6">
            <CollectionsSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
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
      <BrandQrModal
        open={isBrandQrOpen}
        onClose={() => setIsBrandQrOpen(false)}
        brandName={viewDisplayData.brandName || 'WIEZ Brand'}
        qrTargetUrl={profileQrTargetUrl}
        shareUrl={profileShareUrl}
        logoUrl={viewDisplayData.logoImage ?? null}
        username={viewDisplayData.username ?? null}
      />
      <ProfileImageModal
        open={isVisitorAvatarModalOpen && Boolean(visitorLogoUrl ?? visitorLogoAsset.fileId)}
        src={visitorLogoUrl ?? undefined}
        fileId={visitorLogoAsset.fileId}
        alt={viewDisplayData.brandName || 'Brand profile photo'}
        onClose={() => setIsVisitorAvatarModalOpen(false)}
      />
      {showStoreSetupNudge ? (
        <div className="fixed bottom-24 right-4 sm:right-6 z-[60] w-[min(88vw,270px)]">
          <div className="glass-menu-soft px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100">
                Finish setting up your store
              </p>
              <p className="mt-0.5 truncate text-[11px] text-gray-700/80 dark:text-white/70">
                Add your focus, tagline, and Instagram.
              </p>
            </div>
            <div className="mt-2 flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={handleOpenStoreSetup}
                disabled={isStoreSetupNavigating}
                className="rounded-full bg-[color:var(--brand-primary)] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[color:var(--brand-primary-strong)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isStoreSetupNavigating ? 'Opening...' : 'Set up'}
              </button>
              <button
                type="button"
                onClick={dismissStoreSetupNudge}
                disabled={isStoreSetupNavigating}
                className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60 dark:text-white/75 dark:hover:bg-white/10"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      ) : showStoreSetupChip ? (
        <div className="fixed bottom-24 right-4 sm:right-6 z-[60]">
          <button
            type="button"
            onClick={handleOpenStoreSetup}
            disabled={isStoreSetupNavigating}
            aria-busy={isStoreSetupNavigating}
            className="glass-chip chip-sm chip-purple inline-flex items-center gap-2 shadow-xl ring-1 ring-purple-300/40 hover:bg-black/5 dark:hover:bg-white/10 transition disabled:cursor-not-allowed disabled:opacity-75"
            aria-label="Continue store setup"
          >
            <span className="font-semibold min-w-[9.5rem] text-center">
              {isStoreSetupNavigating ? 'Opening...' : 'Continue store setup'}
            </span>
          </button>
        </div>
      ) : null}

      {isOwner ? (
        <OwnerCatalogMediaHeader
          profile={ownerHeaderProfile}
          onEditProfile={handleOpenHeaderQuickEdit}
          onShareProfile={handleShareProfile}
          onShowQrCode={() => setIsBrandQrOpen(true)}
          showPatchAction={showPatchAction}
          isPatched={isPatched}
          patchLoading={patchLoading}
          onTogglePatch={handleTogglePatch}
        />
      ) : (
        <ProfileHeader
          profile={visitorHeaderProfile}
          onViewAvatar={handleViewVisitorAvatar}
          onShareProfile={handleShareProfile}
          onShowQrCode={() => setIsBrandQrOpen(true)}
          showPatchAction={showPatchAction}
          isPatched={isPatched}
          patchLoading={patchLoading}
          onTogglePatch={handleTogglePatch}
        />
      )}

      <div className="w-full px-4 sm:px-6 pb-12">
        <div className="mt-6">
          <Tabs
            tabs={['Content', 'Store', 'Reviews', 'Us']}
            activeTab={activeTab}
            onTabChange={(tab) => {
                setActiveTab(tab as TabType);
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set('tab', tab);
                  return next;
                });
            }}
          />

          <div className="mt-6 min-h-[420px] motion-safe:transition-opacity motion-safe:duration-200">
            {activeTab === 'Store' && shopBrandId ? (
              <CatalogShopTab
                brandId={shopBrandId}
                isStoreOpen={viewIsStoreOpen}
                isOwner={isOwner}
                ownerHasStoreProfile={ownerHasStoreProfile}
              />
            ) : null}

            {activeTab === 'Content' && (
              <div>
                {selectedCollectionId ? (
                  // Show inline collection viewer
                  <InlineCollectionViewer
                    collectionId={selectedCollectionId}
                    onBack={handleCollectionViewerBack}
                    brandName={displayData?.brandName || displayData?.username || 'Brand'}
                    onPriceUpdated={async () => {
                      // Refresh collections to show updated prices on cards
                      if (isVisitorView && routeBrandId) {
                        const cols = await fetchBrandCollectionsQuery(
                          queryClient,
                          { ownerId: routeBrandId, visibility: 'all', scope: 'design' },
                          { forceRefresh: true },
                        );
                        setVisitorCollections(cols ?? []);
                      } else if (user) {
                        await fetchCollections(user.id, { forceRefresh: true });
                      }
                    }}
                  />
                ) : (
                  // Show collections grid
                  <>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                      <div className="flex-1 w-full sm:w-auto">
                        <div className="relative w-full">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">🔎</span>
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter designs by title or description..."
                            className="w-full rounded-xl border border-gray-200 bg-white/80 py-2 pl-10 pr-10 text-sm text-gray-900 outline-none backdrop-blur-sm transition-colors focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-purple-400"
                          />
                          {searchQuery && (
                            <button
                              type="button"
                              onClick={() => setSearchQuery('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-1.5 py-0.5 text-xs text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white"
                            >
                              &times;
                            </button>
                          )}
                        </div>
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
                      <div className="flex gap-5 overflow-x-auto border-b border-gray-200/80 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-white/10">
                        {(isOwner ? OWNER_VISIBILITY_FILTERS : VISIBILITY_FILTERS).map((opt) => (
                          <button
                            key={opt}
                            onClick={() => setVisibilityFilter(opt as any)}
                            aria-pressed={visibilityFilter === opt}
                            className={`relative flex shrink-0 items-center gap-2 pb-3 pt-2 text-sm font-semibold transition-colors ${
                              visibilityFilter === opt
                                ? 'text-purple-700 dark:text-purple-300'
                                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                            }`}
                          >
                            <span>
                              {opt === 'Public'
                                  ? '🌍'
                                  : opt === 'Private'
                                    ? '🔒'
                                    : opt === 'Drafts'
                                      ? '📝'
                                      : opt === 'In Review'
                                        ? 'R'
                                        : opt === 'Changes Requested'
                                          ? '!'
                                          : opt === 'Rejected'
                                            ? 'X'
                                            : '🗑️'}
                            </span>
                            {opt}
                            <span
                              aria-hidden="true"
                              className={`absolute inset-x-0 bottom-0 mx-auto h-0.5 w-7 rounded-full transition-all ${
                                visibilityFilter === opt ? 'bg-purple-600 dark:bg-purple-300' : 'bg-transparent'
                              }`}
                            />
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
                                  <CatalogEntityCard
                                    key={collection.id}
                                    collection={collection}
                                    onClick={() => {
                                      setSelectedCollectionId(collection.id);
                                      setSearchParams((prev) => {
                                        const next = new URLSearchParams(prev);
                                        next.set('collectionId', collection.id);
                                        return next;
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
                                        {hasPending ? '✓ Access request pending for other designs' : hasRevoked ? 'Some requests were declined (wait 72h to re-request)' : 'Request access to view all private designs'}
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
                                      Private Designs
                                    </h2>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">
                                      You do not have permission to view private designs from this brand. Request access to view exclusive drops and content.
                                    </p>
                                  </div>

                                  {/* Collection Count */}
                                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 dark:bg-white/5 border border-gray-200 dark:border-gray-700">
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{privateStates.length} private design{privateStates.length !== 1 ? 's' : ''}</span>
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
                                    One request gives you access to all private designs from this brand
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
                            <p className="text-gray-600 dark:text-gray-400 font-medium">No private designs available</p>
                            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">This brand hasn't created any private designs yet</p>
                          </div>
                        );
                      })()
                    ) : (
                      (isOwner ? !!ownerContentError : !!visitorError) ? (
                        <div className="relative h-[60vh] min-h-[400px] w-full rounded-3xl overflow-hidden border border-gray-200 dark:border-gray-800">
                          <ComingSoon
                            title="Connection Issue"
                            description="We couldn't connect to the server to load your designs. Please check your internet connection."
                            emoji="🔌"
                            showNotify={false}
                            backPath="#"
                            variant="default"
                            minHeight="min-h-full"
                            className="bg-gray-50 dark:bg-[#0a0a0a]"
                          />
                        </div>
                      ) : (isOwner ? ownerContentLoading : visitorLoading) ? (
                        <CollectionsSkeleton />
                      ) : decoratedCollections.length > 0 ? (
                        <CollectionsGrid
                          collections={decoratedCollections}
                          isDraft={isDraftVisibility}
                          isDeleted={isDeletedVisibility}
                          onEdit={isOwner ? handleEditCollection : undefined}
                          onDelete={isOwner ? handleRequestCollectionDelete : undefined}
                          onRestore={isOwner ? handleRequestCollectionRestore : undefined}
                          onPermanentDelete={isOwner ? handleRequestPermanentDelete : undefined}
                          onCollectionClick={handleCollectionClick}
                          onRetryPublish={handleRetryPublishCheck}
                          onDismiss={isOwner ? handleDismissFailedCard : undefined}
                        />
                      ) : (
                        isOwner ? (
                          <EmptyState
                            title={
                              isDraftVisibility
                                ? 'No drafts'
                                : isDeletedVisibility
                                  ? 'No deleted designs'
                                  : 'No designs yet'
                            }
                            description={ownerEmptyStateDescription}
                            cta={ownerEmptyStateCta}
                          />
                        ) : (
                          <div className="text-center text-gray-500">
                            No designs available.
                          </div>
                        )
                      )
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'Reviews' && (
              !reviewFlagsLoading && !reviewFlags.readEnabled ? (
                <CatalogTabNotice
                  title="No reviews yet"
                  description={
                    isOwner
                      ? 'Your customer feedback will appear here once buyers start sharing their experience.'
                      : 'Verified buyer feedback will appear here once customers start sharing their experience.'
                  }
                />
              ) : reviewsError ? (
                <CatalogTabNotice
                  title="Reviews unavailable"
                  description="We couldn't load reviews right now. Please try again shortly."
                />
              ) : (
                <ReviewsTab
                  brandId={shopBrandId || routeBrandId || user?.id || null}
                  currentUserId={user?.id || null}
                  reviews={reviews}
                  averageRating={averageRating}
                  totalReviews={totalReviews}
                  ratingDistribution={ratingDistribution}
                  isLoading={reviewsLoading}
                  isOwner={isOwner}
                  brandRepliesEnabled={reviewFlags.brandRepliesEnabled}
                />
              )
            )}

            {activeTab === 'Us' && (
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
            if (user) await fetchCollections(user.id, { forceRefresh: true });
          }}
        />
      )}

      {/* Confirm access request dialog for visitor */}
      <ConfirmDialog
        open={Boolean(pendingAccessConfirm)}
        title="Request Private Access"
        message="Request access to this private design? If the brand rejects your request, you must wait 72 hours before trying again."
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
            const applyAccessState = (current: PrivateAccessState[] = []) =>
              current.map((entry) => ({ ...entry, state: res.state }));
            setPrivateStates((prev) => applyAccessState(prev));
            queryClient.setQueryData<PrivateAccessState[]>(
              queryKeys.brandPrivateAccess.myStates(routeBrandId, user.id),
              (current) => applyAccessState(current ?? []),
            );
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
        title={drafts.some(d => d.id === collectionToDelete) ? "Delete Draft" : "Delete Design"}
        message={drafts.some(d => d.id === collectionToDelete) 
          ? "Are you sure you want to discard this draft? This action cannot be undone." 
          : "Are you sure you want to delete this design? This action cannot be undone."}
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive
        onCancel={() => setCollectionToDelete(null)}
        onConfirm={async () => {
          if (!collectionToDelete || !user) return;
          const id = collectionToDelete;
          const isDraft = drafts.some(d => d.id === id);
          const removedSnapshot = drafts.find((item) => item.id === id)
            ?? activeCollections.find((item) => item.id === id);
          setCollectionToDelete(null);
          removeCollectionFromView(id);
          try {
            const success = isDraft
              ? await brandApi.deleteCollection(id)
              : await deleteOwnedCollection(id);
            if (success) {
              toast.success(isDraft ? 'Draft discarded' : 'Design deleted');
              setRecentlyDeletedDesign({ isDraft });
              if (!isDraft) {
                // Refresh only the off-screen Deleted source. The visible source remains
                // the optimistic local removal, so one delete never replaces or blanks
                // the current grid.
                void brandApi
                  .getCollections(user.id, {
                    scope: 'design',
                    visibility: 'all',
                    onlyDeleted: true,
                  })
                  .then((items) => setDeletedDesigns(items))
                  .catch((err) => console.error(err));
              }
            } else {
              restoreCollectionInView(id, removedSnapshot, isDraft);
              toast.error(isDraft ? 'Failed to discard draft' : 'Failed to delete design');
            }
          } catch (error) {
            restoreCollectionInView(id, removedSnapshot, isDraft);
            console.error('Error deleting collection:', error);
            toast.error('An error occurred');
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(collectionToRestore)}
        title="Restore Design"
        message="Restore this design back to your content feed?"
        confirmText="Restore"
        cancelText="Cancel"
        onCancel={() => setCollectionToRestore(null)}
        onConfirm={async () => {
          if (!collectionToRestore || !user?.id) return;
          const targetId = collectionToRestore;
          setCollectionToRestore(null);
          const success = await brandApi.restoreCollection(targetId, { scope: 'design' });
          if (!success) {
            toast.error('Failed to restore design');
            return;
          }
          toast.success('Design restored');
          setDeletedDesigns((prev) => prev.filter((item) => item.id !== targetId));
          restoreCollectionInView(targetId);
          void fetchCollections(user.id, { forceRefresh: true });
        }}
      />

      <ConfirmDialog
        open={Boolean(collectionToPermanentDelete)}
        title="Delete Permanently"
        message="This permanently removes the design and cannot be undone."
        confirmText="Delete Permanently"
        cancelText="Cancel"
        isDestructive
        onCancel={() => setCollectionToPermanentDelete(null)}
        onConfirm={async () => {
          if (!collectionToPermanentDelete) return;
          const targetId = collectionToPermanentDelete;
          setCollectionToPermanentDelete(null);
          const success = await brandApi.permanentlyDeleteCollection(targetId, {
            scope: 'design',
          });
          if (!success) {
            toast.error('Failed to permanently delete design');
            return;
          }
          toast.success('Design permanently deleted');
          setDeletedDesigns((prev) => prev.filter((item) => item.id !== targetId));
        }}
      />

      <ConfirmDialog
        open={Boolean(recentlyDeletedDesign)}
        title={recentlyDeletedDesign?.isDraft ? 'Draft Deleted' : 'Design Deleted'}
        message="Where do you want to go next?"
        confirmText="Create New Design"
        cancelText="Go To Content"
        onCancel={() => {
          const nextVisibility = recentlyDeletedDesign?.isDraft ? 'Drafts' : 'Public';
          setRecentlyDeletedDesign(null);
          navigate(`/profile?tab=Content&visibility=${nextVisibility}`);
        }}
        onConfirm={() => {
          setRecentlyDeletedDesign(null);
          navigate(buildDesignRoute({ mode: 'create' }));
        }}
      />

    </div>
  );
};

export default ProfilePage;
