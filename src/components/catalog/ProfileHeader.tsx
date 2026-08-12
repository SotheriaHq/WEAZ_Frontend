import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import Tag from '@/components/ui/Tag';
import FitText from '@/components/ui/FitText';
import { getTagColor } from '@/utils/tagColors';
import AvatarCard from '../profile/AvatarCard';
import VLoader from '../loaders/VLoader';
import ImageWithFallback from '../ImageWithFallback';
import ThreadActivityIndicator from '../ui/ThreadActivityIndicator';
import { patchButtonColorClasses } from '@/lib/patchPresentation';
import type { ProfilePhotoViewState } from '@/types/profilePhoto';

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
    profilePhotoViewState?: ProfilePhotoViewState | null;
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
  isStoreOpen?: boolean;
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
  isStoreOpen = false,
}) => {
  const location = useLocation();
  const hasBannerImage = showBanner && Boolean(profile.bannerImage || profile.bannerImageFileId);
  const profileName = `${profile.firstName} ${profile.lastName}`.trim();
  const bannerLabel = (profile.username ? `@${profile.username}` : profileName).trim() || 'Your Profile';

  // Only show the external spinner for explicit upload operations — ImageWithFallback
  // handles the image-load shimmer internally (including signed URL resolution for S3).
  const showBannerLoader = showBanner && bannerLoading;
  const hasProfilePhoto = Boolean(profile.profileImage || profile.profileImageFileId);
  const hasPhotoVersion = Boolean(profile.profilePhotoViewState?.profilePhotoUpdatedAt);
  const avatarRingClass =
    showBanner && hasProfilePhoto && hasPhotoVersion
      ? profile.profilePhotoViewState?.hasUnviewedUpdate
        ? 'profile-photo-ring-new'
        : 'profile-photo-ring-viewed'
      : '';

  const tags: string[] = Array.isArray(profile.tags)
    ? profile.tags
        .map((tag) => String(tag || '').trim())
        .filter(Boolean)
    : [];


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
              keepPreviousOnReload
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

      {/* The avatar (size="lg") scales across breakpoints (115px → 144 → 176 → 208px),
          so the overlap pull-up must scale WITH it — otherwise on wide screens the giant
          avatar overhangs the banner while the identity text stays put and floats high.
          Overlap stays ~half the avatar height at every width; see the matching text offset below. */}
      <div className={showBanner ? '-mt-14 px-4 sm:-mt-20 sm:px-6 md:-mt-24 lg:-mt-28' : 'mt-2 px-4 sm:px-6'}>
        {/* NOTE: this project's Tailwind breakpoints are CUSTOM (sm=480, md=640, lg=768,
            xl=1024). The action buttons join the header row only at md (640px+): at
            sm (480-640) the row must stay stacked, otherwise avatar(144) + buttons(~136)
            + paddings leave the identity text ~79px and every word wraps to its own line. */}
        <div className="relative z-20 flex flex-col gap-4 p-4 md:flex-row md:items-start md:justify-between sm:px-6">
          {/* Avatar + identity stay on one row even on mobile (matches native app) */}
          <div className="flex min-w-0 flex-1 flex-row items-start gap-4">
          <div className="flex-shrink-0">
            <div
              className={`rounded-xl border-2 transition-colors duration-300 ${
                !showBanner
                  ? 'border-transparent shadow-none ring-0'
                  : avatarRingClass || (avatarHighlight ? 'profile-photo-ring-new' : 'border-transparent shadow-none')
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
                onClick={onViewAvatar}
                className={onViewAvatar ? 'transition-transform duration-200 hover:scale-[1.01]' : ''}
              />
            </div>
          </div>

          {/* The name's BOTTOM edge must rest ON the banner's bottom border. Derivation
              (custom breakpoints sm=480/md=640/lg=768):
                identityTop = bannerBottom - pullUp + rowPadding(16)
                mt          = pullUp - 16 - nameLineHeight
              pullUp per bp: 56 / 80 / 96 / 112 (matches -mt-14/-mt-20/-mt-24/-mt-28 above)
              name line-height (clamp font * leading-tight): ~20 / ~22 / ~27 / 30
              => mt: 20 / 42 / 53 / 66 px. These arbitrary values ARE the tuning knobs. */}
          <div className={`flex min-w-0 flex-1 flex-col gap-1 ${showBanner ? 'mt-[20px] sm:mt-[42px] md:mt-[53px] lg:mt-[66px]' : ''} ${showBanner ? '' : 'text-gray-900 dark:text-white'}`}>
            {/* NAME + BADGES: one line, always. flex-nowrap keeps the badges
                glued beside the name; FitText scales the name down to fit the
                remaining width instead of wrapping or truncating. */}
            <h1
              className={`flex flex-nowrap items-center gap-1.5 font-semibold italic tracking-[0.08em] leading-tight ${
                showBanner ? 'text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]' : 'text-gray-900 dark:text-white'
              }`}
            >
              <FitText
                text={profileName}
                maxPx={24}
                minPx={12}
                className="font-semibold italic tracking-[0.08em] leading-tight"
              />
              {/* Positive-state badges only; NEVER an unverified badge.
                  All three are SEALS, distinguished by colour + mark:
                  Purple = verified · Gold = subscribed · Green = open store. */}
              <span className="inline-flex flex-shrink-0 items-center gap-1 align-middle not-italic">
              {(profile as any).isSubscribed ? (
                <Link
                  to="/help/subscribed"
                  title="Subscribed"
                  className="inline-flex items-center"
                >
                  <svg className="w-[23px] h-[23px] flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.99-3.818-3.99-.48 0-.941.1-1.356.278C14.774 2.525 13.5 1.5 12 1.5s-2.774 1.025-3.416 2.288C8.17 3.6 7.708 3.5 7.23 3.5 5.12 3.5 3.41 5.28 3.41 7.49c0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.58.875 2.95 2.148 3.6-.154.435-.238.905-.238 1.4 0 2.21 1.71 3.99 3.818 3.99.48 0 .941-.1 1.356-.278C9.226 21.475 10.5 22.5 12 22.5s2.774-1.025 3.416-2.288c.415.178.876.278 1.356.278 2.108 0 3.818-1.78 3.818-3.99 0-.495-.084-.965-.238-1.4 1.273-.65 2.148-2.02 2.148-3.6z" fill="var(--brand-accent, #d4af37)" />
                    <path d="M9.7 16.1l-3.2-3.2 1.4-1.4 1.8 1.8 5.8-5.8 1.4 1.4-7.2 7.2z" fill="#0d0d0d" />
                  </svg>
                </Link>
              ) : null}
              {profile.verificationBadgeVisible ? (
                <Link
                  to={profile.verifiedExplanationUrl || '/help/verified-badge'}
                  state={{
                    from:
                      `${location.pathname}${location.search}${location.hash}` ||
                      '/studio/store',
                  }}
                  title="Verified brand"
                  className="inline-flex items-center"
                >
                  <svg className="w-[23px] h-[23px] flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.99-3.818-3.99-.48 0-.941.1-1.356.278C14.774 2.525 13.5 1.5 12 1.5s-2.774 1.025-3.416 2.288C8.17 3.6 7.708 3.5 7.23 3.5 5.12 3.5 3.41 5.28 3.41 7.49c0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.58.875 2.95 2.148 3.6-.154.435-.238.905-.238 1.4 0 2.21 1.71 3.99 3.818 3.99.48 0 .941-.1 1.356-.278C9.226 21.475 10.5 22.5 12 22.5s2.774-1.025 3.416-2.288c.415.178.876.278 1.356.278 2.108 0 3.818-1.78 3.818-3.99 0-.495-.084-.965-.238-1.4 1.273-.65 2.148-2.02 2.148-3.6z" fill="var(--brand-primary, #9333ea)" />
                    <path d="M9.7 16.1l-3.2-3.2 1.4-1.4 1.8 1.8 5.8-5.8 1.4 1.4-7.2 7.2z" fill="white" />
                  </svg>
                </Link>
              ) : null}
              {isStoreOpen ? (
                /* Same scalloped seal as verified and subscribed — badges are
                   seals, without exception.
                   What changed is what is INSIDE it. This carried a 9px 🏪
                   emoji on a grey seal: at that size the emoji is an
                   indistinct smudge, and grey reads as "inactive", which is
                   the opposite of what an open store means. The mark is now a
                   drawn storefront — awning, door, windows — at full seal
                   scale like the other two checkmarks, on emerald so the three
                   seals are told apart by colour at a glance:
                   purple = verified · gold = subscribed · green = open store. */
                <span
                  title="Store open — this brand is taking orders"
                  aria-label="Store open"
                  className="relative inline-flex h-[23px] w-[23px] flex-shrink-0 items-center justify-center align-middle not-italic"
                >
                  <svg
                    className="absolute inset-0 h-full w-full drop-shadow-sm"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.99-3.818-3.99-.48 0-.941.1-1.356.278C14.774 2.525 13.5 1.5 12 1.5s-2.774 1.025-3.416 2.288C8.17 3.6 7.708 3.5 7.23 3.5 5.12 3.5 3.41 5.28 3.41 7.49c0 .495.084.965.238 1.4-1.273.65-2.148 2.02-2.148 3.6 0 1.58.875 2.95 2.148 3.6-.154.435-.238.905-.238 1.4 0 2.21 1.71 3.99 3.818 3.99.48 0 .941-.1 1.356-.278C9.226 21.475 10.5 22.5 12 22.5s2.774-1.025 3.416-2.288c.415.178.876.278 1.356.278 2.108 0 3.818-1.78 3.818-3.99 0-.495-.084-.965-.238-1.4 1.273-.65 2.148-2.02 2.148-3.6z" fill="#059669" />
                    {/* Storefront: awning, fascia, doorway. Drawn rather than
                        typeset so it stays crisp at 23px. */}
                    <path
                      d="M7 8.4h10l.9 2.1a1.55 1.55 0 0 1-2.95.75 1.55 1.55 0 0 1-2.95 0 1.55 1.55 0 0 1-2.95 0 1.55 1.55 0 0 1-2.95-.75L7 8.4z"
                      fill="#ffffff"
                    />
                    <path
                      d="M8 12.4v4.2h8v-4.2"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path d="M10.6 16.6v-2.5h2.8v2.5z" fill="#059669" />
                  </svg>
                </span>
              ) : null}
              </span>
            </h1>
            {/* LOCATION + @username + tags — public identity (visitors + owners). */}
            {(profile.location || profile.address) ? (
              <p className={`flex w-full min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 font-semibold text-gray-700 dark:text-gray-300`}>
                <span aria-hidden="true" className="flex-shrink-0 text-sm">📍</span>
                <FitText
                  text={(profile.location || profile.address || '').trim()}
                  maxPx={14}
                  minPx={9}
                  className="font-semibold"
                />
              </p>
            ) : null}
            {profile.username?.trim() ? (
              <span className={`inline-flex w-fit rounded-md px-1 py-0.5 text-sm font-semibold italic tracking-[0.01em] text-indigo-600 dark:text-indigo-300`}>
                @{profile.username.trim().replace(/^@+/, '')}
              </span>
            ) : null}
            {tags.length > 0 ? (
              // STRICT 3-up: a real grid (grid-cols-3), not flex-wrap — wrap
              // layouts drop chips to 2/1 rows on narrow widths, a grid cannot.
              // w-fit + auto-sized columns: the grid hugs its content so chips
              // keep their natural pill width on wide screens (chips must LOOK
              // like chips). On narrow widths max-w-full clamps the columns and
              // FitText scales each label down — full text, never truncated.
              // Long tag lists stay compact: capped at ~5 rows (15 tags tall),
              // the rest scroll inline with no border and no visible scrollbar.
              <div className="mt-2 grid w-fit max-w-full grid-cols-[repeat(3,minmax(0,auto))] justify-items-start gap-1 max-h-[8.5rem] overflow-y-auto scrollbar-hide">
                {tags.map((tag) => {
                  const color = getTagColor(tag);
                  return (
                    <Tag
                      key={tag}
                      // FitText: tag text SCALES DOWN to fit its cell — full
                      // text always visible, never clipped or truncated.
                      label={<FitText text={`#${tag}`} maxPx={11} minPx={7} className="font-bold" />}
                      color={color}
                      size="xs"
                      className="max-w-full min-w-0"
                    />
                  );
                })}
              </div>
            ) : null}
          </div>
          </div>

          {/* FIX #4: Reduced bottom margin from mb-16 to mb-6 */}
          <div className={`flex flex-shrink-0 gap-2 self-end sm:self-end ${showBanner ? 'mb-6' : 'mb-0'}`}>
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
                className={`group relative inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-semibold tracking-wide shadow-lg transition ${patchButtonColorClasses(
                  isPatched,
                )} ${patchLoading ? 'opacity-70 cursor-not-allowed' : 'hover:-translate-y-0.5 active:translate-y-0'}`}
                aria-live="polite"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/80 text-sm shadow-sm ring-1 ring-black/5">
                  <ThreadActivityIndicator active={isPatched} size={18} state={patchLoading ? 'pending' : 'idle'} />
                </span>
                <span>{patchLoading ? 'Updating…' : isPatched ? 'Patched' : 'Patch'}</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ProfileHeaderComponent);
