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
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Lock, Eye, ArrowLeft } from 'lucide-react';

const CollectionView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [requestState, setRequestState] = useState<AccessState | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [requestingAccess, setRequestingAccess] = useState(false);
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

  const unifiedCounts = useMemo(() => {
    const medias = Array.isArray(detail?.medias) ? detail?.medias as Array<any> : [];
    const mediaComments = medias.reduce((sum, m) => sum + (m?.commentsCount || 0), 0);
    const mediaLikes = medias.reduce((sum, m) => sum + (m?.likesCount || 0), 0);
    const baseComments = (detail as any)?.commentsCount ?? detail?._count?.comments ?? 0;
    const baseLikes = (detail as any)?.totalLikes ?? (detail as any)?.likesCount ?? 0;
    return {
      comments: baseComments + mediaComments,
      likes: baseLikes + mediaLikes,
    };
  }, [detail]);

  const handleDeleteCollection = async () => {
    if (!id) return;
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!id) return;
    try {
      const ok = await brandApi.deleteCollection(id);
      if (ok) {
        toast.success('Collection deleted');
        navigate('/profile');
      } else toast.error('Failed to delete');
    } catch {
      toast.error('Failed to delete');
    } finally {
      setConfirmOpen(false);
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

  const handleCancelSale = async () => {
    if (!id) return;
    try {
      const res = await brandApi.updateCollection(id, {
        saleMinPrice: null as any,
        saleMaxPrice: null as any,
        saleStartAt: null as any,
        saleEndAt: null as any,
      });
      if (res) {
        setDetail((d: any) => ({ ...(d ?? {}), saleMinPrice: null, saleMaxPrice: null, saleStartAt: null, saleEndAt: null }));
        toast.success('Sale cancelled; reverted to main price');
      } else {
        toast.error('Could not cancel sale');
      }
    } catch (e) {
      toast.error('Failed to cancel sale');
    }
  };

  const handleCommentAdded = () => {
    setDetail((prev: any) => {
      if (!prev) return prev;
      const current = prev.commentsCount ?? prev._count?.comments ?? 0;
      return {
        ...prev,
        commentsCount: current + 1,
        _count: {
          ...prev._count,
          comments: (prev._count?.comments ?? 0) + 1
        }
      };
    });
  };

  const handleSetCover = async (item: CarouselMediaItem) => {
    if (!id) return;
    try {
      const res = await brandApi.updateCollection(id, {
        coverMediaId: item.id,
      } as any);
      if (res) {
        setDetail((d: any) => ({ ...d, coverMediaId: item.id }));
        toast.success('Cover updated');
      } else {
        toast.error('Failed to update cover');
      }
    } catch (e) {
      toast.error('Failed to update cover');
    }
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
      <div className="min-h-screen w-full bg-gradient-to-br from-gray-50 via-purple-50/30 to-gray-50 dark:from-gray-900 dark:via-purple-900/10 dark:to-gray-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
          {/* Back Navigation */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 transition-colors shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </div>

          {/* Permission Denied Card */}
          <div className="glass-panel rounded-2xl p-8 sm:p-12 border border-purple-200/50 dark:border-purple-500/20 bg-gradient-to-br from-white/90 via-purple-50/50 to-white/90 dark:from-purple-900/20 dark:via-purple-800/10 dark:to-gray-900/40 backdrop-blur-xl shadow-2xl">
            <div className="flex flex-col items-center text-center space-y-6">
              {/* Icon with Glow Effect */}
              <div className="relative">
                <div className="absolute inset-0 bg-purple-400/30 dark:bg-purple-500/20 blur-3xl rounded-full animate-pulse" />
                <div className="relative bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/60 dark:to-purple-800/40 p-6 rounded-3xl border-2 border-purple-300/60 dark:border-purple-500/40 shadow-xl">
                  <Lock className="w-12 h-12 text-purple-600 dark:text-purple-400" />
                </div>
              </div>

              {/* Title & Message */}
              <div className="space-y-3 max-w-lg">
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
                  Private Collection
                </h1>
                <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed">
                  You do not have permission to view this private collection. Request access from the brand owner to view exclusive drops and content.
                </p>
              </div>

              {/* Brand Info Badge */}
              {detail?.owner && (
                <div className="flex items-center gap-3 px-5 py-3 rounded-full bg-white/80 dark:bg-white/10 border border-gray-200 dark:border-gray-700 shadow-md">
                  <Eye className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  <span className="text-base font-semibold text-gray-800 dark:text-gray-200">
                    {detail.owner.brandFullName || detail.owner.username || 'Brand'}
                  </span>
                </div>
              )}

              {/* Access Request State & Actions */}
              <div className="pt-6 w-full max-w-md space-y-4">
                {requestState === 'PENDING' ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-3 px-5 py-4 rounded-xl bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-200 dark:border-amber-700/40 shadow-md">
                      <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
                      <span className="text-base font-semibold text-amber-700 dark:text-amber-300">Access request pending</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      The brand owner will review your request. You'll be notified once it's approved.
                    </p>
                  </div>
                ) : requestState === 'APPROVED' ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-3 px-5 py-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border-2 border-emerald-200 dark:border-emerald-700/40 shadow-md">
                      <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-base font-semibold text-emerald-700 dark:text-emerald-300">Access approved! Reloading...</span>
                    </div>
                  </div>
                ) : requestState === 'REVOKED' ? (
                  <div className="space-y-3">
                    <div className="px-5 py-4 rounded-xl bg-red-50 dark:bg-red-900/30 border-2 border-red-200 dark:border-red-700/40 shadow-md">
                      <p className="text-base font-semibold text-red-700 dark:text-red-300">Access request declined</p>
                      <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                        You must wait 72 hours before requesting access again.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <FrostedButton
                      variant="primary"
                      onClick={async () => {
                        if (!id) {
                          toast.error('No collection id');
                          return;
                        }
                        if (!me) {
                          const returnTo = `${window.location.pathname}${window.location.search}`;
                          navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
                          return;
                        }
                        setRequestingAccess(true);
                        try {
                          const res = await AccessApi.requestAccess(id);
                          setRequestState(res.state);
                          if (res.state === 'APPROVED') {
                            toast.success('Access approved! Reloading collection...');
                            const d = await brandApi.getCollectionDetail(id);
                            if (d) {
                              setDetail(d);
                              setLocked(false);
                            }
                          } else if (res.state === 'PENDING') {
                            toast.info('Access request sent to brand owner');
                          }
                        } catch (e: any) {
                          const cooldownMsg = e?.response?.data?.message;
                          if (cooldownMsg && cooldownMsg.includes('wait')) {
                            toast.error(cooldownMsg);
                            setRequestState('REVOKED');
                          } else {
                            toast.error('Unable to request access');
                          }
                        } finally {
                          setRequestingAccess(false);
                        }
                      }}
                      disabled={requestingAccess}
                      className="w-full text-base py-3 shadow-lg"
                    >
                      {requestingAccess ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Requesting...
                        </span>
                      ) : (
                        'Request Access'
                      )}
                    </FrostedButton>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                      {detail?.owner ? (
                        <>Once approved, you'll get access to all private collections from {detail.owner.brandFullName || detail.owner.username || 'this brand'}.</>
                      ) : (
                        <>Once approved, you'll get access to all private collections from this brand.</>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
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
              isOwner={isOwner}
              coverMediaId={detail?.coverMediaId}
              onSetCover={handleSetCover}
            />
          </div>

          {/* Right: Metadata & Comments (1/3 width on desktop) */}
          <div className="lg:col-span-1 flex flex-col gap-4 min-h-0">
            {/* Metadata Section */}
            <div className="glass-panel rounded-2xl p-4 border border-white/20 bg-white/90 dark:bg-black/70 backdrop-blur-sm">
              <CollectionMetadata
                title={detail?.title || 'Collection'}
                description={detail?.description}
                tags={detail?.tags || []}
                stats={{
                  likes: unifiedCounts.likes,
                  comments: unifiedCounts.comments,
                  items: detail?._count?.medias,
                  views: detail?._count?.views,
                }}
                price={{
                  min: detail?.minPrice,
                  max: detail?.maxPrice,
                  saleMin: detail?.saleMinPrice,
                  saleMax: detail?.saleMaxPrice,
                  saleStartAt: detail?.saleStartAt,
                  saleEndAt: detail?.saleEndAt,
                }}
                availabilityInStore={detail?.isAvailableInStore}
                visibility={detail?.visibility}
                isOwner={isOwner}
                isLiked={isLiked}
                onLike={handleLike}
                onShare={handleShare}
                onAddToCart={handleAddToCart}
                onDelete={handleDeleteCollection}
                onCancelSale={isOwner ? handleCancelSale : undefined}
              />
            </div>

            {/* Comments Section - Fixed height, scrollable */}
            <div className="glass-panel rounded-2xl p-4 border border-white/20 bg-white/95 dark:bg-black/80 backdrop-blur-sm h-[60vh] lg:h-[420px] overflow-hidden flex flex-col min-h-0">
              {id ? (
                <CompactCommentsSection collectionId={id} onCommentAdded={handleCommentAdded} />
              ) : (
                <div className="text-sm text-gray-500">Collection not found.</div>
              )}
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="Delete collection?"
        message="Delete this entire collection? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};

export default CollectionView;
