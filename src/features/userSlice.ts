import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { AuthUserDto } from '../types/auth';
import { env } from '../config/env';
import { normalizeThemePreference } from '@/types/theme';

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
  bannerImage: user.bannerImage ?? null,
  bannerImageId: user.bannerImageId ?? null,
  bannerImageFile: user.bannerImageFile ?? null,
  verificationStatus: user.verificationStatus ?? null,
  isVerifiedBrand: Boolean(user.isVerifiedBrand),
  verificationBadgeVisible: Boolean(
    user.verificationBadgeVisible ?? user.isVerifiedBrand,
  ),
  verifiedExplanationUrl: user.verifiedExplanationUrl ?? null,
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

const persistedProfile = typeof window !== 'undefined' ? localStorage.getItem(env.userStorageKey) : null;

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
      // Merge with existing profile first so we don't accidentally null-out or
      // lose critical fields like `type` and `role`.
      const merged = state.profile ? ({ ...state.profile, ...action.payload } as AuthUserDto) : action.payload;
      const normalized = normalizeUser(merged);
      state.profile = normalized;
      state.isAuthenticated = true;
      if (typeof window !== 'undefined') {
        localStorage.setItem(env.userStorageKey, JSON.stringify(normalized));
      }
    },
    setUserFromStorage: (state, action: PayloadAction<AuthUserDto | null>) => {
      if (!action.payload) {
        state.profile = null;
        state.isAuthenticated = false;
        return;
      }

      const merged = state.profile ? ({ ...state.profile, ...action.payload } as AuthUserDto) : action.payload;
      const normalized = normalizeUser(merged);
      state.profile = normalized;
      state.isAuthenticated = true;
    },
    clearUser: (state) => {
      state.profile = null;
      state.isAuthenticated = false;
      if (typeof window !== 'undefined') {
        localStorage.removeItem(env.userStorageKey);
      }
    },
  },
});

export const { setUser, setUserFromStorage, clearUser } = userSlice.actions;
export default userSlice.reducer;
