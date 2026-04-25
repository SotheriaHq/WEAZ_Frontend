type ProfileImageFile = {
  id?: string | null;
  fileId?: string | null;
  s3Url?: string | null;
  url?: string | null;
};

export type ProfileImageSource = {
  profileImage?: string | null;
  profileImageId?: string | null;
  profileImageFile?: ProfileImageFile | null;
  brandLogo?: string | null;
  brandLogoFileId?: string | null;
  logo?: string | null;
  logoFileId?: string | null;
  avatarUrl?: string | null;
};

export type ResolvedProfileImage = {
  src: string | null;
  fileId: string | null;
};

export type BannerImageSource = {
  bannerImage?: string | null;
  bannerImageId?: string | null;
  bannerImageFile?: ProfileImageFile | null;
  bannerImageMeta?: ProfileImageFile | null;
};

/**
 * Canonical resolver for user/brand avatars across the app.
 * Keep all profile-image precedence in one place to avoid drift.
 */
export function resolveProfileImageSource(input?: ProfileImageSource | null): ResolvedProfileImage {
  if (!input) {
    return { src: null, fileId: null };
  }

  const src =
    input.profileImage?.trim() ||
    input.profileImageFile?.s3Url?.trim() ||
    input.profileImageFile?.url?.trim() ||
    input.brandLogo?.trim() ||
    input.logo?.trim() ||
    input.avatarUrl?.trim() ||
    null;

  const fileId =
    input.profileImageId?.trim() ||
    input.profileImageFile?.id?.trim() ||
    input.profileImageFile?.fileId?.trim() ||
    input.brandLogoFileId?.trim() ||
    input.logoFileId?.trim() ||
    null;

  return { src, fileId };
}

export function resolveBannerImageSource(input?: BannerImageSource | null): ResolvedProfileImage {
  if (!input) {
    return { src: null, fileId: null };
  }

  const src =
    input.bannerImage?.trim() ||
    input.bannerImageFile?.s3Url?.trim() ||
    input.bannerImageFile?.url?.trim() ||
    input.bannerImageMeta?.s3Url?.trim() ||
    input.bannerImageMeta?.url?.trim() ||
    null;

  const fileId =
    input.bannerImageId?.trim() ||
    input.bannerImageFile?.id?.trim() ||
    input.bannerImageFile?.fileId?.trim() ||
    input.bannerImageMeta?.id?.trim() ||
    input.bannerImageMeta?.fileId?.trim() ||
    null;

  return { src, fileId };
}

export function getAvatarFallback(name?: string | null, username?: string | null): string {
  const label = (name || username || '').trim();
  if (!label) return 'U';
  const tokens = label.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) return tokens[0].slice(0, 1).toUpperCase();
  return `${tokens[0][0] ?? ''}${tokens[1][0] ?? ''}`.toUpperCase() || 'U';
}
