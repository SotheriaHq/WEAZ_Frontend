import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DesignCard from './DesignCard';
import { messagingApi } from '@/api/MessagingApi';
import userReducer from '@/features/userSlice';
import type { AuthUserDto } from '@/types/auth';
import type { MarketItem } from '@/types/market';
import { toast } from 'sonner';

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/api/MessagingApi', () => ({
  messagingApi: {
    sendBrandMessage: vi.fn(),
  },
}));

vi.mock('@/api/httpClient', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: { isSaved: false } }),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/context/BrandPatchContext', () => ({
  useBrandPatchState: () => ({
    isPatchCapable: false,
    getPatched: () => false,
    isLoading: () => false,
    ensureStatus: vi.fn(),
    toggleStatus: vi.fn(),
    prefetchStatuses: vi.fn(),
    clearCache: vi.fn(),
  }),
}));

vi.mock('@/components/ui/ThreadButton', () => ({
  default: () => <button type="button">Thread</button>,
}));

vi.mock('@/components/media/MediaRenderer', () => ({
  default: () => <div data-testid="media-renderer" />,
}));

vi.mock('@/components/ImageWithFallback', () => ({
  default: ({ alt }: { alt?: string }) => <img alt={alt ?? 'image'} />,
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

const mockedMessagingApi = vi.mocked(messagingApi);
const mockedToast = vi.mocked(toast);

const baseUser: AuthUserDto = {
  id: 'user-1',
  username: 'customer',
  email: 'customer@example.com',
  firstName: 'Customer',
  lastName: 'One',
  role: 'User',
  type: 'REGULAR',
  themePreference: 'system',
  phoneNumber: null,
  address: null,
  brandFullName: null,
  brandDescription: null,
  brandCountry: null,
  brandState: null,
  brandCity: null,
  brandTags: [],
  brandBusinessType: null,
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
  profileImage: null,
  profileImageId: null,
  profileImageFile: null,
  bannerImage: null,
  bannerImageId: null,
  bannerImageFile: null,
  isEmailVerified: true,
  storeId: null,
  isActive: 'ACTIVE',
  createdAt: '2026-05-16T00:00:00.000Z',
  updatedAt: '2026-05-16T00:00:00.000Z',
};

const brandOwner: AuthUserDto = {
  ...baseUser,
  id: 'brand-owner-1',
  username: 'owner',
  email: 'owner@example.com',
  type: 'BRAND',
  storeId: 'brand-1',
  activeBrandId: 'brand-1',
  brandFullName: 'Threadly Atelier',
  brandMemberships: [
    {
      brandId: 'brand-1',
      brandName: 'Threadly Atelier',
      role: 'OWNER',
      status: 'ACTIVE',
      isOwner: true,
    },
  ],
};

const baseItem: MarketItem = {
  id: 'design-media-1',
  entityType: 'DESIGN',
  designId: 'design-1',
  legacyCollectionId: null,
  collectionId: 'collection-1',
  collectionTitle: 'Adire wrap dress',
  collectionDescription: 'A direct message test design.',
  brandId: 'brand-1',
  brandName: 'Threadly Atelier',
  username: 'threadlyatelier',
  brandLogo: null,
  brandLogoFileId: null,
  threadsCount: 0,
  commentsCount: 0,
  collectionCollabCount: 0,
  customAvailable: true,
  tags: ['adire'],
  media: {
    fileId: 'file-1',
    url: 'https://example.com/design.jpg',
    previewUrl: null,
    type: 'POST_IMAGE',
  },
};

const createStore = (user: AuthUserDto | null) =>
  configureStore({
    reducer: {
      user: userReducer,
    },
    preloadedState: {
      user: {
        profile: user,
        isAuthenticated: Boolean(user),
      },
    },
  });

const renderDesignCard = (user: AuthUserDto | null, item: MarketItem = baseItem) => {
  const store = createStore(user);
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/']}>
        <DesignCard item={item} />
      </MemoryRouter>
    </Provider>,
  );
};

const sendDirectMessage = async (text: string) => {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText('Message brand...'), text);
  await user.click(screen.getByRole('button', { name: /send direct message/i }));
};

describe('DesignCard direct message flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockReset();
  });

  it('routes signed-out users to login with the current URL as next', async () => {
    renderDesignCard(null);

    await sendDirectMessage('Hello');

    expect(navigateMock).toHaveBeenCalledWith('/login?next=%2F');
    expect(mockedToast.info).toHaveBeenCalledWith('Please sign in to message this brand.');
    expect(mockedMessagingApi.sendBrandMessage).not.toHaveBeenCalled();
  });

  it('sends direct messages, clears the input, and routes to the thread', async () => {
    mockedMessagingApi.sendBrandMessage.mockResolvedValueOnce({
      thread: { id: 'thread-1' },
    });

    renderDesignCard(baseUser);

    await sendDirectMessage('Can I order this?');

    await waitFor(() => {
      expect(mockedMessagingApi.sendBrandMessage).toHaveBeenCalledWith(
        'brand-1',
        expect.objectContaining({
          bodyText: 'Can I order this?',
          clientMessageId: expect.any(String),
        }),
      );
    });

    expect(navigateMock).toHaveBeenCalledWith('/messages?thread=thread-1');
    expect(screen.getByPlaceholderText('Message brand...')).toHaveValue('');
    expect(mockedToast.success).toHaveBeenCalledWith('Message sent');
  });

  it('does not expose direct messaging to the brand owner viewing their own design', () => {
    renderDesignCard(brandOwner);

    expect(screen.getByPlaceholderText('Your design')).toBeDisabled();
    expect(screen.getByRole('button', { name: /send direct message/i })).toBeDisabled();
    expect(mockedMessagingApi.sendBrandMessage).not.toHaveBeenCalled();
  });

  it('shows a clear error when the design is missing a brand id', async () => {
    renderDesignCard(baseUser, { ...baseItem, brandId: '' });

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Brand unavailable'), 'Hello');
    await user.click(screen.getByRole('button', { name: /send direct message/i }));

    expect(mockedToast.error).toHaveBeenCalledWith('Brand is unavailable for this design.');
    expect(mockedMessagingApi.sendBrandMessage).not.toHaveBeenCalled();
  });

  it('uses direct-message semantics instead of comment actions for the card composer', () => {
    renderDesignCard(baseUser);

    expect(screen.getByRole('button', { name: /send direct message/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send comment/i })).not.toBeInTheDocument();
  });
});
