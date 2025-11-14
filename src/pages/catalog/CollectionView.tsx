import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { brandApi } from '@/api/BrandApi';
import AccessApi, { type AccessState } from '@/api/AccessApi';
import { FrostedButton } from '@/components/ui/FrostedButton';
import { toast } from 'react-toastify';
import StackedCarousel, { type CarouselMediaItem } from '@/components/collections/StackedCarousel';
import BrandHeader from '@/components/collections/BrandHeader';
import CollectionMetadata from '@/components/collections/CollectionMetadata';
import CompactCommentsSection from '@/components/collections/CompactCommentsSection';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';

const CollectionView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [requestState, setRequestState] = useState<AccessState | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const me = useSelector((s: RootState) => s.user.profile);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!id) return;
      setLoading(true);
      setLocked(false);
      setDetail(null);
      try {
        const d = await brandApi.getCollectionDetail(id);
        if (!mounted) return;
        if (d) {
          setDetail(d);
          // TODO: Check if user has liked this collection
          setIsLiked(false);
        } else {
          setLocked(true);
        }
      } catch (e) {
        if (mounted) setLocked(true);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [id]);

  // allow hooks to run consistently; handle missing id in render path

  const isOwner = useMemo(() => Boolean(me?.id && detail?.owner?.id && me.id === detail.owner.id), [me?.id, detail?.owner?.id]);

  // Shape media items for carousel
  const mediaItems: CarouselMediaItem[] = useMemo(() => {
    const medias = (detail?.medias ?? []) as Array<any>;
    return medias.map((m: any, idx: number) => {
      const file = m?.file;
      const rawUrl = (file?.s3Url || file?.url || '') as string;
      const mime = (file?.mimeType || '') as string;
      const type: 'image' | 'video' = mime.startsWith('video') ? 'video' : 'image';
      return { id: m.id, url: rawUrl, type, fileId: file?.id, caption: m.caption ?? null, order: m.orderIndex ?? idx };
    });
  }, [detail?.medias]);

  // local media index not required here as comments are unified

  const handleDeleteCollection = async () => {
    if (!id) return;
    if (!confirm('Delete this entire collection? This cannot be undone.')) return;
    try {
      const ok = await brandApi.deleteCollection(id);
      if (ok) {
        toast.success('Collection deleted');
        navigate('/profile');
      } else toast.error('Failed to delete');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleLike = async () => {
    // TODO: Implement like functionality when API is available
    setIsLiked(!isLiked);
    toast.info('Like feature coming soon');
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: detail?.title || 'Collection',
          text: detail?.description || 'Check out this collection',
          url,
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
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

  if (loading) {
    return (
      <div className="min-h-screen w-full">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded-xl" />
            <div className="h-8 w-64 bg-gray-200 dark:bg-gray-800 rounded-lg" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 h-[600px] bg-gray-200 dark:bg-gray-800 rounded-xl" />
              <div className="space-y-4">
                <div className="h-[300px] bg-gray-200 dark:bg-gray-800 rounded-xl" />
                <div className="h-[300px] bg-gray-200 dark:bg-gray-800 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <div className="glass-panel border border-white/20 bg-white/10 px-6 py-8 backdrop-blur-xl text-white rounded-2xl">
          <h1 className="text-xl font-bold mb-2">This collection is private</h1>
          <p className="text-sm text-white/80 mb-4">Request access from the owner to view and interact.</p>
          {requestState === 'PENDING' ? (
            <div className="text-sm text-white/80">Access request pending approval.</div>
          ) : requestState === 'APPROVED' ? (
            <div className="text-sm text-emerald-300">Access approved. Reloading…</div>
          ) : (
            <FrostedButton
              variant="primary"
              onClick={async () => {
                if (!id) {
                  toast.error('No collection id');
                  return;
                }
                try {
                  const res = await AccessApi.requestAccess(id);
                  setRequestState(res.state);
                  if (res.state === 'APPROVED') {
                    toast.success('Access approved');
                    const d = await brandApi.getCollectionDetail(id);
                    setDetail(d);
                    setLocked(!d);
                  } else {
                    toast.info('Request sent');
                  }
                } catch (e) {
                  toast.error('Unable to request access');
                }
              }}
            >
              Request Access
            </FrostedButton>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6">
        {/* Brand Header */}
        <BrandHeader
          brandName={detail?.owner?.brandFullName || detail?.owner?.username || 'Brand'}
          brandUsername={detail?.owner?.username}
          brandAvatar={detail?.owner?.profileImage}
          brandBio={detail?.owner?.brandDescription || detail?.owner?.bio}
          totalCollections={detail?.owner?._count?.collections}
          totalFollowers={detail?.owner?._count?.followers}
          onBack={() => navigate(-1)}
        />

        {/* Collection Title & Piece Count */}
        <div className="flex items-center gap-3 mb-4 px-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight italic uppercase" style={{ fontFamily: 'Georgia, serif' }}>
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
              items={mediaItems}
              initialIndex={0}
              className="mb-4"
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
                  comments: detail?._count?.comments,
                  items: detail?._count?.medias,
                  views: detail?._count?.views,
                }}
                price={{ min: detail?.minPrice, max: detail?.maxPrice }}
                availabilityInStore={detail?.isAvailableInStore}
                visibility={detail?.visibility}
                isOwner={isOwner}
                isLiked={isLiked}
                onLike={handleLike}
                onShare={handleShare}
                onAddToCart={handleAddToCart}
                onDelete={handleDeleteCollection}
              />
            </div>

            {/* Comments Section - Fixed height, scrollable */}
            <div className="glass-panel rounded-2xl p-4 border border-white/20 bg-white/70 dark:bg-white/5 backdrop-blur-md lg:h-[400px] overflow-hidden flex flex-col">
              {id ? (
                <CompactCommentsSection collectionId={id} />
              ) : (
                <div className="text-sm text-gray-500">Collection not found.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollectionView;
