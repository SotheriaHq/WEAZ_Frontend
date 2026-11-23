import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { AuthUserDto } from '../types/auth';
import { env } from '../config/env';
import { normalizeThemePreference } from '@/types/theme';
import { WebSessionStorageAdapter } from '@/auth/sessionAdapter';

export interface UserState {
  profile: AuthUserDto | null;
  isAuthenticated: boolean;
}

const normalizeUser = (user: AuthUserDto): AuthUserDto => ({
  ...user,
  themePreference: normalizeThemePreference(
    (user as { themePreference?: unknown }).themePreference,
  ),
  brandFullName: user.brandFullName ?? null,
  brandDescription: user.brandDescription ?? null,
  brandCountry: user.brandCountry ?? null,
  brandState: user.brandState ?? null,
  brandCity: user.brandCity ?? null,
  brandBusinessType: user.brandBusinessType ?? null,
  brandTags: Array.isArray(user.brandTags) ? user.brandTags : [],
  socialInstagram: user.socialInstagram ?? null,
  socialFacebook: user.socialFacebook ?? null,
  socialTwitter: user.socialTwitter ?? null,
  socialWebsite: user.socialWebsite ?? null,
  profileImage: user.profileImage ?? null,
  profileImageId: user.profileImageId ?? null,
  profileImageFile: user.profileImageFile ?? null,
  profilePhotoUpdatedAt: user.profilePhotoUpdatedAt ?? null,
  bannerImage: user.bannerImage ?? null,
  bannerImageId: user.bannerImageId ?? null,
  bannerImageFile: user.bannerImageFile ?? null,
  verificationStatus: user.verificationStatus ?? null,
  storeId: user.storeId ?? null,
  brandMemberships: Array.isArray(user.brandMemberships)
    ? user.brandMemberships.filter((membership) => Boolean(membership?.brandId))
    : [],
  activeBrandId: user.activeBrandId ?? user.storeId ?? null,
  isVerifiedBrand: Boolean(user.isVerifiedBrand),
  verificationBadgeVisible: Boolean(
    user.verificationBadgeVisible ?? user.isVerifiedBrand,
  ),
  verifiedExplanationUrl: user.verifiedExplanationUrl ?? null,
  gender: user.gender ?? null,
});

const parsePersistedProfile = (raw: string | null): AuthUserDto | null => {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as AuthUserDto;
    return normalizeUser(parsed);
  } catch {
    return null;
  }
};

const persistedProfile = typeof window !== 'undefined'
  ? (WebSessionStorageAdapter.getUserProfile() ?? localStorage.getItem(env.userStorageKey))
  : null;

const initialProfile: AuthUserDto | null = parsePersistedProfile(persistedProfile);

const initialState: UserState = {
  profile: initialProfile,
  isAuthenticated: Boolean(initialProfile),
};

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<AuthUserDto>) => {
      // Some endpoints return partial user objects (e.g. profile update flows).
      // Merge ONLY when the payload is the same authenticated identity.
      // Cross-user merges create franken-profiles (wrong email/uid on navbar
      // while catalog shows another brand) — a high-risk identity leak.
      const incoming = action.payload;
      const sameIdentity =
        Boolean(state.profile?.id) &&
        Boolean(incoming?.id) &&
        state.profile!.id === incoming.id;
      const merged = sameIdentity
        ? ({ ...state.profile, ...incoming } as AuthUserDto)
        : incoming;
      const normalized = normalizeUser(merged);
      state.profile = normalized;
      state.isAuthenticated = true;
      if (typeof window !== 'undefined') {
        WebSessionStorageAdapter.setUserProfile(JSON.stringify(normalized));
        localStorage.setItem(env.userStorageKey, JSON.stringify(normalized));
      }
    },
    setUserFromStorage: (state, action: PayloadAction<AuthUserDto | null>) => {
      if (!action.payload) {
        state.profile = null;
        state.isAuthenticated = false;
        return;
      }

      const incoming = action.payload;
      const sameIdentity =
        Boolean(state.profile?.id) &&
        Boolean(incoming?.id) &&
        state.profile!.id === incoming.id;
      const merged = sameIdentity
        ? ({ ...state.profile, ...incoming } as AuthUserDto)
        : incoming;
      const normalized = normalizeUser(merged);
      state.profile = normalized;
      state.isAuthenticated = true;
    },
    /**
     * Change only the given fields of the signed-in profile.
     *
     * For writes that own one setting (theme, gender). They used to dispatch
     * `setUser({ ...user, field })` with the `user` captured before an await,
     * and `setUser` merges every field of that snapshot back in, so anything
     * that changed meanwhile was silently reverted. A theme switch reverting a
     * just-created store membership closed the open brand-setup modal and
     * dropped the user on the catalogue. Ignored when no profile is signed in
     * or the patch names a different account.
     */
    patchUser: (state, action: PayloadAction<Partial<AuthUserDto>>) => {
      const patch = action.payload;
      if (!state.profile) return;
      if (patch.id && patch.id !== state.profile.id) return;
      const normalized = normalizeUser({ ...state.profile, ...patch, id: state.profile.id } as AuthUserDto);
      state.profile = normalized;
      if (typeof window !== 'undefined') {
        localStorage.setItem(env.userStorageKey, JSON.stringify(normalized));
      }
    },
    clearUser: (state) => {
      state.profile = null;
      state.isAuthenticated = false;
      if (typeof window !== 'undefined') {
        localStorage.removeItem(WebSessionStorageAdapter.PRIMARY_USER_KEY);
        for (const legacyKey of WebSessionStorageAdapter.LEGACY_USER_KEYS) {
          localStorage.removeItem(legacyKey);
        }
        localStorage.removeItem(env.userStorageKey);
      }
    },
  },
});

export const { setUser, setUserFromStorage, patchUser, clearUser } = userSlice.actions;
export default userSlice.reducer;
