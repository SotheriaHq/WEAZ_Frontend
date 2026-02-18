import React, { useEffect, useState } from 'react';
import Tag from '@/components/ui/Tag';
import { getTagColor } from '@/utils/tagColors';
import AvatarCard from '../profile/AvatarCard';
import VLoader from '../loaders/VLoader';
import MediaRenderer from '../media/MediaRenderer';
import { Lock, MapPin } from 'lucide-react';

interface ProfileHeaderProps {
  profile: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    profileImage?: string;
    bannerImage?: string;
    address?: string;
    location?: string;
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
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
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
}) => {
  const [bannerFailed, setBannerFailed] = useState(false);
  const hasBannerImage = showBanner && Boolean(profile.bannerImage) && !bannerFailed;
  const bannerLabel =
    (profile.username ? `@${profile.username}` : `${profile.firstName} ${profile.lastName}` || '').trim() || 'Your Profile';

  const [isBannerImageLoading, setIsBannerImageLoading] = useState<boolean>(hasBannerImage);

  useEffect(() => {
    setBannerFailed(false);
    setIsBannerImageLoading(showBanner && Boolean(profile.bannerImage));
  }, [profile.bannerImage, showBanner]);

  const showBannerLoader =
    showBanner && (bannerLoading || (Boolean(profile.bannerImage) && !bannerFailed && isBannerImageLoading));

  // For end users, we don't show tags
  const tags: string[] = []; // End users don't have tags in this implementation

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
            <MediaRenderer
              kind="image"
              src={profile.bannerImage ?? ''}
              alt={`${profile.firstName} ${profile.lastName} banner`}
              fit="cover"
              className="w-full h-64 rounded-3xl overflow-hidden"
              maxHeightClassName="max-h-64"
              maxWidthClassName="max-w-full"
              mediaClassName="w-full h-full object-cover"
              onLoad={() => setIsBannerImageLoading(false)}
              onError={() => {
                setBannerFailed(true);
                setIsBannerImageLoading(false);
              }}
            />
          ) : (
            <div className="h-64 rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center p-6">
                <div className="max-w-3xl w-full rounded-3xl border border-white/15 bg-white/10 backdrop-blur-md shadow-2xl px-6 py-4 text-center">
                  <div className="text-white/80 text-sm sm:text-base font-semibold tracking-wide">
                    {bannerLabel}
                  </div>
                  <div className="mt-1 text-white/60 text-xs sm:text-sm">
                    {profile.isOwner
                      ? 'Personalize your profile with a banner'
                      : 'This user has not set a banner'}
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
                <Lock className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
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
              className={`rounded-xl border-4 shadow-2xl transition-colors duration-300 ${
                !showBanner
                  ? 'border-transparent shadow-none ring-0'
                  : avatarHighlight
                  ? 'border-emerald-400 ring-2 ring-emerald-200/70'
                  : 'border-gray-400 ring-1 ring-black/10 dark:border-gray-900'
              }`}
            >
              <AvatarCard
                src={profile.profileImage}
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
            {/* FIX #5: Responsive font sizing without truncation */}
            <h1
              className={`font-semibold italic tracking-[0.08em] leading-tight ${
                showBanner ? 'text-blue-300 drop-shadow-lg' : 'text-gray-900 dark:text-white'
              }`}
              style={{ fontSize: 'clamp(1rem, 3vw, 1.5rem)' }}
            >
              {profile.firstName} {profile.lastName}
            </h1>
            <p className={`flex items-center gap-2 text-sm font-medium ${showBanner ? 'text-white/90 drop-shadow-md' : 'text-gray-600 dark:text-gray-300'}`}>
              <MapPin className={`h-4 w-4 ${showBanner ? 'text-white/90' : 'text-gray-500 dark:text-gray-300'}`} aria-hidden="true" />
              <span>{profile.location || profile.address || 'Location not set'}</span>
            </p>
            <span className={`text-sm font-semibold italic tracking-[0.01em] ${showBanner ? 'text-blue-200' : 'text-indigo-500 dark:text-indigo-300'}`}>
              @{profile.username}
            </span>
            {tags.length > 0 ? (
              <div className="mt-2 flex flex-col gap-2">
                {tagRows.map((row, idx) => (
                  <div key={idx} className="flex gap-2">
                    {row.map((tag) => {
                      const color = getTagColor(tag);
                      return <Tag key={tag} label={`#${tag}`} color={color} size="sm" />;
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
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                Private
              </span>
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

export default ProfileHeader;
