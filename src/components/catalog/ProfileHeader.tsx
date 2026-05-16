import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Tag from '@/components/ui/Tag';
import { getTagColor } from '@/utils/tagColors';
import AvatarCard from '../profile/AvatarCard';
import VLoader from '../loaders/VLoader';
import ImageWithFallback from '../ImageWithFallback';

interface ProfileHeaderProps {
  profile: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    profileImage?: string | null;
    profileImageFileId?: string | null;
    bannerImage?: string | null;
    bannerImageFileId?: string | null;
    address?: string;
    location?: string;
    verificationBadgeVisible?: boolean;
    isVerifiedBrand?: boolean;
    verifiedExplanationUrl?: string;
    tags?: string[];
    description?: string;
    isOwner: boolean;
    profileVisibility: 'UNLOCKED' | 'LOCKED';
  };
  onEditAvatar?: () => void;
  onEditBanner?: () => void;
  onViewAvatar?: () => void;
  avatarLoading?: boolean;
  bannerLoading?: boolean;
  avatarHighlight?: boolean;
  showPatchAction?: boolean;
  isPatched?: boolean;
  patchLoading?: boolean;
  onTogglePatch?: () => void;
  showBanner?: boolean;
  canEdit?: boolean;
  onEditProfile?: () => void;
  onShareProfile?: () => void;
  onShowQrCode?: () => void;
}

const ProfileHeaderComponent: React.FC<ProfileHeaderProps> = ({
  profile,
  onEditAvatar,
  onEditBanner,
  onViewAvatar,
  avatarLoading = false,
  bannerLoading = false,
  avatarHighlight = false,
  showPatchAction = false,
  isPatched = false,
  patchLoading = false,
  onTogglePatch,
  showBanner = true,
  canEdit = false,
  onEditProfile,
  onShareProfile,
  onShowQrCode,
}) => {
  const location = useLocation();
  const hasBannerImage = showBanner && Boolean(profile.bannerImage || profile.bannerImageFileId);
  const profileName = `${profile.firstName} ${profile.lastName}`.trim();
  const bannerLabel = (profile.username ? `@${profile.username}` : profileName).trim() || 'Your Profile';

  // Only show the external spinner for explicit upload operations — ImageWithFallback
  // handles the image-load shimmer internally (including signed URL resolution for S3).
  const showBannerLoader = showBanner && bannerLoading;

  const tags: string[] = Array.isArray(profile.tags)
    ? profile.tags
        .map((tag) => String(tag || '').trim())
        .filter(Boolean)
    : [];

  // Split tags into rows of 3 so we always display max 3 tags per row
  const tagRows: string[][] = [];
  for (let i = 0; i < tags.length; i += 3) {
    tagRows.push(tags.slice(i, i + 3));
  }
  return (
    <div className="w-full">
      {showBanner ? (
        <div className="relative rounded-3xl">
          {hasBannerImage ? (
            /* ImageWithFallback resolves signed S3 URLs, shows a shimmer while loading,
               and degrades gracefully on error — no manual error/loading state needed. */
            <ImageWithFallback
              src={profile.bannerImage}
              fileId={profile.bannerImageFileId}
              alt={`${profile.firstName} ${profile.lastName} banner`}
              fit="cover"
              containerClassName="w-full h-64 rounded-3xl overflow-hidden"
              rounded="none"
              maxHeightClassName="max-h-64"
            />
          ) : (
            <div className="flex h-64 items-center justify-center overflow-hidden rounded-3xl bg-slate-900 px-6 text-center">
              <div>
                <div className="text-sm font-semibold tracking-wide text-white/80 sm:text-base">
                  {bannerLabel}
                </div>
                <div className="mt-1 text-xs text-white/55 sm:text-sm">
                  {profile.isOwner
                    ? 'Add a banner from profile actions'
                    : 'No banner added'}
                </div>
              </div>
            </div>
          )}

          {showBannerLoader && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
              <VLoader size={72} />
            </div>
          )}

          {/* Show privacy indicator if profile is locked */}
          {profile.profileVisibility === 'LOCKED' && (
            <div className="absolute top-4 right-4 z-30">
              <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center">
                <span className="mr-1" aria-hidden="true">🔒</span>
                <span>Private</span>
              </div>
            </div>
          )}

          {/* Move only the edit banner button to the top-left */}
          {profile.isOwner && onEditBanner ? (
            <div className="absolute top-3 left-3 z-30">
              {/* Enlarge the hit target via a padded container while keeping visual button compact */}
              <div className="p-2 rounded-xl hover:bg-white/20 focus-within:ring-2 focus-within:ring-purple-300">
                <label
                  htmlFor="banner-file-input"
                  title="Change banner image"
                  onClick={(e) => {
                    if (bannerLoading) {
                      e.preventDefault();
                      e.stopPropagation();
                      return;
                    }
                    // Prevent default to avoid double-firing if htmlFor is also working.
                    e.preventDefault();
                    onEditBanner?.();
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (bannerLoading) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onEditBanner?.();
                    }
                  }}
                  className={
                    `cursor-pointer rounded-full bg-white/90 px-5 py-2 text-xs font-semibold uppercase tracking-wide text-gray-800 shadow-lg transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 dark:bg-gray-900/85 dark:text-gray-100 ` +
                    (bannerLoading ? 'pointer-events-none opacity-70' : '')
                  }
                  aria-disabled={bannerLoading}
                >
                  {bannerLoading ? 'Updating...' : 'Edit banner'}
                </label>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* FIX #4: Reduced negative margin from -mt-24/-mt-28 to -mt-16/-mt-20 */}
      <div className={showBanner ? '-mt-16 px-4 sm:-mt-20 sm:px-6' : 'mt-2 px-4 sm:px-6'}>
        <div className="relative z-20 flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="flex-shrink-0">
            <div
              className={`rounded-xl border-2 shadow-lg transition-colors duration-300 ${
                !showBanner
                  ? 'border-transparent shadow-none ring-0'
                  : avatarHighlight
                  ? 'border-emerald-400 ring-2 ring-emerald-200/70'
                  : 'border-gray-400 ring-1 ring-black/10 dark:border-gray-900'
              }`}
            >
              <AvatarCard
                src={profile.profileImage}
                fileId={profile.profileImageFileId}
                name={`${profile.firstName} ${profile.lastName}`}
                alt={`${profile.firstName} ${profile.lastName}`}
                size="lg"
                editable={profile.isOwner && Boolean(onEditAvatar)}
                onEdit={onEditAvatar}
                loading={avatarLoading}
                fallbackInitials={(profile.username ? profile.username[0] : (profile.firstName?.[0] || profile.lastName?.[0])) ?? 'U'}
                onClick={onViewAvatar}
                className={onViewAvatar ? 'transition-transform duration-200 hover:scale-[1.01]' : ''}
              />
            </div>
          </div>

          <div className={`mt-4 flex flex-1 flex-col gap-2 sm:mt-2 ${showBanner ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
            <h1
              className={`flex flex-wrap items-center gap-2 font-semibold italic tracking-[0.08em] leading-tight ${
                showBanner ? 'text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]' : 'text-gray-900 dark:text-white'
              }`}
              style={{ fontSize: 'clamp(1rem, 3vw, 1.5rem)' }}
            >
              {profile.firstName} {profile.lastName}
              <Link
                to={profile.verifiedExplanationUrl || '/help/verified-badge'}
                state={{
                  from:
                    `${location.pathname}${location.search}${location.hash}` ||
                    '/studio/store',
                }}
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-wide ${
                  profile.verificationBadgeVisible
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-300 text-slate-900'
                }`}
              >
                {profile.verificationBadgeVisible ? 'Verified' : 'Unverified'}
              </Link>
            </h1>
            <p className={`inline-flex w-fit items-center gap-2 rounded-md px-2 py-1 text-sm font-semibold ${showBanner ? 'bg-black/35 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]' : 'text-gray-700 dark:text-gray-300'}`}>
              <span aria-hidden="true">📍</span>
              <span>{profile.location || profile.address || 'Location not set'}</span>
            </p>
            <span className={`inline-flex w-fit rounded-md px-2 py-1 text-sm font-semibold italic tracking-[0.01em] ${showBanner ? 'bg-black/35 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]' : 'text-indigo-600 dark:text-indigo-300'}`}>
              @{profile.username}
            </span>
            {tags.length > 0 ? (
              <div className="mt-2 flex flex-col gap-2">
                {tagRows.map((row, idx) => (
                  <div key={idx} className="flex gap-2">
                    {row.map((tag) => {
                      const color = getTagColor(tag);
                      return <Tag key={tag} label={`#${tag}`} color={color} size="sm" className="font-bold" />;
                    })}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* FIX #4: Reduced bottom margin from mb-16 to mb-6 */}
          <div className={`flex gap-2 self-end sm:self-end ${showBanner ? 'mb-6' : 'mb-0'}`}>
            {!showBanner && profile.profileVisibility === 'LOCKED' ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-1 text-xs font-bold text-white">
                <span aria-hidden="true">🔒</span>
                Private
              </span>
            ) : null}
            {canEdit && onEditProfile ? (
              <button
                type="button"
                onClick={onEditProfile}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-fuchsia-500 text-lg shadow-lg transition hover:scale-105 hover:bg-fuchsia-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300"
                aria-label="Quick edit profile"
                title="Quick edit"
              >
                <span aria-hidden="true">✏️</span>
              </button>
            ) : null}
            {onShareProfile ? (
              <button
                type="button"
                onClick={onShareProfile}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500 text-lg text-white shadow-lg transition hover:scale-105 hover:bg-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
                aria-label="Share profile"
                title="Share profile"
              >
                <span aria-hidden="true">🔗</span>
              </button>
            ) : null}
            {onShowQrCode ? (
              <button
                type="button"
                onClick={onShowQrCode}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-lg text-gray-900 shadow-lg transition hover:scale-105 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 dark:bg-gray-900/85 dark:text-gray-100"
                aria-label="Show brand QR code"
                title="Show QR code"
              >
                <span aria-hidden="true">▦</span>
              </button>
            ) : null}
            {showPatchAction && onTogglePatch ? (
              <button
                type="button"
                onClick={onTogglePatch}
                disabled={patchLoading}
                className={`group relative inline-flex items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-2 text-xs font-semibold tracking-wide shadow-lg transition ${
                  isPatched
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    : 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-900 hover:bg-fuchsia-100'
                } ${patchLoading ? 'opacity-70 cursor-not-allowed' : 'hover:-translate-y-0.5 active:translate-y-0'}`}
                aria-live="polite"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-sm shadow-sm ring-1 ring-black/5">
                  {isPatched ? '🧵' : '🪡'}
                </span>
                <span>{patchLoading ? 'Updating...' : isPatched ? 'Unpatch' : 'Patch'}</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ProfileHeaderComponent);
