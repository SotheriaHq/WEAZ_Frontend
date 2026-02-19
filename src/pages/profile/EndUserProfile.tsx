import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useDispatch, useSelector } from 'react-redux';
import { SavedTab } from './tabs/SavedTab';
import { PatchesTab } from './tabs/PatchesTab';
import { OrdersPanel } from './tabs/OrdersPanel';
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

interface UserProfile {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profileImage?: string;
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

  const isOwner = !id || currentUser?.id === id;
  const profileId = id ?? currentUser?.id;
  const availableTabs = useMemo(() => (isOwner ? ['Saved', 'Patches'] : ['Patches']), [isOwner]);
  const [activeTab, setActiveTab] = useState<string>(isOwner ? 'Saved' : 'Patches');

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
    setActiveTab((prev) => (availableTabs.includes(prev) ? prev : availableTabs[0]));
  }, [availableTabs]);

  const handleShareProfile = useCallback(async () => {
    if (!profile) return;
    const url = `${window.location.origin}/profile/${profile.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${profile.firstName} ${profile.lastName}`, url });
        return;
      } catch {
        // fallback below
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Profile link copied.');
    } catch {
      toast.error('Unable to copy profile link.');
    }
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

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="max-w-screen-xl mx-auto space-y-6">
          <div className="animate-pulse">
            <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-2xl mb-6" />
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
              <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-full" />
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

  const profileUrl = `${window.location.origin}/profile/${profile.id}`;
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim() || profile.username;
  const joinLabel = formatJoinLabel(profile.createdAt ?? (isOwner ? currentUser?.createdAt : undefined));
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
        <section className="rounded-[2rem] border border-gray-200/70 bg-white/70 p-4 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-black/20 sm:p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-4 sm:gap-5">
                <div className="relative h-20 w-20 shrink-0 rounded-full border border-white/60 bg-white/60 p-1 shadow-md dark:border-white/15 dark:bg-white/5 sm:h-24 sm:w-24">
                  {profile.profileImage ? (
                    <img
                      src={profile.profileImage}
                      alt={fullName}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/30 to-fuchsia-500/30 text-2xl font-bold text-gray-800 dark:text-white">
                      {(profile.firstName?.charAt(0) || profile.username?.charAt(0) || '?').toUpperCase()}
                    </div>
                  )}
                  <div className="absolute bottom-0 right-0 rounded-full border border-white/60 bg-white/90 p-1 text-[11px] leading-none dark:border-white/20 dark:bg-zinc-900">
                    {profile.profileVisibility === 'LOCKED' ? '🔒' : '🌐'}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="truncate text-2xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                      {fullName}
                    </h1>
                    {isOwner ? (
                      <span className="inline-flex items-center rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-700 dark:text-fuchsia-300">
                        🏷️ Your Profile
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-sm font-medium italic text-gray-500 dark:text-gray-400">
                    @{profile.username}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
                    {profile.location ? <span>📍 {profile.location}</span> : null}
                    {profile.location ? (joinLabel ? <span className="h-1 w-1 rounded-full bg-gray-400/80 dark:bg-gray-500" /> : null) : null}
                    {joinLabel ? <span>{joinLabel}</span> : null}
                  </div>
                </div>
              </div>
            </div>

            {isOwner ? (
              <ProfileActionsBar actions={profileActions} />
            ) : null}

            <div className="mt-2 flex items-center gap-8 border-b border-gray-200/70 px-1 dark:border-white/10">
              {tabs.map(({ key, icon }) => {
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
                    <span>{icon}</span>
                    <span>{key}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            {activeTab === 'Saved' ? (
              isOwner ? <SavedTab isOwner={isOwner} /> : <PatchesTab isOwner={isOwner} profileVisibility={profile.profileVisibility} />
            ) : (
              <PatchesTab isOwner={isOwner} profileVisibility={profile.profileVisibility} />
            )}
          </div>
          {isOwner ? <OrdersPanel /> : null}
        </div>
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

      <EndUserProfileQrModal open={isQrOpen} onClose={() => setIsQrOpen(false)} profileUrl={profileUrl} />

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
    </div>
  );
};
