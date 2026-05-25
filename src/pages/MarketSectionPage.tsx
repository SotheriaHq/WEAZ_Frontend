import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { marketApi, type MarketSection, type MarketSectionItem } from '@/api/MarketApi';
import ImageWithFallback from '@/components/ImageWithFallback';
import InlineProductDetail from '@/components/catalog/InlineProductDetail';
import ProductCardSkeleton from '@/components/designs/ProductCardSkeleton';
import StoreProductCard from '@/components/designs/StoreProductCard';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useMarketSignals } from '@/hooks/useMarketSignals';
import type { MarketplaceProduct } from '@/utils/marketProductMapper';
import {
  getSectionItemSignalKey,
  getSectionItemStableKey,
  getSectionItemTargetId,
  mapSectionProductToMarketplaceProduct,
} from '@/utils/marketSectionMapper';

const SECTION_DETAIL_LIMIT = 24;

const isCanceledRequest = (err: unknown) => {
  const error = err as { code?: string; name?: string; message?: string };
  return (
    error?.code === 'ERR_CANCELED' ||
    error?.name === 'CanceledError' ||
    error?.message === 'canceled'
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
      className="group overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-gray-200/70 transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-default dark:bg-white/[0.04] dark:ring-white/10"
    >
      {mediaUrl ? (
        <ImageWithFallback
          src={mediaUrl}
          alt={item.media?.alt || item.title}
          fit="cover"
          rounded="none"
          containerClassName="h-48 w-full bg-gray-100 dark:bg-white/5"
          className="h-full w-full transition-transform duration-500 group-hover:scale-105"
          maxHeightClassName="max-h-full"
          fallbackName={item.title}
        />
      ) : (
        <div className="flex h-48 w-full items-center justify-center bg-gray-100 text-3xl dark:bg-white/5">
          #
        </div>
      )}
      <div className="space-y-1 p-4">
        <p className="line-clamp-2 text-sm font-bold text-gray-900 dark:text-white">
          {item.title}
        </p>
        {item.subtitle || item.brand?.name ? (
          <p className="line-clamp-1 text-xs text-gray-500 dark:text-gray-400">
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
  const { anonymousSessionId, flushMarketSignals, trackMarketSignal } =
    useMarketSignals('MARKET_SECTION_DETAIL');
  const [section, setSection] = useState<MarketSection | null>(null);
  const [items, setItems] = useState<MarketSectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const observedItemKeysRef = useRef<Set<string>>(new Set());
  const viewedSectionKeyRef = useRef<string | null>(null);
  const loadMoreControllerRef = useRef<AbortController | null>(null);

  const normalizedSectionKey = useMemo(
    () => String(sectionKey ?? '').trim(),
    [sectionKey],
  );

  const requestSectionPage = useCallback(
    async (cursor: string | null | undefined, signal?: AbortSignal) => {
      if (!normalizedSectionKey) {
        throw new Error('Missing market section key.');
      }
      return marketApi.getMarketSectionDetail(
        normalizedSectionKey,
        {
          cursor: cursor ?? undefined,
          limit: SECTION_DETAIL_LIMIT,
          anonymousSessionId,
        },
        { signal },
      );
    },
    [anonymousSessionId, normalizedSectionKey],
  );

  useEffect(() => {
    if (!normalizedSectionKey) {
      setError('Market section not found.');
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    observedItemKeysRef.current.clear();
    viewedSectionKeyRef.current = null;
    itemRefs.current.clear();
    setLoading(true);
    setError(null);
    setItems([]);

    void requestSectionPage(null, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return;
        const nextSection = payload.section;
        const nextItems = Array.isArray(nextSection.items) ? nextSection.items : [];
        setSection({ ...nextSection, items: nextItems });
        setItems(nextItems);
      })
      .catch((err) => {
        if (controller.signal.aborted || isCanceledRequest(err)) return;
        const message =
          (err as any)?.response?.data?.message ||
          (err as Error)?.message ||
          'Unable to load this market section.';
        setError(typeof message === 'string' ? message : 'Unable to load this market section.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [normalizedSectionKey, reloadToken, requestSectionPage]);

  useEffect(() => {
    return () => {
      loadMoreControllerRef.current?.abort();
    };
  }, []);

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
        setSelectedProduct(product);
        return;
      }

      if (item.target?.route) {
        navigate(item.target.route);
      }
    },
    [flushMarketSignals, navigate, section, trackMarketSignal],
  );

  const loadMore = useCallback(async () => {
    if (!section?.pagination?.hasNextPage || loadingMore) return;
    const cursor = section.pagination.nextCursor;
    if (!cursor) return;

    loadMoreControllerRef.current?.abort();
    const controller = new AbortController();
    loadMoreControllerRef.current = controller;
    setLoadingMore(true);
    setError(null);

    try {
      const payload = await requestSectionPage(cursor, controller.signal);
      if (controller.signal.aborted) return;
      const incomingSection = payload.section;
      const incomingItems = Array.isArray(incomingSection.items) ? incomingSection.items : [];
      const merged = mergeUniqueItems(items, incomingItems);
      setItems(merged);
      setSection({ ...incomingSection, items: merged });
    } catch (err) {
      if (controller.signal.aborted || isCanceledRequest(err)) return;
      const message =
        (err as any)?.response?.data?.message ||
        (err as Error)?.message ||
        'Unable to load more from this section.';
      setError(typeof message === 'string' ? message : 'Unable to load more from this section.');
    } finally {
      if (!controller.signal.aborted) {
        setLoadingMore(false);
        loadMoreControllerRef.current = null;
      }
    }
  }, [items, loadingMore, requestSectionPage, section]);

  const hasNextPage = Boolean(section?.pagination?.hasNextPage && section.pagination.nextCursor);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-4 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <header className="flex flex-col gap-4 border-b border-gray-200 pb-5 dark:border-white/10 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => navigate('/market-place')}
              className="mb-3 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 dark:border-white/10 dark:text-gray-300 dark:hover:bg-white/10"
            >
              Back to market
            </button>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white sm:text-3xl">
              {section?.title || 'Market section'}
            </h1>
            {section?.subtitle ? (
              <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
                {section.subtitle}
              </p>
            ) : null}
          </div>
          {section?.emotionalLabel ? (
            <span className="w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-300">
              {section.emotionalLabel}
            </span>
          ) : null}
        </header>

        {loading ? (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <ProductCardSkeleton key={index} />
            ))}
          </section>
        ) : error && items.length === 0 ? (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 text-center dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{error}</p>
            <button
              type="button"
              onClick={() => setReloadToken((current) => current + 1)}
              className="mt-4 rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black dark:bg-white dark:text-gray-900"
            >
              Retry
            </button>
          </section>
        ) : items.length === 0 ? (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 text-center dark:border-white/10 dark:bg-white/[0.04]">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Nothing eligible is available in this section right now.
            </p>
          </section>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {items.map((item, index) => {
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
            </section>

            {error ? (
              <p className="text-center text-sm font-semibold text-red-600 dark:text-red-300">
                {error}
              </p>
            ) : null}

            <div className="flex justify-center">
              {hasNextPage ? (
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                  className="rounded-full bg-gray-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-900"
                >
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  You have reached the end of this section.
                </p>
              )}
            </div>
          </>
        )}
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
