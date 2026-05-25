import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  marketApi,
  type MarketSectionItem,
  type MarketSignalSurface,
  type MarketSignalTargetType,
  type MarketSuggestionBlock,
  type MarketSuggestionContext,
  type MarketSuggestionTargetType,
} from '@/api/MarketApi';
import MediaRenderer from '@/components/media/MediaRenderer';
import { useMarketSignals } from '@/hooks/useMarketSignals';
import {
  getSectionItemStableKey,
  getSectionItemTargetId,
} from '@/utils/marketSectionMapper';

type MarketSuggestionBlocksProps = {
  context: MarketSuggestionContext;
  targetType?: MarketSuggestionTargetType;
  targetId?: string | null;
  query?: string | null;
  sectionKey?: string | null;
  limit?: number;
  className?: string;
};

const contextSurface: Record<MarketSuggestionContext, MarketSignalSurface> = {
  PRODUCT_DETAIL: 'PRODUCT_DETAIL',
  COLLECTION_DETAIL: 'COLLECTION_DETAIL',
  BRAND_DETAIL: 'BRAND_DETAIL',
  SEARCH_EMPTY: 'SEARCH',
  MARKET_SECTION_DETAIL: 'MARKET_SECTION_DETAIL',
};

const toSignalTargetType = (item: MarketSectionItem): MarketSignalTargetType => {
  const targetType = item.target?.type ?? item.entityType;
  if (targetType === 'PRODUCT') return 'PRODUCT';
  if (targetType === 'COLLECTION') return 'COLLECTION';
  if (targetType === 'DESIGN') return 'DESIGN';
  if (targetType === 'BRAND') return 'BRAND';
  if (targetType === 'CATEGORY') return 'CATEGORY';
  return 'PRODUCT';
};

const resolveSuggestionRoute = (item: MarketSectionItem) => {
  const targetId = getSectionItemTargetId(item);
  const targetType = item.target?.type ?? item.entityType;
  if (targetType === 'PRODUCT' && targetId) return `/products/${targetId}`;
  if (targetType === 'COLLECTION' && targetId) return `/collections/${targetId}`;
  if (targetType === 'BRAND' && targetId) return `/brand/${targetId}`;
  if (targetType === 'CATEGORY') {
    const slug = item.category?.slug ?? item.target?.key ?? targetId;
    return `/market-place?category=${encodeURIComponent(slug)}`;
  }
  return item.target?.route || '/market-place';
};

const formatPrice = (item: MarketSectionItem) => {
  const value =
    item.price?.effectiveAmount ??
    item.price?.saleAmount ??
    item.price?.amount ??
    item.priceRange?.min ??
    null;
  const currency = item.price?.currency ?? item.priceRange?.currency ?? 'NGN';
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString()}`;
  }
};

const SuggestionSkeleton = () => (
  <div className="space-y-3">
    <div className="h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="h-52 animate-pulse rounded-2xl bg-slate-200/80 dark:bg-white/10"
        />
      ))}
    </div>
  </div>
);

const SuggestionCard = ({
  item,
  block,
  index,
  onOpen,
  onHide,
  setItemRef,
}: {
  item: MarketSectionItem;
  block: MarketSuggestionBlock;
  index: number;
  onOpen: (item: MarketSectionItem, block: MarketSuggestionBlock, index: number) => void;
  onHide: (item: MarketSectionItem, block: MarketSuggestionBlock) => void;
  setItemRef: (key: string, node: HTMLElement | null) => void;
}) => {
  const image = item.media?.thumbnailUrl || item.media?.url || null;
  const price = formatPrice(item);
  const stableKey = getSectionItemStableKey(item);

  return (
    <div
      ref={(node) => setItemRef(`${block.blockKey}:${stableKey}`, node)}
      className="group flex min-h-[15rem] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-white/5"
    >
      <button
        type="button"
        onClick={() => onOpen(item, block, index)}
        className="flex flex-1 flex-col text-left"
      >
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-slate-100 dark:bg-white/10">
          {image ? (
            <MediaRenderer
              kind="image"
              src={image}
              alt={item.media?.alt ?? item.title}
              fit="cover"
              className="h-full w-full"
              mediaClassName="h-full w-full transition duration-300 group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
              No image
            </div>
          )}
          <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 shadow-sm dark:bg-black/60 dark:text-white">
            {item.entityType.toLowerCase()}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3">
          <div className="min-w-0">
            <h4 className="line-clamp-2 text-sm font-semibold text-slate-900 dark:text-white">
              {item.title}
            </h4>
            {item.subtitle ? (
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                {item.subtitle}
              </p>
            ) : null}
          </div>
          <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
            {price ?? item.category?.name ?? item.brand?.name ?? 'Market pick'}
          </span>
        </div>
      </button>
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => onHide(item, block)}
          className="rounded-full border border-black/10 px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:bg-black/5 hover:text-slate-800 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
        >
          Not interested
        </button>
      </div>
    </div>
  );
};

const MarketSuggestionBlocks: React.FC<MarketSuggestionBlocksProps> = ({
  context,
  targetType,
  targetId,
  query,
  sectionKey,
  limit = 8,
  className = '',
}) => {
  const navigate = useNavigate();
  const { anonymousSessionId, flushMarketSignals, trackMarketSignal } =
    useMarketSignals(`market-suggestions:${context}`);
  const [blocks, setBlocks] = React.useState<MarketSuggestionBlock[]>([]);
  const [hiddenKeys, setHiddenKeys] = React.useState<Set<string>>(() => new Set());
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasLoaded, setHasLoaded] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const blockRefs = React.useRef<Map<string, HTMLElement>>(new Map());
  const itemRefs = React.useRef<Map<string, HTMLElement>>(new Map());
  const viewedBlocksRef = React.useRef<Set<string>>(new Set());
  const viewedItemsRef = React.useRef<Set<string>>(new Set());

  const canFetch =
    context === 'SEARCH_EMPTY'
      ? Boolean(query?.trim())
      : context === 'MARKET_SECTION_DETAIL'
        ? Boolean(sectionKey)
        : Boolean(targetType && targetId);

  React.useEffect(() => {
    if (!canFetch) {
      setBlocks([]);
      setHasLoaded(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setFailed(false);

    marketApi
      .getMarketSuggestions(
        {
          context,
          targetType,
          targetId: targetId ?? undefined,
          query: query ?? undefined,
          sectionKey: sectionKey ?? undefined,
          limit,
          anonymousSessionId,
        },
        { signal: controller.signal },
      )
      .then((response) => {
        if (controller.signal.aborted) return;
        setBlocks(response.blocks ?? []);
        setHiddenKeys(new Set());
        viewedBlocksRef.current = new Set();
        viewedItemsRef.current = new Set();
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setFailed(true);
        if (import.meta.env.DEV) {
          console.debug('Market suggestions unavailable', error);
        }
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setIsLoading(false);
        setHasLoaded(true);
      });

    return () => {
      controller.abort();
    };
  }, [
    anonymousSessionId,
    canFetch,
    context,
    limit,
    query,
    sectionKey,
    targetId,
    targetType,
  ]);

  const visibleBlocks = React.useMemo(
    () =>
      blocks
        .map((block) => ({
          ...block,
          items: block.items.filter(
            (item) => !hiddenKeys.has(`${block.blockKey}:${getSectionItemStableKey(item)}`),
          ),
        }))
        .filter((block) => block.items.length > 0),
    [blocks, hiddenKeys],
  );

  const setBlockRef = React.useCallback((key: string, node: HTMLElement | null) => {
    if (node) blockRefs.current.set(key, node);
    else blockRefs.current.delete(key);
  }, []);

  const setItemRef = React.useCallback((key: string, node: HTMLElement | null) => {
    if (node) itemRefs.current.set(key, node);
    else itemRefs.current.delete(key);
  }, []);

  React.useEffect(() => {
    if (!visibleBlocks.length || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const key = (entry.target as HTMLElement).dataset.suggestionObserveKey;
          const type = (entry.target as HTMLElement).dataset.suggestionObserveType;
          if (!key) return;

          if (type === 'block' && !viewedBlocksRef.current.has(key)) {
            viewedBlocksRef.current.add(key);
            trackMarketSignal({
              targetType: 'SUGGESTION_BLOCK',
              targetId: key,
              signalType: 'SUGGESTION_BLOCK_VIEW',
              surface: contextSurface[context],
              suggestionBlockKey: key,
            });
          }

          if (type === 'item' && !viewedItemsRef.current.has(key)) {
            viewedItemsRef.current.add(key);
            const [blockKey, ...itemKeyParts] = key.split(':');
            const itemKey = itemKeyParts.join(':');
            const block = visibleBlocks.find((candidate) => candidate.blockKey === blockKey);
            const item = block?.items.find(
              (candidate) => getSectionItemStableKey(candidate) === itemKey,
            );
            if (!item) return;
            trackMarketSignal({
              targetType: toSignalTargetType(item),
              targetId: getSectionItemTargetId(item),
              signalType: 'SUGGESTION_ITEM_VIEW',
              surface: contextSurface[context],
              suggestionBlockKey: blockKey,
            });
          }
        });
      },
      { threshold: 0.35 },
    );

    for (const [key, node] of blockRefs.current.entries()) {
      node.dataset.suggestionObserveKey = key;
      node.dataset.suggestionObserveType = 'block';
      observer.observe(node);
    }
    for (const [key, node] of itemRefs.current.entries()) {
      node.dataset.suggestionObserveKey = key;
      node.dataset.suggestionObserveType = 'item';
      observer.observe(node);
    }

    return () => observer.disconnect();
  }, [context, trackMarketSignal, visibleBlocks]);

  const handleOpen = React.useCallback(
    (item: MarketSectionItem, block: MarketSuggestionBlock, position: number) => {
      trackMarketSignal({
        targetType: toSignalTargetType(item),
        targetId: getSectionItemTargetId(item),
        signalType: 'SUGGESTION_ITEM_CLICK',
        surface: contextSurface[context],
        suggestionBlockKey: block.blockKey,
        position,
      });
      void flushMarketSignals();
      navigate(resolveSuggestionRoute(item));
    },
    [context, flushMarketSignals, navigate, trackMarketSignal],
  );

  const handleHide = React.useCallback(
    async (item: MarketSectionItem, block: MarketSuggestionBlock) => {
      const stableKey = `${block.blockKey}:${getSectionItemStableKey(item)}`;
      setHiddenKeys((prev) => new Set(prev).add(stableKey));
      trackMarketSignal({
        targetType: toSignalTargetType(item),
        targetId: getSectionItemTargetId(item),
        signalType: 'SUGGESTION_ITEM_HIDE',
        surface: contextSurface[context],
        suggestionBlockKey: block.blockKey,
      });

      try {
        await marketApi.createMarketSuppression({
          anonymousSessionId,
          targetType: toSignalTargetType(item),
          targetId: getSectionItemTargetId(item),
          brandId: item.brand?.id ?? null,
          categoryId: item.category?.id ?? null,
          suggestionBlockKey: block.blockKey,
          suppressionType: 'NOT_INTERESTED',
          reason: 'suggestion-item-hidden',
        });
      } catch {
        setHiddenKeys((prev) => {
          const next = new Set(prev);
          next.delete(stableKey);
          return next;
        });
      }
    },
    [anonymousSessionId, context, trackMarketSignal],
  );

  if (!canFetch) return null;
  if (isLoading && !hasLoaded) {
    return (
      <section className={`space-y-4 ${className}`}>
        <SuggestionSkeleton />
      </section>
    );
  }
  if (failed || visibleBlocks.length === 0) return null;

  return (
    <section className={`space-y-8 ${className}`} aria-label="Market suggestions">
      {visibleBlocks.map((block) => (
        <div
          key={block.blockKey}
          ref={(node) => setBlockRef(block.blockKey, node)}
          className="space-y-3"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                {block.title}
              </h3>
              {block.subtitle ? (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {block.subtitle}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {block.items.map((item, index) => (
              <SuggestionCard
                key={`${block.blockKey}:${getSectionItemStableKey(item)}`}
                item={item}
                block={block}
                index={index}
                onOpen={handleOpen}
                onHide={handleHide}
                setItemRef={setItemRef}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
};

export default MarketSuggestionBlocks;
