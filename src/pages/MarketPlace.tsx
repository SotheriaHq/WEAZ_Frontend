import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import { apiClient } from '@/api/httpClient';
import { unwrapApiResponse, type ApiSuccessPayload } from '@/types/auth';
import type { AppDispatch, RootState } from '@/store';
import ImageWithFallback from '@/components/ImageWithFallback';
import StoreProductCard, { type StoreProduct } from '@/components/designs/StoreProductCard';
import ProductCardSkeleton from '@/components/designs/ProductCardSkeleton';
import InlineProductDetail from '@/components/catalog/InlineProductDetail';
import { fetchWishlist } from '@/features/wishlistSlice';
import FeaturedSection from '@/components/FeaturedSection';
import FeaturedGalleryModal from '@/components/FeaturedGalleryModal';
import SearchBarWithSuggestions from '@/components/search/SearchBarWithSuggestions';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { normalizeSizingMode } from '@/types/sizing';

interface RawProductsPayload {
  items?: any[];
  total?: number;
  hasNextPage?: boolean;
  nextCursor?: string | null;
}

const BASE_FILTERS = ['FOR_YOU', 'MENSWEAR', 'WOMENSWEAR', 'EVERYBODY', 'ON_SALE'] as const;

type MarketplaceProduct = StoreProduct & {
  createdAt?: string;
  updatedAt?: string;
};

// Speed in pixels per second for the marquee
const MARQUEE_PX_PER_S = 40;
// Width per compact carousel card (336px) + gap-4 (16px)
const CARD_WIDTH = 352;
const FRESH_DROP_DAY_MS = 24 * 60 * 60 * 1000;
const FRESH_DROP_MAX_AGE_MS = 7 * FRESH_DROP_DAY_MS;
const SYSTEM_FRESH_DROPS_LIMIT = 20;
const ADMIN_FRESH_DROPS_LIMIT = 10;

const MARKET_LOAD_PAGE_LIMIT = 120;
const MARKET_LOAD_MAX_PAGES = 40;
const MARKET_LOAD_MAX_ROWS = 4800;

const parseTimestamp = (value?: string | null): number => {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
};

const getProductRecencyTimestamp = (product: MarketplaceProduct): number => {
  const createdTs = parseTimestamp(product.createdAt);
  const updatedTs = parseTimestamp(product.updatedAt);
  const publishedTs = parseTimestamp(product.publishAt ?? null);
  return Math.max(createdTs, updatedTs, publishedTs);
};

const getUtcDayIndex = (nowMs: number): number => Math.floor(nowMs / FRESH_DROP_DAY_MS);

const selectDailyBatch = <T,>(items: T[], batchSize: number, utcDayIndex: number): T[] => {
  if (items.length === 0 || batchSize <= 0) return [];
  const batchCount = Math.max(1, Math.ceil(items.length / batchSize));
  const safeDayIndex = Number.isFinite(utcDayIndex) ? Math.max(0, Math.floor(utcDayIndex)) : 0;
  const batchIndex = safeDayIndex % batchCount;
  const start = batchIndex * batchSize;
  return items.slice(start, start + batchSize);
};

const ProductCarousel: React.FC<{
  title: string;
  products: MarketplaceProduct[];
  onViewProduct: (product: StoreProduct) => void;
}> = ({ title, products, onViewProduct }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [previewNavigationActive, setPreviewNavigationActive] = useState(false);
  const useMarquee = products.length > 2;

  // Duplicate only when marquee is active so the seamless loop works.
  // The CSS animation translates by -50% of the track width, which equals one copy.
  const duplicatedProducts = useMemo(
    () => (useMarquee ? [...products, ...products] : products),
    [products, useMarquee],
  );

  // Duration: time to scroll one full copy width
  const durationS = useMemo(
    () => Math.max(18, Math.round((products.length * CARD_WIDTH) / MARQUEE_PX_PER_S)),
    [products.length],
  );

  if (products.length === 0) return null;

  return (
    <section className="space-y-3">
      {/* keyframes injected once per carousel render */}
      <style>{`
        @keyframes threadly-marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>

      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h2>
        {useMarquee ? (
          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            className="rounded-full border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-100 dark:border-white/10 dark:text-gray-400 dark:hover:bg-white/10"
            aria-label={isPaused ? 'Resume auto-scroll' : 'Pause auto-scroll'}
          >
            {isPaused ? '▶' : '⏸'}
          </button>
        ) : null}
      </div>

      {useMarquee ? (
        <div
          className="overflow-hidden"
          onMouseLeave={() => setPreviewNavigationActive(false)}
        >
          <div
            className="flex gap-4"
            style={{
              width: 'max-content',
              animation: `threadly-marquee ${durationS}s linear infinite`,
              animationPlayState: isPaused || previewNavigationActive ? 'paused' : 'running',
            }}
          >
            {duplicatedProducts.map((product, index) => (
              <div
                key={`${product.id}-${index}`}
                className="w-[336px] max-w-[82vw] shrink-0"
              >
                <StoreProductCard
                  product={product}
                  onViewProduct={onViewProduct}
                  enableHoverGallery
                  onPreviewNavigationActiveChange={setPreviewNavigationActive}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-4">
            {products.map((product) => (
              <div key={product.id} className="w-[336px] max-w-[82vw] shrink-0">
                <StoreProductCard
                  product={product}
                  onViewProduct={onViewProduct}
                  enableHoverGallery
                  onPreviewNavigationActiveChange={() => undefined}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

const normalizeProduct = (raw: any): MarketplaceProduct | null => {
  const id = String(raw?.id ?? '').trim();
  if (!id) return null;

  const brand = raw?.brand ?? raw?.collection?.brand ?? {};
  const price = Number(raw?.price ?? 0);
  const salePrice = raw?.salePrice != null ? Number(raw.salePrice) : null;
  const totalStock = Number(raw?.totalStock ?? 0);
  const now = Date.now();
  const saleStartAt = raw?.saleStartAt ? new Date(raw.saleStartAt).getTime() : null;
  const saleEndAt = raw?.saleEndAt ? new Date(raw.saleEndAt).getTime() : null;
  const saleWindowValid = (!saleStartAt || saleStartAt <= now) && (!saleEndAt || saleEndAt >= now);
  const isOnSale = Boolean(salePrice != null && salePrice > 0 && salePrice < price && saleWindowValid);
  const effectivePrice = isOnSale ? Number(salePrice) : price;
  const discountPercent = isOnSale ? Math.round(((price - Number(salePrice)) / price) * 100) : null;

  const media = Array.isArray(raw?.media)
    ? raw.media
      .map((m: any) => {
        const mediaId = m?.id ? String(m.id) : null;
        const mediaUrl = m?.url ? String(m.url) : null;
        if (!mediaId || !mediaUrl) return null;
        return {
          id: mediaId,
          url: mediaUrl,
          type: String(m?.type ?? 'image'),
          isPrimary: Boolean(m?.isPrimary),
        };
      })
      .filter(Boolean) as Array<{ id: string; url: string; type: string; isPrimary?: boolean }>
    : [];

  const sizeAvailability = Array.isArray(raw?.sizes)
    ? raw.sizes.map((size: any) => ({
      size: String(size),
      inStock: totalStock > 0,
      quantity: totalStock,
    }))
    : [];

  const variants = Array.isArray(raw?.variants)
    ? raw.variants
      .map((v: any) => {
        const id = String(v?.id ?? '').trim();
        if (!id) return null;
        return {
          id,
          size: v?.size != null ? String(v.size) : null,
          color: v?.color != null ? String(v.color) : null,
          stock: Number(v?.stock ?? 0),
          price: v?.price != null ? Number(v.price) : null,
          sku: v?.sku != null ? String(v.sku) : null,
          colorHex: v?.colorHex != null ? String(v.colorHex) : null,
        };
      })
      .filter((v: NonNullable<typeof variants>[number] | null): v is NonNullable<typeof v> => Boolean(v))
    : [];

  return {
    id,
    collectionId: String(raw?.collectionId ?? raw?.collection?.id ?? ''),
    brandId: String(raw?.brandId ?? brand?.id ?? ''),
    name: String(raw?.name ?? 'Product'),
    description: raw?.description ? String(raw.description) : undefined,
    price,
    salePrice,
    effectivePrice,
    isOnSale,
    discountPercent,
    thumbnail: raw?.thumbnail ? String(raw.thumbnail) : undefined,
    images: Array.isArray(raw?.images) ? raw.images.map((img: any) => String(img)) : [],
    media,
    sizes: Array.isArray(raw?.sizes) ? raw.sizes.map((size: any) => String(size)) : [],
    sizingMode: normalizeSizingMode(raw?.sizingMode),
    customMeasurementKeys: Array.isArray(raw?.customMeasurementKeys)
      ? raw.customMeasurementKeys.map((k: any) => String(k))
      : [],
    customAvailable: Boolean(raw?.customAvailable ?? raw?.customOrderEnabled),
    customOrderEnabled: Boolean(
      raw?.customOrderEnabled ?? raw?.customAvailable,
    ),
    isCustomOrderOnly: Boolean(raw?.isCustomOrderOnly),
    canBagWhenOutOfStock: Boolean(raw?.canBagWhenOutOfStock),
    sizeAvailability,
    colors: Array.isArray(raw?.colors) ? raw.colors.map((c: any) => String(c)) : [],
    variants,
    totalStock,
    isLowStock: totalStock > 0 && totalStock <= 5,
    isOutOfStock: totalStock <= 0,
    isFeatured: Boolean(raw?.isFeatured),
    isActive: typeof raw?.isActive === 'boolean' ? raw.isActive : undefined,
    publishAt: raw?.publishAt ? String(raw.publishAt) : null,
    createdAt: raw?.createdAt ? String(raw.createdAt) : undefined,
    updatedAt: raw?.updatedAt ? String(raw.updatedAt) : undefined,
    threadsCount: Number(raw?.threadsCount ?? 0),
    viewsCount: Number(raw?.viewsCount ?? 0),
    brand: {
      id: String(brand?.id ?? raw?.brandId ?? ''),
      name: String(brand?.brandName ?? brand?.name ?? 'Brand'),
      logo: brand?.logoUrl ? String(brand.logoUrl) : undefined,
      currency: String(brand?.currency ?? 'NGN'),
    },
  };
};

const isOutOfStockCustomOrderProduct = (product: MarketplaceProduct) =>
  Boolean(
    product.isCustomOrderOnly ||
      product.canBagWhenOutOfStock ||
      (product.customOrderEnabled && Number(product.totalStock ?? 0) <= 0),
  );

const MarketPlace: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const isAuth = useSelector((state: RootState) => state.user.isAuthenticated);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('FOR_YOU');
  const [visibleCount, setVisibleCount] = useState(18);
  const [heroIndex, setHeroIndex] = useState(0);
  const [utcDayIndex, setUtcDayIndex] = useState<number>(() => getUtcDayIndex(Date.now()));


  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const aggregatedRows: any[] = [];
      let cursor: string | null | undefined = null;
      let hasNextPage = true;
      let pagesFetched = 0;

      while (
        hasNextPage &&
        pagesFetched < MARKET_LOAD_MAX_PAGES &&
        aggregatedRows.length < MARKET_LOAD_MAX_ROWS
      ) {
        const response: { data: unknown } = await apiClient.get('/store/products/market', {
          params: {
            limit: MARKET_LOAD_PAGE_LIMIT,
            sortBy: 'newest',
            ...(cursor ? { cursor } : {}),
          },
        });

        const payload: RawProductsPayload = unwrapApiResponse<RawProductsPayload>(
          response.data as ApiSuccessPayload<RawProductsPayload>,
        );
        const rows = Array.isArray(payload?.items) ? payload.items : [];
        aggregatedRows.push(...rows);

        hasNextPage = Boolean(payload?.hasNextPage);
        cursor = payload?.nextCursor ?? null;
        pagesFetched += 1;

        if (!cursor || rows.length === 0) {
          break;
        }
      }

      const mapped = aggregatedRows
        .map((row) => normalizeProduct(row))
        .filter((p): p is MarketplaceProduct => Boolean(p));

      const dedupedById = new Map<string, MarketplaceProduct>();
      for (const product of mapped) {
        if (!dedupedById.has(product.id)) {
          dedupedById.set(product.id, product);
        }
      }

      const sorted = Array.from(dedupedById.values()).sort(
        (a, b) => getProductRecencyTimestamp(b) - getProductRecencyTimestamp(a),
      );

      setProducts(sorted);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Unable to load the general market right now.';
      setError(message);
      toast.error(typeof message === 'string' ? message : 'Failed to load market.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (!isAuth) return;
    void dispatch(fetchWishlist({ page: 1, limit: 100 }));
  }, [dispatch, isAuth]);

  useEffect(() => {
    const updateDayIndex = () => setUtcDayIndex(getUtcDayIndex(Date.now()));
    updateDayIndex();
    const interval = window.setInterval(updateDayIndex, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const availableFilters = useMemo(() => {
    const fromProducts = new Set<string>(BASE_FILTERS);
    if (products.some((p) => p.customAvailable === true)) {
      fromProducts.add('CUSTOM_FIT');
    }
    return Array.from(fromProducts);
  }, [products]);

  const recencySortedProducts = useMemo(
    () => [...products].sort((a, b) => getProductRecencyTimestamp(b) - getProductRecencyTimestamp(a)),
    [products],
  );

  const weeklyEligibleProducts = useMemo(() => {
    const nowMs = Date.now();
    return recencySortedProducts.filter((product) => {
      const recencyTs = getProductRecencyTimestamp(product);
      return recencyTs > 0 && nowMs - recencyTs <= FRESH_DROP_MAX_AGE_MS;
    });
  }, [recencySortedProducts, utcDayIndex]);

  const adminFeaturedFreshDrops = useMemo(
    () => weeklyEligibleProducts.filter((product) => product.isFeatured === true).slice(0, ADMIN_FRESH_DROPS_LIMIT),
    [weeklyEligibleProducts],
  );

  const systemFreshDropPool = useMemo(() => {
    const adminFeaturedIds = new Set(adminFeaturedFreshDrops.map((product) => product.id));
    return weeklyEligibleProducts.filter((product) => !adminFeaturedIds.has(product.id));
  }, [weeklyEligibleProducts, adminFeaturedFreshDrops]);

  const systemFreshDrops = useMemo(
    () => selectDailyBatch(systemFreshDropPool, SYSTEM_FRESH_DROPS_LIMIT, utcDayIndex),
    [systemFreshDropPool, utcDayIndex],
  );

  const freshDrops = useMemo(() => {
    const combined = [...adminFeaturedFreshDrops, ...systemFreshDrops];
    return combined.slice(0, SYSTEM_FRESH_DROPS_LIMIT + ADMIN_FRESH_DROPS_LIMIT);
  }, [adminFeaturedFreshDrops, systemFreshDrops]);

  const heroProducts = useMemo(() => recencySortedProducts.slice(0, 3), [recencySortedProducts]);

  useEffect(() => {
    if (heroProducts.length === 0) return;
    const interval = window.setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroProducts.length);
    }, 4500);
    return () => window.clearInterval(interval);
  }, [heroProducts.length]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (selectedFilter === 'MENSWEAR' && product.sizingMode === 'CUSTOM') return false;
      if (selectedFilter === 'WOMENSWEAR' && product.sizingMode === 'CUSTOM') return false;
      if (selectedFilter === 'ON_SALE' && !product.isOnSale) return false;
      if (
        selectedFilter === 'CUSTOM_FIT' &&
        product.customAvailable !== true
      ) {
        return false;
      }

      return true;
    });
  }, [products, selectedFilter]);

  const outOfStockCustomOrderProducts = useMemo(
    () => filteredProducts.filter((product) => isOutOfStockCustomOrderProduct(product)),
    [filteredProducts],
  );

  const generalMarketProducts = useMemo(
    () => filteredProducts.filter((product) => !isOutOfStockCustomOrderProduct(product)),
    [filteredProducts],
  );

  const visibleProducts = useMemo(
    () => generalMarketProducts.slice(0, visibleCount),
    [generalMarketProducts, visibleCount],
  );

  useEffect(() => {
    setVisibleCount(18);
  }, [selectedFilter]);

  const activeHero = heroProducts[heroIndex] ?? null;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-4 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <section className="rounded-2xl bg-white/35 p-3 backdrop-blur-[2px] ring-1 ring-gray-200/55 dark:bg-white/[0.03] dark:ring-white/10 sm:p-4">
          <div className="grid grid-cols-1 gap-3 lg:min-h-[54px] lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="min-h-[46px] sm:min-h-[54px] lg:h-full lg:min-h-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeHero?.id ?? 'hero-empty'}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="relative h-full overflow-hidden rounded-2xl"
                >
                  {activeHero ? (
                    <>
                      <div className="absolute inset-0">
                        <ImageWithFallback
                          src={activeHero.thumbnail || activeHero.images[0] || null}
                          alt={activeHero.name}
                          fit="cover"
                          rounded="none"
                          containerClassName="h-full w-full"
                          className="h-full w-full"
                          maxHeightClassName="max-h-full"
                          fallbackName={activeHero.name}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      </div>
                      <div className="relative flex h-full min-h-[46px] flex-col justify-end p-3 text-white sm:min-h-[54px] lg:min-h-0">
                        <span className="mb-2 inline-flex w-fit items-center gap-2 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur">
                          🔥 Trending now
                        </span>
                        <h1 className="max-w-xl text-lg font-black leading-tight sm:text-2xl">
                          {activeHero.name}
                        </h1>
                        <p className="mt-1 text-xs text-white/80 sm:text-sm">
                          {activeHero.brand?.name || 'Threadly Brand'} · Smooth picks from recent brand drops.
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedProduct(activeHero)}
                            className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-gray-900 transition-transform hover:scale-[1.02]"
                          >
                            👀 View product
                          </button>
                          <span className="rounded-full bg-black/40 px-3 py-1.5 text-xs font-semibold">
                            {new Intl.NumberFormat('en-NG', {
                              style: 'currency',
                              currency: 'NGN',
                              maximumFractionDigits: 0,
                            }).format(activeHero.effectivePrice || activeHero.price || 0)}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full min-h-[46px] items-center justify-center rounded-2xl bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300 sm:min-h-[54px] lg:min-h-0">
                      No featured products yet.
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:h-full lg:grid-cols-1 lg:grid-rows-2">
              {heroProducts.slice(0, 2).map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setSelectedProduct(product)}
                  className="group relative h-[37px] overflow-hidden rounded-xl bg-gray-100 text-left ring-1 ring-gray-200/70 dark:bg-white/5 dark:ring-white/10 sm:h-[42px] lg:h-full"
                >
                  <ImageWithFallback
                    src={product.thumbnail || product.images[0] || null}
                    alt={product.name}
                    fit="cover"
                    rounded="none"
                    containerClassName="absolute inset-0 h-full w-full"
                    className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                    maxHeightClassName="max-h-full"
                    fallbackName={product.name}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/70">{product.brand?.name}</p>
                    <p className="mt-1 line-clamp-2 text-sm font-bold">{product.name}</p>
                    <p className="mt-3 text-xs font-semibold text-white/80">✨ Tap to preview</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <FeaturedSection
          filterType="PRODUCT"
          onViewProduct={(productId) => {
            const p = products.find((pr) => pr.id === productId);
            if (p) setSelectedProduct(p);
          }}
          onSeeAll={() => setGalleryOpen(true)}
        />

        {loading ? (
          <section>
            <div className="mb-3 h-7 w-40 animate-pulse rounded-lg bg-gray-200/80 dark:bg-white/10" />
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="min-w-[260px] max-w-[260px]">
                  <ProductCardSkeleton />
                </div>
              ))}
            </div>
          </section>
        ) : (
          <ProductCarousel
            title="Fresh Drops"
            products={freshDrops}
            onViewProduct={setSelectedProduct}
          />
        )}



        <section className="space-y-5">
          <div className="sticky top-16 z-20 rounded-2xl border border-gray-200/70 bg-white/55 px-3 py-3 backdrop-blur-[4px] sm:p-4 dark:border-white/10 dark:bg-[#0f0b13]/55">
            {/* Heading + search row — on small screens header is compact, search hidden */}
            <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-stretch sm:gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-black text-gray-900 dark:text-white sm:text-2xl">Explore the Market</h2>
                <p className="hidden text-sm text-gray-600 dark:text-gray-400 sm:block">
                  Tap any product to preview, wishlist, or add to bag. Use global search for product, brand, design, and tag discovery.
                </p>
              </div>
              <div className="hidden w-full flex-col gap-3 sm:flex lg:w-auto lg:min-w-[520px] lg:flex-row">
                <SearchBarWithSuggestions
                  placeholder="Search products, brands, styles, or tags..."
                  className="w-full"
                />
              </div>
            </div>
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 sm:gap-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {availableFilters.map((filter) => {
                const active = selectedFilter === filter;
                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setSelectedFilter(filter)}
                    className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
                      active
                        ? 'border-purple-500 bg-purple-600 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
                    }`}
                  >
                    {filter === 'FOR_YOU' && '✨ For You'}
                    {filter === 'MENSWEAR' && '🧥 Menswear'}
                    {filter === 'WOMENSWEAR' && '👗 Womenswear'}
                    {filter === 'EVERYBODY' && '🌍 Everybody'}
                    {filter === 'ON_SALE' && '🏷️ On Sale'}
                    {filter === 'CUSTOM_FIT' && '✂️ Custom Fit'}
                  </button>
                );
              })}
            </div>
            {/* Search visible only on small screens — below the filter chips */}
            <div className="mt-2 sm:hidden">
              <SearchBarWithSuggestions
                placeholder="Search products, brands..."
                className="w-full"
              />
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 12 }).map((_, index) => (
                <ProductCardSkeleton key={index} />
              ))}
            </div>
          ) : generalMarketProducts.length === 0 && outOfStockCustomOrderProducts.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white/70 p-10 text-center dark:border-white/10 dark:bg-white/5">
              <p className="text-3xl">🧭</p>
              <h3 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">No products matched this view</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Try another market filter or use the global search bar above for broader discovery.</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedFilter('FOR_YOU');
                }}
                className="mt-5 rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
              >
                Reset view
              </button>
            </div>
          ) : (
            <>
              {visibleProducts.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                    {visibleProducts.map((product) => (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="w-full"
                      >
                        <StoreProductCard product={product} onViewProduct={setSelectedProduct} />
                      </motion.div>
                    ))}
                  </div>

                  {visibleCount < generalMarketProducts.length && (
                    <div className="flex justify-center pt-4">
                      <button
                        type="button"
                        onClick={() => setVisibleCount((prev) => prev + 18)}
                        className="rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-100 dark:border-white/15 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10"
                      >
                        Load more items
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-2xl border border-amber-300/70 bg-amber-50/80 p-5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  No in-stock products matched this view. Custom-order-only pieces that are temporarily out of stock are still available below.
                </div>
              )}

              {outOfStockCustomOrderProducts.length > 0 ? (
                <section className="space-y-4 rounded-2xl border border-amber-300/70 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <div className="space-y-1">
                    <h3 className="text-lg font-black text-gray-900 dark:text-white">Out Of Stock, Still Open For Custom Orders</h3>
                    <p className="text-sm text-gray-700 dark:text-amber-100/90">
                      These products are sold out for standard checkout, but brands still accept custom-order bags. If they are not restocked within 7 days, they leave the market automatically.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                    {outOfStockCustomOrderProducts.map((product) => (
                      <motion.div
                        key={`custom-order-only-${product.id}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="w-full"
                      >
                        <StoreProductCard product={product} onViewProduct={setSelectedProduct} />
                      </motion.div>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </section>
      </div>

      <AnimatePresence>
        {selectedProduct && (
          <OverlayPortal>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-layer-modal bg-black/60 p-3 backdrop-blur-sm sm:p-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              className="mx-auto h-full w-full max-w-6xl overflow-y-auto rounded-3xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-[#120d18] sm:p-6"
            >
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-white/20 dark:text-gray-200 dark:hover:bg-white/10"
                >
                  ✖ Close
                </button>
              </div>
              <InlineProductDetail
                product={selectedProduct}
                onBack={() => setSelectedProduct(null)}
                brandName={selectedProduct.brand?.name}
              />
            </motion.div>
          </motion.div>
          </OverlayPortal>
        )}
      </AnimatePresence>

      <FeaturedGalleryModal open={galleryOpen} onClose={() => setGalleryOpen(false)} />
    </div>
  );
};

export default MarketPlace;
