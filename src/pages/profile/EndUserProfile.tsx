import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useDispatch, useSelector } from 'react-redux';
import { SavedTab } from './tabs/SavedTab';
import { PatchesTab } from './tabs/PatchesTab';
import { OrdersPanel, type OrdersPanelSelection } from './tabs/OrdersPanel';
import { apiClient } from '@/api/httpClient';
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
import { getAvatarFallback, resolveProfileImageSource } from '@/utils/profileImage';

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
  const dispatch = useDispatch<AppDispatch>();
  const currentUser = useSelector((state: RootState) => state.user.profile);
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
  const [computedGuidance, setComputedGuidance] = useState<string | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartSaving, setChartSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  const isOwner = !id || currentUser?.id === id;
  const profileId = id ?? currentUser?.id;
  const availableTabs = useMemo(() => (isOwner ? ['Saved', 'Patches', 'Orders'] : ['Patches']), [isOwner]);
  const [activeTab, setActiveTab] = useState<string>(isOwner ? 'Saved' : 'Patches');
  const [ordersSelection, setOrdersSelection] = useState<OrdersPanelSelection | null>(null);

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

      try {
        if (mounted) {
          setLoading(true);
          setError(null);
        }

        const endpoint = isOwner ? '/users/me/profile' : `/users/${profileId}/profile/public`;
        const response = await apiClient.get(endpoint);
        const normalized = normalizeProfile(response.data);
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
  }, [profileId, isOwner, currentUser]);

  const loadSizeFit = useCallback(async () => {
    if (!isOwner) return;
    setSizeFitLoading(true);
    try {
      const [profileData, shareData] = await Promise.all([SizeFitApi.getMyProfile(), SizeFitApi.getShares()]);
      setSizeFitProfile(profileData);
      setSizeFitShares(shareData);
    } catch (err) {
      console.error('Failed to load size fit profile', err);
      toast.error('Unable to load custom size/fits right now.');
    } finally {
      setSizeFitLoading(false);
    }
  }, [isOwner]);

  useEffect(() => {
    if (!isOwner) return;
    void loadSizeFit();
  }, [isOwner, loadSizeFit]);

  useEffect(() => {
    let active = true;
    if (!isOwner) return;

    const loadChartProfile = async () => {
      setChartLoading(true);
      try {
        const preference = await customOrdersBuyerApi.getDisplayChartPreference();
        if (!active) return;
        setDisplayChartFamily(preference.displayChartFamily);
      } catch (err) {
        if (active) {
          setComputedSize(null);
          setComputedGuidance(null);
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
  }, [isOwner]);

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
    setComputedGuidance(recommendation.conversionGuidance);
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
        const response = await apiClient.patch(`/auth/update-profile/${profile.id}`, {
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
    [dispatch, isOwner, profile],
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
        toast.success('Size fitting profile updated.');
      } catch (err) {
        console.error('Failed to update size fitting profile', err);
        toast.error('Failed to update custom size/fits.');
      } finally {
        setSizeFitSaving(false);
      }
    },
    [],
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
        toast.success('Size fitting permissions updated.');
      } catch (err) {
        console.error('Failed to update size fitting settings', err);
        toast.error('Failed to update permissions.');
      } finally {
        setSizeFitSaving(false);
      }
    },
    [],
  );

  const handleShareSizeFit = useCallback(
    async (payload: { targetUserId: string; canReshare?: boolean; note?: string }) => {
      setSizeFitSaving(true);
      try {
        const result = await SizeFitApi.share(payload);
        toast.success(result.requiresApproval ? 'Share request sent for approval.' : 'Size fitting profile shared.');
        await loadSizeFit();
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
        await loadSizeFit();
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
        await customOrdersBuyerApi.updateDisplayChartPreference({
          displayChartFamily: next,
          updatedAtMs: Date.now(),
        });
        toast.success('Display chart updated.');
      } catch (err) {
        console.error('Failed to save display chart preference', err);
        toast.error('Could not save display chart preference.');
      } finally {
        setChartSaving(false);
      }
    },
    [displayChartFamily],
  );

  const handleTriggerAvatarUpload = useCallback(() => {
    avatarInputRef.current?.click();
  }, []);

  const handleAvatarSelected: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    async (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file || !currentUser) return;

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

        setProfile((prev) =>
          prev
            ? {
                ...prev,
                profileImage: nextImage ?? undefined,
                profileImageId: nextImageId,
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
    [currentUser, dispatch],
  );

  const handleRemoveAvatar = useCallback(async () => {
    if (!currentUser) return;
    setAvatarUploading(true);
    try {
      await apiClient.delete('/uploads/profile-image');

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              profileImage: undefined,
              profileImageId: null,
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
          profileImageFile: null,
        }),
      );

      toast.success('Profile image removed.');
    } catch (err) {
      console.error('Failed to remove profile image', err);
      toast.error('Unable to remove profile image right now.');
    } finally {
      setAvatarUploading(false);
    }
  }, [currentUser, dispatch]);

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="max-w-screen-xl mx-auto space-y-6">
          <div className="animate-pulse">
            <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-2xl mb-6" />
            <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <div className="h-24 w-24 rounded-3xl bg-gray-200 dark:bg-gray-700" />
              <div className="flex-1 space-y-2">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-4 sm:p-6">
        <div className="max-w-screen-xl mx-auto text-center py-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Profile Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400">
            {error || 'The requested profile could not be found.'}
          </p>
        </div>
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
  const alphaFitLabel = describeAlphaFit(computedAlphaSize);
  const tabs = availableTabs.map((tab) => ({
    key: tab,
    icon: tab === 'Saved' ? '🗂️' : '🪡',
  }));
  const profileActions: ProfileAction[] = [
    {
      key: 'edit',
      icon: '\u270F\uFE0F',
      label: 'Edit',
      onClick: () => setIsQuickEditOpen(true),
    },
    {
      key: 'share',
      icon: '\uD83D\uDD17',
      label: 'Share',
      onClick: handleShareProfile,
    },
    {
      key: 'fits',
      icon: '\uD83D\uDCCF',
      label: 'Custom Fits',
      onClick: () => setIsSizeFitOpen(true),
    },
    {
      key: 'quick-share',
      icon: '\u2197\uFE0F',
      label: 'Quick Share',
      onClick: () => setIsQuickShareOpen(true),
    },
    {
      key: 'qr',
      icon: '\uD83D\uDDF3',
      label: 'QR Code',
      onClick: () => setIsQrOpen(true),
    },
    {
      key: 'update-fits',
      icon: '\u26A0\uFE0F',
      label: 'Update Fits',
      onClick: () => setIsReminderDialogOpen(true),
      pulse: true,
      hidden: !sizeFitProfile?.isUpdateDue,
    },
  ];

  return (
    <div className="relative p-3 sm:p-5 lg:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-gradient-to-b from-fuchsia-500/10 via-indigo-500/5 to-transparent dark:from-fuchsia-400/10 dark:via-purple-500/10" />
      <div className="mx-auto w-full max-w-[1280px]">
        <section className="rounded-[2rem] p-4 sm:p-6">
          <div className="flex flex-col gap-5">
            {/* Profile info row: avatar + name on left, computed size on right */}
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
                <div className="relative h-32 w-32 shrink-0 rounded-xl bg-white/70 p-1 shadow-sm dark:bg-white/5 sm:h-36 sm:w-36">
                  <ImageWithFallback
                    src={avatar.src}
                    fileId={avatar.fileId}
                    alt={fullName}
                    fit="cover"
                    rounded="xl"
                    fallbackName={avatarFallback}
                    containerClassName="h-full w-full"
                    className="h-full w-full rounded-lg object-cover"
                    maxHeightClassName="max-h-full"
                  />
                  {avatarUploading ? (
                    <div className="absolute inset-1 flex items-center justify-center rounded-lg bg-black/55">
                      <div className="rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900">
                        Uploading image...
                      </div>
                    </div>
                  ) : null}
                  {isOwner ? (
                    <button
                      type="button"
                      onClick={handleTriggerAvatarUpload}
                      disabled={avatarUploading}
                      className="absolute bottom-2 right-2 rounded-full bg-white/95 px-3 py-2 text-sm font-semibold leading-none shadow-sm transition hover:scale-105 disabled:opacity-60 dark:bg-zinc-900"
                      title="Upload profile image"
                    >
                      ✏️
                    </button>
                  ) : (
                    <div className="absolute bottom-2 right-2 rounded-full bg-white/95 px-3 py-2 text-xs font-semibold leading-none shadow-sm dark:bg-zinc-900">
                      {profile.profileVisibility === 'LOCKED' ? '🔒' : '🌐'}
                    </div>
                  )}
                  {isOwner ? (
                    <div className="absolute left-2 top-2 flex items-center gap-1">
                      {avatar.src ? (
                        <button
                          type="button"
                          onClick={() => void handleRemoveAvatar()}
                          disabled={avatarUploading}
                          className="rounded-full bg-white/95 px-3 py-2 text-xs font-semibold leading-none shadow-sm dark:bg-zinc-900"
                          title="Remove profile image"
                        >
                          🗑️
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="min-w-0 max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="truncate text-2xl font-black tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                      {fullName}
                    </h1>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium italic text-gray-500 dark:text-gray-400 sm:text-base">
                    @{profile.username}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
                    {profile.location ? <span>{profile.location}</span> : null}
                    {profile.location ? (joinLabel ? <span className="h-1.5 w-1.5 rounded-full bg-gray-400/80 dark:bg-gray-500" /> : null) : null}
                    {joinLabel ? <span>{joinLabel}</span> : null}
                  </div>
                  {isOwner ? (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <div className="rounded-full border border-emerald-300/60 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                        {avatarUploading ? 'Uploading your new profile image now.' : 'Profile photo updates appear here immediately.'}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Computed size — displayed parallel to profile image on desktop */}
              {isOwner ? (
                <div className="w-full max-w-sm shrink-0 lg:max-w-xs">
                  {/* Minimal chart tabs */}
                  <div className="mb-3 inline-flex flex-wrap gap-1 rounded-2xl bg-gray-100/70 p-1 dark:bg-white/5">
                    {DISPLAY_CHART_OPTIONS.map((option) => {
                      const active = displayChartFamily === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => void handleDisplayChartChange(option.value)}
                          disabled={chartSaving}
                          className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition sm:text-xs ${
                            active
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-gray-500 hover:text-gray-800 hover:bg-white dark:text-gray-400 dark:hover:text-white dark:hover:bg-zinc-800'
                          }`}
                          aria-pressed={active}
                        >
                          {option.label
                            .replace('Nigeria', 'NG')
                            .replace('UK-Nigeria Hybrid', 'UK-NG')
                            .replace('US-Nigeria Hybrid', 'US-NG')}
                        </button>
                      );
                    })}
                  </div>
                  {/* Computed size display */}
                  <div className="rounded-2xl border border-indigo-200/70 bg-indigo-50/70 p-4 dark:border-indigo-500/20 dark:bg-indigo-500/10">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500/80 dark:text-indigo-300/80">Computed size</div>
                    <div className="mt-1 text-2xl font-black text-indigo-950 dark:text-indigo-100 sm:text-3xl">
                      {chartLoading ? 'Loading…' : computedSize || '—'}
                    </div>
                    <div className="mt-3 rounded-xl bg-white/80 px-3 py-2.5 dark:bg-slate-950/40">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-500/70 dark:text-indigo-300/70">
                        Alpha fit
                      </div>
                      <div className="mt-0.5 text-lg font-bold text-indigo-900 dark:text-indigo-100">
                        {alphaFitLabel ?? 'Not available yet'}
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-indigo-900/75 dark:text-indigo-200/80">
                      {computedGuidance || 'Computed from your live measurement profile.'}
                    </div>
                    {sizeFitProfile?.missingBaselineKeys?.length ? (
                      <div className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-500/10 dark:text-amber-100">
                        Update: {sizeFitProfile.missingBaselineKeys
                          .map((key) => key.replace(/^WOMEN_|^MEN_|^UNISEX_/g, '').replace(/_/g, ' '))
                          .join(', ')}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            {isOwner ? (
              <ProfileActionsBar actions={profileActions} />
            ) : null}

            <div className="mt-2 flex items-center gap-4 overflow-x-auto scrollbar-hide px-1 sm:gap-8">
              {tabs.map(({ key }) => {
                const active = activeTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={`inline-flex items-center gap-2 pb-3.5 text-sm font-semibold transition-colors sm:text-base ${
                      active
                        ? 'border-b-2 border-fuchsia-500 text-gray-900 dark:text-white'
                        : 'border-b-2 border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                    }`}
                  >
                    <span className="leading-none">
                      {key === 'Saved' ? '🗂️' : key === 'Orders' ? '📦' : '🪡'}
                    </span>
                    <span className="whitespace-nowrap">{key}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {activeTab === 'Orders' && isOwner ? (
          <div className="mt-6">
            <OrdersPanel
              mode="full"
              initialSelection={ordersSelection}
              onSelectionHandled={() => setOrdersSelection(null)}
            />
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div>
              {activeTab === 'Saved' ? (
                isOwner ? <SavedTab isOwner={isOwner} /> : <PatchesTab isOwner={isOwner} profileVisibility={profile.profileVisibility} />
              ) : (
                <PatchesTab isOwner={isOwner} profileVisibility={profile.profileVisibility} />
              )}
            </div>
            {isOwner ? (
              <OrdersPanel
                onViewAll={(selection) => {
                  setOrdersSelection(selection ?? null);
                  setActiveTab('Orders');
                }}
              />
            ) : null}
          </div>
        )}
      </div>

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

      {isReminderDialogOpen ? (
        <OverlayPortal>
          <div className="fixed inset-0 z-layer-modal flex items-center justify-center p-4">
            <button
              type="button"
              className="absolute inset-0 z-0 bg-black/55 backdrop-blur-sm"
              onClick={() => setIsReminderDialogOpen(false)}
              aria-label="Close reminder details"
            />
            <section className="relative z-10 w-full max-w-md rounded-3xl border border-white/40 dark:border-white/10 bg-[color:var(--surface-primary)]/95 dark:bg-zinc-900/95 shadow-2xl p-5">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">{'\u26A0\uFE0F'} Size/Fit Update Reminder
              </h3>
              <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                Keep your size/fits current every {sizeFitProfile?.requireUpdateEveryDays ?? 14} days.
                Your latest fitting values are attached to new orders so fulfillment stays accurate.
              </p>
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsReminderDialogOpen(false)}
                  className="rounded-xl border border-gray-300/80 dark:border-white/20 px-3 py-2 text-xs font-semibold"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsReminderDialogOpen(false);
                    setIsSizeFitOpen(true);
                  }}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-xs font-semibold"
                >
                  Open Fits
                </button>
              </div>
            </section>
          </div>
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
