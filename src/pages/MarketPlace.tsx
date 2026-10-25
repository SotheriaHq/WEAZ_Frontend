import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/httpClient';
import type { MarketSection, MarketSectionItem } from '@/api/MarketApi';
import { unwrapApiResponse, type ApiSuccessPayload } from '@/types/auth';
import type { AppDispatch, RootState } from '@/store';
import type { StoreProduct } from '@/components/designs/StoreProductCard';
import ProductCardSkeleton from '@/components/designs/ProductCardSkeleton';
import { DeferredOverlay } from '@/components/ui/DeferredOverlay';
const MarketProductOverlay = React.lazy(() => import('@/components/market/MarketProductOverlay'));
import { fetchWishlist } from '@/features/wishlistSlice';
import MarketTrendingHero from '@/components/market/MarketTrendingHero';
import MarketSectionRail from '@/components/market/MarketSectionRail';
const MarketTrendingTodayModal = React.lazy(() => import('@/components/market/MarketTrendingTodayModal'));
import SearchBarWithSuggestions from '@/components/search/SearchBarWithSuggestions';
import {
  getProductRecencyTimestamp,
  normalizeMarketProduct,
  type MarketplaceProduct,
  type RawProductsPayload,
} from '@/utils/marketProductMapper';
import {
  getSectionItemTargetId,
  mapSectionProductToMarketplaceProduct,
} from '@/utils/marketSectionMapper';
import { useMarketSignals } from '@/hooks/useMarketSignals';
import useMarketSections from '@/hooks/useMarketSections';
import { queryKeys } from '@/query/queryKeys';
import { useScrollRestore } from '@/components/ScrollRestoreProvider';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useMarketSurfacePrefetch } from '@/hooks/useMarketSurfacePrefetch';
import { useOverlayBackClose } from '@/hooks/useOverlayBackClose';
import { selectIsMobile } from '@/features/uiSlice';
import { createMixSeed, mixFeedItems } from '@/utils/feedMixer';

const BASE_FILTERS = ['FOR_YOU', 'MENSWEAR', 'WOMENSWEAR', 'EVERYBODY', 'ON_SALE'] as const;
const FRESH_DROP_DAY_MS = 24 * 60 * 60 * 1000;
const TRENDING_TODAY_LIMIT = 15;
const MARKET_FALLBACK_PRODUCT_LIMIT = 32;

const getUtcDayIndex = (nowMs: number): number => Math.floor(nowMs / FRESH_DROP_DAY_MS);

const selectDailyBatch = <T,>(items: T[], batchSize: number, utcDayIndex: number): T[] => {
  if (items.length === 0 || batchSize <= 0) return [];
  const batchCount = Math.max(1, Math.ceil(items.length / batchSize));
  const safeDayIndex = Number.isFinite(utcDayIndex) ? Math.max(0, Math.floor(utcDayIndex)) : 0;
  const batchIndex = safeDayIndex % batchCount;
  const start = batchIndex * batchSize;
  return items.slice(start, start + batchSize);
};

const extractProductsFromSections = (sections: MarketSection[]): MarketplaceProduct[] => {
  const byId = new Map<string, MarketplaceProduct>();
  for (const section of sections) {
    for (const item of section.items ?? []) {
      const product = mapSectionProductToMarketplaceProduct(item);
      if (product && !byId.has(product.id)) {
        byId.set(product.id, product);
      }
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => getProductRecencyTimestamp(b) - getProductRecencyTimestamp(a),
  );
};

export const MarketPlace: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const isAuth = useSelector((state: RootState) => state.user.isAuthenticated);
  const isMobileViewportUi = useSelector(selectIsMobile);

  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);
  useScrollLock(Boolean(selectedProduct));

  // Filter & Sort State
  const [selectedAudienceFilter, setSelectedAudienceFilter] = useState<string>('FOR_YOU');
  const [craftsmanshipFilter, setCraftsmanshipFilter] = useState<string>('ALL');
  const [priceRangeFilter, setPriceRangeFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('EDITORIAL');

  const [trendingTodayOpen, setTrendingTodayOpen] = useState(false);
  // Queue-to-product changes retain a single overlay entry, including while
  // the requested panel is downloading.
  useOverlayBackClose(
    Boolean(selectedProduct || trendingTodayOpen),
    () => selectedProduct ? setSelectedProduct(null) : setTrendingTodayOpen(false),
    isMobileViewportUi,
  );
  const [marketClockMs, setMarketClockMs] = useState<number>(() => Date.now());
  const [hiddenTargetIds] = useState<Set<string>>(() => new Set());
  const { anonymousSessionId, flushMarketSignals, trackMarketSignal } = useMarketSignals('MARKET_HOME');

  useMarketSurfacePrefetch('market');
  const { saveScrollPosition } = useScrollRestore('MARKET_PLACE');

  const marketSectionsParams = useMemo(
    () => ({ limit: 12, anonymousSessionId }),
    [anonymousSessionId],
  );
  const marketSectionsQuery = useMarketSections(marketSectionsParams);
  const rawMarketSections = useMemo(
    () => marketSectionsQuery.data?.sections ?? [],
    [marketSectionsQuery.data?.sections],
  );

  const marketSections = useMemo(
    () =>
      rawMarketSections
        .map((section) => ({
          ...section,
          items: (section.items ?? []).filter((item) => {
            const targetId = getSectionItemTargetId(item);
            return !targetId || !hiddenTargetIds.has(targetId);
          }),
        }))
        .filter((section) => section.items.length > 0),
    [hiddenTargetIds, rawMarketSections],
  );

  const sectionProducts = useMemo(
    () => extractProductsFromSections(marketSections),
    [marketSections],
  );

  const shouldUseFallbackProducts =
    !marketSectionsQuery.isLoading &&
    (marketSectionsQuery.isError || sectionProducts.length === 0);

  const fallbackProductsQuery = useQuery({
    queryKey: queryKeys.market.fallbackProducts({
      surface: 'market-place',
      limit: MARKET_FALLBACK_PRODUCT_LIMIT,
      sortBy: 'newest',
    }),
    queryFn: async ({ signal }) => {
      const response: { data: unknown } = await apiClient.get('/store/products/market', {
        params: {
          limit: MARKET_FALLBACK_PRODUCT_LIMIT,
          sortBy: 'newest',
        },
        signal,
      });

      const payload: RawProductsPayload = unwrapApiResponse<RawProductsPayload>(
        response.data as ApiSuccessPayload<RawProductsPayload>,
      );
      const rows = Array.isArray(payload?.items) ? payload.items : [];
      const mapped = rows
        .map((row) => normalizeMarketProduct(row))
        .filter((p): p is MarketplaceProduct => Boolean(p));

      const dedupedById = new Map<string, MarketplaceProduct>();
      for (const product of mapped) {
        if (!dedupedById.has(product.id)) {
          dedupedById.set(product.id, product);
        }
      }

      return Array.from(dedupedById.values()).sort(
        (a, b) => getProductRecencyTimestamp(b) - getProductRecencyTimestamp(a),
      );
    },
    enabled: shouldUseFallbackProducts,
  });

  const fallbackProducts = useMemo(
    () => (fallbackProductsQuery.data ?? []).filter((product) => !hiddenTargetIds.has(product.id)),
    [fallbackProductsQuery.data, hiddenTargetIds],
  );

  const marketMixSeedRef = useRef(createMixSeed());
  const rawProducts = sectionProducts.length > 0 ? sectionProducts : fallbackProducts;
  const products = useMemo(
    () => mixFeedItems(rawProducts, marketMixSeedRef.current),
    [rawProducts],
  );

  const loading =
    products.length === 0 &&
    (marketSectionsQuery.isLoading ||
      (shouldUseFallbackProducts && fallbackProductsQuery.isLoading));
  const refreshing =
    products.length > 0 &&
    (marketSectionsQuery.isFetching ||
      (shouldUseFallbackProducts && fallbackProductsQuery.isFetching));

  useEffect(() => {
    if (!isAuth) return;
    void dispatch(fetchWishlist({ page: 1, limit: 100 }));
  }, [dispatch, isAuth]);

  useEffect(() => {
    const updateMarketClock = () => setMarketClockMs(Date.now());
    updateMarketClock();
    const interval = window.setInterval(updateMarketClock, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const handleOpenProduct = useCallback(
    (product: StoreProduct, metadata?: Record<string, unknown>) => {
      saveScrollPosition('MARKET_PLACE', window.scrollY);
      const marketProduct = product as MarketplaceProduct;
      if (marketProduct.id) {
        trackMarketSignal({
          targetType: 'PRODUCT',
          targetId: marketProduct.id,
          signalType: 'OPEN',
          surface: 'MARKET_HOME',
          metadata,
        });
      }
      setSelectedProduct(marketProduct);
      void flushMarketSignals();
    },
    [flushMarketSignals, saveScrollPosition, trackMarketSignal],
  );

  const handleOpenSectionItem = useCallback(
    (item: MarketSectionItem) => {
      saveScrollPosition('MARKET_PLACE', window.scrollY);
      void flushMarketSignals();
      const route = typeof item.target?.route === 'string' ? item.target.route.trim() : '';
      if (route.startsWith('/')) {
        navigate(route);
        return;
      }
      const targetId = getSectionItemTargetId(item);
      if (item.entityType === 'DESIGN' && targetId) {
        navigate(`/designs/${encodeURIComponent(targetId)}`);
        return;
      }
      if (item.entityType === 'BRAND' && targetId) {
        const brandRoute =
          (typeof item.target?.route === 'string' && item.target.route.startsWith('/')
            ? item.target.route
            : null) ||
          `/profile/${encodeURIComponent(targetId)}?tab=Store`;
        navigate(brandRoute);
        return;
      }
      if (item.entityType === 'COLLECTION' && targetId) {
        navigate(`/collections/${encodeURIComponent(targetId)}`);
        return;
      }
      if (item.entityType === 'PRODUCT' && targetId) {
        navigate(`/products/${encodeURIComponent(targetId)}`);
      }
    },
    [flushMarketSignals, navigate, saveScrollPosition],
  );

  const handleExploreSection = useCallback(
    (sectionKey: string, title: string) => {
      saveScrollPosition('MARKET_PLACE', window.scrollY);
      void flushMarketSignals();
      navigate(`/market/sections/${encodeURIComponent(sectionKey)}`, {
        state: { title },
      });
    },
    [flushMarketSignals, navigate, saveScrollPosition],
  );

  const utcDayIndex = useMemo(() => getUtcDayIndex(marketClockMs), [marketClockMs]);

  const recencySortedProducts = useMemo(
    () => [...products].sort((a, b) => getProductRecencyTimestamp(b) - getProductRecencyTimestamp(a)),
    [products],
  );

  const trendingToday = useMemo(
    () => selectDailyBatch(recencySortedProducts, TRENDING_TODAY_LIMIT, utcDayIndex),
    [recencySortedProducts, utcDayIndex],
  );

  const availableFilters = useMemo(() => {
    const list = [...BASE_FILTERS];
    if (products.some((p) => p.customAvailable === true || p.isCustomOrderOnly)) {
      return [...list, 'CUSTOM_FIT'];
    }
    return list;
  }, [products]);

  // Filter item predicate based on audience, craftsmanship, price, and sort
  const matchesFilters = useCallback(
    (item: MarketSectionItem): boolean => {
      const product = mapSectionProductToMarketplaceProduct(item);
      const effectivePrice =
        item.price?.effectiveAmount ??
        item.price?.amount ??
        product?.effectivePrice ??
        product?.price ??
        0;

      // Audience Filter
      if (selectedAudienceFilter === 'MENSWEAR') {
        if (product && product.sizingMode === 'CUSTOM') return false;
      } else if (selectedAudienceFilter === 'WOMENSWEAR') {
        if (product && product.sizingMode === 'CUSTOM') return false;
      } else if (selectedAudienceFilter === 'ON_SALE') {
        if (product && !product.isOnSale) return false;
      } else if (selectedAudienceFilter === 'CUSTOM_FIT') {
        const isCustom = product?.customAvailable || product?.isCustomOrderOnly || product?.customOrderEnabled;
        if (!isCustom) return false;
      }

      // Craftsmanship Filter
      if (craftsmanshipFilter === 'READY_TO_WEAR') {
        if (product?.isCustomOrderOnly) return false;
      } else if (craftsmanshipFilter === 'CUSTOM_FIT') {
        const isCustom = product?.customAvailable || product?.isCustomOrderOnly || product?.customOrderEnabled;
        if (!isCustom) return false;
      }

      // Price Range Filter
      if (priceRangeFilter === 'UNDER_100K') {
        if (effectivePrice > 100000) return false;
      } else if (priceRangeFilter === '100K_300K') {
        if (effectivePrice < 100000 || effectivePrice > 300000) return false;
      } else if (priceRangeFilter === '300K_500K') {
        if (effectivePrice < 300000 || effectivePrice > 500000) return false;
      } else if (priceRangeFilter === 'ABOVE_500K') {
        if (effectivePrice < 500000) return false;
      }

      return true;
    },
    [craftsmanshipFilter, priceRangeFilter, selectedAudienceFilter],
  );

  const sortItems = useCallback(
    (items: MarketSectionItem[]): MarketSectionItem[] => {
      const sorted = [...items];
      if (sortBy === 'PRICE_LOW') {
        sorted.sort((a, b) => {
          const pa = a.price?.effectiveAmount ?? a.price?.amount ?? 0;
          const pb = b.price?.effectiveAmount ?? b.price?.amount ?? 0;
          return pa - pb;
        });
      } else if (sortBy === 'PRICE_HIGH') {
        sorted.sort((a, b) => {
          const pa = a.price?.effectiveAmount ?? a.price?.amount ?? 0;
          const pb = b.price?.effectiveAmount ?? b.price?.amount ?? 0;
          return pb - pa;
        });
      } else if (sortBy === 'NEWEST') {
        sorted.sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });
      }
      return sorted;
    },
    [sortBy],
  );

  // Dynamically constructed sections: from backend API or curated initial sections
  const processedSections = useMemo((): MarketSection[] => {
    // If backend returned sections, use them
    if (marketSections.length > 0) {
      return marketSections
        .map((section) => {
          const filtered = (section.items ?? []).filter(matchesFilters);
          return {
            ...section,
            items: sortItems(filtered),
          };
        })
        .filter((section) => section.items.length > 0);
    }

    // Fallback constructed initial sections from products
    if (products.length === 0) return [];

    const fallbackItems: MarketSectionItem[] = products.map((p) => ({
      id: p.id,
      entityType: 'PRODUCT',
      sourceType: 'PRODUCT',
      sourceId: p.id,
      title: p.name,
      subtitle: p.brand?.name ?? null,
      price: {
        amount: p.price,
        effectiveAmount: p.effectivePrice,
        currency: 'NGN',
        isOnSale: p.isOnSale,
      },
      media: {
        url: p.thumbnail || p.images[0] || '',
        thumbnailUrl: p.thumbnail || p.images[0] || '',
      },
      brand: p.brand,
      createdAt: p.publishAt || null,
    }));

    const newArrivals = sortItems(fallbackItems.slice(0, 12).filter(matchesFilters));
    const customFitPieces = sortItems(
      fallbackItems
        .filter((i) => {
          const prod = products.find((p) => p.id === i.sourceId);
          return prod?.customAvailable || prod?.isCustomOrderOnly;
        })
        .filter(matchesFilters),
    );
    const trendingDrops = sortItems(fallbackItems.slice(6, 18).filter(matchesFilters));
    const readyToWear = sortItems(
      fallbackItems
        .filter((i) => {
          const prod = products.find((p) => p.id === i.sourceId);
          return prod && !prod.isOutOfStock && !prod.isCustomOrderOnly;
        })
        .filter(matchesFilters),
    );

    const initialList: Array<{
      key: string;
      title: string;
      eyebrow: string;
      items: MarketSectionItem[];
    }> = [];

    if (newArrivals.length > 0) {
      initialList.push({
        key: 'fresh-drops',
        title: 'New Arrivals & Master Ateliers',
        eyebrow: 'HANDPICKED SILHOUETTES',
        items: newArrivals,
      });
    }

    if (trendingDrops.length > 0) {
      initialList.push({
        key: 'hot-right-now',
        title: 'Trending Drops & High Demand',
        eyebrow: 'COMMUNITY FAVORITES',
        items: trendingDrops,
      });
    }

    if (customFitPieces.length > 0) {
      initialList.push({
        key: 'custom-fit',
        title: 'Artisanal & Custom Fit Couture',
        eyebrow: 'MADE TO MEASURE',
        items: customFitPieces,
      });
    }

    if (readyToWear.length > 0) {
      initialList.push({
        key: 'almost-gone',
        title: 'Archive Drops & Ready to Ship',
        eyebrow: 'IMMEDIATE DISPATCH',
        items: readyToWear,
      });
    }

    return initialList.map((sec) => ({
      key: sec.key,
      title: sec.title,
      subtitle: undefined,
      emotionalLabel: sec.eyebrow,
      layout: 'HORIZONTAL_RAIL' as const,
      sourceType: 'PRODUCT' as const,
      previewItemLimit: 12,
      detailPageLimit: 24,
      minimumItems: 1,
      viewAll: {
        enabled: true,
        key: sec.key,
        route: `/market/sections/${sec.key}`,
        label: `Explore ${sec.title}`,
      },
      items: sec.items,
    }));
  }, [marketSections, matchesFilters, products, sortItems]);

  return (
    <div
      className={`mx-auto w-full max-w-[1440px] px-4 pb-16 pt-5 transition-opacity sm:px-6 sm:pt-7 lg:px-8 ${
        refreshing ? 'opacity-95' : 'opacity-100'
      }`}
    >
      <div className="space-y-8 sm:space-y-10">
        {/* ── 1. Top Component: Flagship Trending Hero (Image 1 Parity) ── */}
        <MarketTrendingHero
          products={trendingToday}
          onOpenProduct={handleOpenProduct}
          onSeeAll={() => setTrendingTodayOpen(true)}
        />

        {/* ── 2. Destination Catalog Header & Top Area (Image 2 Parity) ── */}
        <div className="space-y-4 border-t border-gray-200/70 pt-8 dark:border-white/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[color:var(--brand-primary,#9333EA)]">
                DESTINATION CATALOG
              </p>
              <h2 className="mt-1 font-serif text-2xl font-normal tracking-tight text-gray-900 dark:text-white sm:text-3xl">
                Explore the Market
              </h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-xl">
                Discover independent African fashion ateliers, ready-to-wear drops, and bespoke couture.
              </p>
            </div>

            {/* Global Search Bar */}
            <div className="w-full lg:max-w-md">
              <SearchBarWithSuggestions
                placeholder="Search designers, Aso-Oke, trench..."
                className="w-full"
              />
            </div>
          </div>

          {/* Audience Filter Chips Row */}
          <div className="flex items-center gap-2 overflow-x-auto border-b border-gray-200/80 pb-2.5 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-white/10">
            {availableFilters.map((filter) => {
              const active = selectedAudienceFilter === filter;
              return (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setSelectedAudienceFilter(filter)}
                  aria-pressed={active}
                  className={`relative whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                    active
                      ? 'bg-purple-700 text-white shadow-sm'
                      : 'bg-gray-100/80 text-gray-600 hover:bg-gray-200/70 hover:text-gray-900 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10'
                  }`}
                >
                  {filter === 'FOR_YOU' && 'Discover •'}
                  {filter === 'MENSWEAR' && 'Menswear'}
                  {filter === 'WOMENSWEAR' && 'Womenswear'}
                  {filter === 'EVERYBODY' && 'Everybody (genderless)'}
                  {filter === 'ON_SALE' && 'On Sale Archive'}
                  {filter === 'CUSTOM_FIT' && 'Custom Fit'}
                </button>
              );
            })}
          </div>

          {/* Secondary Filter & Sort Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-600 dark:text-gray-400 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium text-gray-500 dark:text-gray-400">Filter by:</span>

              {/* Craftsmanship Type Dropdown */}
              <select
                value={craftsmanshipFilter}
                onChange={(e) => setCraftsmanshipFilter(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 font-medium text-gray-800 shadow-sm transition hover:border-gray-300 dark:border-white/10 dark:bg-[#181322] dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="ALL">All Craftsmanship</option>
                <option value="READY_TO_WEAR">Ready to Wear</option>
                <option value="CUSTOM_FIT">Custom Fit / Bespoke</option>
              </select>

              {/* Price Range Dropdown */}
              <select
                value={priceRangeFilter}
                onChange={(e) => setPriceRangeFilter(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 font-medium text-gray-800 shadow-sm transition hover:border-gray-300 dark:border-white/10 dark:bg-[#181322] dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="ALL">All Price Ranges</option>
                <option value="UNDER_100K">Under ₦100,000</option>
                <option value="100K_300K">₦100,000 - ₦300,000</option>
                <option value="300K_500K">₦300,000 - ₦500,000</option>
                <option value="ABOVE_500K">Above ₦500,000</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <span>
                Showing <strong className="font-semibold text-gray-900 dark:text-white">{processedSections.length}</strong> curated sections
              </span>
              <span>•</span>
              <div className="flex items-center gap-1.5">
                <span>Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1 font-semibold text-gray-800 shadow-sm dark:border-white/10 dark:bg-[#181322] dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="EDITORIAL">Curated Editorial</option>
                  <option value="NEWEST">Newest Drops</option>
                  <option value="PRICE_LOW">Price: Low to High</option>
                  <option value="PRICE_HIGH">Price: High to Low</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* ── 3. 100% Section-Driven Rails (Zero Vertical Infinite Grid on Home) ── */}
        {loading ? (
          <div className="space-y-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="h-6 w-48 animate-pulse rounded-lg bg-gray-200 dark:bg-white/10" />
                <div className="flex gap-4 overflow-hidden">
                  {Array.from({ length: 4 }).map((__, j) => (
                    <div key={j} className="w-[300px] shrink-0">
                      <ProductCardSkeleton />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : processedSections.length > 0 ? (
          <div className="space-y-10 sm:space-y-12">
            {processedSections.map((section) => (
              <MarketSectionRail
                key={section.key}
                section={section}
                title={section.title}
                eyebrow={section.emotionalLabel ?? undefined}
                items={section.items}
                onViewProduct={(product) => handleOpenProduct(product, { source: `section_${section.key}` })}
                onOpenItem={handleOpenSectionItem}
                onTrackSignal={trackMarketSignal}
                onExploreSection={handleExploreSection}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-gray-200 bg-white/70 p-12 text-center shadow-sm dark:border-white/10 dark:bg-white/5">
            <p className="text-3xl">🧭</p>
            <h3 className="mt-3 font-serif text-xl font-bold text-gray-900 dark:text-white">
              No sections matched your filter criteria
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Try switching back to &apos;Discover •&apos; or resetting your craftsmanship and price filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedAudienceFilter('FOR_YOU');
                setCraftsmanshipFilter('ALL');
                setPriceRangeFilter('ALL');
                setSortBy('EDITORIAL');
              }}
              className="mt-5 rounded-full bg-purple-700 px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-md transition hover:bg-purple-600 active:scale-95"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* ── Product Quick Detail Overlay ── */}
      <DeferredOverlay open={Boolean(selectedProduct)}>
        <MarketProductOverlay product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      </DeferredOverlay>

      {/* ── Full Editorial Queue Modal (Trending Today) ── */}
      <DeferredOverlay open={trendingTodayOpen}>
      <MarketTrendingTodayModal
        open={trendingTodayOpen}
        products={trendingToday}
        onClose={() => setTrendingTodayOpen(false)}
        onOpenProduct={handleOpenProduct}
      />
      </DeferredOverlay>
    </div>
  );
};

export default MarketPlace;
