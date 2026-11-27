import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarketFacets, MarketSectionPageResult } from '@/api/MarketV2Api';
import type { MarketPagedListSectionProps } from '@/components/market/composed/MarketPagedListSection';

/**
 * See All on the composed Market: the section's own v2 list with its own
 * facets, and the established page whenever the server answers the old way.
 */

const getSectionPage = vi.fn<(key: string, request: unknown) => Promise<MarketSectionPageResult>>();
const getSectionFacets = vi.fn<(key: string, request: unknown) => Promise<MarketFacets | null>>();
const listProps: MarketPagedListSectionProps[] = [];

vi.mock('@/api/MarketV2Api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/MarketV2Api')>()),
  marketV2Api: { getSectionPage, getSectionFacets },
  retryMarketV2Request: () => false,
}));
vi.mock('react-redux', () => ({
  useDispatch: () => vi.fn(),
  useSelector: (select: (state: unknown) => unknown) => select({ user: { isAuthenticated: false } }),
}));
vi.mock('@/features/wishlistSlice', () => ({ fetchWishlist: vi.fn() }));
vi.mock('@/components/ScrollRestoreProvider', () => ({ useScrollRestore: () => ({ saveScrollPosition: vi.fn() }) }));
vi.mock('@/hooks/useMarketSignals', () => ({
  useMarketSignals: () => ({ trackMarketSignal: vi.fn(), flushMarketSignals: vi.fn(), anonymousSessionId: 'anon-1' }),
}));
vi.mock('@/features/market-v2/useMarketHome', () => ({ useMarketViewerScope: () => ({ viewer: 'guest', ready: true }) }));
vi.mock('@/features/market-v2/useMarketItemOpener', () => ({
  useMarketItemOpener: () => ({ openFor: () => vi.fn(), overlay: null }),
}));
vi.mock('@/components/market/composed/MarketPagedListSection', () => ({
  MarketPagedListSection: (props: MarketPagedListSectionProps) => {
    listProps.push(props);
    return <p data-testid="list">{`${props.list.items.length} pieces; facets ${props.facets ? 'on' : 'off'}`}</p>;
  },
}));
vi.mock('@/pages/MarketSectionPage', () => ({ default: () => <p>classic section page</p> }));

const { default: MarketSectionComposedPage } = await import('@/pages/MarketSectionComposedPage');

const FACETS = {
  audience: [],
  categories: [],
  categoryTypes: [],
  brands: [{ value: 'b1', label: 'Nuel', count: 3, disabled: false }],
  tags: [],
  colors: [],
  sizes: [],
  fulfilment: [],
  onSale: [],
  inStockOnly: [],
} as unknown as MarketFacets;

const v2Page = (): MarketSectionPageResult =>
  ({
    kind: 'v2',
    items: [
      { entityType: 'PRODUCT', id: 'p1' },
      { entityType: 'PRODUCT', id: 'p2' },
    ],
    hasNextPage: false,
    nextCursor: null,
    availableSorts: ['newest', 'price_asc'],
    sortRequested: null,
    sortEffective: null,
    fallbackReason: null,
    total: 2,
    facets: null,
    section: { key: 'new-in', title: 'New in', subtitle: 'Fresh this week', layout: 'PRODUCT_GRID', sourceType: 'PRODUCT' },
  }) as unknown as MarketSectionPageResult;

const renderAt = (path: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/market/sections/:sectionKey" element={<MarketSectionComposedPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  getSectionPage.mockReset();
  getSectionFacets.mockReset();
  listProps.length = 0;
});

describe('Market See All (composed)', () => {
  it('shows the section title and its own list, with section-scoped facets', async () => {
    getSectionPage.mockResolvedValue(v2Page());
    getSectionFacets.mockResolvedValue(FACETS);
    renderAt('/market/sections/new-in?sort=price_asc');

    expect(await screen.findByRole('heading', { level: 1, name: 'New in' })).toBeInTheDocument();
    expect(screen.getByText('Fresh this week')).toBeInTheDocument();
    expect(await screen.findByText('2 pieces; facets on')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Market/ })).toHaveAttribute('href', '/market');

    const [key, request] = getSectionPage.mock.calls[0];
    expect(key).toBe('new-in');
    expect(request).toMatchObject({ sort: 'price_asc', cursor: null, anonymousSessionId: 'anon-1' });
    expect(getSectionFacets.mock.calls[0][0]).toBe('new-in');
    expect(listProps.at(-1)?.context).toMatchObject({ surface: 'MARKET_SECTION_DETAIL', sectionKey: 'new-in' });
    // The section's own order is the default choice, not the home catalogue's.
    expect(listProps.at(-1)?.defaultOrderLabel).toBe('Section order');
  });

  it('hands an old-shape answer to the established page and asks for no facets', async () => {
    getSectionPage.mockResolvedValue({ kind: 'legacy', response: {} } as unknown as MarketSectionPageResult);
    renderAt('/market/sections/new-in');

    expect(await screen.findByText('classic section page')).toBeInTheDocument();
    expect(getSectionFacets).not.toHaveBeenCalled();
  });

  it('falls back to the established page when the server has the composed Market off', async () => {
    getSectionPage.mockRejectedValue(
      Object.assign(new Error('Not Found'), { isAxiosError: true, response: { status: 404 } }),
    );
    renderAt('/market/sections/new-in');

    expect(await screen.findByText('classic section page')).toBeInTheDocument();
  });
});
