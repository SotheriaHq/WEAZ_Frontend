import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCcw } from 'lucide-react';
import Masonry from 'react-masonry-css';
import marketApi from '@/api/MarketApi';
import type { MarketItem } from '@/types/market';
import MarketCard from '@/components/market/MarketCard';
import MarketSkeleton from '@/components/market/MarketSkeleton';
import Tag from '@/components/ui/Tag';
import { FrostedButton } from '@/components/ui/FrostedButton';
import MarketViewModal from '@/components/market/MarketViewModal';

const Market: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<MarketItem | null>(null);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const feed = await marketApi.getFeed();
      setItems(feed.items);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load market feed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const availableTags = useMemo(() => {
    const collected = new Set<string>();
    items.forEach((item) => item.tags.forEach((tag) => collected.add(tag)));
    return Array.from(collected).sort((a, b) => a.localeCompare(b)).slice(0, 12);
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!selectedTag) return items;
    return items.filter((item) =>
      item.tags.some((tag) => tag.toLowerCase() === selectedTag.toLowerCase()),
    );
  }, [items, selectedTag]);

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
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-8 px-4">
      {/* <section className="glass-panel relative overflow-hidden border border-white/40 bg-white/60 px-6 py-8 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-[#0f0f0f]/60 sm:px-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-purple-400/10 to-transparent opacity-60 blur-3xl" />
        <div className="relative space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-primary/90">Discover</p>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
            The Market
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            Scroll through curated drops from across the Threadly community. Tap any story card to jump into the full collection, explore brand profiles, and experience each piece up close.
          </p>
        </div>
      </section> */}

      {availableTags.length > 0 && (
        <section className="glass-panel flex flex-wrap items-center gap-3 border border-white/30 bg-white/50 px-4 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#0f0f0f]/50 sm:px-6">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary/80">Browse by tag</span>
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => {
              const isActive = selectedTag === tag;
              return (
                <button
                  type="button"
                  key={tag}
                  onClick={() => setSelectedTag((current) => (current === tag ? null : tag))}
                  className={`transition-transform duration-150 hover:-translate-y-[1px] ${isActive ? 'ring-2 ring-primary/60 ring-offset-2 ring-offset-white dark:ring-offset-slate-950' : ''}`}
                >
                  <Tag label={`#${tag}`} size="sm" className={isActive ? 'chip-purple font-semibold' : undefined} />
                </button>
              );
            })}
            {selectedTag && (
              <FrostedButton variant="ghost" size="sm" onClick={() => setSelectedTag(null)}>
                Clear filter
              </FrostedButton>
            )}
          </div>
        </section>
      )}

      {loading ? (
        <MarketSkeleton />
      ) : error ? (
        <section className="glass-panel border border-red-200/60 bg-red-50/70 px-6 py-10 text-center shadow-lg backdrop-blur-xl dark:border-red-500/30 dark:bg-[#1a0a0a]/80">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-300">We couldn&apos;t load the market feed.</h2>
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
            default: 4,
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
      ) : (
        <section className="glass-panel border border-white/40 bg-white/60 px-6 py-16 text-center backdrop-blur-xl dark:border-white/10 dark:bg-[#0f0f0f]/50">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Nothing matches that tag yet</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-300">
            Hit clear filter or check back later—new collections are dropping every week.
          </p>
          <FrostedButton variant="primary" size="sm" className="mt-4" onClick={() => setSelectedTag(null)}>
            Clear filter
          </FrostedButton>
        </section>
      )}
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
