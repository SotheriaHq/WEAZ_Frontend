import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { apiClient } from '@/api/httpClient';
import { marketApi, type MarketSection, type MarketSectionItem, type MarketSignalEvent } from '@/api/MarketApi';
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
import {
  getProductRecencyTimestamp,
  normalizeMarketProduct,
  type MarketplaceProduct,
  type RawProductsPayload,
} from '@/utils/marketProductMapper';
import {
  getSectionItemSignalKey,
  getSectionItemTargetId,
  mapSectionProductToMarketplaceProduct,
} from '@/utils/marketSectionMapper';
import { useMarketSignals } from '@/hooks/useMarketSignals';

const BASE_FILTERS = ['FOR_YOU', 'MENSWEAR', 'WOMENSWEAR', 'EVERYBODY', 'ON_SALE'] as const;

// Speed in pixels per second for the marquee
const MARQUEE_PX_PER_S = 40;
// Width per compact carousel card (336px) + gap-4 (16px)
const CARD_WIDTH = 352;
const FRESH_DROP_DAY_MS = 24 * 60 * 60 * 1000;
const FRESH_DROP_MAX_AGE_MS = 7 * FRESH_DROP_DAY_MS;
const SYSTEM_FRESH_DROPS_LIMIT = 20;
const ADMIN_FRESH_DROPS_LIMIT = 10;

const MARKET_FALLBACK_PRODUCT_LIMIT = 24;

const getUtcDayIndex = (nowMs: number): number => Math.floor(nowMs / FRESH_DROP_DAY_MS);

const selectDailyBatch = <T,>(items: T[], batchSize: number, utcDayIndex: number): T[] => {
  if (items.length === 0 || batchSize <= 0) return [];
  const batchCount = Math.max(1, Math.ceil(items.length / batchSize));
  const safeDayIndex = Number.isFinite(utcDayIndex) ? Math.max(0, Math.floor(utcDayIndex)) : 0;
  const batchIndex = safeDayIndex % batchCount;
  const start = batchIndex * batchSize;
  return items.slice(start, start + batchSize);
};

const isCanceledRequest = (err: unknown) => {
  const error = err as { code?: string; name?: string; message?: string };
  return (
    error?.code === 'ERR_CANCELED' ||
    error?.name === 'CanceledError' ||
    error?.message === 'canceled'
  );
};

const extractProductsFromSections = (sections: MarketSection[]) => {
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

const MarketSectionPreviewRail: React.FC<{
  section: MarketSection;
  onViewProduct: (product: MarketplaceProduct) => void;
  onTrackSignal: (event: MarketSignalEvent) => void;
  onHideItem: (section: MarketSection, item: MarketSectionItem) => void;
  onViewAll: (section: MarketSection) => void;
}> = ({ section, onViewProduct, onTrackSignal, onHideItem, onViewAll }) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const observedKeysRef = useRef<Set<string>>(new Set());
  const sectionObservedRef = useRef(false);

  const itemsBySignalKey = useMemo(() => {
    return new Map(
      (section.items ?? []).map((item, index) => [
        getSectionItemSignalKey(section.key, item, index),
        { item, index },
      ]),
    );
  }, [section.items, section.key]);

  const setItemRef = useCallback((key: string, node: HTMLDivElement | null) => {
    if (!node) {
      itemRefs.current.delete(key);
      return;
    }
    itemRefs.current.set(key, node);
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;

          if (entry.target === sectionRef.current && !sectionObservedRef.current) {
            sectionObservedRef.current = true;
            onTrackSignal({
              targetType: 'SECTION',
              targetId: section.key,
              signalType: 'MARKET_SECTION_VIEW',
              surface: 'MARKET_HOME',
              sectionKey: section.key,
            });
            continue;
          }

          const signalKey = (entry.target as HTMLElement).dataset.marketSignalKey;
          if (!signalKey || observedKeysRef.current.has(signalKey)) continue;
          const payload = itemsBySignalKey.get(signalKey);
          const targetId = payload ? getSectionItemTargetId(payload.item) : '';
          if (!payload || !targetId) continue;

          observedKeysRef.current.add(signalKey);
          if (observedKeysRef.current.size > 300) {
            observedKeysRef.current.clear();
          }
          onTrackSignal({
            targetType: payload.item.entityType,
            targetId,
            signalType: 'IMPRESSION',
            surface: 'MARKET_HOME',
            sectionKey: section.key,
            position: payload.index,
          });
        }
      },
      { threshold: 0.5 },
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    for (const node of itemRefs.current.values()) {
      observer.observe(node);
    }

    return () => observer.disconnect();
  }, [itemsBySignalKey, onTrackSignal, section.key]);

  if (!section.items?.length) return null;

  return (
    <section ref={sectionRef} className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{section.title}</h2>
          {section.subtitle ? (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{section.subtitle}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {section.emotionalLabel ? (
            <span className="hidden rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-300 sm:inline-flex">
              {section.emotionalLabel}
            </span>
          ) : null}
          {section.viewAll?.enabled ? (
            <button
              type="button"
              onClick={() => onViewAll(section)}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 transition hover:bg-gray-100 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/10"
            >
              {section.viewAll.label || 'View all'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-4">
          {section.items.map((item, index) => {
            const product = mapSectionProductToMarketplaceProduct(item);
            const mediaUrl = item.media?.thumbnailUrl || item.media?.url || null;
            const signalKey = getSectionItemSignalKey(section.key, item, index);
            const targetId = getSectionItemTargetId(item);
            const priceLabel = item.price?.effectiveAmount
              ? new Intl.NumberFormat('en-NG', {
                  style: 'currency',
                  currency: item.price.currency || 'NGN',
                  maximumFractionDigits: 0,
                }).format(item.price.effectiveAmount)
              : item.priceRange?.min
                ? `From ${new Intl.NumberFormat('en-NG', {
                    style: 'currency',
                    currency: item.priceRange.currency || 'NGN',
                    maximumFractionDigits: 0,
                  }).format(item.priceRange.min)}`
                : item.stats?.products
                  ? `${item.stats.products} item${item.stats.products === 1 ? '' : 's'}`
                  : null;

            return (
              <div
                key={`${section.key}-${item.sourceType}-${item.sourceId}`}
                ref={(node) => setItemRef(signalKey, node)}
                data-market-signal-key={signalKey}
                className="group relative w-[260px] shrink-0 overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-gray-200/70 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-white/[0.04] dark:ring-white/10"
              >
                <button
                  type="button"
                  disabled={!product}
                  onClick={() => {
                    if (!product || !targetId) return;
                    onTrackSignal({
                      targetType: item.entityType,
                      targetId,
                      signalType: 'OPEN',
                      surface: 'MARKET_HOME',
                      sectionKey: section.key,
                      position: index,
                    });
                    onViewProduct(product);
                  }}
                  className="block w-full text-left disabled:cursor-default"
                >
                  {mediaUrl ? (
                    <ImageWithFallback
                      src={mediaUrl}
                      alt={item.media?.alt || item.title}
                      fit="cover"
                      rounded="none"
                      containerClassName="h-40 w-full bg-gray-100 dark:bg-white/5"
                      className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                      maxHeightClassName="max-h-full"
                      fallbackName={item.title}
                    />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center bg-gray-100 text-3xl dark:bg-white/5">
                      #
                    </div>
                  )}
                  <div className="space-y-1 p-3">
                    <p className="line-clamp-1 text-sm font-bold text-gray-900 dark:text-white">{item.title}</p>
                    {item.subtitle || item.brand?.name ? (
                      <p className="line-clamp-1 text-xs text-gray-500 dark:text-gray-400">
                        {item.subtitle || item.brand?.name}
                      </p>
                    ) : null}
                    {priceLabel ? (
                      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{priceLabel}</p>
                    ) : null}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onTrackSignal({
                      targetType: item.entityType,
                      targetId: targetId || item.sourceId || item.id,
                      signalType: 'NOT_INTERESTED',
                      surface: 'MARKET_HOME',
                      sectionKey: section.key,
                      position: index,
                    });
                    onHideItem(section, item);
                  }}
                  className="absolute right-2 top-2 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 shadow-sm transition-opacity hover:bg-black/80 focus:opacity-100 group-hover:opacity-100"
                >
                  Not interested
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const isOutOfStockCustomOrderProduct = (product: MarketplaceProduct) =>
  Boolean(
    product.isCustomOrderOnly ||
      product.canBagWhenOutOfStock ||
      (product.customOrderEnabled && Number(product.totalStock ?? 0) <= 0),
  );

const MarketPlace: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const isAuth = useSelector((state: RootState) => state.user.isAuthenticated);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [marketSections, setMarketSections] = useState<MarketSection[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('FOR_YOU');
  const [visibleCount, setVisibleCount] = useState(18);
  const [heroIndex, setHeroIndex] = useState(0);
  const [marketClockMs, setMarketClockMs] = useState<number>(() => Date.now());
  const { anonymousSessionId, flushMarketSignals, trackMarketSignal } = useMarketSignals('MARKET_HOME');


  const loadProducts = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);

    try {
      try {
        const sectionPayload = await marketApi.getMarketSections(
          { limit: 8, anonymousSessionId },
          { signal },
        );
        if (signal?.aborted) return;

        const sections = Array.isArray(sectionPayload.sections) ? sectionPayload.sections : [];
        const sectionProducts = extractProductsFromSections(sections);
        setMarketSections(sections);

        if (sectionProducts.length > 0) {
          setProducts(sectionProducts);
          return;
        }
      } catch (sectionError) {
        if (isCanceledRequest(sectionError)) return;
        setMarketSections([]);
      }

      const response: { data: unknown } = await apiClient.get('/store/products/market', {
        params: {
          limit: MARKET_FALLBACK_PRODUCT_LIMIT,
          sortBy: 'newest',
        },
        signal,
      });

      if (signal?.aborted) return;
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

      const sorted = Array.from(dedupedById.values()).sort(
        (a, b) => getProductRecencyTimestamp(b) - getProductRecencyTimestamp(a),
      );

      setProducts(sorted);
    } catch (err: any) {
      if (isCanceledRequest(err)) return;
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Unable to load the general market right now.';
      setError(message);
      toast.error(typeof message === 'string' ? message : 'Failed to load market.');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [anonymousSessionId]);

  useEffect(() => {
    const controller = new AbortController();
    void loadProducts(controller.signal);
    return () => controller.abort();
  }, [loadProducts]);

  useEffect(() => {
    if (!isAuth) return;
    void dispatch(fetchWishlist({ page: 1, limit: 100 }));
  }, [dispatch, isAuth]);

  const handleOpenProduct = useCallback(
    (product: StoreProduct, metadata?: Record<string, unknown>) => {
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
    [flushMarketSignals, trackMarketSignal],
  );

  const handleOpenSectionProduct = useCallback(
    (product: MarketplaceProduct) => {
      setSelectedProduct(product);
      void flushMarketSignals();
    },
    [flushMarketSignals],
  );

  const handleHideMarketSectionItem = useCallback(
    async (section: MarketSection, item: MarketSectionItem) => {
      const targetId = getSectionItemTargetId(item);
      if (!targetId) return;

      const previousSections = marketSections;
      const previousProducts = products;

      setMarketSections((current) =>
        current
          .map((entry) =>
            entry.key === section.key
              ? {
                  ...entry,
                  items: (entry.items ?? []).filter(
                    (existing) => getSectionItemTargetId(existing) !== targetId,
                  ),
                }
              : entry,
          )
          .filter((entry) => entry.items?.length > 0),
      );
      if (item.entityType === 'PRODUCT') {
        setProducts((current) =>
          current.filter((product) => product.id !== targetId && product.id !== item.sourceId),
        );
      }

      try {
        const suppression = await marketApi.createMarketSuppression({
          anonymousSessionId,
          targetType: item.entityType,
          targetId,
          brandId: item.entityType === 'BRAND' ? item.brand?.id ?? targetId : undefined,
          categoryId:
            item.entityType === 'CATEGORY' ? item.category?.id ?? targetId : undefined,
          sectionKey: section.key,
          suppressionType: 'NOT_INTERESTED',
          reason: 'market_section_card',
        });
        toast.success('Hidden from this market view.', {
          action: {
            label: 'Undo',
            onClick: () => {
              void marketApi
                .deleteMarketSuppression(suppression.id, { anonymousSessionId })
                .catch(() => undefined);
              setMarketSections(previousSections);
              setProducts(previousProducts);
            },
          },
        });
      } catch {
        setMarketSections(previousSections);
        setProducts(previousProducts);
        toast.error('Could not hide that item. Try again.');
      }
    },
    [anonymousSessionId, marketSections, products],
  );

  const handleViewAllSection = useCallback(
    (section: MarketSection) => {
      if (!section.viewAll?.enabled) return;
      trackMarketSignal({
        targetType: 'SECTION',
        targetId: section.key,
        signalType: 'VIEW_ALL_CLICK',
        surface: 'MARKET_HOME',
        sectionKey: section.key,
      });
      void flushMarketSignals();
      navigate(`/market/sections/${encodeURIComponent(section.key)}`, {
        state: {
          title: section.title,
          subtitle: section.subtitle ?? null,
        },
      });
    },
    [flushMarketSignals, navigate, trackMarketSignal],
  );

  useEffect(() => {
    const updateMarketClock = () => setMarketClockMs(Date.now());
    updateMarketClock();
    const interval = window.setInterval(updateMarketClock, 60_000);
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

  const utcDayIndex = useMemo(() => getUtcDayIndex(marketClockMs), [marketClockMs]);

  const weeklyEligibleProducts = useMemo(() => {
    const nowMs = marketClockMs;
    return recencySortedProducts.filter((product) => {
      const recencyTs = getProductRecencyTimestamp(product);
      return recencyTs > 0 && nowMs - recencyTs <= FRESH_DROP_MAX_AGE_MS;
    });
  }, [recencySortedProducts, marketClockMs]);

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

  const sectionProductsByKey = useMemo(() => {
    const byKey = new Map<string, MarketplaceProduct[]>();
    for (const section of marketSections) {
      const mapped = (section.items ?? [])
        .map((item) => mapSectionProductToMarketplaceProduct(item))
        .filter((product): product is MarketplaceProduct => Boolean(product));
      if (mapped.length > 0) {
        byKey.set(section.key, mapped);
      }
    }
    return byKey;
  }, [marketSections]);

  const previewSections = useMemo(
    () => marketSections.filter((section) => section.key !== 'fresh-drops' && section.items?.length > 0),
    [marketSections],
  );

  const freshDropsForDisplay = sectionProductsByKey.get('fresh-drops') ?? freshDrops;

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
                          {activeHero.brand?.name || 'WEAZ Brand'} · Smooth picks from recent brand drops.
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenProduct(activeHero, { source: 'market_hero' })}
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
                  onClick={() => handleOpenProduct(product, { source: 'market_hero_secondary' })}
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
            if (p) handleOpenProduct(p, { source: 'featured_section' });
          }}
          onSeeAll={() => setGalleryOpen(true)}
        />

        {!loading && previewSections.length > 0 ? (
          <div className="space-y-6">
            {previewSections.map((section) => (
              <MarketSectionPreviewRail
                key={section.key}
                section={section}
                onViewProduct={handleOpenSectionProduct}
                onTrackSignal={trackMarketSignal}
                onHideItem={handleHideMarketSectionItem}
                onViewAll={handleViewAllSection}
              />
            ))}
          </div>
        ) : null}

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
            products={freshDropsForDisplay}
            onViewProduct={(product) => handleOpenProduct(product, { source: 'fresh_drops' })}
          />
        )}



        <section className="space-y-5">
          <div className="sticky top-16 z-20 rounded-2xl border border-gray-200/70 bg-white/72 px-3 py-2 backdrop-blur-md dark:border-white/10 dark:bg-[#0f0b13]/78">
            {/* Heading + search row — on small screens header is compact, search hidden */}
            <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-stretch sm:gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h2 className="text-base font-black text-gray-900 dark:text-white sm:text-xl">Explore the Market</h2>
              </div>
              <div className="hidden w-full flex-col gap-3 sm:flex lg:w-auto lg:min-w-[480px] lg:flex-row">
                <SearchBarWithSuggestions
                  placeholder="Search products, brands, styles, or tags..."
                  className="w-full"
                />
              </div>
            </div>
            <div className="mt-1.5 flex gap-5 overflow-x-auto border-b border-gray-200/80 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-white/10">
              {availableFilters.map((filter) => {
                const active = selectedFilter === filter;
                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setSelectedFilter(filter)}
                    aria-pressed={active}
                    className={`relative whitespace-nowrap pb-3 pt-2 text-sm font-semibold transition-colors ${
                      active
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    {filter === 'FOR_YOU' && 'Discover'}
                    {filter === 'MENSWEAR' && 'Menswear'}
                    {filter === 'WOMENSWEAR' && 'Womenswear'}
                    {filter === 'EVERYBODY' && 'Everybody'}
                    {filter === 'ON_SALE' && 'On Sale'}
                    {filter === 'CUSTOM_FIT' && 'Custom Fit'}
                    <span
                      aria-hidden="true"
                      className={`absolute inset-x-0 bottom-0 mx-auto h-0.5 w-7 rounded-full transition-all ${
                        active ? 'bg-gray-900 dark:bg-white' : 'bg-transparent'
                      }`}
                    />
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
                        <StoreProductCard
                          product={product}
                          onViewProduct={(selected) =>
                            handleOpenProduct(selected, { source: 'market_grid' })
                          }
                        />
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
                        <StoreProductCard
                          product={product}
                          onViewProduct={(selected) =>
                            handleOpenProduct(selected, {
                              source: 'custom_order_out_of_stock',
                            })
                          }
                        />
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
