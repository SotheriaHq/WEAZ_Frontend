import React, { useEffect, useState, useMemo } from 'react';
import { brandApi } from '@/api/BrandApi';
import { toast } from 'react-toastify';
import StackedCarousel, { type CarouselMediaItem } from '@/components/collections/StackedCarousel';
import CollectionMetadata from '@/components/collections/CollectionMetadata';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { ArrowLeft } from 'lucide-react';
import UnifiedCollectionComments from '@/components/collections/UnifiedCollectionComments';
import Dropdown from '@/components/Dropdown';
import UpdatePriceTagsModal from '@/components/collections/UpdatePriceTagsModal';
import { MessageCircle } from 'lucide-react';

interface MenuItem {
  label?: string;
  icon?: string;
  command?: () => void;
}

interface InlineCollectionViewerProps {
  collectionId: string;
  onBack: () => void;
  brandName?: string;
  onPriceUpdated?: () => void | Promise<void>;
}

export const InlineCollectionViewer: React.FC<InlineCollectionViewerProps> = ({
  collectionId,
  onBack,
  brandName = 'Brand',
  onPriceUpdated,
}) => {
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [, setActiveIndex] = useState(0); // track index changes for potential side-effects
  const [showUpdateMeta, setShowUpdateMeta] = useState(false);
  const me = useSelector((s: RootState) => s.user.profile);
  const [resolvedItems, setResolvedItems] = useState<CarouselMediaItem[]>([]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!collectionId) return;
      setLoading(true);
      setDetail(null);
      try {
        const d = await brandApi.getCollectionDetail(collectionId);
        if (!mounted) return;
        if (d) {
          setDetail(d);
          setIsLiked(false);
        }
      } catch (e) {
        if (mounted) {
          toast.error('Failed to load collection');
          onBack();
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [collectionId, onBack]);

  const isOwner = useMemo(
    () => Boolean(me?.id && detail?.owner?.id && me.id === detail.owner.id),
    [me?.id, detail?.owner?.id]
  );

  const mediaItems: CarouselMediaItem[] = useMemo(() => {
    const medias = (detail?.medias ?? []) as Array<any>;
    return medias.map((m: any, idx: number) => {
      const file = m?.file;
      const rawUrl = (file?.s3Url || file?.url || '') as string;
      const mime = (file?.mimeType || '') as string;
      const type: 'image' | 'video' = mime.startsWith('video') ? 'video' : 'image';
      return {
        id: m.id,
        url: rawUrl,
        type,
        fileId: file?.id,
        caption: m.caption ?? null,
        order: m.orderIndex ?? idx,
      };
    });
  }, [detail?.medias]);

  // Resolve signed URLs for media files to ensure content displays in modal/viewer
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const items = await Promise.all(
        mediaItems.map(async (item) => {
          if (item.fileId) {
            try {
              const url = await brandApi.getSignedFileUrl(item.fileId);
              return { ...item, url: url || item.url };
            } catch {
              return item;
            }
          }
          return item;
        })
      );
      if (mounted) setResolvedItems(items);
    };
    run();
    return () => {
      mounted = false;
    };
  }, [mediaItems]);

  const unifiedCommentsCount = useMemo(() => {
    const base = detail?.commentsCount ?? detail?._count?.comments ?? 0;
    const mediaSum = Array.isArray(detail?.medias)
      ? detail.medias.reduce((sum: number, m: any) => sum + (m?.commentsCount || 0), 0)
      : 0;
    return base + mediaSum;
  }, [detail]);

  // active media id no longer needed for unified comments

  const handleDeleteCollection = async () => {
    if (!collectionId) return;
    if (!confirm('Delete this entire collection? This cannot be undone.')) return;
    try {
      const ok = await brandApi.deleteCollection(collectionId);
      if (ok) {
        toast.success('Collection deleted');
        onBack();
      } else toast.error('Failed to delete');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleLike = async () => {
    setIsLiked(!isLiked);
    toast.info('Like feature coming soon');
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/collections/${collectionId}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: detail?.title || 'Collection',
          text: detail?.description || 'Check out this collection',
          url,
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard');
      } catch {
        toast.error('Failed to copy link');
      }
    }
  };

  const handleAddToCart = () => {
    toast.info('Add to cart feature coming soon');
  };

  // legacy stub (dropdown handles edit options)

  void brandName;

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-10 w-64 bg-gray-200 dark:bg-gray-800 rounded-lg" />
        <div className="h-8 w-80 bg-gray-200 dark:bg-gray-800 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[600px] bg-gray-200 dark:bg-gray-800 rounded-xl" />
          <div className="space-y-4">
            <div className="h-[300px] bg-gray-200 dark:bg-gray-800 rounded-xl" />
            <div className="h-[400px] bg-gray-200 dark:bg-gray-800 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Collection not found</p>
        <button onClick={onBack} className="mt-4 text-purple-600 hover:text-purple-700 font-medium">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Simple back arrow instead of breadcrumbs */}
      <div className="px-1">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/70 dark:bg-white/5 px-2.5 py-1 text-xs text-gray-700 dark:text-gray-300 hover:bg-white/90 dark:hover:bg-white/10"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to collections
        </button>
      </div>

      {/* Collection Title & Piece Count */}
      <div className="flex items-center gap-3 px-2">
        <h2
          className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight italic uppercase"
          style={{ fontFamily: 'Georgia, serif' }}
        >
          {detail?.title || 'Collection'}
        </h2>
        {typeof detail?._count?.medias === 'number' && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-semibold border border-purple-200 dark:border-purple-700/40">
            <span>{detail._count.medias}</span>
            <span>piece{detail._count.medias !== 1 ? 's' : ''}</span>
          </span>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Carousel (2/3 width on desktop) */}
        <div className="lg:col-span-2">
          <StackedCarousel
            items={resolvedItems.length ? resolvedItems : mediaItems}
            initialIndex={0}
            onIndexChange={(index) => setActiveIndex(index)}
            className="mb-2"
            isOwner={isOwner}
            coverMediaId={detail?.coverMediaId ?? null}
            onSetCover={async (item) => {
              if (!isOwner) return;
              try {
                const res = await brandApi.updateCollection(collectionId, { coverMediaId: item.id } as any);
                if (res) {
                  setDetail((d: any) => ({ ...d, coverMediaId: item.id }));
                  toast.success('Cover updated');
                }
              } catch {
                toast.error('Failed to set cover');
              }
            }}
          />
        </div>

        {/* Right: Metadata & Comments (1/3 width on desktop) */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* Metadata Section */}
          <div className="glass-panel rounded-2xl p-4 border border-white/20 bg-white/70 dark:bg-white/5 backdrop-blur-md">
            <CollectionMetadata
              title={detail?.title || 'Collection'}
              description={detail?.description}
              tags={detail?.tags || []}
              stats={{
                likes: detail?.totalLikes,
                comments: unifiedCommentsCount,
                items: detail?._count?.medias,
                views: detail?._count?.views,
              }}
              price={{ min: detail?.minPrice, max: detail?.maxPrice, saleMin: detail?.saleMinPrice ?? null, saleMax: detail?.saleMaxPrice ?? null, saleStartAt: detail?.saleStartAt ?? null, saleEndAt: detail?.saleEndAt ?? null }}
              availabilityInStore={detail?.isAvailableInStore}
              visibility={detail?.visibility}
              isOwner={isOwner}
              isLiked={isLiked}
              onLike={handleLike}
              onShare={handleShare}
              onAddToCart={handleAddToCart}
              onDelete={handleDeleteCollection}
              ownerMenu={isOwner ? (
                <Dropdown
                  buttonLabel={<span className="text-base leading-none">✏️</span>}
                  variant="ghost"
                  className="!p-1 !rounded-md"
                  hideCaret
                  buttonClassName="!p-1 !rounded-md focus:ring-0 focus:ring-offset-0 outline-none focus:outline-none"
                  options={[
                    { label: 'Update Price & Tags', onClick: () => setShowUpdateMeta(true) },
                    { label: 'Edit Collection Details', onClick: () => { window.location.href = `/collections/${collectionId}/edit`; } },
                  ]}
                />
              ) : undefined}
            />
          </div>

          {/* Comments Section - Unified & Frosted Glassmorphism */}
          <div className="glass-panel rounded-2xl p-3 border border-white/20 bg-white/60 dark:bg-white/5 backdrop-blur-xl lg:h-[420px] overflow-hidden flex flex-col shadow-lg">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-200/50 dark:border-gray-700/50">
              <MessageCircle className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">All Comments</h3>
            </div>
            <div className="flex-1 mt-2">
              <UnifiedCollectionComments collectionId={collectionId} />
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {isOwner && (
        <UpdatePriceTagsModal
          open={showUpdateMeta}
          onClose={() => setShowUpdateMeta(false)}
          collectionId={collectionId}
          currentMin={detail?.minPrice}
          currentMax={detail?.maxPrice}
          currentTags={detail?.tags ?? []}
          onUpdated={async (p) => {
            setDetail((prev: any) => ({ ...(prev ?? {}), minPrice: p.minPrice ?? prev?.minPrice, maxPrice: p.maxPrice ?? prev?.maxPrice, tags: p.tags ?? prev?.tags, saleMinPrice: p.saleMinPrice ?? prev?.saleMinPrice, saleMaxPrice: p.saleMaxPrice ?? prev?.saleMaxPrice }));
            // Notify parent to refresh collections list so cards show updated prices
            if (onPriceUpdated) {
              await onPriceUpdated();
            }
          }}
        />
      )}
    </div>
  );
};

export default InlineCollectionViewer;
