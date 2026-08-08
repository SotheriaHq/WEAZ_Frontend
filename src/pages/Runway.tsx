import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RefreshCcw, WifiOff, ServerCrash, SearchX, Sparkles, TrendingUp, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import Masonry from 'react-masonry-css';
import { useQuery } from '@tanstack/react-query';
import DesignApi from '@/api/DesignApi';
import type { MarketItem } from '@/types/market';
import DesignCard from '@/components/designs/DesignCard';
import DesignSkeleton from '@/components/designs/DesignSkeleton';
import StoreProductCard, { type StoreProduct } from '@/components/designs/StoreProductCard';
import DesignViewModal from '@/components/designs/DesignViewModal';
import { RunwayReelsFeed } from '@/components/runway/RunwayReelsFeed';
import { setEngagementState } from '@/features/engagementSlice';
import { selectIsMobile } from '@/features/uiSlice';
import { apiClient } from '@/api/httpClient';
import { toast } from 'sonner';
import type { RootState } from '@/store';
import { useBrandPatchState } from '@/context/BrandPatchContext';
import { patchToastMessage } from '@/lib/patchPresentation';
import { buildDesignRoute, buildProductRoute } from '@/utils/catalogRoutes';
import { buildBrandProfilePathFromMarketItem } from '@/utils/brandProfileRoute';
import { unwrapApiResponse, type ApiSuccessPayload } from '@/types/auth';
import {
  normalizeMarketProduct,
  type MarketplaceProduct,
  type RawProductsPayload,
} from '@/utils/marketProductMapper';
import { marketApi, type FeedCategory } from '@/api/MarketApi';
import { toDesignMarketItem } from '@/utils/designMarketItem';
import { shouldLoadProductFallback, type MarketPageMode } from '@/utils/marketFallback';
import { useScrollRestore } from '@/components/ScrollRestoreProvider';
import { useMarketSurfacePrefetch } from '@/hooks/useMarketSurfacePrefetch';
import useRunwayFeed from '@/hooks/useRunwayFeed';
import useRunwayPinnedFeed from '@/hooks/useRunwayPinnedFeed';
import { createMixSeed, mixFeedItems } from '@/utils/feedMixer';
import { queryKeys } from '@/query/queryKeys';

/**
 * Runway page — Design feed UI.
 * Domain: Design (backend). Label: Runway (frontend aesthetics).
 * Not the commerce Market surface (`MarketPlace` / `/market`).
 */

/** Phones / narrow mobile browsers: reels. md+ (tablet/iPad/desktop): masonry. */
const MASONRY_BREAKPOINT_COLS = {
  default: 3,
  1920: 4,
  1536: 3,
  1280: 3,
  1024: 2,
  768: 2,
};

// Error type detection
type ErrorType = 'network' | 'timeout' | 'server' | 'empty' | 'category_empty' | 'unknown';

const FALLBACK_FEED_CATEGORIES: FeedCategory[] = [
  {
    id: 'discover',
    key: 'discover',
    label: 'Discover',
    displayOrder: 10,
    isDefaultForGuest: true,
    isDefaultForNewUser: true,
  },
  { id: 'explore', key: 'explore', label: 'Explore', displayOrder: 20 },
  { id: 'african-style', key: 'african-style', label: 'African Style', displayOrder: 30 },
  { id: 'casual-style', key: 'casual-style', label: 'Casual', displayOrder: 40 },
];

const BROAD_FEED_CATEGORY_KEYS = new Set(['all', 'discover', 'explore', 'for-you']);

const feedTagForCategory = (categoryKey: string) =>
  BROAD_FEED_CATEGORY_KEYS.has(categoryKey.toLowerCase()) ? null : categoryKey;

const detectErrorType = (error: string | null, isTimeout?: boolean): ErrorType => {
  if (!error) return 'unknown';
  const lowerError = error.toLowerCase();
  if (isTimeout || lowerError.includes('timeout') || lowerError.includes('timed out')) return 'timeout';
  if (lowerError.includes('network') || lowerError.includes('fetch') || lowerError.includes('connection') || lowerError.includes('econnrefused')) return 'network';
  if (lowerError.includes('500') || lowerError.includes('502') || lowerError.includes('503') || lowerError.includes('server')) return 'server';
  return 'unknown';
};

// Beautiful Empty/Error State Component
interface StateDisplayProps {
  type: 'empty' | 'category_empty' | 'network' | 'timeout' | 'server' | 'unknown';
  category?: string;
  onRetry?: () => void;
  onViewAll?: () => void;
}

const StateDisplay: React.FC<StateDisplayProps> = ({ type, category, onRetry, onViewAll }) => {
  const configs = {
    empty: {
      emoji: '✨',
      icon: Sparkles,
      title: 'The runway is empty',
      subtitle: 'Be the first to showcase your designs!',
      description: 'Our designers are crafting amazing designs. Check back soon for fresh fashion inspiration.',
      gradient: 'from-purple-500/20 via-indigo-500/15 to-blue-500/10',
      iconBg: 'from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30',
      iconColor: 'text-purple-500',
      showViewAll: false,
      tips: [
        { icon: '👗', text: 'Follow your favorite brands' },
        { icon: '🔔', text: 'Enable notifications for new drops' },
        { icon: '🌟', text: 'Explore trending categories' },
      ],
    },
    category_empty: {
      emoji: '🔍',
      icon: SearchX,
      title: `No designs in ${category?.replace('_', ' ') || 'this category'}`,
      subtitle: 'This design feed is still growing',
      description: 'We couldn\'t find any designs matching this category yet. Try exploring other styles or check back later.',
      gradient: 'from-amber-500/20 via-orange-500/15 to-yellow-500/10',
      iconBg: 'from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30',
      iconColor: 'text-amber-500',
      showViewAll: true,
      tips: [
        { icon: '🎨', text: 'Try a different category' },
        { icon: '🔥', text: 'Check trending designs' },
        { icon: '💡', text: 'New styles added weekly' },
      ],
    },
    network: {
      emoji: '📡',
      icon: WifiOff,
      title: 'Connection lost',
      subtitle: 'We couldn\'t reach our servers',
      description: 'Please check your internet connection and try again. Your fashion feed will be back in no time!',
      gradient: 'from-blue-500/20 via-cyan-500/15 to-teal-500/10',
      iconBg: 'from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30',
      iconColor: 'text-blue-500',
      showViewAll: false,
      tips: [
        { icon: '📶', text: 'Check your WiFi connection' },
        { icon: '📱', text: 'Try switching to mobile data' },
        { icon: '🔄', text: 'Refresh in a few seconds' },
      ],
    },
    timeout: {
      emoji: '⏱️',
      icon: Clock,
      title: 'Taking too long',
      subtitle: 'The request timed out',
      description: 'Our servers are experiencing high traffic. Please wait a moment and try again.',
      gradient: 'from-orange-500/20 via-red-500/15 to-pink-500/10',
      iconBg: 'from-orange-100 to-red-100 dark:from-orange-900/30 dark:to-red-900/30',
      iconColor: 'text-orange-500',
      showViewAll: false,
      tips: [
        { icon: '☕', text: 'Grab a coffee and retry' },
        { icon: '🚀', text: 'Peak hours may be slower' },
        { icon: '⚡', text: 'Try again in a moment' },
      ],
    },
    server: {
      emoji: '🔧',
      icon: ServerCrash,
      title: 'Server hiccup',
      subtitle: 'Our team is on it!',
      description: 'We\'re experiencing technical difficulties. Our engineers are working to fix this quickly.',
      gradient: 'from-red-500/20 via-rose-500/15 to-pink-500/10',
      iconBg: 'from-red-100 to-rose-100 dark:from-red-900/30 dark:to-rose-900/30',
      iconColor: 'text-red-500',
      showViewAll: false,
      tips: [
        { icon: '🛠️', text: 'Engineers are notified' },
        { icon: '⏰', text: 'Usually fixed within minutes' },
        { icon: '🙏', text: 'Thanks for your patience' },
      ],
    },
    unknown: {
      emoji: '😅',
      icon: Sparkles,
      title: 'Something went wrong',
      subtitle: 'An unexpected error occurred',
      description: 'We\'re not sure what happened, but we\'re looking into it. Please try refreshing the page.',
      gradient: 'from-gray-500/20 via-slate-500/15 to-zinc-500/10',
      iconBg: 'from-gray-100 to-slate-100 dark:from-gray-900/30 dark:to-slate-900/30',
      iconColor: 'text-gray-500',
      showViewAll: false,
      tips: [
        { icon: '🔄', text: 'Try refreshing the page' },
        { icon: '🧹', text: 'Clear your browser cache' },
        { icon: '📧', text: 'Contact support if it persists' },
      ],
    },
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="surface-card relative overflow-hidden rounded-3xl backdrop-blur-xl"
    >
      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-gradient-to-r ${config.gradient} blur-3xl`}
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center py-16 px-6 text-center">
        {/* Floating emoji */}
        <motion.div
          className="relative mb-6"
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${config.iconBg} flex items-center justify-center shadow-lg`}>
            <Icon className={`w-10 h-10 ${config.iconColor}`} />
          </div>
          <span className="absolute -top-2 -right-2 text-3xl">{config.emoji}</span>
        </motion.div>

        {/* Title */}
        <h2 className="text-2xl md:text-3xl font-bold text-theme mb-2">
          {config.title}
        </h2>
        <p className={`text-lg ${config.iconColor} font-medium mb-3`}>
          {config.subtitle}
        </p>
        <p className="text-theme-secondary max-w-md mb-8 leading-relaxed">
          {config.description}
        </p>

        {/* Tips */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {config.tips.map((tip, index) => (
            <motion.div
              key={tip.text}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="surface-control flex items-center gap-2 rounded-full px-4 py-2 shadow-sm"
            >
              <span>{tip.icon}</span>
              <span className="text-sm text-theme-secondary">{tip.text}</span>
            </motion.div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {onRetry && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onRetry}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-[color:var(--text-primary)] text-[color:var(--surface-primary)] font-semibold opacity-95 transition-all hover:opacity-85 shadow-lg"
            >
              <RefreshCcw className="w-5 h-5" />
              Try Again
            </motion.button>
          )}
          {config.showViewAll && onViewAll && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onViewAll}
              className="surface-control surface-interactive-hover flex items-center gap-2 rounded-full px-6 py-3 font-semibold transition-all"
            >
              <TrendingUp className="w-5 h-5" />
              View All Designs
            </motion.button>
          )}
        </div>
      </div>
    </motion.section>
  );
};

interface RunwayProps {
  mode?: MarketPageMode;
}

const Runway: React.FC<RunwayProps> = ({ mode = 'designs' }) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useDispatch();
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('discover');
  const [viewItem, setViewItem] = useState<MarketItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  /** Phone + responsive mobile: reels. Wider tablets/iPad keep masonry. */
  const isMobileReels = useSelector(selectIsMobile);
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const {
    isPatchCapable,
    getPatched,
    isLoading: isPatchLoading,
    prefetchStatuses,
    toggleStatus,
  } = useBrandPatchState();
  const openDesignId = searchParams.get('openDesign');
  const openMediaId = searchParams.get('openMedia');
  const openCommentId = searchParams.get('commentId');
  const routeOpenKey = `${openDesignId ?? ''}::${openMediaId ?? ''}::${openCommentId ?? ''}`;
  const dismissedRouteOpenKeyRef = useRef<string | null>(null);
  const savedBatchInFlightRef = useRef<string | null>(null);
  const savedBatchLastRunRef = useRef<Record<string, number>>({});
  const [isPending, startTransition] = useTransition();
  // Extra pages for reels infinite scroll (first page still comes from useRunwayFeed).
  const [reelsExtraItems, setReelsExtraItems] = useState<MarketItem[]>([]);
  const [reelsNextCursor, setReelsNextCursor] = useState<string | null>(null);
  const [reelsHasMore, setReelsHasMore] = useState(false);
  const [reelsFetchingMore, setReelsFetchingMore] = useState(false);
  const reelsFetchInFlightRef = useRef(false);
  
  // Scroll restoration hook
  const { saveScrollPosition } = useScrollRestore('RUNWAY_FEED');

  // Warm the commerce Market surface cache while Runway idles so Runway → Market
  // switches paint instantly instead of cold-loading.
  useMarketSurfacePrefetch('runway');

  // Phone reels use a fixed-position snap stage; lock document scroll so the
  // page behind the stage never rubber-bands or steals vertical gestures.
  useEffect(() => {
    if (!isMobileReels) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyOverscroll = body.style.overscrollBehaviorY;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.overscrollBehaviorY = 'none';
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.overscrollBehaviorY = prevBodyOverscroll;
    };
  }, [isMobileReels]);

  const feedCategoriesQuery = useQuery({
    queryKey: queryKeys.runway.feedCategories(),
    queryFn: ({ signal }) => marketApi.getFeedCategories({ signal }),
  });
  const feedCategories = useMemo(() => {
    const categories = feedCategoriesQuery.data?.categories ?? FALLBACK_FEED_CATEGORIES;
    return [...categories]
      .filter((category) => category.status === undefined || category.status === 'ACTIVE')
      .sort((left, right) => {
        if (left.displayOrder !== right.displayOrder) return left.displayOrder - right.displayOrder;
        return left.key.localeCompare(right.key);
      });
  }, [feedCategoriesQuery.data?.categories]);
  const defaultFeedCategory =
    feedCategoriesQuery.data?.defaults?.selected ??
    (isAuth
      ? feedCategoriesQuery.data?.defaults?.authenticatedReturningUser ??
        feedCategoriesQuery.data?.defaults?.authenticatedNewUser
      : feedCategoriesQuery.data?.defaults?.guest) ??
    feedCategories[0]?.key ??
    'discover';
  const activeFeedTag = feedTagForCategory(selectedCategory);
  const activeCategoryLabel =
    feedCategories.find((category) => category.key === selectedCategory)?.label ?? selectedCategory;

  useEffect(() => {
    if (!feedCategories.length) return;
    if (!feedCategories.some((category) => category.key === selectedCategory)) {
      setSelectedCategory(defaultFeedCategory);
    }
  }, [defaultFeedCategory, feedCategories, selectedCategory]);

  // Design feed (Runway UI) via React Query
  const feedQuery = useRunwayFeed({
      tag: activeFeedTag ?? undefined,
      counts: 'combined',
  });

  const { data: feedData, isLoading, error: queryError, refetch } = feedQuery;
  const loadFeed = useCallback(() => {
    setError(null);
    return refetch();
  }, [refetch]);

  // SEARCH-CORE-5: Runway search-pinned mode. Activated by the search result
  // tap routing (?feedMode=searchPinned&query=...&anchorDesignId=...). The
  // default feed code path below is left entirely untouched.
  const isPinnedMode = searchParams.get('feedMode') === 'searchPinned';
  const pinnedQuery = searchParams.get('query') ?? '';
  const pinnedAnchorId = searchParams.get('anchorDesignId') ?? undefined;
  const [pinnedCursor, setPinnedCursor] = useState<string | undefined>(undefined);
  const [pinnedItems, setPinnedItems] = useState<MarketItem[]>([]);
  const pinnedFeed = useRunwayPinnedFeed(
    { query: pinnedQuery, anchorDesignId: pinnedAnchorId, cursor: pinnedCursor, limit: 12 },
    { enabled: isPinnedMode },
  );

  // Reset accumulation whenever the pinned query/anchor changes or pinned mode
  // is exited, so a stale search context can never overwrite a newer one.
  useEffect(() => {
    setPinnedCursor(undefined);
    setPinnedItems([]);
  }, [pinnedQuery, pinnedAnchorId, isPinnedMode]);

  // Accumulate keyset pages (dedupe by id) as the cursor advances.
  useEffect(() => {
    const data = pinnedFeed.data;
    if (!isPinnedMode || !data) return;
    setPinnedItems((prev) => {
      const base = pinnedCursor ? prev : [];
      const seen = new Set(base.map((entry) => entry.id));
      const merged = [...base];
      for (const entry of data.items) {
        if (!seen.has(entry.id)) {
          seen.add(entry.id);
          merged.push(entry);
        }
      }
      return merged;
    });
  }, [pinnedFeed.data, isPinnedMode, pinnedCursor]);

  const exitPinnedToDefaultFeed = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('feedMode');
    next.delete('query');
    next.delete('anchorDesignId');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const broadenPinnedSearch = useCallback(() => {
    // Safe placeholder: route back to global search with the same query.
    navigate(`/search?q=${encodeURIComponent(pinnedQuery)}`);
  }, [navigate, pinnedQuery]);

  // Handle engagement state dispatch when feed data arrives
  useEffect(() => {
    if (feedData?.items) {
      feedData.items.forEach((item) => {
        dispatch(setEngagementState({
          contentType: 'COLLECTION_MEDIA',
          contentId: item.id,
          threadedByMe: item.isThreaded ?? false,
          threadCount: item.threadsCount ?? 0,
          commentCount: item.commentsCount ?? 0,
          collabCount: item.collectionCollabCount ?? 0,
        }));
      });
    }
  }, [feedData, dispatch]);

  const shouldUseProductFallback = shouldLoadProductFallback({
    mode,
    selectedCategory,
    designItemCount: feedData?.items.length ?? 0,
  });

  const fallbackProductsQuery = useQuery({
    queryKey: queryKeys.market.fallbackProducts({
      surface: 'design-feed',
      limit: 24,
      sortBy: 'newest',
    }),
    queryFn: async ({ signal }) => {
      const response = await apiClient.get('/products/market', {
        params: { limit: 24, sortBy: 'newest' },
        signal,
      });
      const payload = unwrapApiResponse<RawProductsPayload>(
        response.data as ApiSuccessPayload<RawProductsPayload>,
      );
      const products = Array.isArray(payload?.items)
        ? payload.items
            .map((row) => normalizeMarketProduct(row))
            .filter((product): product is MarketplaceProduct => Boolean(product))
        : [];
      const byId = new Map<string, MarketplaceProduct>();
      for (const product of products) {
        if (!byId.has(product.id)) byId.set(product.id, product);
      }
      return Array.from(byId.values());
    },
    enabled: Boolean(feedData) && shouldUseProductFallback,
  });

  const fallbackProducts = fallbackProductsQuery.data ?? [];

  // Show query error as state error (convert React Query error to display error)
  useEffect(() => {
    if (queryError) {
      const message =
        queryError instanceof Error ? queryError.message : 'Unable to load market feed';
      setError(message);
      return;
    }
    setError(null);
  }, [queryError]);

  const closeViewModal = useCallback(() => {
    if (openDesignId || openMediaId || openCommentId) {
      dismissedRouteOpenKeyRef.current = routeOpenKey;
    }
    setViewItem(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('openDesign');
      next.delete('openMedia');
      next.delete('commentId');
      return next;
    }, { replace: true });
  }, [openCommentId, openDesignId, openMediaId, routeOpenKey, setSearchParams]);

  // Handle route-based item opening
  useEffect(() => {
    const shouldResolveFromRoute = Boolean(openDesignId || openMediaId);
    if (!shouldResolveFromRoute || isLoading) return;
    if (dismissedRouteOpenKeyRef.current === routeOpenKey) return;

    let cancelled = false;

    const resolveRoutedItem = async () => {
      const items = feedData?.items ?? [];
      const fromFeed = items.find((item) => {
        if (openMediaId) return item.id === openMediaId;
        if (openDesignId) return item.collectionId === openDesignId;
        return false;
      });

      if (fromFeed) {
        if (!cancelled) setViewItem(fromFeed);
        return;
      }

      if (!openDesignId) return;

      try {
        const detail = await DesignApi.getDesignDetail(openDesignId);
        const fallbackItem = toDesignMarketItem(detail, openMediaId);
        if (!cancelled && fallbackItem) {
          setViewItem(fallbackItem);
        }
      } catch {
        // Keep current state if lookup fails; user can still browse feed.
      }
    };

    void resolveRoutedItem();

    return () => {
      cancelled = true;
    };
  }, [feedData, isLoading, openDesignId, openMediaId, routeOpenKey]);

  // Scored rotation (product rule: remix on every login / refresh / re-route).
  // The backend rotates per fresh load, but the persisted query cache replays
  // the previous response within staleTime — so remix presentation-side with a
  // per-mount seed, exactly like the MarketPlace grid does.
  const runwayMixSeedRef = useRef(createMixSeed());
  const items = useMemo(
    () => mixFeedItems(feedData?.items ?? [], runwayMixSeedRef.current),
    [feedData?.items],
  );

  // Reset reels pagination when the primary feed page or category changes.
  useEffect(() => {
    setReelsExtraItems([]);
    setReelsNextCursor(feedData?.nextCursor ?? null);
    setReelsHasMore(Boolean(feedData?.hasNextPage));
    reelsFetchInFlightRef.current = false;
  }, [feedData?.items, feedData?.nextCursor, feedData?.hasNextPage, activeFeedTag]);

  const mediaTargetIds = useMemo(() => {
    const base = items.map((item) => item.id).filter(Boolean);
    if (reelsExtraItems.length === 0) return base;
    const seen = new Set(base);
    const merged = [...base];
    for (const entry of reelsExtraItems) {
      if (!entry.id || seen.has(entry.id)) continue;
      seen.add(entry.id);
      merged.push(entry.id);
    }
    return merged;
  }, [items, reelsExtraItems]);

  const mediaTargetIdsKey = useMemo(
    () => mediaTargetIds.join('|'),
    [mediaTargetIds],
  );

  const patchBrandTargetIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of items) {
      if (item.brandId) ids.add(item.brandId);
    }
    for (const item of reelsExtraItems) {
      if (item.brandId) ids.add(item.brandId);
    }
    return Array.from(ids);
  }, [items, reelsExtraItems]);

  // Load saved status for items
  useEffect(() => {
    let mounted = true;
    const loadSaved = async () => {
      if (!isAuth || mediaTargetIds.length === 0) {
        if (mounted) setSavedMap({});
        return;
      }

      const requestKey = `COLLECTION_MEDIA:${mediaTargetIdsKey}`;
      const now = Date.now();
      const lastRunAt = savedBatchLastRunRef.current[requestKey] ?? 0;
      if (savedBatchInFlightRef.current === requestKey || now - lastRunAt < 1500) {
        return;
      }
      savedBatchInFlightRef.current = requestKey;

      try {
        const res = await apiClient.post('/saved/check/batch', {
          targetType: 'COLLECTION_MEDIA',
          targetIds: mediaTargetIds,
        });
        const list = res.data?.items ?? [];
        if (mounted) {
          const next: Record<string, boolean> = {};
          for (const entry of list) {
            if (entry?.targetId) next[entry.targetId] = Boolean(entry.isSaved);
          }
          setSavedMap((prev) => {
            const prevKeys = Object.keys(prev);
            const nextKeys = Object.keys(next);
            if (prevKeys.length === nextKeys.length && prevKeys.every((k) => prev[k] === next[k])) {
              return prev;
            }
            return next;
          });
        }
      } catch {
        if (mounted) setSavedMap({});
      } finally {
        if (savedBatchInFlightRef.current === requestKey) {
          savedBatchInFlightRef.current = null;
        }
        savedBatchLastRunRef.current[requestKey] = Date.now();
      }
    };
    void loadSaved();
    return () => {
      mounted = false;
    };
  }, [isAuth, mediaTargetIds, mediaTargetIdsKey]);

  // Prefetch brand patch statuses
  useEffect(() => {
    if (!isAuth || !isPatchCapable || patchBrandTargetIds.length === 0) return;
    void prefetchStatuses(patchBrandTargetIds);
  }, [isAuth, isPatchCapable, patchBrandTargetIds, prefetchStatuses]);

  // Client-side filtering (backend may not filter yet)
  const filteredItems = useMemo(() => {
    let result = items;

    if (activeFeedTag) {
      result = result.filter((item) => {
        const categoryTerms = [activeFeedTag, activeFeedTag.replace(/[-_]+/g, ' ')];
        const hasMatchingTag = item.tags.some((tag) =>
          categoryTerms.some((term) => tag.toLowerCase().includes(term.toLowerCase())),
        );
        const rawCategory = String((item as any).category ?? '').toLowerCase();
        const hasMatchingCategory =
          rawCategory === activeFeedTag.toLowerCase() ||
          rawCategory === activeFeedTag.replace(/[-_]+/g, ' ').toLowerCase();

        return hasMatchingTag || hasMatchingCategory;
      });
    }

    if (selectedTag) {
      result = result.filter((item) =>
        item.tags.some((tag) => tag.toLowerCase() === selectedTag.toLowerCase()),
      );
    }
    return result;
  }, [items, selectedTag, activeFeedTag]);

  /** First page + reels cursor pages (deduped). Masonry only uses filteredItems. */
  const runwayReelsItems = useMemo(() => {
    if (reelsExtraItems.length === 0) return filteredItems;
    const seen = new Set(filteredItems.map((entry) => entry.id));
    const merged = [...filteredItems];
    for (const entry of reelsExtraItems) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      merged.push(entry);
    }
    return merged;
  }, [filteredItems, reelsExtraItems]);

  const handleReelsLoadMore = useCallback(async () => {
    if (!isMobileReels || !reelsHasMore || !reelsNextCursor || reelsFetchInFlightRef.current) {
      return;
    }
    reelsFetchInFlightRef.current = true;
    setReelsFetchingMore(true);
    try {
      const page = await marketApi.getRunwayFeed({
        tag: activeFeedTag ?? undefined,
        counts: 'combined',
        cursor: reelsNextCursor,
        limit: 12,
      });
      const mixed = mixFeedItems(
        page.items ?? [],
        `${runwayMixSeedRef.current}:cursor:${reelsNextCursor}`,
      );
      setReelsExtraItems((prev) => {
        const seen = new Set(prev.map((entry) => entry.id));
        const next = [...prev];
        for (const entry of mixed) {
          if (seen.has(entry.id)) continue;
          seen.add(entry.id);
          next.push(entry);
        }
        return next;
      });
      setReelsNextCursor(page.nextCursor ?? null);
      setReelsHasMore(Boolean(page.hasNextPage && page.nextCursor));
    } catch {
      // Silent — user can keep scrolling existing reels; next arm will retry.
    } finally {
      reelsFetchInFlightRef.current = false;
      setReelsFetchingMore(false);
    }
  }, [
    activeFeedTag,
    isMobileReels,
    reelsExtraItems.length,
    reelsHasMore,
    reelsNextCursor,
  ]);

  const handleViewCollection = (designId: string) => {
    saveScrollPosition('RUNWAY_FEED', window.scrollY);
    navigate(buildDesignRoute({ designId, legacyCollectionId: designId }));
  };

  const handleViewProduct = (product: StoreProduct) => {
    saveScrollPosition('RUNWAY_FEED', window.scrollY);
    navigate(buildProductRoute({ productId: product.id }));
  };

  const handleViewBrand = (brandId: string, item: MarketItem) => {
    if (!brandId && !item.username) return;
    saveScrollPosition('RUNWAY_FEED', window.scrollY);
    const path =
      buildBrandProfilePathFromMarketItem(item) ||
      (brandId ? `/profile/${encodeURIComponent(brandId)}` : null);
    if (!path) return;
    navigate(path, {
      state: {
        brandPreview: {
          id: brandId || item.brandId,
          brandFullName: item.brandName ?? item.username ?? 'Brand',
          brandCity: undefined,
          brandCountry: undefined,
          brandState: undefined,
          brandTags: item.tags ?? [],
          profileImage: item.brandLogo ?? undefined,
          username: item.username ?? undefined,
        },
      },
    });
  };

  const handleCommentCountChange = (itemId: string, newCount: number) => {
    setViewItem((prevItem) => {
      if (!prevItem || prevItem.id !== itemId) return prevItem;
      const currentCount = prevItem.commentsCount ?? 0;
      if (currentCount === newCount) return prevItem;
      return { ...prevItem, commentsCount: newCount };
    });
  };

  const handleToggleSave = async (itemId: string) => {
    if (!isAuth) {
      toast.info('Please sign in to save items.');
      return;
    }
    if (savingIds.has(itemId)) return;
    try {
      setSavingIds((prev) => new Set(prev).add(itemId));
      const isSaved = Boolean(savedMap[itemId]);
      if (isSaved) {
        await apiClient.delete('/saved', { data: { targetType: 'COLLECTION_MEDIA', targetId: itemId } });
      } else {
        await apiClient.post('/saved', { targetType: 'COLLECTION_MEDIA', targetId: itemId });
      }
      setSavedMap((prev) => ({ ...prev, [itemId]: !isSaved }));
      toast.success(isSaved ? 'Removed from saved.' : 'Saved for later.');
    } catch {
      toast.error('Unable to update saved items.');
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleTogglePatch = async (brandId: string) => {
    if (!isAuth) {
      toast.info('Please sign in to patch brands.');
      return;
    }
    if (!isPatchCapable) return;
    try {
      const nextPatched = await toggleStatus(brandId);
      toast.success(patchToastMessage(nextPatched));
    } catch {
      toast.error('Unable to update patch.');
    }
  };

  const categoryChips = (
    <div className="flex items-center gap-2 border-b border-[color:var(--border-default)]/70 pb-1 text-sm min-w-max justify-start md:justify-center md:mx-auto">
      {feedCategories.map((cat) => {
        const active = selectedCategory === cat.key;
        return (
          <button
            type="button"
            key={cat.key}
            onClick={() => startTransition(() => setSelectedCategory(cat.key))}
            aria-pressed={active}
            className={`relative shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              active
                ? 'bg-[color:var(--brand-primary)]/10 text-[color:var(--brand-primary)]'
                : 'text-theme-secondary hover:bg-[color:var(--surface-muted)] hover:text-theme'
            }${isPending ? ' opacity-60' : ''}`}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );

  const reelsCategoryHeader = (
    <div className="bg-gradient-to-b from-black/70 via-black/35 to-transparent px-2 pb-3 pt-2">
      <div className="overflow-x-auto no-scrollbar">
        <div className="flex min-w-max items-center gap-2">
          {feedCategories.map((cat) => {
            const active = selectedCategory === cat.key;
            return (
              <button
                type="button"
                key={cat.key}
                onClick={() => startTransition(() => setSelectedCategory(cat.key))}
                aria-pressed={active}
                className={`relative shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-md transition-colors ${
                  active
                    ? 'bg-white/90 text-black'
                    : 'bg-white/15 text-white hover:bg-white/25'
                }${isPending ? ' opacity-60' : ''}`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (isPinnedMode) {
    const pinnedLoading = pinnedFeed.isLoading && pinnedItems.length === 0;
    const hasMore = Boolean(pinnedFeed.data?.hasMore);
    const exhausted = !pinnedLoading && !hasMore;

    if (isMobileReels) {
      return (
        <div className="relative">
          {/* Full-bleed stage: owns the whole viewport, with the navbar floating
              transparently over it (Layout → `immersive`). It used to start at
              `top-16`, handing the top 64px of a media surface to a solid bar —
              which is what read as the nav pushing everything down. */}
          <div
            className="fixed inset-x-0 top-0 z-10 bg-black"
            style={{
              bottom: 0,
            }}
          >
            <RunwayReelsFeed
              items={pinnedItems}
              isLoading={pinnedLoading}
              hasNextPage={hasMore}
              isFetchingMore={pinnedFeed.isFetching && pinnedItems.length > 0}
              onLoadMore={() => {
                if (pinnedFeed.data?.nextCursor) {
                  setPinnedCursor(pinnedFeed.data.nextCursor);
                }
              }}
              onOpenView={(it) => setViewItem(it)}
              onViewBrand={handleViewBrand}
              isSaved={(id) => savedMap[id] ?? false}
              saveBusy={(id) => savingIds.has(id)}
              onToggleSave={handleToggleSave}
              isPatched={(brandId) => getPatched(brandId)}
              patchBusy={(brandId) => isPatchLoading(brandId)}
              onTogglePatch={handleTogglePatch}
              header={
                <div className="flex items-center justify-between gap-2 bg-gradient-to-b from-black/75 to-transparent px-3 pb-2 pt-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
                      Pinned search
                    </p>
                    <p className="text-sm font-bold text-white">“{pinnedQuery}”</p>
                  </div>
                  <button
                    type="button"
                    onClick={exitPinnedToDefaultFeed}
                    className="shrink-0 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-black"
                  >
                    Exit pin
                  </button>
                </div>
              }
            />
          </div>
          {exhausted && pinnedItems.length > 0 ? (
            <div className="sr-only">End of pinned matches for {pinnedQuery}</div>
          ) : null}
          <DesignViewModal
            open={Boolean(viewItem)}
            item={viewItem}
            onClose={closeViewModal}
            onCommentCountChange={(newCount) => {
              if (viewItem) {
                handleCommentCountChange(viewItem.id, newCount);
              }
            }}
          />
        </div>
      );
    }

    return (
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-4">
        <div className="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--border-default)]/70 bg-[color:var(--surface-muted)]/60 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-secondary">
              Pinned to your search
            </p>
            <h2 className="truncate text-lg font-bold text-theme">“{pinnedQuery}”</h2>
          </div>
          <button
            type="button"
            onClick={exitPinnedToDefaultFeed}
            className="shrink-0 rounded-full bg-[color:var(--brand-primary)]/10 px-4 py-2 text-xs font-semibold text-[color:var(--brand-primary)] transition-colors hover:bg-[color:var(--brand-primary)]/20"
          >
            Continue normal Runway feed
          </button>
        </div>

        <div className="relative min-h-[240px]">
          {pinnedLoading ? (
            <Masonry
              breakpointCols={MASONRY_BREAKPOINT_COLS}
              className="flex -ml-6 w-auto"
              columnClassName="pl-6 space-y-6 bg-clip-padding"
            >
              {Array.from({ length: 9 }).map((_, i) => (
                <DesignSkeleton key={i} />
              ))}
            </Masonry>
          ) : pinnedItems.length > 0 ? (
            <Masonry
              breakpointCols={MASONRY_BREAKPOINT_COLS}
              className="flex -ml-6 w-auto"
              columnClassName="pl-6 space-y-6 bg-clip-padding"
            >
              {pinnedItems.map((item, index) => (
                <div key={item.id} className="w-full">
                  <DesignCard
                    item={item}
                    priority={index < 4}
                    onOpenView={(it) => setViewItem(it)}
                    onViewCollection={handleViewCollection}
                    onViewBrand={handleViewBrand}
                    isSaved={savedMap[item.id] ?? false}
                    onToggleSave={handleToggleSave}
                    saveBusy={savingIds.has(item.id)}
                    isPatched={item.brandId ? getPatched(item.brandId) : false}
                    onTogglePatch={handleTogglePatch}
                    patchBusy={item.brandId ? isPatchLoading(item.brandId) : false}
                  />
                </div>
              ))}
            </Masonry>
          ) : (
            <div className="rounded-2xl border border-[color:var(--border-default)]/70 bg-[color:var(--surface-muted)]/50 p-10 text-center text-theme-secondary">
              No matching designs for “{pinnedQuery}” yet.
            </div>
          )}

          {hasMore ? (
            <div className="flex justify-center pt-6">
              <button
                type="button"
                onClick={() => setPinnedCursor(pinnedFeed.data?.nextCursor ?? undefined)}
                disabled={pinnedFeed.isFetching}
                className="rounded-full bg-theme px-5 py-3 text-sm font-semibold text-theme-inverse transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pinnedFeed.isFetching ? 'Loading more…' : 'Load more'}
              </button>
            </div>
          ) : null}

          {exhausted ? (
            <div className="mt-6 rounded-2xl border border-[color:var(--border-default)]/70 bg-[color:var(--surface-muted)]/60 p-6 text-center">
              <p className="text-sm font-semibold text-theme">
                You’ve reached the end of matches for “{pinnedQuery}”.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={exitPinnedToDefaultFeed}
                  className="rounded-full bg-theme px-5 py-2.5 text-sm font-semibold text-theme-inverse transition hover:opacity-90"
                >
                  Continue normal Runway feed
                </button>
                <button
                  type="button"
                  onClick={broadenPinnedSearch}
                  className="rounded-full border border-[color:var(--border-default)] px-5 py-2.5 text-sm font-semibold text-theme transition hover:bg-[color:var(--surface-muted)]"
                >
                  Broaden search
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <DesignViewModal
          open={Boolean(viewItem)}
          item={viewItem}
          onClose={closeViewModal}
          onCommentCountChange={(newCount) => {
            if (viewItem) {
              handleCommentCountChange(viewItem.id, newCount);
            }
          }}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Mobile reels (phone browsers + responsive mobile widths < 768)
  // ---------------------------------------------------------------------------
  if (isMobileReels) {
    const showError = Boolean(error) && !feedData;
    const showEmpty =
      !isLoading &&
      !error &&
      runwayReelsItems.length === 0 &&
      !(
        shouldLoadProductFallback({
          mode,
          selectedCategory,
          designItemCount: filteredItems.length,
        }) && fallbackProducts.length > 0
      );

    const showFallback =
      runwayReelsItems.length === 0 &&
      shouldLoadProductFallback({
        mode,
        selectedCategory,
        designItemCount: filteredItems.length,
      }) &&
      fallbackProducts.length > 0;

    // Black belongs to the MEDIA, not to the route. The stage was
    // unconditionally `bg-black`, but the empty/error/fallback branches paint a
    // theme surface on top of it — so on a light theme the user got light
    // panels, a light category header and a light island bar sitting on a black
    // stage, with black showing through every gap. Reels stay black because
    // photos and video need a neutral ground; everything else follows the theme
    // like the rest of the app.
    const showsReels = !showError && !showEmpty && !showFallback;

    return (
      <div className="relative">
        {/* Full-bleed stage — see the pinned-mode stage above. */}
        <div
          className={`fixed inset-x-0 top-0 z-10 ${
            showsReels ? 'bg-black' : 'bg-[color:var(--surface-base)]'
          }`}
          style={{
            bottom: 0,
          }}
        >
          {showError ? (
            <div className="flex h-full flex-col overflow-y-auto bg-[color:var(--surface-base)] px-3 pt-20 pb-[calc(env(safe-area-inset-bottom,0px)+7rem)]">
              {reelsCategoryHeader}
              <StateDisplay type={detectErrorType(error)} onRetry={() => void refetch()} />
            </div>
          ) : showEmpty ? (
            <div className="flex h-full flex-col overflow-y-auto bg-[color:var(--surface-base)] px-3 pt-20 pb-[calc(env(safe-area-inset-bottom,0px)+7rem)]">
              {reelsCategoryHeader}
              {!activeFeedTag ? (
                <StateDisplay type="empty" onRetry={() => void loadFeed()} />
              ) : (
                <StateDisplay
                  type="category_empty"
                  category={activeCategoryLabel}
                  onRetry={() => void loadFeed()}
                  onViewAll={() => {
                    setSelectedCategory(defaultFeedCategory);
                    setSelectedTag(null);
                  }}
                />
              )}
            </div>
          ) : showFallback ? (
            <div className="flex h-full flex-col overflow-y-auto bg-[color:var(--surface-base)] px-3 pt-20 pb-[calc(env(safe-area-inset-bottom,0px)+7rem)]">
              {reelsCategoryHeader}
              <section className="mt-4 space-y-4" data-entity-type="PRODUCT" data-card-branch="product">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-secondary">
                    Ready-to-wear
                  </p>
                  <h2 className="text-xl font-bold text-theme">Fresh products in market</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {fallbackProducts.map((product) => (
                    <StoreProductCard
                      key={product.id}
                      product={product}
                      onViewProduct={handleViewProduct}
                      enableHoverGallery
                    />
                  ))}
                </div>
              </section>
            </div>
          ) : (
            <RunwayReelsFeed
              items={runwayReelsItems}
              isLoading={isLoading && !feedData}
              hasNextPage={reelsHasMore}
              isFetchingMore={reelsFetchingMore}
              onLoadMore={() => {
                void handleReelsLoadMore();
              }}
              onOpenView={(it) => setViewItem(it)}
              onViewBrand={handleViewBrand}
              isSaved={(id) => savedMap[id] ?? false}
              saveBusy={(id) => savingIds.has(id)}
              onToggleSave={handleToggleSave}
              isPatched={(brandId) => getPatched(brandId)}
              patchBusy={(brandId) => isPatchLoading(brandId)}
              onTogglePatch={handleTogglePatch}
              header={reelsCategoryHeader}
            />
          )}
        </div>
        <DesignViewModal
          open={Boolean(viewItem)}
          item={viewItem}
          onClose={closeViewModal}
          onCommentCountChange={(newCount) => {
            if (viewItem) {
              handleCommentCountChange(viewItem.id, newCount);
            }
          }}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Tablet / desktop masonry
  // ---------------------------------------------------------------------------
  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-4">
      <div className="sticky top-16 z-20 mb-1 overflow-x-auto no-scrollbar px-2 py-1">
        {categoryChips}
      </div>

      {/* Content — never dim or spinner-overlay already-painted cached data. */}
      <div className="relative min-h-[240px]">
      <div>
      {isLoading && !feedData ? (
        <Masonry
          breakpointCols={MASONRY_BREAKPOINT_COLS}
          className="flex -ml-6 w-auto"
          columnClassName="pl-6 space-y-6 bg-clip-padding"
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <DesignSkeleton key={i} />
          ))}
        </Masonry>
      ) : error ? (
        // Smart error state - detects error type for appropriate messaging
        <StateDisplay
          type={detectErrorType(error)}
          onRetry={() => void refetch()}
        />
      ) : filteredItems.length > 0 ? (
        <Masonry
          breakpointCols={MASONRY_BREAKPOINT_COLS}
          className="flex -ml-6 w-auto"
          columnClassName="pl-6 space-y-6 bg-clip-padding"
        >
          {filteredItems.map((item, index) => (
            <div key={item.id} className="w-full">
              <DesignCard
                item={item}
                priority={index < 4}
                onOpenView={(it) => setViewItem(it)}
                onViewCollection={handleViewCollection}
                onViewBrand={handleViewBrand}
                isSaved={savedMap[item.id] ?? false}
                onToggleSave={handleToggleSave}
                saveBusy={savingIds.has(item.id)}
                isPatched={item.brandId ? getPatched(item.brandId) : false}
                onTogglePatch={handleTogglePatch}
                patchBusy={item.brandId ? isPatchLoading(item.brandId) : false}
              />
            </div>
          ))}
        </Masonry>
      ) : shouldLoadProductFallback({
        mode,
        selectedCategory,
        designItemCount: filteredItems.length,
      }) && fallbackProducts.length > 0 ? (
        <section className="space-y-4" data-entity-type="PRODUCT" data-card-branch="product">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-theme-secondary">Ready-to-wear</p>
            <h2 className="text-2xl font-bold text-theme">Fresh products in market</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {fallbackProducts.map((product) => (
              <StoreProductCard
                key={product.id}
                product={product}
                onViewProduct={handleViewProduct}
                enableHoverGallery
              />
            ))}
          </div>
        </section>
      ) : !activeFeedTag ? (
        // Empty database state - no designs at all
        <StateDisplay
          type="empty"
          onRetry={() => void loadFeed()}
        />
      ) : (
        // Category-specific empty state
        <StateDisplay
          type="category_empty"
          category={activeCategoryLabel}
          onRetry={() => void loadFeed()}
          onViewAll={() => {
            setSelectedCategory(defaultFeedCategory);
            setSelectedTag(null);
          }}
        />
      )}
      </div>
      {/* Intentionally no spinner/backdrop over cached cards on revalidate.
          Background refetch is silent; only the true first-load skeleton above
          paints when feedData is absent. */}
      </div>
      {/* View modal */}
      <DesignViewModal
        open={Boolean(viewItem)}
        item={viewItem}
        onClose={closeViewModal}
        onCommentCountChange={(newCount) => {
          if (viewItem) {
            handleCommentCountChange(viewItem.id, newCount);
          }
        }}
      />
    </div>
  );
};

export default Runway;

// Modal outside of main layout tree for z-index safety
// Render within page to keep simple routing for now
export const RunwayPageWithView: React.FC = () => {
  return <Runway mode="designs" />;
};

/** @deprecated Use RunwayPageWithView — Runway is the design feed, not commerce Market. */
export const MarketPageWithView = RunwayPageWithView;





