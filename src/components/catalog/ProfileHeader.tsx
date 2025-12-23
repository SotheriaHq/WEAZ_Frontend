import React, { useEffect, useState } from 'react';
import { FiEdit2, FiShare2 } from 'react-icons/fi';
import Tag from '@/components/ui/Tag';
import { IconButton } from '@/components/ui/FrostedButton';
import { getTagColor } from '@/utils/tagColors';
import AvatarCard from '../profile/AvatarCard';
import VLoader from '../loaders/VLoader';
import StoreAccessButton from '../store/StoreAccessButton';

const DummyQRCode = () => (
  <svg viewBox="0 0 100 100" className="h-full w-full object-cover text-gray-800 dark:text-white">
    <path
      d="M0 0h30v30H0zM10 10h10v10H10zM70 0h30v30H70zM80 10h10v10H80zM0 70h30v30H0zM10 80h10v10H10zM40 0h10v10H40zM60 0h10v10H60zM0 40h10v10H0zM0 60h10v10H0zM40 100h10v-10H40zM60 100h10v-10H60zM100 40h-10v10h10zM100 60h-10v10h10zM40 40h30v30H40zM50 50h10v10H50zM70 70h30v30H70zM80 80h10v10H80zM40 70h10v10H40zM60 70h10v10H60zM70 40h10v10H70zM90 40h10v10H90z"
      fill="currentColor"
    />
  </svg>
);

interface ProfileHeaderProps {
  profileData: {
    name: string;
    location: string;
    username?: string;
    avatar: string;
    banner: string;
    tags: string[];
  };
  canEdit?: boolean;
  storeId?: string | null;
  onEditProfile?: () => void;
  onShareProfile?: () => void;
  onEditAvatar?: () => void;
  onEditBanner?: () => void;
  onViewAvatar?: () => void;
  avatarLoading?: boolean;
  bannerLoading?: boolean;
  avatarHighlight?: boolean;
}

const ActionButton: React.FC<{
  Icon: React.ElementType;
  label: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}> = ({ Icon, label, onClick, className = '', disabled = false }) => (
  <IconButton
    icon={<Icon className="h-4 w-4" />}
    aria-label={label}
    variant="ghost"
    size="sm"
    className={className}
    disabled={disabled}
    onClick={onClick}
  />
);

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  profileData,
  canEdit = false,
  storeId,
  onEditProfile,
  onShareProfile,
  onEditAvatar,
  onEditBanner,
  onViewAvatar,
  avatarLoading = false,
  bannerLoading = false,
  avatarHighlight = false,
}) => {
  const [bannerFailed, setBannerFailed] = useState(false);
  const hasBannerImage = Boolean(profileData.banner) && !bannerFailed;
  const bannerLabel =
    (profileData.username ? `@${profileData.username}` : profileData.name || '').trim() || 'Your Brand';

  const [isBannerImageLoading, setIsBannerImageLoading] = useState<boolean>(hasBannerImage);

  useEffect(() => {
    setBannerFailed(false);
    setIsBannerImageLoading(Boolean(profileData.banner));
  }, [profileData.banner]);

  const showBannerLoader = bannerLoading || (Boolean(profileData.banner) && !bannerFailed && isBannerImageLoading);

  // Split tags into rows of 3 so we always display max 3 tags per row
  const tagRows: string[][] = [];
  for (let i = 0; i < (profileData.tags || []).length; i += 3) {
    tagRows.push(profileData.tags.slice(i, i + 3));
  }

  return (
    <div className="w-full">
      <div className="relative h-64 overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950">
        {hasBannerImage ? (
          <>
            <img
              src={profileData.banner}
              alt={`${profileData.name} banner blurred`}
              className="absolute inset-0 h-full w-full object-cover opacity-30 blur-2xl"
              aria-hidden
              onError={() => {
                setBannerFailed(true);
                setIsBannerImageLoading(false);
              }}
            />
            <img
              src={profileData.banner}
              alt={`${profileData.name} banner`}
              className="absolute inset-0 h-full w-full object-cover object-center"
              onLoad={() => setIsBannerImageLoading(false)}
              onError={() => {
                setBannerFailed(true);
                setIsBannerImageLoading(false);
              }}
            />
          </>
        ) : (
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950" />
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="max-w-3xl w-full rounded-3xl border border-white/15 bg-white/10 backdrop-blur-md shadow-2xl px-6 py-4 text-center">
                <div className="text-white/80 text-sm sm:text-base font-semibold tracking-wide">
                  {bannerLabel}
                </div>
                <div className="mt-1 text-white/60 text-xs sm:text-sm">
                  Showcase your brand story and visuals
                </div>
              </div>
            </div>
          </div>
        )}

        {showBannerLoader && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
            <VLoader size={72} />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/15 pointer-events-none" />

        {/* Keep QR at top-right */}
        <div className="absolute top-4 right-4 z-30">
          <div className="h-48 w-48 rounded-lg bg-white p-2 shadow-xl dark:bg-gray-900">
            <DummyQRCode />
          </div>
        </div>
        {/* Move only the edit banner button to the top-left */}
        {canEdit ? (
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
                {bannerLoading ? 'Updating…' : 'Edit banner'}
              </label>
            </div>
          </div>
        ) : null}
      </div>

      {/* 🔧 FIX #4: Reduced negative margin from -mt-24/-mt-28 to -mt-16/-mt-20 */}
      <div className="-mt-16 px-4 sm:-mt-20 sm:px-6">
        <div className="relative z-20 flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
          <div className="flex-shrink-0">
            <div
              className={`rounded-xl border-4 shadow-2xl transition-colors duration-300 ${
                avatarHighlight
                  ? 'border-emerald-400 ring-2 ring-emerald-200/70'
                  : 'border-gray-400 ring-1 ring-black/10 dark:border-gray-900'
              }`}
            >
              <AvatarCard
                src={profileData.avatar}
                name={profileData.name}
                alt={profileData.name}
                size="lg"
                editable={canEdit && Boolean(onEditAvatar)}
                onEdit={onEditAvatar}
                loading={avatarLoading}
                fallbackInitials={(profileData.username ? profileData.username[0] : profileData.name?.[0]) ?? 'U'}
                onClick={onViewAvatar}
                className={onViewAvatar ? 'transition-transform duration-200 hover:scale-[1.01]' : ''}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-1 flex-col gap-2 text-white sm:mt-2">
            {/* 🔧 FIX #5: Responsive font sizing without truncation */}
            <h1 
              className="font-semibold italic tracking-[0.08em] text-blue-300 drop-shadow-lg leading-tight"
              style={{ fontSize: 'clamp(1rem, 3vw, 1.5rem)' }}
            >
              {profileData.name}
            </h1>
            <p className="flex items-center gap-2 text-sm font-medium text-white/90 drop-shadow-md">
              <span aria-hidden className="text-base leading-none">📍</span>
              <span>{profileData.location}</span>
            </p>
            {profileData.username ? (
              <span className="text-sm font-semibold italic tracking-[0.01em] text-blue-200">
                @{profileData.username}
              </span>
            ) : null}
            {profileData.tags.length > 0 ? (
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

          {/* 🔧 FIX #4: Reduced bottom margin from mb-16 to mb-6 */}
          <div className="flex gap-2 self-end sm:self-end mb-24 ">
            {canEdit && storeId ? <StoreAccessButton hasStore={true} storeId={storeId} /> : null}
            {canEdit ? (
              <ActionButton
                Icon={FiEdit2}
                label="Edit profile"
                onClick={onEditProfile}
                className="text-purple-600 hover:bg-purple-500/10 dark:text-purple-300 dark:hover:bg-purple-500/20"
              />
            ) : null}
            <ActionButton
              Icon={FiShare2}
              label="Share profile"
              onClick={onShareProfile}
              className="text-rose-500 hover:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;
