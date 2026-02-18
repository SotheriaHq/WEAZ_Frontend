import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RefreshCcw, WifiOff, ServerCrash, SearchX, Sparkles, TrendingUp, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import Masonry from 'react-masonry-css';
import marketApi from '@/api/MarketApi';
import type { MarketItem } from '@/types/market';
import DesignCard from '@/components/designs/DesignCard';
import DesignSkeleton from '@/components/designs/DesignSkeleton';
// Category chips live directly on page; tag chips removed for now
import DesignViewModal from '@/components/designs/DesignViewModal';
import { setEngagementState } from '@/features/engagementSlice';
import { apiClient } from '@/api/httpClient';
import { toast } from 'sonner';
import type { RootState } from '@/store';

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
  const dispatch = useDispatch();
  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [viewItem, setViewItem] = useState<MarketItem | null>(null);
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
    let mounted = true;
    const loadSaved = async () => {
      if (!isAuth || items.length === 0) {
        if (mounted) setSavedMap({});
        return;
      }
      try {
        const res = await apiClient.post('/saved/check/batch', {
          targetType: 'COLLECTION_MEDIA',
          targetIds: items.map((item) => item.id).filter(Boolean),
        });
        const list = res.data?.items ?? [];
        if (mounted) {
          const next: Record<string, boolean> = {};
          for (const entry of list) {
            if (entry?.targetId) next[entry.targetId] = Boolean(entry.isSaved);
          }
          setSavedMap(next);
        }
      } catch {
        if (mounted) setSavedMap({});
      }
    };
    void loadSaved();
    return () => { mounted = false; };
  }, [items, isAuth]);

  useEffect(() => {
    let mounted = true;
    const loadPatches = async () => {
      if (!isAuth || !isRegular || items.length === 0) {
        if (mounted) setPatchMap({});
        return;
      }
      const brandIds = Array.from(
        new Set(items.map((item) => item.brandId).filter(Boolean))
      ) as string[];
      if (brandIds.length === 0) {
        if (mounted) setPatchMap({});
        return;
      }
      try {
        const res = await apiClient.post('/brands/patches/check/batch', {
          targetIds: brandIds,
        });
        const list = res.data?.items ?? [];
        if (mounted) {
          const next: Record<string, boolean> = {};
          for (const entry of list) {
            if (entry?.targetId) next[entry.targetId] = Boolean(entry.isPatched);
          }
          setPatchMap(next);
        }
      } catch {
        if (mounted) setPatchMap({});
      }
    };
    void loadPatches();
    return () => { mounted = false; };
  }, [items, isAuth, isRegular]);
  
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
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === itemId ? { ...item, commentsCount: newCount } : item
      )
    );
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
            1920: 5,
            1536: 4,
            1280: 3,
            1024: 3,
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
            1920: 5,
            1536: 4,
            1280: 3,
            1024: 3,
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
          <div className="h-6 w-6 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
        </div>
      )}
      </div>
      {/* View modal */}
      <DesignViewModal
        open={Boolean(viewItem)}
        item={viewItem}
        onClose={() => setViewItem(null)}
        onCommentCountChange={(newCount) => {
          if (viewItem) {
            handleCommentCountChange(viewItem.id, newCount);
          }
        }}
      />
    </div>
  );
};

export default Market;

// Modal outside of main layout tree for z-index safety
// Render within page to keep simple routing for now
export const MarketPageWithView: React.FC = () => {
  return <Market />;
};





