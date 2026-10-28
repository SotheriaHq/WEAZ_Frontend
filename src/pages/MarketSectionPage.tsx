import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronDown,
  Layers,
  Sparkles,
  Compass,
} from 'lucide-react';

import {
  marketApi,
  type MarketSection,
  type MarketSectionDetailResponse,
  type MarketSectionItem,
} from '@/api/MarketApi';
import ImageWithFallback from '@/components/ImageWithFallback';
import InlineProductDetail from '@/components/catalog/InlineProductDetail';
import ProductCardSkeleton from '@/components/designs/ProductCardSkeleton';
import StoreProductCard from '@/components/designs/StoreProductCard';
import Button from '@/components/ui/Button';
import { MarketSectionRail } from '@/components/market/MarketSectionRail';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useMarketSignals } from '@/hooks/useMarketSignals';
import { queryKeys } from '@/query/queryKeys';
import type { MarketplaceProduct } from '@/utils/marketProductMapper';
import {
  getSectionItemSignalKey,
  getSectionItemStableKey,
  getSectionItemTargetId,
  mapSectionProductToMarketplaceProduct,
} from '@/utils/marketSectionMapper';
import { useScrollRestore } from '@/components/ScrollRestoreProvider';
import { useScrollLock } from '@/hooks/useScrollLock';

const SECTION_DETAIL_LIMIT = 24;

const MAIN_MARKET_SECTION_KEYS = new Set([
  'hot-right-now',
  'fresh-drops',
  'picked-for-you',
  'new-designers-to-watch',
  'shop-by-style',
  'loved-near-you',
  'shop-the-look',
  'almost-gone',
  'still-thinking-about-these',
  'more-from-brands-you-like',
  'style-picks-of-the-week',
  'latest-collections',
  'adire',
  'bestsellers-row',
  'fresh-row',
  'custom-ready-row',
  'for-moodboard',
]);

const MAIN_MARKET_SECTION_TITLES = new Set([
  'loved near you',
  'hot right now',
  'fresh drops',
  'fresh on wiez',
  'picked for you',
  'new designers to watch',
  'shop by style',
  'shop the look',
  'almost gone',
  'still thinking about these',
  'more from brands you like',
  'style picks of the week',
  'latest collections',
  'adire casual',
  'highest sales & most coveted',
  'artisanal custom fit runway',
  'for your moodboard',
]);

type FilterChip = 'ALL' | 'READY_TO_WEAR' | 'CUSTOM_FIT' | 'UNDER_50K' | '50K_150K' | 'ABOVE_150K';
type SortOption = 'trending' | 'price_asc' | 'price_desc' | 'newest';

const getItemEffectivePrice = (item: MarketSectionItem): number => {
  return (
    item.price?.effectiveAmount ??
    item.price?.saleAmount ??
    item.price?.amount ??
    item.priceRange?.min ??
    0
  );
};

const formatPriceLabel = (item: MarketSectionItem) => {
  const currency = item.price?.currency || item.priceRange?.currency || 'NGN';
  const formatAmount = (amount: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);

  if (item.price?.effectiveAmount) return formatAmount(item.price.effectiveAmount);
  if (item.priceRange?.min) return `From ${formatAmount(item.priceRange.min)}`;
  if (item.stats?.products) {
    return `${item.stats.products} item${item.stats.products === 1 ? '' : 's'}`;
  }
  return null;
};

const mergeUniqueItems = (
  current: MarketSectionItem[],
  next: MarketSectionItem[],
) => {
  const byKey = new Map<string, MarketSectionItem>();
  for (const item of current) {
    byKey.set(getSectionItemStableKey(item), item);
  }
  for (const item of next) {
    const key = getSectionItemStableKey(item);
    if (!byKey.has(key)) {
      byKey.set(key, item);
    }
  }
  return Array.from(byKey.values());
};

const GenericSectionCard: React.FC<{
  item: MarketSectionItem;
  onOpen: () => void;
}> = ({ item, onOpen }) => {
  const mediaUrl = item.media?.thumbnailUrl || item.media?.url || null;
  const priceLabel = formatPriceLabel(item);
  const canOpen = Boolean(item.target?.route);

  return (
    <button
      type="button"
      disabled={!canOpen}
      onClick={onOpen}
      className="group overflow-hidden rounded-3xl bg-white text-left shadow-sm ring-1 ring-gray-200/70 transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-default dark:bg-white/[0.04] dark:ring-white/10"
    >
      {mediaUrl ? (
        <ImageWithFallback
          src={mediaUrl}
          alt={item.media?.alt || item.title}
          fit="cover"
          rounded="none"
          containerClassName="h-56 w-full bg-gray-100 dark:bg-white/5"
          className="h-full w-full transition-transform duration-500 group-hover:scale-105"
          maxHeightClassName="max-h-full"
          fallbackName={item.title}
        />
      ) : (
        <div className="flex h-56 w-full items-center justify-center bg-gray-100 text-3xl dark:bg-white/5">
          #
        </div>
      )}
      <div className="space-y-1.5 p-4">
        <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug">
          {item.title}
        </p>
        {item.subtitle || item.brand?.name ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {item.subtitle || item.brand?.name}
          </p>
        ) : null}
        {priceLabel ? (
          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
            {priceLabel}
          </p>
        ) : null}
      </div>
    </button>
  );
};

const MarketSectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { sectionKey } = useParams<{ sectionKey: string }>();
  const [searchParams] = useSearchParams();
  const parentKey = searchParams.get('parent');

  const { anonymousSessionId, flushMarketSignals, trackMarketSignal } =
    useMarketSignals('MARKET_SECTION_DETAIL');
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);
  useScrollLock(Boolean(selectedProduct));

  const [activeFilter, setActiveFilter] = useState<FilterChip>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('trending');

  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const observedItemKeysRef = useRef<Set<string>>(new Set());
  const viewedSectionKeyRef = useRef<string | null>(null);

  const normalizedSectionKey = useMemo(
    () => String(sectionKey ?? '').trim(),
    [sectionKey],
  );
  const scrollRestoreKey = normalizedSectionKey
    ? `MARKET_SECTION:${normalizedSectionKey}`
    : 'MARKET_SECTION';
  const { saveScrollPosition } = useScrollRestore(scrollRestoreKey);

  // 1. Fetch Primary Section Details
  const sectionDetailQuery = useInfiniteQuery<MarketSectionDetailResponse>({
    queryKey: queryKeys.market.sectionDetail(normalizedSectionKey, {
      limit: SECTION_DETAIL_LIMIT,
      anonymousSessionId,
    }),
    queryFn: async ({ pageParam, signal }) => {
      if (!normalizedSectionKey) {
        throw new Error('Missing market section key.');
      }
      const cursor = typeof pageParam === 'string' ? pageParam : undefined;
      return marketApi.getMarketSectionDetail(
        normalizedSectionKey,
        {
          cursor,
          limit: SECTION_DETAIL_LIMIT,
          anonymousSessionId,
        },
        { signal },
      );
    },
    initialPageParam: null,
    enabled: Boolean(normalizedSectionKey),
    getNextPageParam: (lastPage) =>
      lastPage.section.pagination?.hasNextPage
        ? lastPage.section.pagination.nextCursor ?? undefined
        : undefined,
  });

  // 2. Fetch Suggestion Blocks for this Section
  const { data: suggestionData } = useQuery({
    queryKey: queryKeys.market.suggestions({
      context: 'MARKET_SECTION_DETAIL',
      targetId: normalizedSectionKey,
    }),
    queryFn: () =>
      marketApi.getMarketSuggestions({
        context: 'MARKET_SECTION_DETAIL',
        targetType: 'SECTION',
        targetId: normalizedSectionKey,
        sectionKey: normalizedSectionKey,
      }),
    enabled: Boolean(normalizedSectionKey),
    staleTime: 60 * 1000,
  });

  const sectionPages = useMemo(
    () => sectionDetailQuery.data?.pages ?? [],
    [sectionDetailQuery.data?.pages],
  );
  const items = useMemo(
    () =>
      sectionPages.reduce<MarketSectionItem[]>((merged, page) => {
        const pageItems = Array.isArray(page.section.items) ? page.section.items : [];
        return mergeUniqueItems(merged, pageItems);
      }, []),
    [sectionPages],
  );
  const section = useMemo<MarketSection | null>(() => {
    const latestSection = sectionPages[sectionPages.length - 1]?.section;
    if (!latestSection) return null;
    return {
      ...latestSection,
      items,
    };
  }, [items, sectionPages]);

  const loading = sectionDetailQuery.isLoading && !sectionDetailQuery.data;
  const loadingMore = sectionDetailQuery.isFetchingNextPage;
  const error = useMemo(() => {
    if (!normalizedSectionKey) return 'Market section not found.';
    if (!sectionDetailQuery.error) return null;
    return sectionDetailQuery.error instanceof Error
      ? sectionDetailQuery.error.message
      : 'Unable to load this market section.';
  }, [normalizedSectionKey, sectionDetailQuery.error]);

  useEffect(() => {
    observedItemKeysRef.current.clear();
    viewedSectionKeyRef.current = null;
    itemRefs.current.clear();
  }, [normalizedSectionKey]);

  useEffect(() => {
    if (!section || viewedSectionKeyRef.current === section.key) return;
    viewedSectionKeyRef.current = section.key;
    trackMarketSignal({
      targetType: 'SECTION',
      targetId: section.key,
      signalType: 'MARKET_SECTION_VIEW',
      surface: 'MARKET_SECTION_DETAIL',
      sectionKey: section.key,
    });
  }, [section, trackMarketSignal]);

  const setItemRef = useCallback((key: string, node: HTMLDivElement | null) => {
    if (!node) {
      itemRefs.current.delete(key);
      return;
    }
    itemRefs.current.set(key, node);
  }, []);

  useEffect(() => {
    if (!section || typeof IntersectionObserver === 'undefined') return undefined;

    const itemsBySignalKey = new Map(
      items.map((item, index) => [
        getSectionItemSignalKey(section.key, item, index),
        { item, index },
      ]),
    );

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const signalKey = (entry.target as HTMLElement).dataset.marketSignalKey;
          if (!signalKey || observedItemKeysRef.current.has(signalKey)) continue;
          const payload = itemsBySignalKey.get(signalKey);
          const targetId = payload ? getSectionItemTargetId(payload.item) : '';
          if (!payload || !targetId) continue;

          observedItemKeysRef.current.add(signalKey);
          if (observedItemKeysRef.current.size > 500) {
            observedItemKeysRef.current.clear();
          }
          trackMarketSignal({
            targetType: payload.item.entityType,
            targetId,
            signalType: 'IMPRESSION',
            surface: 'MARKET_SECTION_DETAIL',
            sectionKey: section.key,
            position: payload.index,
          });
        }
      },
      { threshold: 0.45 },
    );

    for (const node of itemRefs.current.values()) {
      observer.observe(node);
    }

    return () => observer.disconnect();
  }, [items, section, trackMarketSignal]);

  const openItem = useCallback(
    (item: MarketSectionItem, index: number) => {
      if (!section) return;
      const targetId = getSectionItemTargetId(item);
      if (!targetId) return;

      trackMarketSignal({
        targetType: item.entityType,
        targetId,
        signalType: 'OPEN',
        surface: 'MARKET_SECTION_DETAIL',
        sectionKey: section.key,
        position: index,
      });
      void flushMarketSignals();

      const product = mapSectionProductToMarketplaceProduct(item);
      if (product) {
        saveScrollPosition(scrollRestoreKey, window.scrollY);
        setSelectedProduct(product);
        return;
      }

      if (item.target?.route) {
        saveScrollPosition(scrollRestoreKey, window.scrollY);
        navigate(item.target.route);
      }
    },
    [flushMarketSignals, navigate, saveScrollPosition, scrollRestoreKey, section, trackMarketSignal],
  );

  const loadMore = useCallback(() => {
    if (!section?.pagination?.hasNextPage || loadingMore) return;
    void sectionDetailQuery.fetchNextPage();
  }, [loadingMore, section, sectionDetailQuery]);

  const hasNextPage = Boolean(section?.pagination?.hasNextPage && section.pagination.nextCursor);

  // 4. Curated & Strict Deduplication of Embedded Fashion Sub-Sections:
  // Strictly EXCLUDE any main market sections (no "loved near you", "hot right now", etc.).
  // Only display suggestion blocks and thematic partitions of this section's own items.
  const embeddedSubSections = useMemo(() => {
    const excludedKeys = new Set<string>([
      normalizedSectionKey.toLowerCase(),
      ...(parentKey ? [parentKey.toLowerCase()] : []),
      ...Array.from(MAIN_MARKET_SECTION_KEYS),
    ]);
    const seenTitles = new Set<string>([
      (section?.title || '').trim().toLowerCase(),
      ...Array.from(MAIN_MARKET_SECTION_TITLES),
    ]);

    const result: Array<{
      key: string;
      title: string;
      emotionalLabel?: string;
      items: MarketSectionItem[];
      section: MarketSection;
    }> = [];

    // Source A: Suggestion blocks from backend suggestion service
    if (suggestionData?.blocks) {
      for (const block of suggestionData.blocks) {
        const blockKey = block.blockKey.toLowerCase();
        const titleLower = block.title.trim().toLowerCase();
        if (
          block.items &&
          block.items.length >= 2 &&
          !excludedKeys.has(blockKey) &&
          !seenTitles.has(titleLower)
        ) {
          excludedKeys.add(blockKey);
          seenTitles.add(titleLower);
          result.push({
            key: block.blockKey,
            title: block.title,
            emotionalLabel: 'CURATED SUGGESTIONS',
            items: block.items,
            section: {
              key: block.blockKey,
              title: block.title,
              subtitle: block.subtitle || 'Personalized and complementary recommendations',
              emotionalLabel: 'CURATED SUGGESTIONS',
              layout: 'HORIZONTAL_RAIL',
              sourceType: 'PRODUCT',
              items: block.items,
            },
          });
        }
      }
    }

    // Source B: Thematic partitions of current section items (category or tag based)
    const itemsByCategory = new Map<string, MarketSectionItem[]>();
    for (const it of items) {
      const cat = it.category?.name || (it.tags && it.tags[0]) || null;
      if (cat && cat.trim().length > 1) {
        const catKey = cat.trim();
        const list = itemsByCategory.get(catKey) ?? [];
        list.push(it);
        itemsByCategory.set(catKey, list);
      }
    }

    for (const [catName, catItems] of itemsByCategory.entries()) {
      if (catItems.length >= 3) {
        const subKey = `${normalizedSectionKey}-sub-${catName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        const titleLower = catName.toLowerCase();
        if (!excludedKeys.has(subKey) && !seenTitles.has(titleLower)) {
          excludedKeys.add(subKey);
          seenTitles.add(titleLower);
          result.push({
            key: subKey,
            title: catName,
            emotionalLabel: 'ATELIER FOCUS',
            items: catItems,
            section: {
              key: subKey,
              title: catName,
              subtitle: `Curated ${catName} pieces inside ${section?.title || 'this section'}`,
              emotionalLabel: 'ATELIER FOCUS',
              layout: 'HORIZONTAL_RAIL',
              sourceType: 'PRODUCT',
              items: catItems,
            },
          });
        }
      }
    }

    // Return at most 3 embedded sub-sections
    return result.slice(0, 3);
  }, [items, normalizedSectionKey, parentKey, section?.title, suggestionData?.blocks]);

  // 5. Client-Side Filtering & Sorting of the Primary Catalog Grid
  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    // Filter
    if (activeFilter === 'READY_TO_WEAR') {
      result = result.filter(
        (i) => i.availability?.standardCheckoutEnabled || i.entityType === 'PRODUCT',
      );
    } else if (activeFilter === 'CUSTOM_FIT') {
      result = result.filter((i) => Boolean(i.availability?.customOrderEnabled));
    } else if (activeFilter === 'UNDER_50K') {
      result = result.filter((i) => getItemEffectivePrice(i) < 50000 && getItemEffectivePrice(i) > 0);
    } else if (activeFilter === '50K_150K') {
      result = result.filter(
        (i) => getItemEffectivePrice(i) >= 50000 && getItemEffectivePrice(i) <= 150000,
      );
    } else if (activeFilter === 'ABOVE_150K') {
      result = result.filter((i) => getItemEffectivePrice(i) > 150000);
    }

    // Sort
    if (sortBy === 'price_asc') {
      result.sort((a, b) => getItemEffectivePrice(a) - getItemEffectivePrice(b));
    } else if (sortBy === 'price_desc') {
      result.sort((a, b) => getItemEffectivePrice(b) - getItemEffectivePrice(a));
    } else if (sortBy === 'newest') {
      result.sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return db - da;
      });
    }

    return result;
  }, [activeFilter, items, sortBy]);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 space-y-12">
      {/* Editorial Luxury Header */}
      <header className="relative overflow-hidden rounded-3xl border border-[var(--wiez-border-subtle,#e5e7eb)] bg-[var(--wiez-surface-card,#ffffff)] p-6 sm:p-10 shadow-sm dark:border-white/10 dark:bg-[var(--wiez-surface-card,#181220)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => {
              saveScrollPosition(scrollRestoreKey, window.scrollY);
              if (parentKey) {
                navigate(`/market/sections/${encodeURIComponent(parentKey)}`);
              } else {
                navigate('/market');
              }
            }}
            className="group inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/80 px-4 py-2 text-xs font-bold text-gray-700 shadow-sm backdrop-blur transition hover:bg-gray-100 dark:border-white/15 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/20"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            {parentKey ? 'Back to parent section' : 'Back to Market'}
          </button>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-primary dark:border-primary/40 dark:bg-primary/15">
              <Sparkles className="h-3 w-3" />
              {section?.emotionalLabel || 'WIEZ Fashion Sector'}
            </span>
            <span className="rounded-full bg-gray-200/70 px-3 py-1 text-[11px] font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-300">
              {items.length} {items.length === 1 ? 'Curated Piece' : 'Curated Pieces'}
            </span>
          </div>
        </div>

        <div className="mt-6 max-w-3xl space-y-2.5">
          <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white sm:text-4xl lg:text-5xl">
            {section?.title || normalizedSectionKey.replace(/-/g, ' ')}
          </h1>
          {section?.subtitle ? (
            <p className="text-base font-medium leading-relaxed text-gray-600 dark:text-gray-300 sm:text-lg">
              {section.subtitle}
            </p>
          ) : (
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Discover dedicated artisanal creations, verified African designers, and custom-order silhouettes.
            </p>
          )}
        </div>
      </header>

      {/* Section Catalog: Primary Content Owned by this Screen */}
      <section className="space-y-6 pt-4">
        <div className="flex flex-col gap-4 border-b border-gray-200/80 pb-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight sm:text-2xl">
              All {section?.title || 'Sector'} Pieces
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Showing {filteredAndSortedItems.length} of {items.length} pieces available in this section
            </p>
          </div>

          {/* Filter Chips & Sort Select */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {(
                [
                  { id: 'ALL', label: 'All' },
                  { id: 'READY_TO_WEAR', label: 'Ready to Wear' },
                  { id: 'CUSTOM_FIT', label: 'Custom Fit' },
                  { id: 'UNDER_50K', label: 'Under ₦50k' },
                  { id: '50K_150K', label: '₦50k - ₦150k' },
                  { id: 'ABOVE_150K', label: '₦150k+' },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setActiveFilter(chip.id)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                    activeFilter === chip.id
                      ? 'bg-[var(--wiez-action-brand,#9333ea)] text-white shadow-sm'
                      : 'border border-[var(--wiez-border-subtle,#e5e7eb)] bg-[var(--wiez-surface-card,#ffffff)] text-gray-600 hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Sort Menu */}
            <div className="relative ml-auto sm:ml-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="appearance-none rounded-full border border-gray-200 bg-white py-1.5 pl-3.5 pr-8 text-xs font-bold text-gray-800 shadow-sm transition hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10 cursor-pointer"
              >
                <option value="trending">Sort: Trending Curation</option>
                <option value="price_asc">Sort: Price (Low to High)</option>
                <option value="price_desc">Sort: Price (High to Low)</option>
                <option value="newest">Sort: Newest Arrivals</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Catalog Grid */}
        {loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <ProductCardSkeleton key={index} />
            ))}
          </div>
        ) : error && items.length === 0 ? (
          <div className="rounded-3xl border border-[var(--wiez-border-subtle,#e5e7eb)] bg-[var(--wiez-surface-card,#ffffff)] p-10 text-center dark:border-white/10 dark:bg-white/[0.04] space-y-4">
            <p className="text-base font-semibold text-gray-900 dark:text-white">{error}</p>
            <Button
              type="button"
              onClick={() => void sectionDetailQuery.refetch()}
              variant="secondary"
              size="sm"
            >
              Retry Loading Section
            </Button>
          </div>
        ) : filteredAndSortedItems.length === 0 ? (
          <div className="rounded-3xl border border-[var(--wiez-border-subtle,#e5e7eb)] bg-[var(--wiez-surface-card,#ffffff)] p-12 text-center dark:border-white/10 dark:bg-white/[0.04] space-y-3">
            <Compass className="h-8 w-8 mx-auto text-gray-400 opacity-60" />
            <p className="text-base font-bold text-gray-900 dark:text-white">
              No matching pieces found for this filter.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Try switching back to &apos;All&apos; to view all curated pieces in this section.
            </p>
            <Button
              type="button"
              onClick={() => setActiveFilter('ALL')}
              variant="secondary"
              size="sm"
            >
              Reset Filter
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {filteredAndSortedItems.map((item, index) => {
                const signalKey = getSectionItemSignalKey(
                  section?.key ?? normalizedSectionKey,
                  item,
                  index,
                );
                const product = mapSectionProductToMarketplaceProduct(item);

                return (
                  <div
                    key={getSectionItemStableKey(item)}
                    ref={(node) => setItemRef(signalKey, node)}
                    data-market-signal-key={signalKey}
                  >
                    {product ? (
                      <StoreProductCard
                        product={product}
                        onViewProduct={() => openItem(item, index)}
                        enableHoverGallery
                        onPreviewNavigationActiveChange={() => undefined}
                      />
                    ) : (
                      <GenericSectionCard item={item} onOpen={() => openItem(item, index)} />
                    )}
                  </div>
                );
              })}
            </div>

            {error ? (
              <p className="text-center text-sm font-semibold text-red-600 dark:text-red-300">
                {error}
              </p>
            ) : null}

            <div className="flex justify-center pt-8 pb-12">
              {hasNextPage ? (
                <Button
                  type="button"
                  disabled={loadingMore}
                  loading={loadingMore}
                  onClick={() => void loadMore()}
                  variant="secondary"
                  size="md"
                >
                  Load more pieces
                </Button>
              ) : (
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  End of Section Catalog
                </p>
              )}
            </div>
          </>
        )}
      </section>

      {/* Unique Thematic Sub-Sections & Suggestions Displayed UNDER the Main Section Catalog */}
      {embeddedSubSections.length > 0 && (
        <section className="space-y-8 pt-8 border-t border-gray-200/80 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <span className="text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
              Curated Suggestions & Sub-Themes for this Sector
            </span>
          </div>

          <div className="space-y-12">
            {embeddedSubSections.map((subSec) => (
              <MarketSectionRail
                key={subSec.key}
                section={subSec.section}
                title={subSec.title}
                eyebrow={subSec.emotionalLabel}
                items={subSec.items}
                onViewProduct={(product) => setSelectedProduct(product)}
                onOpenItem={(it) => {
                  const prod = mapSectionProductToMarketplaceProduct(it);
                  if (prod) {
                    setSelectedProduct(prod);
                  } else if (it.target?.route) {
                    navigate(it.target.route);
                  }
                }}
                onTrackSignal={trackMarketSignal}
                onExploreSection={(secKey) =>
                  navigate(`/market/sections/${encodeURIComponent(secKey)}?parent=${encodeURIComponent(normalizedSectionKey)}`)
                }
              />
            ))}
          </div>
        </section>
      )}

      {/* Quick View Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <OverlayPortal>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-layer-modal bg-black/60 p-3 backdrop-blur-sm sm:p-6 flex items-center justify-center"
            >
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 18 }}
                className="mx-auto max-h-[92vh] w-full max-w-6xl overflow-y-auto overscroll-contain rounded-3xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-[#120d18] sm:p-6 glass-scrollbar flex flex-col"
              >
                <div className="mb-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-white/20 dark:text-gray-200 dark:hover:bg-white/10"
                  >
                    Close
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
    </div>
  );
};

export default MarketSectionPage;
