import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RefreshCcw, WifiOff, ServerCrash, SearchX, Sparkles, TrendingUp, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import Masonry from 'react-masonry-css';
import marketApi from '@/api/MarketApi';
import { brandApi } from '@/api/BrandApi';
import type { MarketItem } from '@/types/market';
import DesignCard from '@/components/designs/DesignCard';
import DesignSkeleton from '@/components/designs/DesignSkeleton';
// Category chips live directly on page; tag chips removed for now
import DesignViewModal from '@/components/designs/DesignViewModal';
import VLoader from '@/components/loaders/VLoader';
import { setEngagementState } from '@/features/engagementSlice';
import { apiClient } from '@/api/httpClient';
import { toast } from 'sonner';
import type { RootState } from '@/store';
import FeaturedSection from '@/components/FeaturedSection';
import FeaturedGalleryModal from '@/components/FeaturedGalleryModal';
import { resolveProfileImageSource } from '@/utils/profileImage';

// Error type detection
type ErrorType = 'network' | 'timeout' | 'server' | 'empty' | 'category_empty' | 'unknown';

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
      className="relative overflow-hidden rounded-3xl border border-gray-200 dark:border-white/10 bg-gradient-to-br from-gray-100/80 to-white/80 dark:from-gray-900/50 dark:to-black/50 backdrop-blur-xl"
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
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {config.title}
        </h2>
        <p className={`text-lg ${config.iconColor} font-medium mb-3`}>
          {config.subtitle}
        </p>
        <p className="text-gray-600 dark:text-gray-400 max-w-md mb-8 leading-relaxed">
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
              className="flex items-center gap-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full px-4 py-2 shadow-sm dark:shadow-none"
            >
              <span>{tip.icon}</span>
              <span className="text-sm text-gray-700 dark:text-gray-300">{tip.text}</span>
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
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition-all shadow-lg"
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
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/20 text-gray-800 dark:text-white font-semibold hover:bg-gray-200 dark:hover:bg-white/20 transition-all"
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

const Market: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useDispatch();
  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [viewItem, setViewItem] = useState<MarketItem | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const user = useSelector((s: RootState) => s.user.profile);
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [patchMap, setPatchMap] = useState<Record<string, boolean>>({});
  const [patchingIds, setPatchingIds] = useState<Set<string>>(new Set());
  const isRegular = user?.type === 'REGULAR';
  const openDesignId = searchParams.get('openDesign');
  const openMediaId = searchParams.get('openMedia');
  const openCommentId = searchParams.get('commentId');
  const routeOpenKey = `${openDesignId ?? ''}::${openMediaId ?? ''}::${openCommentId ?? ''}`;
  const dismissedRouteOpenKeyRef = useRef<string | null>(null);
  const savedBatchInFlightRef = useRef<string | null>(null);
  const savedBatchLastRunRef = useRef<Record<string, number>>({});
  const patchBatchInFlightRef = useRef<string | null>(null);
  const patchBatchLastRunRef = useRef<Record<string, number>>({});

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

  const loadFeed = useCallback(async () => {
    // First load shows skeleton; subsequent loads use a soft overlay
    if (!hasLoadedOnce) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);
    try {
      const feed = await marketApi.getFeed({
        // Backend may ignore category until supported
        category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
        counts: 'combined',
      });
      setItems(feed.items);
      
      // Initialize Redux engagement state for all items (CRITICAL for thread persistence & real-time comment sync)
      feed.items.forEach((item) => {
        dispatch(setEngagementState({
          contentType: 'COLLECTION_MEDIA',
          contentId: item.id,
          threadedByMe: item.isThreaded ?? false,
          threadCount: item.threadsCount ?? 0,
          commentCount: item.commentsCount ?? 0,
          collabCount: item.collectionCollabCount ?? 0,
        }));
      });
      
      setHasLoadedOnce(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load market feed';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, hasLoadedOnce, dispatch]);

  // Load feed on mount and when dependencies change
  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    const shouldResolveFromRoute = Boolean(openDesignId || openMediaId);
    if (!shouldResolveFromRoute || loading) return;
    if (dismissedRouteOpenKeyRef.current === routeOpenKey) return;

    let cancelled = false;

    const toMarketItem = (detail: any, mediaOverrideId?: string | null): MarketItem | null => {
      if (!detail) return null;
      const medias = Array.isArray(detail.medias) ? detail.medias : [];
      const selectedMedia =
        medias.find((m: any) => m?.id === mediaOverrideId) ||
        medias.find((m: any) => m?.id === detail.coverMediaId) ||
        medias[0] ||
        null;

      if (!selectedMedia) return null;

      const file = selectedMedia.file ?? {};
      const mediaUrl =
        (typeof file.s3Url === 'string' && file.s3Url) ||
        (typeof file.url === 'string' && file.url) ||
        (typeof selectedMedia.url === 'string' && selectedMedia.url) ||
        '';

      const ownerAvatar = resolveProfileImageSource(detail.owner ?? null);

      return {
        id: String(selectedMedia.id),
        collectionId: String(detail.id),
        coverMediaId: detail.coverMediaId ?? null,
        collectionTitle: String(detail.title ?? 'Design'),
        collectionDescription: typeof detail.description === 'string' ? detail.description : null,
        brandId: String(detail.owner?.id ?? ''),
        brandName: detail.owner?.brand?.brandName ?? detail.owner?.username ?? null,
        username: detail.owner?.username ?? null,
        brandLogo: ownerAvatar.src,
        brandLogoFileId: ownerAvatar.fileId,
        minPrice: typeof detail.minPrice === 'number' ? detail.minPrice : null,
        maxPrice: typeof detail.maxPrice === 'number' ? detail.maxPrice : null,
        saleMinPrice: typeof detail.saleMinPrice === 'number' ? detail.saleMinPrice : null,
        saleMaxPrice: typeof detail.saleMaxPrice === 'number' ? detail.saleMaxPrice : null,
        saleStartAt: typeof detail.saleStartAt === 'string' ? detail.saleStartAt : null,
        saleEndAt: typeof detail.saleEndAt === 'string' ? detail.saleEndAt : null,
        threadsCount: typeof detail.totalThreads === 'number' ? detail.totalThreads : null,
        commentsCount: typeof detail.commentsCount === 'number' ? detail.commentsCount : null,
        collectionCollabCount: null,
        customMeasurementKeys: Array.isArray(detail.customMeasurementKeys)
          ? detail.customMeasurementKeys
          : [],
        customAvailable:
          detail.customOrderEnabled === true ||
          detail.customAvailable === true,
        tags: Array.isArray(detail.tags) ? detail.tags : [],
        media: {
          fileId: String(file.id ?? selectedMedia.id ?? ''),
          url: mediaUrl,
          previewUrl: mediaUrl,
          type: String(selectedMedia.mediaType ?? file.mimeType ?? 'POST_IMAGE').toUpperCase().includes('VIDEO')
            ? 'POST_VIDEO'
            : 'POST_IMAGE',
          aspectRatio: null,
          createdAt: null,
        },
        isThreaded: false,
      };
    };

    const resolveRoutedItem = async () => {
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
        const detail = await brandApi.getCollectionDetail(openDesignId, { scope: 'design' });
        const fallbackItem = toMarketItem(detail, openMediaId);
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
  }, [items, loading, openDesignId, openMediaId, routeOpenKey]);

  const mediaTargetIds = useMemo(
    () => items.map((item) => item.id).filter(Boolean),
    [items],
  );

  const mediaTargetIdsKey = useMemo(
    () => mediaTargetIds.join('|'),
    [mediaTargetIds],
  );

  const patchBrandTargetIds = useMemo(
    () => Array.from(new Set(items.map((item) => item.brandId).filter(Boolean))) as string[],
    [items],
  );

  const patchBrandTargetIdsKey = useMemo(
    () => patchBrandTargetIds.join('|'),
    [patchBrandTargetIds],
  );

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
    return () => { mounted = false; };
  }, [isAuth, mediaTargetIds, mediaTargetIdsKey]);

  useEffect(() => {
    let mounted = true;
    const loadPatches = async () => {
      if (!isAuth || !isRegular || patchBrandTargetIds.length === 0) {
        if (mounted) setPatchMap({});
        return;
      }

      const requestKey = `BRAND_PATCH:${patchBrandTargetIdsKey}`;
      const now = Date.now();
      const lastRunAt = patchBatchLastRunRef.current[requestKey] ?? 0;
      if (patchBatchInFlightRef.current === requestKey || now - lastRunAt < 1500) {
        return;
      }
      patchBatchInFlightRef.current = requestKey;

      try {
        const res = await apiClient.post('/brands/patches/check/batch', {
          targetIds: patchBrandTargetIds,
        });
        const list = res.data?.items ?? [];
        if (mounted) {
          const next: Record<string, boolean> = {};
          for (const entry of list) {
            if (entry?.targetId) next[entry.targetId] = Boolean(entry.isPatched);
          }
          setPatchMap((prev) => {
            const prevKeys = Object.keys(prev);
            const nextKeys = Object.keys(next);
            if (prevKeys.length === nextKeys.length && prevKeys.every((k) => prev[k] === next[k])) {
              return prev;
            }
            return next;
          });
        }
      } catch {
        if (mounted) setPatchMap({});
      } finally {
        if (patchBatchInFlightRef.current === requestKey) {
          patchBatchInFlightRef.current = null;
        }
        patchBatchLastRunRef.current[requestKey] = Date.now();
      }
    };
    void loadPatches();
    return () => { mounted = false; };
  }, [isAuth, isRegular, patchBrandTargetIds, patchBrandTargetIdsKey]);
  
  // Force reload when navigating back to this page (fixes image loading issue after route changes)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && hasLoadedOnce) {
        // Refresh data when page becomes visible again
        void loadFeed();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [loadFeed, hasLoadedOnce]);

  // Tag filter UI removed for now; keep hook slots lean

  // Backend now handles category filtering
  const filteredItems = useMemo(() => {
    let result = items;
    
    // Client-side category filter (fallback if backend doesn't filter)
    if (selectedCategory !== 'ALL') {
      result = result.filter((item) => {
        // Check if any tag matches the category slug or label (case-insensitive)
        // Also check if the item has a category property that matches
        const categoryTerms = [selectedCategory, selectedCategory.replace('_', ' ')];
        const hasMatchingTag = item.tags.some((tag) => 
          categoryTerms.some(term => tag.toLowerCase().includes(term.toLowerCase()))
        );
        // If item has a category field, check that too (assuming item.category exists or similar)
        const hasMatchingCategory = (item as any).category === selectedCategory;
        
        return hasMatchingTag || hasMatchingCategory;
      });
    }

    if (selectedTag) {
      result = result.filter((item) =>
        item.tags.some((tag) => tag.toLowerCase() === selectedTag.toLowerCase()),
      );
    }
    return result;
  }, [items, selectedTag, selectedCategory]);

  const handleViewCollection = (collectionId: string) => {
    navigate(`/collections/${collectionId}`);
  };

  const handleViewBrand = (brandId: string, item: MarketItem) => {
    if (!brandId) return;
    navigate(`/profile/${brandId}` , {
      state: {
        brandPreview: {
          id: brandId,
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
    setItems((prevItems) => {
      let changed = false;
      const nextItems = prevItems.map((item) => {
        if (item.id !== itemId) return item;
        const currentCount = item.commentsCount ?? 0;
        if (currentCount === newCount) return item;
        changed = true;
        return { ...item, commentsCount: newCount };
      });
      return changed ? nextItems : prevItems;
    });

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
    if (!isRegular) return;
    if (patchingIds.has(brandId)) return;
    try {
      setPatchingIds((prev) => new Set(prev).add(brandId));
      const isPatched = Boolean(patchMap[brandId]);
      if (isPatched) {
        await apiClient.delete(`/brands/${brandId}/patches`);
      } else {
        await apiClient.post(`/brands/${brandId}/patches`);
      }
      setPatchMap((prev) => ({ ...prev, [brandId]: !isPatched }));
      toast.success(isPatched ? 'Brand unpatched.' : 'Brand patched.');
    } catch {
      toast.error('Unable to update patch.');
    } finally {
      setPatchingIds((prev) => {
        const next = new Set(prev);
        next.delete(brandId);
        return next;
      });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-4">
      <FeaturedSection
        filterType="DESIGN"
        onViewDesign={(collectionId) => {
          const item = filteredItems.find((i) => i.id === collectionId);
          if (item) setViewItem(item);
        }}
        onSeeAll={() => setGalleryOpen(true)}
      />

           <div className="flex w-full gap-3 overflow-x-auto no-scrollbar mt-2 mb-3">
        {[
          { slug: 'ALL', label: 'All', border: 'border-slate-300/80 dark:border-slate-400/60', bgActive: 'bg-slate-500/20 backdrop-blur-md', hoverBg: 'hover:bg-slate-500/10' },
          { slug: 'AFRICAN_FASHION', label: 'African Fashion', border: 'border-fuchsia-300/80 dark:border-fuchsia-400/60', bgActive: 'bg-fuchsia-500/20 backdrop-blur-md', hoverBg: 'hover:bg-fuchsia-500/10' },
          { slug: 'WESTERN_FASHION', label: 'Western Fashion', border: 'border-blue-300/80 dark:border-blue-400/60', bgActive: 'bg-blue-500/20 backdrop-blur-md', hoverBg: 'hover:bg-blue-500/10' },
          { slug: 'DE_HOUSE', label: 'De House', border: 'border-emerald-300/80 dark:border-emerald-400/60', bgActive: 'bg-emerald-500/20 backdrop-blur-md', hoverBg: 'hover:bg-emerald-500/10' },
        ].map((cat) => {
          const active = selectedCategory === cat.slug;
          return (
            <button
              type="button"
              key={cat.slug}
              onClick={() => startTransition(() => setSelectedCategory(cat.slug))}
              className={
                `shrink-0 inline-flex items-center rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 border-2 ` +
                `${cat.border} text-gray-900 dark:text-white ` +
                (active
                  ? `${cat.bgActive} shadow-lg`
                  : `bg-transparent ${cat.hoverBg} shadow-md backdrop-blur-sm`) +
                (isPending ? ' opacity-60' : '')
              }
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Content + soft overlay wrapper for smooth transitions */}
      <div className="relative min-h-[240px]">
      <div className={`transition-opacity duration-300 ${(!loading && (refreshing || isPending)) ? 'opacity-60' : 'opacity-100'}`}>
      {loading && !hasLoadedOnce ? (
        <Masonry
          breakpointCols={{
            default: 3,
            1920: 4,
            1536: 3,
            1280: 3,
            1024: 2,
            768: 2,
            640: 1,
          }}
          className="flex -ml-6 w-auto"
          columnClassName="pl-6 space-y-6 bg-clip-padding"
        >
          <DesignSkeleton />
        </Masonry>
      ) : error ? (
        // Smart error state - detects error type for appropriate messaging
        <StateDisplay
          type={detectErrorType(error)}
          onRetry={() => void loadFeed()}
        />
      ) : filteredItems.length > 0 ? (
        <Masonry
          breakpointCols={{
            default: 3,
            1920: 4,
            1536: 3,
            1280: 3,
            1024: 2,
            768: 2,
            640: 1,
          }}
          className="flex -ml-6 w-auto"
          columnClassName="pl-6 space-y-6 bg-clip-padding"
        >
          {filteredItems.map((item) => (
            <div key={item.id} className="w-full">
              <DesignCard
                item={item}
                onOpenView={(it) => setViewItem(it)}
                onViewCollection={handleViewCollection}
                onViewBrand={handleViewBrand}
                isSaved={savedMap[item.id] ?? false}
                onToggleSave={handleToggleSave}
                saveBusy={savingIds.has(item.id)}
                isPatched={item.brandId ? patchMap[item.brandId] ?? false : false}
                onTogglePatch={handleTogglePatch}
                patchBusy={item.brandId ? patchingIds.has(item.brandId) : false}
              />
            </div>
          ))}
        </Masonry>
      ) : selectedCategory === 'ALL' ? (
        // Empty database state - no designs at all
        <StateDisplay
          type="empty"
          onRetry={() => void loadFeed()}
        />
      ) : (
        // Category-specific empty state
        <StateDisplay
          type="category_empty"
          category={selectedCategory}
          onRetry={() => void loadFeed()}
          onViewAll={() => {
            setSelectedCategory('ALL');
            setSelectedTag(null);
          }}
        />
      )}
      </div>
      {/* Soft overlay while refreshing/filtering (keeps layout stable) */}
      {(!loading && (refreshing || isPending)) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/40 dark:bg-black/30 backdrop-blur-[2px] transition-opacity duration-300">
          <VLoader size={24} phase="loading" showLabel={false} />
        </div>
      )}
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

      <FeaturedGalleryModal open={galleryOpen} onClose={() => setGalleryOpen(false)} />
    </div>
  );
};

export default Market;

// Modal outside of main layout tree for z-index safety
// Render within page to keep simple routing for now
export const MarketPageWithView: React.FC = () => {
  return <Market />;
};





