import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Market from '@/pages/Market';
import CreateDesignPage from '@/pages/catalog/CreateDesign';
import EditProduct from '@/pages/studio/products/EditProduct';
import StoreCollectionCreate from '@/pages/studio/store/StoreCollectionCreate';
import { ThemeProvider } from '@/context/ThemeContext';
import userReducer from '@/features/userSlice';

const getFeedMock = vi.hoisted(() => vi.fn());
const getCategoriesMock = vi.hoisted(() => vi.fn());
const getSuggestionsMock = vi.hoisted(() => vi.fn());
const apiPostMock = vi.hoisted(() => vi.fn());
const patchStateMock = vi.hoisted(() => ({
  isPatchCapable: false,
  getPatched: vi.fn(() => false),
  isLoading: vi.fn(() => false),
  prefetchStatuses: vi.fn(),
  toggleStatus: vi.fn(),
}));

vi.mock('@/api/MarketApi', () => ({
  default: {
    getFeed: getFeedMock,
  },
}));

vi.mock('@/api/BrandApi', () => ({
  brandApi: {
    getCategoriesWithSubCategories: getCategoriesMock,
    getCollectionDetail: vi.fn(),
    getSignedFileUrl: vi.fn(),
  },
}));

vi.mock('@/api/TagsApi', () => ({
  default: {
    getSuggestions: getSuggestionsMock,
  },
}));

vi.mock('@/api/httpClient', () => ({
  apiClient: {
    post: apiPostMock,
    delete: vi.fn(),
  },
}));

vi.mock('@/context/BrandPatchContext', () => ({
  useBrandPatchState: () => patchStateMock,
}));

vi.mock('@/components/FeaturedSection', () => ({
  default: () => <section data-testid="featured-section" />,
}));

vi.mock('@/components/FeaturedGalleryModal', () => ({
  default: () => null,
}));

vi.mock('@/components/designs/DesignCard', () => ({
  default: () => <article data-testid="design-card" />,
}));

vi.mock('@/components/designs/DesignSkeleton', () => ({
  default: () => <div data-testid="design-skeleton" />,
}));

vi.mock('@/components/designs/DesignViewModal', () => ({
  default: () => null,
}));

vi.mock('@/components/loaders/VLoader', () => ({
  default: () => <span data-testid="loader" />,
}));

vi.mock('@/components/upload/MediaUploadZone', () => ({
  default: () => <div data-testid="media-upload-zone" />,
}));

vi.mock('@/components/upload/ThumbnailStrip', () => ({
  default: () => null,
}));

vi.mock('@/components/upload/useFilePicker', () => ({
  default: () => ({
    inputRef: { current: null },
    open: vi.fn(),
    handlers: { onInputChange: vi.fn() },
  }),
}));

vi.mock('@/components/forms/TextField', () => ({
  default: ({ label }: { label: string }) => (
    <label>
      {label}
      <input />
    </label>
  ),
}));

vi.mock('@/components/forms/UniversalSelect', () => ({
  default: ({ label }: { label: string }) => <div>{label}</div>,
}));

vi.mock('@/components/categories/FilterSelector', () => ({
  default: () => <div data-testid="filter-selector" />,
}));

vi.mock('@/components/custom-orders/CustomOrderConfigurationEditor', () => ({
  default: () => <div data-testid="custom-order-editor" />,
}));

vi.mock('@/components/ui/TourOverlay', () => ({
  TourOverlay: () => null,
}));

vi.mock('@/hooks/UseBrandHook', () => ({
  useBrandProfile: () => ({
    user: { id: 'brand-1', isEmailVerified: true },
    fetchCollections: vi.fn(),
  }),
}));

vi.mock('@/hooks/useCollectionUpload', () => ({
  default: () => ({
    uploadCollection: vi.fn(),
    isUploading: false,
    progress: 0,
    perFileProgress: {},
    cancelUploads: vi.fn(),
  }),
}));

vi.mock('@/api/CustomOrderApi', () => ({
  customOrderConfigurationsApi: {
    create: vi.fn(),
    createFabricRuleBasis: vi.fn(),
  },
}));

vi.mock('@/api/collectionUploads', () => ({
  finalizeCollectionUploads: vi.fn(),
}));

const setSystemDark = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
};

const createStore = () =>
  configureStore({
    reducer: {
      user: userReducer,
    },
    preloadedState: {
      user: {
        profile: null,
        isAuthenticated: false,
      },
    },
  });

const renderMarket = (preference: 'light' | 'dark') => {
  localStorage.setItem('vite-ui-theme', preference);
  render(
    <Provider store={createStore()}>
      <MemoryRouter>
        <ThemeProvider>
          <Market />
        </ThemeProvider>
      </MemoryRouter>
    </Provider>,
  );
};

describe('feature page theme token migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-preference');
    setSystemDark(false);
    getFeedMock.mockResolvedValue({ items: [] });
    getCategoriesMock.mockResolvedValue([
      {
        id: 'cat-1',
        slug: 'african-fashion',
        name: 'African Fashion',
        types: [{ id: 'type-1', name: 'Ready to Wear' }],
      },
    ]);
    getSuggestionsMock.mockResolvedValue(['kaftan', 'agbada']);
    apiPostMock.mockResolvedValue({ data: { items: [] } });
  });

  it('renders the market feed under ThemeProvider in light mode', async () => {
    renderMarket('light');

    expect(await screen.findByTestId('featured-section')).toBeInTheDocument();
    await waitFor(() => expect(getFeedMock).toHaveBeenCalled());
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('renders the market feed under ThemeProvider in dark mode', async () => {
    renderMarket('dark');

    expect(await screen.findByTestId('featured-section')).toBeInTheDocument();
    await waitFor(() => expect(getFeedMock).toHaveBeenCalled());
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement).toHaveClass('dark');
  });

  it('renders the design creation shared sections in dark mode', async () => {
    localStorage.setItem('vite-ui-theme', 'dark');

    render(
      <MemoryRouter initialEntries={['/profile/collections/create']}>
        <ThemeProvider>
          <Routes>
            <Route path="/profile/collections/create" element={<CreateDesignPage />} />
          </Routes>
        </ThemeProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('media-upload-zone')).toBeInTheDocument();
    expect(screen.getByText('Design Details')).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('renders the product edit page in dark mode', async () => {
    localStorage.setItem('vite-ui-theme', 'dark');

    render(
      <Provider store={createStore()}>
        <MemoryRouter initialEntries={['/studio/products/new']}>
          <ThemeProvider>
            <Routes>
              <Route path="/studio/products/new" element={<EditProduct />} />
            </Routes>
          </ThemeProvider>
        </MemoryRouter>
      </Provider>,
    );

    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('renders the store collection creation page in dark mode', async () => {
    localStorage.setItem('vite-ui-theme', 'dark');

    render(
      <Provider store={createStore()}>
        <MemoryRouter initialEntries={['/studio/store/collections/new']}>
          <ThemeProvider>
            <Routes>
              <Route path="/studio/store/collections/new" element={<StoreCollectionCreate />} />
            </Routes>
          </ThemeProvider>
        </MemoryRouter>
      </Provider>,
    );

    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
