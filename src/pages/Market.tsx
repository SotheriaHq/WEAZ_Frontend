import React, { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { RefreshCcw } from 'lucide-react';
import Masonry from 'react-masonry-css';
import marketApi from '@/api/MarketApi';
import type { MarketItem } from '@/types/market';
import MarketCard from '@/components/market/MarketCard';
import MarketSkeleton from '@/components/market/MarketSkeleton';
// Category chips live directly on page; tag chips removed for now
import { FrostedButton } from '@/components/ui/FrostedButton';
import MarketViewModal from '@/components/market/MarketViewModal';
import { setEngagementState } from '@/features/engagementSlice';

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
      
      // Initialize Redux engagement state for all items (CRITICAL for like persistence & real-time comment sync)
      feed.items.forEach((item) => {
        dispatch(setEngagementState({
          contentType: 'COLLECTION_MEDIA',
          contentId: item.id,
          likedByMe: item.isLiked ?? false,
          likeCount: item.likesCount ?? 0,
          commentCount: item.commentsCount ?? 0,
          patchCount: item.patchesCount ?? 0,
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

  // Heuristic category matching (until backend category is wired into feed)
  const filteredItems = useMemo(() => {
    let result = items;
    if (selectedCategory && selectedCategory !== 'ALL') {
      const keysByCat: Record<string, string[]> = {
        AFRICAN_FASHION: ['african', 'ankara', 'kente', 'aso oke', 'adire', 'dashiki', 'gele', 'africa'],
        WESTERN_FASHION: ['western', 'streetwear', 'workwear', 'couture', 'runway', 'denim', 'suit', 'casual', 'formal'],
        DE_HOUSE: ['house', 'home', 'lounge', 'cozy', 'basics', 'stay home', 'loungewear', 'sleep', 'pajama'],
      };
      const keys = keysByCat[selectedCategory] ?? [];
      result = result.filter((item) =>
        item.tags.some((t) => keys.some((k) => t.toLowerCase().includes(k))),
      );
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

  const handleViewBrand = (brandId: string) => {
    if (!brandId) return;
    navigate(`/brands/${brandId}`);
  };

  const handleCommentCountChange = (itemId: string, newCount: number) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === itemId ? { ...item, commentsCount: newCount } : item
      )
    );
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
        <MarketSkeleton />
      ) : error ? (
        <section className="glass-panel border border-red-200/60 bg-red-50/70 px-6 py-10 text-center shadow-lg backdrop-blur-xl dark:border-red-500/30 dark:bg-[#1a0a0a]/80">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-300">We couldn&apos;t find any design for market.</h2>
          <p className="mt-2 text-sm text-red-500 dark:text-red-200/80">{error}</p>
          <FrostedButton
            variant="primary"
            size="sm"
            className="mt-4 inline-flex items-center gap-2"
            onClick={() => void loadFeed()}
          >
            <RefreshCcw className="h-4 w-4" />
            Try again
          </FrostedButton>
        </section>
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
              <MarketCard
                item={item}
                onOpenView={(it) => setViewItem(it)}
                onViewCollection={handleViewCollection}
                onViewBrand={handleViewBrand}
              />
            </div>
          ))}
        </Masonry>
      ) : selectedCategory === 'ALL' ? (
        // Default empty state when no items at all (not category-specific)
        <section className="glass-panel border border-red-200/60 bg-red-50/70 px-6 py-10 text-center shadow-lg backdrop-blur-xl dark:border-red-500/30 dark:bg-[#1a0a0a]/80">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-300">We couldn&apos;t find any design for market.</h2>
          <p className="mt-2 text-sm text-red-500 dark:text-red-200/80">{error}</p>
          <FrostedButton
            variant="primary"
            size="sm"
            className="mt-4 inline-flex items-center gap-2"
            onClick={() => void loadFeed()}
          >
            <RefreshCcw className="h-4 w-4" />
            Try again
          </FrostedButton>
        </section>
      ) : (
        // Category-specific empty state (show Clear filter only when not ALL)
        <section className="glass-panel border border-white/40 bg-white/60 px-6 py-16 text-center backdrop-blur-xl dark:border-white/10 dark:bg-[#0f0f0f]/50">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Nothing in this category yet</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-300">Change or clear the category filter, or check back later.</p>
          <FrostedButton
            variant="primary"
            size="sm"
            className="mt-4"
            onClick={() => {
              setSelectedCategory('ALL');
              setSelectedTag(null);
            }}
          >
            Clear filter
          </FrostedButton>
        </section>
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
      <MarketViewModal
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





