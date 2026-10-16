import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';

// Mock useEmbeddedSurface
let mockSurface = 'mobile-app';
vi.mock('@/hooks/useEmbeddedSurface', () => ({
  useEmbeddedSurface: () => mockSurface,
}));

vi.mock('@/api/ProductApi', () => ({
  productApi: {
    getCategoryHierarchy: vi.fn().mockResolvedValue([]),
    getAllCustomOrderConfigurations: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/api/BrandApi', () => ({
  brandApi: {
    getHashtags: vi.fn().mockResolvedValue([]),
  },
}));

import StudioScaffold from '@/components/studio/StudioScaffold';

describe('StudioScaffold & Product Creation Layout Contracts', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const store = configureStore({
    reducer: {
      user: () => ({ profile: { id: 'user-1', type: 'BRAND' } }),
      ui: () => ({ sidebarMode: 'HIDDEN', isSidebarOpen: false }),
    },
  });

  it('StudioScaffold applies pb-0 on product creation route when embedded on mobile', () => {
    mockSurface = 'mobile-app';
    const { container } = render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/studio/store/products/new']}>
            <Routes>
              <Route
                path="/studio/store/products/new"
                element={
                  <StudioScaffold active="store" onSelect={vi.fn()}>
                    <div data-testid="child-content">Product Form</div>
                  </StudioScaffold>
                }
              />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>,
    );

    const child = screen.getByTestId('child-content');
    expect(child).toBeInTheDocument();

    // Find the container div that wraps the surface
    const surfaceContainer = container.querySelector('.embedded-studio-surface')?.closest('.min-h-dvh');
    expect(surfaceContainer).toBeTruthy();
    expect(surfaceContainer?.className).toContain('pb-0');
    expect(surfaceContainer?.className).not.toContain('pb-[env(safe-area-inset-bottom)]');
  });

  it('StudioScaffold keeps safe-area bottom padding on non-product routes when embedded on mobile', () => {
    mockSurface = 'mobile-app';
    const { container } = render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={['/studio']}>
            <Routes>
              <Route
                path="/studio"
                element={
                  <StudioScaffold active="overview" onSelect={vi.fn()}>
                    <div data-testid="overview-content">Dashboard Overview</div>
                  </StudioScaffold>
                }
              />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>,
    );

    const child = screen.getByTestId('overview-content');
    expect(child).toBeInTheDocument();

    const surfaceContainer = container.querySelector('.embedded-studio-surface')?.closest('.min-h-dvh');
    expect(surfaceContainer).toBeTruthy();
    expect(surfaceContainer?.className).toContain('pb-[env(safe-area-inset-bottom)]');
  });
});
