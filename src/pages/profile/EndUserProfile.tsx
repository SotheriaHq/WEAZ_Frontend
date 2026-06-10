import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';
import { SavedTab } from './tabs/SavedTab';
import { PatchesTab } from './tabs/PatchesTab';
import { OrdersPanel, type OrdersPanelSelection } from './tabs/OrdersPanel';
import { apiClient } from '@/api/httpClient';
import { ProfilePhotoViewApi } from '@/api/ProfilePhotoViewApi';
import type { AppDispatch, RootState } from '@/store';
import { setUser } from '@/features/userSlice';
import { EndUserQuickEditModal } from './EndUserQuickEditModal';
import { EndUserSizeFitModal } from './EndUserSizeFitModal';
import { EndUserSizeFitQuickShareModal } from './EndUserSizeFitQuickShareModal';
import { EndUserProfileQrModal } from './EndUserProfileQrModal';
import { SizeFitApi } from '@/api/SizeFitApi';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import type { SizeFitProfile, SizeFitSharesPayload } from '@/types/sizeFit';
import ProfileActionsBar, { type ProfileAction } from '@/components/profile/ProfileActionsBar';
import { buildProfileUrl, shareOrCopyLink } from '@/utils/publicLinks';
import { customOrdersBuyerApi, type CustomOrderChartFamily } from '@/api/CustomOrderApi';
import { deriveSizeRecommendation, DISPLAY_CHART_OPTIONS } from '@/lib/sizeCharts';
import ImageWithFallback from '@/components/ImageWithFallback';
import ProfileImageModal from '@/components/profile/ProfileImageModal';
import { getAvatarFallback, resolveProfileImageSource } from '@/utils/profileImage';
import {
  createUnviewedProfilePhotoViewState,
  type ProfilePhotoViewState,
} from '@/types/profilePhoto';
import {
  fetchDisplayChartPreferenceQuery,
  fetchMySizeFitProfileQuery,
  fetchMySizeFitSharesQuery,
  fetchMyUserProfileQuery,
  usePublicUserProfileQuery,
} from '@/query/queries';
import { queryKeys } from '@/query/queryKeys';
import {
  WEB_UPLOAD_POLICIES,
  assertValidUploadFile,
  getUploadValidationMessage,
} from '@/utils/uploadValidation';

interface UserProfile {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profileImage?: string;
  profileImageId?: string | null;
  profileImageFile?: {
    id: string;
    s3Url: string;
    fileName?: string;
    originalName?: string;
    createdAt?: string;
    updatedAt?: string;
  } | null;
  bannerImage?: string;
  address?: string;
  profileVisibility: 'UNLOCKED' | 'LOCKED';
  location?: string;
  profilePhotoUpdatedAt?: string | null;
  profilePhotoViewState?: ProfilePhotoViewState | null;
  createdAt?: string;
}

const normalizeProfile = (raw: any): UserProfile | null => {
  const payload = raw?.data ?? raw;
  const source = payload?.user ?? payload?.profile ?? payload;
  if (!source || typeof source !== 'object' || !source.id) return null;

  return {
    id: source.id,
    username: source.username ?? '',
    firstName: source.firstName ?? '',
    lastName: source.lastName ?? '',
    profileImage: source.profileImage ?? undefined,
    profileImageId: source.profileImageId ?? null,
    profileImageFile: source.profileImageFile ?? null,
    bannerImage: source.bannerImage ?? undefined,
    address: source.address ?? undefined,
    location: source.location ?? source.address ?? undefined,
    profileVisibility: source.profileVisibility === 'LOCKED' ? 'LOCKED' : 'UNLOCKED',
    profilePhotoUpdatedAt: source.profilePhotoUpdatedAt ?? null,
    profilePhotoViewState: source.profilePhotoViewState ?? null,
    createdAt: typeof source.createdAt === 'string' ? source.createdAt : undefined,
  };
};

const formatJoinLabel = (value?: string): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return `Joined ${new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(parsed)}`;
};

const describeAlphaFit = (value?: string | null): string | null => {
  if (!value) return null;

  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/^2XL$/, 'XXL')
    .replace(/^3XL$/, 'XXXL')
    .replace(/^4XL$/, 'XXXXL');
  const labels: Record<string, string> = {
    XXS: 'Extra Extra Small',
    XS: 'Extra Small',
    S: 'Small',
    M: 'Medium',
    L: 'Large',
    XL: 'Extra Large',
    XXL: 'Extra Extra Large',
    XXXL: 'Extra Extra Extra Large',
  };

  return labels[normalized] ? `${labels[normalized]} (${normalized})` : normalized;
};

export const EndUserProfile: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const currentUser = useSelector((state: RootState) => state.user.profile);
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isQuickEditOpen, setIsQuickEditOpen] = useState(false);
  const [savingQuickEdit, setSavingQuickEdit] = useState(false);
  const [isSizeFitOpen, setIsSizeFitOpen] = useState(false);
  const [isQuickShareOpen, setIsQuickShareOpen] = useState(false);
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isReminderDialogOpen, setIsReminderDialogOpen] = useState(false);
  const [sizeFitLoading, setSizeFitLoading] = useState(false);
  const [sizeFitSaving, setSizeFitSaving] = useState(false);
  const [sizeFitProfile, setSizeFitProfile] = useState<SizeFitProfile | null>(null);
  const [sizeFitShares, setSizeFitShares] = useState<SizeFitSharesPayload | null>(null);
  const [displayChartFamily, setDisplayChartFamily] = useState<CustomOrderChartFamily>('UK');
  const [computedSize, setComputedSize] = useState<string | null>(null);
  const [computedAlphaSize, setComputedAlphaSize] = useState<string | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartSaving, setChartSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [avatarActionsOpen, setAvatarActionsOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const avatarActionsRef = useRef<HTMLDivElement | null>(null);

  const isOwner = !id || currentUser?.id === id;
  const profileId = id ?? currentUser?.id;
  const publicProfileQuery = usePublicUserProfileQuery(profileId, {
    enabled: Boolean(!isOwner && profileId),
  });
  const availableTabs = useMemo(() => (isOwner ? ['Saved', 'Patches', 'Orders'] : ['Patches']), [isOwner]);
  const tabParam = searchParams.get('tab');
  const derivedTab = (() => {
    if (tabParam === 'orders' && isOwner) return 'Orders';
    return isOwner ? 'Saved' : 'Patches';
  })();
  const [activeTab, setActiveTab] = useState<string>(derivedTab);
  const [ordersSelection, setOrdersSelection] = useState<OrdersPanelSelection | null>(null);

  // Keep activeTab in sync when URL changes (e.g. browser back/forward)
  useEffect(() => {
    setActiveTab(derivedTab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);
  const hasAvatarImage = Boolean(
    avatarPreviewUrl ||
      profile?.profileImage ||
      profile?.profileImageFile ||
      (isOwner && (currentUser?.profileImage || currentUser?.profileImageFile)),
  );

  useEffect(() => {
    let mounted = true;

    const fetchProfile = async () => {
      if (!profileId) {
        if (mounted) {
          setLoading(false);
          setError('Failed to load profile');
        }
        return;
      }

      if (!isOwner) {
        return;
      }

      try {
        if (mounted) {
          setLoading(true);
          setError(null);
        }

        const ownerProfilePayload = await fetchMyUserProfileQuery(queryClient, currentUser?.id ?? profileId);
        const normalized = normalizeProfile(ownerProfilePayload);
        if (!normalized) throw new Error('Invalid profile payload');
        if (mounted) setProfile(normalized);
      } catch (err) {
        if (mounted && isOwner && currentUser) {
          setProfile({
            id: currentUser.id,
            username: currentUser.username ?? '',
            firstName: currentUser.firstName ?? '',
            lastName: currentUser.lastName ?? '',
            profileImage: currentUser.profileImage ?? undefined,
            profileImageId: currentUser.profileImageId ?? null,
            profileImageFile: currentUser.profileImageFile ?? null,
            bannerImage: currentUser.bannerImage ?? undefined,
            address: currentUser.address ?? undefined,
            location: currentUser.address ?? undefined,
            profilePhotoUpdatedAt: currentUser.profilePhotoUpdatedAt ?? null,
            profilePhotoViewState: null,
            profileVisibility:
              (currentUser as any).profileVisibility === 'LOCKED' ? 'LOCKED' : 'UNLOCKED',
            createdAt: currentUser.createdAt,
          });
          setError(null);
        } else if (mounted) {
          setError('Failed to load profile');
        }
        console.error('Error fetching profile:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void fetchProfile();

    return () => {
      mounted = false;
    };
  }, [profileId, isOwner, currentUser, queryClient]);

  useEffect(() => {
    if (isOwner) return;

    if (!profileId) {
      setProfile(null);
      setLoading(false);
      setError('Failed to load profile');
      return;
    }

    if (publicProfileQuery.isLoading && !publicProfileQuery.data) {
      setLoading(true);
      setError(null);
      return;
    }

    if (publicProfileQuery.error) {
      setProfile(null);
      setLoading(false);
      setError('Failed to load profile');
      return;
    }

    if (!publicProfileQuery.data) return;

    const normalized = normalizeProfile(publicProfileQuery.data);
    if (!normalized) {
      setProfile(null);
      setLoading(false);
      setError('Failed to load profile');
      return;
    }

    setProfile(normalized);
    setLoading(false);
    setError(null);
  }, [
    isOwner,
    profileId,
    publicProfileQuery.data,
    publicProfileQuery.error,
    publicProfileQuery.isLoading,
  ]);

  const loadSizeFit = useCallback(async (forceRefresh = false) => {
    if (!isOwner || !currentUser?.id) return;
    setSizeFitLoading(true);
    try {
      const [profileData, shareData] = await Promise.all([
        fetchMySizeFitProfileQuery(queryClient, currentUser.id, { forceRefresh }),
        fetchMySizeFitSharesQuery(queryClient, currentUser.id, { forceRefresh }),
      ]);
      setSizeFitProfile(profileData);
      setSizeFitShares(shareData);
    } catch (err) {
      console.error('Failed to load size fit profile', err);
      toast.error('Unable to load custom size/fits right now.');
    } finally {
      setSizeFitLoading(false);
    }
  }, [currentUser?.id, isOwner, queryClient]);

  useEffect(() => {
    if (!isOwner) return;
    void loadSizeFit();
  }, [isOwner, loadSizeFit]);

  useEffect(() => {
    let active = true;
    if (!isOwner || !currentUser?.id) return;

    const loadChartProfile = async () => {
      setChartLoading(true);
      try {
        const preference = await fetchDisplayChartPreferenceQuery(queryClient, currentUser.id);
        if (!active) return;
        if (preference) {
          setDisplayChartFamily(preference.displayChartFamily);
        }
      } catch (err) {
        if (active) {
          setComputedSize(null);
        }
        console.error('Failed to load display chart/computed size', err);
      } finally {
        if (active) {
          setChartLoading(false);
        }
      }
    };

    void loadChartProfile();
    return () => {
      active = false;
    };
  }, [currentUser?.id, isOwner, queryClient]);

  useEffect(() => {
    if (!isOwner) return;
    const measurements = (sizeFitProfile?.measurements as Record<string, unknown> | undefined) ?? {};
    const recommendation = deriveSizeRecommendation(
      measurements,
      displayChartFamily,
      sizeFitProfile?.measurementGender ?? null,
    );
    setComputedSize(recommendation.computedSize);
    setComputedAlphaSize(recommendation.alphaSize);
  }, [displayChartFamily, isOwner, sizeFitProfile?.measurementGender, sizeFitProfile?.measurements]);

  useEffect(() => {
    setActiveTab((prev) => (availableTabs.includes(prev) ? prev : availableTabs[0]));
  }, [availableTabs]);

  useEffect(() => {
    return () => {
      if (avatarPreviewUrl) {
        URL.revokeObjectURL(avatarPreviewUrl);
      }
    };
  }, [avatarPreviewUrl]);

  useEffect(() => {
    if (!avatarActionsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (avatarActionsRef.current && event.target instanceof Node && avatarActionsRef.current.contains(event.target)) {
        return;
      }
      setAvatarActionsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [avatarActionsOpen]);

  const handleShareProfile = useCallback(async () => {
    if (!profile) return;
    const url = buildProfileUrl({ id: profile.id, username: profile.username });
    await shareOrCopyLink({
      url,
      title: `${profile.firstName} ${profile.lastName}`.trim() || profile.username,
      successMessage: 'Profile link copied.',
      errorMessage: 'Unable to copy profile link.',
    });
  }, [profile]);

  const handleQuickProfileSave = useCallback(
    async (values: { firstName: string; lastName: string; address: string }) => {
      if (!profile) return;
      setSavingQuickEdit(true);
      try {
        const response = await apiClient.patch('/users/me/profile', {
          firstName: values.firstName,
          lastName: values.lastName,
          username: profile.username,
          address: values.address || undefined,
        });

        const payload = response.data?.data ?? response.data;
        const updatedUser = payload?.user ?? payload;

        setProfile((prev) =>
          prev
            ? {
                ...prev,
                firstName: String(updatedUser?.firstName ?? values.firstName),
                lastName: String(updatedUser?.lastName ?? values.lastName),
                address: String(updatedUser?.address ?? values.address ?? ''),
                location: String(updatedUser?.address ?? values.address ?? ''),
              }
            : prev,
        );

        if (isOwner && updatedUser && typeof updatedUser === 'object') {
          dispatch(setUser(updatedUser));
          queryClient.setQueryData(queryKeys.user.meProfile(profile.id), updatedUser);
        }

        toast.success('Profile updated');
        setIsQuickEditOpen(false);
      } catch (err) {
        console.error('Quick profile update failed:', err);
        toast.error('Unable to update profile right now.');
      } finally {
        setSavingQuickEdit(false);
      }
    },
    [dispatch, isOwner, profile, queryClient],
  );

  const handleSaveSizeFitMeasurements = useCallback(
    async (payload: {
      measurements: Record<string, unknown>;
      notes?: string;
      requireUpdateEveryDays?: number;
      preferredLengthUnit?: 'CM' | 'IN';
    }) => {
      setSizeFitSaving(true);
      try {
        const updated = await SizeFitApi.updateProfile(payload);
        setSizeFitProfile(updated);
        if (currentUser?.id) {
          queryClient.setQueryData(queryKeys.sizeFit.myProfile(currentUser.id), updated);
        }
        toast.success('Size fitting profile updated.');
      } catch (err) {
        console.error('Failed to update size fitting profile', err);
        toast.error('Failed to update custom size/fits.');
      } finally {
        setSizeFitSaving(false);
      }
    },
    [currentUser?.id, queryClient],
  );

  const handleSaveSizeFitSettings = useCallback(
    async (payload: {
      visibility?: 'PUBLIC' | 'PRIVATE';
      sharePolicy?: 'OWNER_ONLY' | 'REQUIRE_PERMISSION' | 'ALLOW_ANYONE';
      notifyOnShare?: boolean;
      requireUpdateEveryDays?: number;
    }) => {
      setSizeFitSaving(true);
      try {
        const updated = await SizeFitApi.updateSettings(payload);
        setSizeFitProfile((prev) => (prev ? { ...prev, ...updated } : prev));
        if (currentUser?.id) {
          queryClient.setQueryData<SizeFitProfile | null>(
            queryKeys.sizeFit.myProfile(currentUser.id),
            (current) => (current ? { ...current, ...updated } : current),
          );
        }
        toast.success('Size fitting permissions updated.');
      } catch (err) {
        console.error('Failed to update size fitting settings', err);
        toast.error('Failed to update permissions.');
      } finally {
        setSizeFitSaving(false);
      }
    },
    [currentUser?.id, queryClient],
  );

  const handleShareSizeFit = useCallback(
    async (payload: { targetUserIdentifier: string; canReshare?: boolean; note?: string }) => {
      setSizeFitSaving(true);
      try {
        const result = await SizeFitApi.share(payload);
        toast.success(result.requiresApproval ? 'Share request sent for approval.' : 'Size fitting profile shared.');
        await loadSizeFit(true);
      } catch (err) {
        console.error('Failed to share size fitting profile', err);
        toast.error('Unable to process share request.');
      } finally {
        setSizeFitSaving(false);
      }
    },
    [loadSizeFit],
  );

  const handleRespondShareRequest = useCallback(
    async (shareId: string, decision: 'APPROVE' | 'REJECT' | 'REVOKE') => {
      setSizeFitSaving(true);
      try {
        await SizeFitApi.respondToShareRequest(shareId, decision);
        toast.success(
          decision === 'APPROVE'
            ? 'Share request approved.'
            : decision === 'REVOKE'
              ? 'Access revoked.'
              : 'Share request rejected.',
        );
        await loadSizeFit(true);
      } catch (err) {
        console.error('Failed to respond to share request', err);
        toast.error('Unable to update share request.');
      } finally {
        setSizeFitSaving(false);
      }
    },
    [loadSizeFit],
  );

  const handleDisplayChartChange = useCallback(
    async (value: string) => {
      const next = value as CustomOrderChartFamily;
      if (next === displayChartFamily) return;
      setDisplayChartFamily(next);
      setChartSaving(true);
      try {
        const updated = await customOrdersBuyerApi.updateDisplayChartPreference({
          displayChartFamily: next,
          updatedAtMs: Date.now(),
        });
        if (currentUser?.id) {
          queryClient.setQueryData(queryKeys.customOrders.displayChartPreference(currentUser.id), updated);
        }
        toast.success('Display chart updated.');
      } catch (err) {
        console.error('Failed to save display chart preference', err);
        toast.error('Could not save display chart preference.');
      } finally {
        setChartSaving(false);
      }
    },
    [currentUser?.id, displayChartFamily, queryClient],
  );

  const handleTriggerAvatarUpload = useCallback(() => {
    setAvatarActionsOpen(false);
    avatarInputRef.current?.click();
  }, []);

  const handleAvatarSelected: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file || !currentUser) return;

      try {
        assertValidUploadFile(file, WEB_UPLOAD_POLICIES.profileImage);
      } catch (uploadError) {
        toast.error(getUploadValidationMessage(uploadError));
        return;
      }

      const nextPreviewUrl = URL.createObjectURL(file);
      setAvatarPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return nextPreviewUrl;
      });

      const formData = new FormData();
      formData.append('file', file);

      setAvatarUploading(true);
      try {
        const response = await apiClient.post('/uploads/profile-image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const uploaded = response.data?.data ?? response.data;
        const nextImage = uploaded?.url ?? null;
        const nextImageId = uploaded?.id ?? null;
        const nextProfilePhotoUpdatedAt = new Date().toISOString();
        const nextProfilePhotoViewState =
          nextImage || nextImageId
            ? createUnviewedProfilePhotoViewState(
                currentUser.id,
                nextProfilePhotoUpdatedAt,
              )
            : null;

        setProfile((prev) =>
          prev
            ? {
                ...prev,
                profileImage: nextImage ?? undefined,
                profileImageId: nextImageId,
                profilePhotoUpdatedAt: nextProfilePhotoUpdatedAt,
                profilePhotoViewState: nextProfilePhotoViewState,
                profileImageFile: nextImage
                  ? {
                      id: nextImageId,
                      s3Url: nextImage,
                      fileName: uploaded?.fileName ?? file.name,
                      originalName: uploaded?.originalName ?? file.name,
                      createdAt: uploaded?.createdAt ?? new Date().toISOString(),
                      updatedAt: uploaded?.updatedAt ?? new Date().toISOString(),
                    }
                  : null,
              }
            : prev,
        );

        dispatch(
          setUser({
            ...currentUser,
            profileImage: nextImage,
            profileImageId: nextImageId,
            profilePhotoUpdatedAt: nextProfilePhotoUpdatedAt,
            profileImageFile: nextImage
              ? {
                  id: nextImageId,
                  s3Url: nextImage,
                  fileName: uploaded?.fileName ?? file.name,
                  originalName: uploaded?.originalName ?? file.name,
                  createdAt: uploaded?.createdAt ?? new Date().toISOString(),
                  updatedAt: uploaded?.updatedAt ?? new Date().toISOString(),
                }
              : null,
          }),
        );
        queryClient.setQueryData(queryKeys.user.meProfile(currentUser.id), (current: any) => ({
          ...(current ?? currentUser),
          profileImage: nextImage,
          profileImageId: nextImageId,
          profilePhotoUpdatedAt: nextProfilePhotoUpdatedAt,
          profilePhotoViewState: nextProfilePhotoViewState,
          profileImageFile: nextImage
            ? {
                id: nextImageId,
                s3Url: nextImage,
                fileName: uploaded?.fileName ?? file.name,
                originalName: uploaded?.originalName ?? file.name,
                createdAt: uploaded?.createdAt ?? new Date().toISOString(),
                updatedAt: uploaded?.updatedAt ?? new Date().toISOString(),
              }
            : null,
        }));

        setAvatarPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return null;
        });
        toast.success('Profile image updated.');
      } catch (err) {
        console.error('Failed to upload profile image', err);
        setAvatarPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return null;
        });
        toast.error('Unable to upload profile image right now.');
      } finally {
        setAvatarUploading(false);
      }
    },
    [currentUser, dispatch, queryClient],
  );

  const handleRemoveAvatar = useCallback(async () => {
    if (!currentUser) return;
    setAvatarActionsOpen(false);
    setAvatarUploading(true);
    try {
      await apiClient.delete('/uploads/profile-image');

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              profileImage: undefined,
              profileImageId: null,
              profilePhotoUpdatedAt: null,
              profilePhotoViewState: null,
              profileImageFile: null,
            }
          : prev,
      );

      setAvatarPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });

      dispatch(
        setUser({
          ...currentUser,
          profileImage: null,
          profileImageId: null,
          profilePhotoUpdatedAt: null,
          profileImageFile: null,
        }),
      );
      queryClient.setQueryData(queryKeys.user.meProfile(currentUser.id), (current: any) => ({
        ...(current ?? currentUser),
        profileImage: null,
        profileImageId: null,
        profilePhotoUpdatedAt: null,
        profileImageFile: null,
      }));

      toast.success('Profile image removed.');
    } catch (err) {
      console.error('Failed to remove profile image', err);
      toast.error('Unable to remove profile image right now.');
    } finally {
      setAvatarUploading(false);
    }
  }, [currentUser, dispatch, queryClient]);

  const handleAvatarButtonClick = useCallback(() => {
    if (avatarUploading) return;

    if (!hasAvatarImage) {
      handleTriggerAvatarUpload();
      return;
    }

    setAvatarActionsOpen((current) => !current);
  }, [avatarUploading, handleTriggerAvatarUpload, hasAvatarImage]);

  const handleViewAvatar = useCallback(() => {
    if (!profile || !hasAvatarImage) return;

    setIsAvatarModalOpen(true);

    const currentState = profile.profilePhotoViewState;
    if (!currentUser || !currentState?.canMarkViewed) return;

    void ProfilePhotoViewApi.markViewed(profile.id)
      .then((nextState) => {
        setProfile((current) =>
          current
            ? {
                ...current,
                profilePhotoUpdatedAt: nextState.profilePhotoUpdatedAt,
                profilePhotoViewState: nextState,
              }
            : current,
        );
        const key = isOwner
          ? queryKeys.user.meProfile(profile.id)
          : queryKeys.user.publicProfile(profile.id);
        queryClient.setQueryData(key, (current: any) =>
          current
            ? {
                ...current,
                profilePhotoUpdatedAt: nextState.profilePhotoUpdatedAt,
                profilePhotoViewState: nextState,
              }
            : current,
        );
      })
      .catch((error) => {
        console.error('Failed to mark profile photo viewed', error);
      });
  }, [currentUser, hasAvatarImage, isOwner, profile, queryClient]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1280px] animate-pulse px-4 py-6">
        {/* Avatar + name skeleton */}
        <div className="flex items-center gap-4 mb-6">
          <div className="h-32 w-32 shrink-0 rounded-2xl bg-gray-200 dark:bg-white/10 sm:h-44 sm:w-44" />
          <div className="flex-1 space-y-2.5">
            <div className="h-5 w-2/5 rounded-lg bg-gray-200 dark:bg-white/10" />
            <div className="h-3.5 w-1/4 rounded-lg bg-gray-200 dark:bg-white/10" />
            <div className="h-3 w-1/3 rounded-lg bg-gray-200 dark:bg-white/10" />
          </div>
        </div>
        {/* Actions bar skeleton */}
        <div className="mb-5 flex gap-2">
          {[90, 80, 110, 90, 80].map((w, i) => (
            <div key={i} className="h-9 rounded-full bg-gray-200 dark:bg-white/10" style={{ width: w }} />
          ))}
        </div>
        {/* Size card skeleton */}
        <div className="mb-6 h-28 rounded-2xl bg-gray-200 dark:bg-white/10" />
        {/* Tab bar skeleton */}
        <div className="mb-5 flex gap-6 border-b border-theme pb-px">
          {[70, 80, 70].map((w, i) => (
            <div key={i} className="h-4 rounded bg-gray-200 dark:bg-white/10" style={{ width: w }} />
          ))}
        </div>
        {/* Content skeleton grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] rounded-2xl bg-gray-200 dark:bg-white/10" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-5xl" aria-hidden="true">😕</span>
        <h2 className="text-xl font-bold text-theme">Profile Not Found</h2>
        <p className="text-sm text-theme-secondary">
          {error || 'The requested profile could not be found.'}
        </p>
      </div>
    );
  }

  const profileUrl = buildProfileUrl({ id: profile.id, username: profile.username });
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || profile.username;
  const joinLabel = formatJoinLabel(profile.createdAt ?? (isOwner ? currentUser?.createdAt : undefined));
  const avatar = resolveProfileImageSource({
    profileImage: avatarPreviewUrl ?? profile.profileImage ?? (isOwner ? currentUser?.profileImage : null),
    profileImageId: avatarPreviewUrl
      ? null
      : (profile.profileImageId ?? (isOwner ? currentUser?.profileImageId : null) ?? null),
    profileImageFile: avatarPreviewUrl
      ? null
      : (profile.profileImageFile ?? (isOwner ? currentUser?.profileImageFile : null) ?? null),
  });
  const avatarFallback = getAvatarFallback(fullName, profile.username);
  const avatarRingClass =
    hasAvatarImage && profile.profilePhotoViewState?.profilePhotoUpdatedAt
      ? profile.profilePhotoViewState.hasUnviewedUpdate
        ? 'profile-photo-ring-new'
        : 'profile-photo-ring-viewed'
      : 'border-gray-200 shadow-sm dark:border-white/10';
  const alphaFitLabel = describeAlphaFit(computedAlphaSize);
  const profileActions: ProfileAction[] = [
    {
      key: 'edit',
      icon: '✏️',
      label: 'Edit',
      onClick: () => setIsQuickEditOpen(true),
      hidden: true,
    },
    {
      key: 'share',
      icon: '🔗',
      label: 'Share',
      onClick: handleShareProfile,
      hidden: true,
    },
    {
      key: 'fits',
      icon: '📐',
      label: 'My Fits',
      onClick: () => setIsSizeFitOpen(true),
    },
    {
      key: 'quick-share',
      icon: '↗️',
      label: 'Quick Share',
      onClick: () => setIsQuickShareOpen(true),
    },
    {
      key: 'qr',
      icon: '🗳️',
      label: 'QR Code',
      onClick: () => setIsQrOpen(true),
    },
    {
      key: 'update-fits',
      icon: '⚠️',
      label: 'Update Fits',
      onClick: () => setIsReminderDialogOpen(true),
      pulse: true,
      hidden: !sizeFitProfile?.isUpdateDue,
    },
  ];

  const TAB_ICONS: Record<string, string> = { Saved: '🗂️', Patches: '🪡', Orders: '📦' };

  return (
    <div className="relative min-h-screen">
      <div className="mx-auto w-full max-w-[1280px] px-3 pb-28 pt-4 sm:px-5 sm:pt-6 xl:pb-10">

        {/* ── PROFILE HEADER ── */}
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="mb-5"
        >
          {/* Top row: avatar + identity + inline size widget */}
          <div className="flex items-start gap-4 sm:gap-6">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div
                className={`relative h-32 w-32 overflow-hidden rounded-xl border-2 p-0.5 transition-colors duration-300 sm:h-44 sm:w-44 ${avatarRingClass}`}
              >
                <button
                  type="button"
                  className="relative h-full w-full overflow-hidden rounded-[0.65rem] text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--menu-focus-ring)] disabled:cursor-default"
                  onClick={handleViewAvatar}
                  disabled={!hasAvatarImage}
                  aria-label="View profile photo"
                >
                <ImageWithFallback
                  src={avatar.src}
                  fileId={avatar.fileId}
                  alt={fullName}
                  fit="cover"
                  rounded="xl"
                  fallbackName={avatarFallback}
                  containerClassName="h-full w-full"
                  className="h-full w-full rounded-[inherit] object-cover"
                  maxHeightClassName="max-h-full"
                />
                </button>
                {avatarUploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-[inherit] bg-black/55">
                    <div className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-900">
                      Uploading…
                    </div>
                  </div>
                )}
              </div>
              {/* Avatar action button */}
              {isOwner ? (
                <div ref={avatarActionsRef} className="absolute -bottom-1.5 -right-1.5 z-20">
                  <button
                    type="button"
                    onClick={handleAvatarButtonClick}
                    disabled={avatarUploading}
                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-purple-600 text-sm shadow-md transition hover:bg-purple-700 active:scale-95 disabled:opacity-60 dark:border-zinc-900"
                    title={hasAvatarImage ? 'Profile photo actions' : 'Upload profile photo'}
                    aria-label={hasAvatarImage ? 'Profile photo actions' : 'Upload profile photo'}
                    aria-expanded={avatarActionsOpen}
                    aria-haspopup={hasAvatarImage}
                  >
                    📷
                  </button>

                  <AnimatePresence>
                    {avatarActionsOpen ? (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.16 }}
                        className="glass-menu absolute right-0 top-full mt-2 w-44 overflow-hidden p-1"
                      >
                        <button
                          type="button"
                          onClick={handleTriggerAvatarUpload}
                          className="menu-item-interactive flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium"
                        >
                          <span aria-hidden="true">📷</span>
                          Change photo
                        </button>
                        {hasAvatarImage ? (
                          <button
                            type="button"
                            onClick={() => void handleRemoveAvatar()}
                            className="menu-item-danger mt-1 flex w-full items-center gap-2 rounded-xl border-t border-[color:var(--border-default)] px-3 py-2 text-left text-sm font-medium"
                          >
                            <span aria-hidden="true">🗑️</span>
                            Remove photo
                          </button>
                        ) : null}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-white/90 text-sm shadow-sm dark:border-zinc-900 dark:bg-zinc-800">
                  {profile.profileVisibility === 'LOCKED' ? '🔒' : '🌐'}
                </div>
              )}
            </div>

            {/* Identity */}
            <div className="min-w-0 flex-1 pt-0.5">
              <h1 className="truncate text-xl font-black tracking-tight text-theme sm:text-3xl">
                {fullName}
              </h1>
              <p className="mt-0.5 truncate text-sm text-theme-secondary">
                @{profile.username}
              </p>
              {(profile.location || joinLabel) ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-theme-secondary sm:text-xs">
                  {profile.location ? (
                    <span className="flex items-center gap-0.5">
                      <span aria-hidden="true">📍</span> {profile.location}
                    </span>
                  ) : null}
                  {profile.location && joinLabel ? <span className="h-1 w-1 rounded-full bg-gray-400" /> : null}
                  {joinLabel ? <span>{joinLabel}</span> : null}
                </div>
              ) : null}

              {/* Upload status pill — only shown while uploading */}
              {avatarUploading ? (
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-[11px] font-semibold text-purple-800 dark:bg-purple-500/15 dark:text-purple-200">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-500" />
                  Uploading photo…
                </div>
              ) : null}
            </div>

            {/* ── Compact inline size widget (owner only) ── */}
            {isOwner ? (
              <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
                {/* Chart family tabs */}
                <div className="flex gap-0.5 rounded-lg bg-indigo-50 p-0.5 dark:bg-indigo-950/40">
                  {DISPLAY_CHART_OPTIONS.slice(0, 4).map((option) => {
                    const active = displayChartFamily === option.value;
                    const shortLabel = option.label
                      .replace('Nigeria', 'NG')
                      .replace('UK-Nigeria Hybrid', 'UK-NG')
                      .replace('US-Nigeria Hybrid', 'US-NG')
                      .replace('Asia', 'Asia');
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => void handleDisplayChartChange(option.value)}
                        disabled={chartSaving}
                        aria-pressed={active}
                        className={`rounded-md px-2 py-1 text-[10px] font-bold transition ${
                          active
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-indigo-500 hover:bg-indigo-100 dark:text-indigo-300 dark:hover:bg-indigo-900/40'
                        }`}
                      >
                        {shortLabel}
                      </button>
                    );
                  })}
                </div>
                {/* Size number */}
                <div className="text-right">
                  <div className="text-3xl font-black leading-none text-indigo-900 dark:text-indigo-100">
                    {chartLoading ? '…' : computedSize || '—'}
                  </div>
                  {alphaFitLabel ? (
                    <div className="mt-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                      {alphaFitLabel}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {/* ── ACTION BAR ── */}
          {isOwner ? (
            <div className="mt-4">
              <ProfileActionsBar actions={profileActions} />
            </div>
          ) : null}

          {/* ── SIZE/FIT strip (mobile: compact inline below actions) ── */}
          {isOwner ? (
            <div className="mt-3 sm:hidden">
              <div className="flex items-center gap-3 rounded-2xl border border-indigo-200/60 bg-indigo-50/70 px-4 py-2.5 dark:border-indigo-500/20 dark:bg-indigo-950/30">
                {/* Chart tabs */}
                <div className="flex gap-0.5 rounded-md bg-white/60 p-0.5 dark:bg-white/10">
                  {DISPLAY_CHART_OPTIONS.slice(0, 4).map((option) => {
                    const active = displayChartFamily === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => void handleDisplayChartChange(option.value)}
                        disabled={chartSaving}
                        aria-pressed={active}
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold transition ${
                          active ? 'bg-indigo-600 text-white' : 'text-indigo-500 dark:text-indigo-300'
                        }`}
                      >
                        {option.label.replace('Nigeria', 'NG').replace('UK-Nigeria Hybrid', 'UK-NG').replace('US-Nigeria Hybrid', 'US-NG')}
                      </button>
                    );
                  })}
                </div>
                {/* Size number */}
                <div className="text-2xl font-black leading-none text-indigo-900 dark:text-indigo-100">
                  {chartLoading ? '…' : computedSize || '—'}
                </div>
                {alphaFitLabel ? (
                  <div className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                    {alphaFitLabel}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </motion.section>

        {/* ── TAB BAR ── */}
        <div className="sticky top-16 z-10 -mx-3 mb-4 border-b border-gray-200/70 bg-white/80 px-3 backdrop-blur-md dark:border-white/10 dark:bg-[#0a0812]/80 sm:-mx-5 sm:px-5">
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide">
            {availableTabs.map((key) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`relative flex min-w-0 flex-shrink-0 items-center gap-2 px-4 py-3.5 text-sm font-semibold transition-colors sm:px-6 ${
                    active
                      ? 'text-fuchsia-600 dark:text-fuchsia-400'
                      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  <span className="text-base leading-none">{TAB_ICONS[key]}</span>
                  <span className="whitespace-nowrap">{key}</span>
                  {active && (
                    <motion.div
                      layoutId="profile-tab-indicator"
                      className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-fuchsia-500"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── TAB CONTENT ── */}
        <div className={activeTab === 'Orders' ? '' : 'lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6 xl:grid-cols-[minmax(0,1fr)_360px]'}>
          {/* Main column */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {activeTab === 'Orders' && isOwner ? (
                <OrdersPanel
                  mode="full"
                  initialSelection={ordersSelection}
                  onSelectionHandled={() => setOrdersSelection(null)}
                />
              ) : activeTab === 'Saved' ? (
                isOwner
                  ? <SavedTab isOwner={isOwner} />
                  : <PatchesTab isOwner={isOwner} profileVisibility={profile.profileVisibility} />
              ) : (
                <PatchesTab isOwner={isOwner} profileVisibility={profile.profileVisibility} />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Desktop sidebar column: orders summary */}
          {isOwner && activeTab !== 'Orders' ? (
            <div className="hidden lg:flex lg:flex-col lg:gap-5">
              <OrdersPanel
                onViewAll={(selection) => {
                  if (selection) {
                    navigate(`/profile?tab=orders&kind=${selection.kind}&orderId=${selection.id}`);
                  } else {
                    navigate('/profile?tab=orders');
                  }
                  setOrdersSelection(selection ?? null);
                  setActiveTab('Orders');
                }}
              />
            </div>
          ) : null}
        </div>

        {/* Mobile: orders summary panel shown below content when on non-orders tab */}
        {isOwner && activeTab !== 'Orders' ? (
          <div className="mt-5 lg:hidden">
            <OrdersPanel
              onViewAll={(selection) => {
                if (selection) {
                  navigate(`/profile?tab=orders&kind=${selection.kind}&orderId=${selection.id}`);
                } else {
                  navigate('/profile?tab=orders');
                }
                setOrdersSelection(selection ?? null);
                setActiveTab('Orders');
              }}
            />
          </div>
        ) : null}
      </div>

      {/* ── MODALS ── */}
      <EndUserQuickEditModal
        open={isQuickEditOpen}
        saving={savingQuickEdit}
        initialValues={{
          firstName: profile.firstName,
          lastName: profile.lastName,
          address: profile.address ?? '',
        }}
        onClose={() => setIsQuickEditOpen(false)}
        onSave={handleQuickProfileSave}
      />

      <EndUserSizeFitModal
        open={isSizeFitOpen}
        loading={sizeFitLoading}
        saving={sizeFitSaving}
        profile={sizeFitProfile}
        onClose={() => setIsSizeFitOpen(false)}
        onSaveMeasurements={handleSaveSizeFitMeasurements}
        onSaveSettings={handleSaveSizeFitSettings}
      />

      <EndUserSizeFitQuickShareModal
        open={isQuickShareOpen}
        saving={sizeFitSaving}
        sharePolicy={sizeFitProfile?.sharePolicy ?? 'REQUIRE_PERMISSION'}
        shares={sizeFitShares}
        onClose={() => setIsQuickShareOpen(false)}
        onShare={handleShareSizeFit}
        onRespond={handleRespondShareRequest}
      />

      <EndUserProfileQrModal
        open={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        profileUrl={profileUrl}
        logoUrl={profile.profileImage}
        username={profile.username}
      />

      <ProfileImageModal
        open={isAvatarModalOpen && Boolean(avatar.src ?? avatar.fileId)}
        src={avatar.src}
        fileId={avatar.fileId}
        alt={fullName}
        onClose={() => setIsAvatarModalOpen(false)}
      />

      {isReminderDialogOpen ? (
        <OverlayPortal>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-layer-modal flex items-center justify-center p-4"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/55 backdrop-blur-sm"
              onClick={() => setIsReminderDialogOpen(false)}
              aria-label="Close"
            />
            <motion.section
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              className="relative z-10 w-full max-w-sm rounded-3xl border border-white/30 bg-white/95 p-5 shadow-2xl dark:border-white/10 dark:bg-zinc-900/95"
            >
              <h3 className="text-base font-semibold text-theme">⚠️ Size/Fit Update Reminder</h3>
              <p className="mt-2 text-sm text-theme-secondary">
                Keep your size/fits current every {sizeFitProfile?.requireUpdateEveryDays ?? 14} days.
                Your latest fitting values are attached to new orders so fulfillment stays accurate.
              </p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReminderDialogOpen(false)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/5"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => { setIsReminderDialogOpen(false); setIsSizeFitOpen(true); }}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 active:scale-95"
                >
                  Open Fits
                </button>
              </div>
            </motion.section>
          </motion.div>
        </OverlayPortal>
      ) : null}

      {isOwner ? (
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarSelected}
        />
      ) : null}
    </div>
  );
};
