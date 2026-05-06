import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import userReducer, { setUser } from '@/features/userSlice';
import { brandApi } from '@/api/BrandApi';
import { useBrandProfile } from '@/hooks/UseBrandHook';
import type { AuthUserDto } from '@/types/auth';
import type { BrandProfileDto } from '@/types/profile';

vi.mock('@/api/BrandApi', () => ({
  brandApi: {
    getCollections: vi.fn().mockResolvedValue([]),
    getBrandProfile: vi.fn().mockResolvedValue(null),
    getReviews: vi.fn().mockResolvedValue({
      reviews: [],
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: [],
    }),
  },
}));

vi.mock('@/hooks/useReviewRuntimeFlags', () => ({
  useReviewRuntimeFlags: () => ({
    flags: { readEnabled: false, brandRepliesEnabled: false },
    isLoading: false,
  }),
}));

const baseUser: AuthUserDto = {
  id: 'brand-1',
  username: 'atelier',
  email: 'atelier@example.com',
  firstName: 'Atelier',
  lastName: 'Brand',
  role: 'User',
  type: 'BRAND',
  themePreference: 'system',
  phoneNumber: null,
  address: null,
  brandFullName: 'Atelier Brand',
  brandDescription: 'A stable luxury catalog.',
  brandCountry: 'Nigeria',
  brandState: 'Lagos',
  brandCity: 'Lagos',
  brandTags: ['Luxury', 'Ready-to-wear'],
  brandBusinessType: 'Fashion',
  socialInstagram: null,
  socialFacebook: null,
  socialTwitter: null,
  socialWebsite: null,
  cacNumber: null,
  tin: null,
  ceoNin: null,
  ceoFirstName: null,
  ceoLastName: null,
  companyLocation: null,
  profileImage: 'https://cdn.example.com/old-avatar.jpg',
  profileImageId: 'avatar-1',
  profileImageFile: {
    id: 'avatar-1',
    s3Url: 'https://cdn.example.com/old-avatar.jpg',
    fileName: 'old-avatar.jpg',
    originalName: 'old-avatar.jpg',
    createdAt: '2026-04-17T00:00:00.000Z',
    updatedAt: '2026-04-17T00:00:00.000Z',
  },
  bannerImage: 'https://cdn.example.com/old-banner.jpg',
  bannerImageId: 'banner-1',
  bannerImageFile: {
    id: 'banner-1',
    s3Url: 'https://cdn.example.com/old-banner.jpg',
    fileName: 'old-banner.jpg',
    originalName: 'old-banner.jpg',
    createdAt: '2026-04-17T00:00:00.000Z',
    updatedAt: '2026-04-17T00:00:00.000Z',
  },
  isEmailVerified: true,
  storeId: null,
  verificationStatus: 'APPROVED',
  isVerifiedBrand: true,
  verificationBadgeVisible: true,
  verifiedExplanationUrl: null,
  isActive: 'ACTIVE',
  status: 'ACTIVE',
  mustResetPassword: false,
  createdAt: '2026-04-17T00:00:00.000Z',
  updatedAt: '2026-04-17T00:00:00.000Z',
};

describe('useBrandProfile render isolation', () => {
  it('does not re-render hook consumers for media-only user updates', async () => {
    const store = configureStore({
      reducer: {
        user: userReducer,
      },
    });

    store.dispatch(setUser(baseUser));

    let renderCount = 0;

    const Probe = () => {
      useBrandProfile();
      renderCount += 1;
      return null;
    };

    render(
      <Provider store={store}>
        <Probe />
      </Provider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const settledRenderCount = renderCount;

    await act(async () => {
      store.dispatch(
        setUser({
          ...baseUser,
          profileImage: 'https://cdn.example.com/new-avatar.jpg',
          profileImageId: 'avatar-2',
          profileImageFile: {
            id: 'avatar-2',
            s3Url: 'https://cdn.example.com/new-avatar.jpg',
            fileName: 'new-avatar.jpg',
            originalName: 'new-avatar.jpg',
            createdAt: '2026-04-17T01:00:00.000Z',
            updatedAt: '2026-04-17T01:00:00.000Z',
          },
          bannerImage: 'https://cdn.example.com/new-banner.jpg',
          bannerImageId: 'banner-2',
          bannerImageFile: {
            id: 'banner-2',
            s3Url: 'https://cdn.example.com/new-banner.jpg',
            fileName: 'new-banner.jpg',
            originalName: 'new-banner.jpg',
            createdAt: '2026-04-17T01:00:00.000Z',
            updatedAt: '2026-04-17T01:00:00.000Z',
          },
        }),
      );
      await Promise.resolve();
    });

    expect(renderCount).toBe(settledRenderCount);
  });

  it('immediately syncs stale brand profile fields from the updated auth user', async () => {
    const staleProfile: BrandProfileDto = {
      id: baseUser.id,
      brandFullName: baseUser.brandFullName ?? '',
      description: 'Old story still cached in hook state.',
      country: 'Nigeria',
      state: 'Lagos',
      city: 'Lagos',
      location: 'Lagos, Nigeria',
      bannerImage: baseUser.bannerImage,
      bannerImageMeta: {
        fileId: 'banner-1',
        url: 'https://cdn.example.com/old-banner.jpg',
        originalName: 'old-banner.jpg',
        fileName: 'old-banner.jpg',
        createdAt: '2026-04-17T00:00:00.000Z',
        updatedAt: '2026-04-17T00:00:00.000Z',
      },
      logoImage: baseUser.profileImage,
      logoImageMeta: {
        fileId: 'avatar-1',
        url: 'https://cdn.example.com/old-avatar.jpg',
        originalName: 'old-avatar.jpg',
        fileName: 'old-avatar.jpg',
        createdAt: '2026-04-17T00:00:00.000Z',
        updatedAt: '2026-04-17T00:00:00.000Z',
      },
      socialLinks: {},
      contactInfo: {
        email: baseUser.email,
        phone: null,
        businessType: null,
      },
      tags: ['OldTag'],
      hashtags: ['OldTag'],
      verified: true,
      verificationStatus: 'APPROVED',
      verificationBadgeVisible: true,
      verifiedExplanationUrl: null,
      createdAt: baseUser.createdAt,
      updatedAt: baseUser.updatedAt,
    };

    const getBrandProfileMock = vi.mocked(brandApi.getBrandProfile);
    getBrandProfileMock.mockReset();
    getBrandProfileMock
      .mockResolvedValueOnce(staleProfile)
      .mockImplementation(() => new Promise<BrandProfileDto | null>(() => {}));

    const store = configureStore({
      reducer: {
        user: userReducer,
      },
    });

    store.dispatch(setUser(baseUser));

    type BrandProfileHookState = ReturnType<typeof useBrandProfile>;
    let latestHook: BrandProfileHookState | null = null;

    const Probe = () => {
      latestHook = useBrandProfile();
      return null;
    };

    render(
      <Provider store={store}>
        <Probe />
      </Provider>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latestHook).not.toBeNull();
    if (!latestHook) {
      throw new Error('Hook state was not captured after initial render.');
    }
    const initialHook: BrandProfileHookState = latestHook;
    expect(initialHook.displayData.description).toBe('Old story still cached in hook state.');
    expect(initialHook.displayData.hashtags).toEqual(['OldTag']);

    await act(async () => {
      store.dispatch(
        setUser({
          ...baseUser,
          brandDescription: 'Fresh profile story from the save response.',
          brandCountry: 'Ghana',
          brandState: 'Greater Accra',
          brandCity: 'Accra',
          brandTags: ['Minimalist', 'Resort'],
          updatedAt: '2026-04-18T00:00:00.000Z',
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(latestHook).not.toBeNull();
    if (!latestHook) {
      throw new Error('Hook state was not captured after profile update.');
    }
    const updatedHook: BrandProfileHookState = latestHook;
    expect(updatedHook.displayData.description).toBe('Fresh profile story from the save response.');
    expect(updatedHook.displayData.hashtags).toEqual(['Minimalist', 'Resort']);
    expect(updatedHook.displayData.country).toBe('Ghana');
    expect(updatedHook.displayData.state).toBe('Greater Accra');
    expect(updatedHook.displayData.city).toBe('Accra');
  });
});
