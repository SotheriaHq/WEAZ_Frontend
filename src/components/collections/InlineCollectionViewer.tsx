import React, { useEffect, useState, useMemo } from 'react';
import { brandApi } from '@/api/BrandApi';
import AccessApi, { type AccessState } from '@/api/AccessApi';
import { toast } from 'react-toastify';
import { useNavigate, useSearchParams } from 'react-router-dom';
import StackedCarousel, { type CarouselMediaItem } from '@/components/collections/StackedCarousel';
import CollectionMetadata from '@/components/collections/CollectionMetadata';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { ArrowLeft, Lock, Eye } from 'lucide-react';
import UnifiedCollectionComments from '@/components/collections/UnifiedCollectionComments';
import Dropdown from '@/components/Dropdown';
import UpdatePriceTagsModal from '@/components/collections/UpdatePriceTagsModal';
import DiscountSaleModal from '@/components/collections/DiscountSaleModal';
import { MessageCircle } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { FrostedButton } from '@/components/ui/FrostedButton';

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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightCommentId = searchParams.get('commentId');
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [requestState, setRequestState] = useState<AccessState | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [, setActiveIndex] = useState(0); // track index changes for potential side-effects
  const [showUpdateMeta, setShowUpdateMeta] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const me = useSelector((s: RootState) => s.user.profile);
  const [resolvedItems, setResolvedItems] = useState<CarouselMediaItem[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [requestingAccess, setRequestingAccess] = useState(false);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!collectionId) return;
      setLoading(true);
      setLocked(false);
      setDetail(null);
      setRequestState(null);
      
      console.log('[InlineCollectionViewer] Loading collection:', collectionId, 'User ID:', me?.id);
      
      try {
        const d = await brandApi.getCollectionDetail(collectionId);
        if (!mounted) return;
        if (d) {
          console.log('[InlineCollectionViewer] Collection loaded:', d.id, 'Owner:', d.owner?.id, 'Visibility:', d.visibility);
          setDetail(d);
          setIsLiked(false);
          setLocked(false);
        } else {
          // API returned null - likely permission issue
          // But check if user is owner before showing locked state
          if (me?.id) {
            // User is logged in - null response might mean permission issue or deleted collection
            setLocked(true);
          } else {
            // Not logged in - definitely a permission issue
            setLocked(true);
          }
        }
      } catch (e: any) {
        if (mounted) {
          // Check if it's a 404 or permission error
          const status = e?.response?.status;
          const errorData = e?.response?.data;
          
          console.error('[InlineCollectionViewer] Error loading collection:', {
            status,
            collectionId,
            userId: me?.id,
            errorData,
            error: e.message
          });
          
          if (status === 404 || status === 403) {
            // Check if the error response indicates ownership
            // If user is logged in, try to determine if they own this collection
            
            // If we have owner info in the error and user matches, this is a backend issue
            if (me?.id && errorData?.ownerId && errorData.ownerId === me.id) {
              // User owns this collection but got 404/403 - shouldn't happen
              console.error('[InlineCollectionViewer] Owner being blocked - backend issue');
              toast.error('Unable to load your collection. Please try again.');
              onBack();
            } else {
              // Collection is private and user doesn't have access (or doesn't exist)
              console.log('[InlineCollectionViewer] Setting locked state - permission denied');
              setLocked(true);
            }
          } else {
            // Other error - show toast and go back
            toast.error('Failed to load collection');
            onBack();
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [collectionId, onBack, me?.id]);

  const isOwner = useMemo(
    () => Boolean(me?.id && detail?.owner?.id && me.id === detail.owner.id),
    [me?.id, detail?.owner?.id]
  );

  const hasActiveSale = useMemo(() => {
    return (detail?.saleMinPrice != null || detail?.saleMaxPrice != null);
  }, [detail]);

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
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    try {
      const ok = await brandApi.deleteCollection(collectionId);
      if (ok) {
        toast.success('Collection deleted');
        onBack();
      } else toast.error('Failed to delete');
    } catch {
      toast.error('Failed to delete');
    } finally {
      setConfirmOpen(false);
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

  const handleCancelSale = async () => {
    try {
      const res = await brandApi.updateCollection(collectionId, {
        saleMinPrice: null as any,
        saleMaxPrice: null as any,
        saleStartAt: null as any,
        saleEndAt: null as any,
      });
      if (res) {
        setDetail((d: any) => ({ ...(d ?? {}), saleMinPrice: null, saleMaxPrice: null, saleStartAt: null, saleEndAt: null }));
        toast.success('Sale cancelled');
        if (onPriceUpdated) await onPriceUpdated();
      } else {
        toast.error('Could not cancel sale');
      }
    } catch {
      toast.error('Failed to cancel sale');
    }
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

  // Show elegant permission denied UI when locked (and user is not the owner)
  if (locked) {
    // Double-check: if we somehow have detail with owner info and user matches, don't show locked
    if (detail?.owner?.id && me?.id && detail.owner.id === me.id) {
      // User is owner - this shouldn't be locked, skip to normal view
      // This is a fallback safety check
    } else {
      return (
        <div className="space-y-4">
          {/* Back button */}
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

          {/* Permission Denied Card */}
        <div className="max-w-2xl mx-auto">
          <div className="glass-panel rounded-2xl p-8 border border-purple-200/50 dark:border-purple-500/20 bg-gradient-to-br from-white/80 via-purple-50/30 to-white/80 dark:from-purple-900/10 dark:via-purple-800/5 dark:to-gray-900/20 backdrop-blur-xl shadow-xl">
            <div className="flex flex-col items-center text-center space-y-4">
              {/* Icon */}
              <div className="relative">
                <div className="absolute inset-0 bg-purple-400/20 dark:bg-purple-500/10 blur-2xl rounded-full" />
                <div className="relative bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/40 dark:to-purple-800/30 p-5 rounded-2xl border border-purple-300/50 dark:border-purple-500/30 shadow-lg">
                  <Lock className="w-10 h-10 text-purple-600 dark:text-purple-400" />
                </div>
              </div>

              {/* Title & Message */}
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Private Collection
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-300 max-w-md">
                  You do not have permission to view private collections of this brand. Request access to view exclusive drops and content.
                </p>
              </div>

              {/* Brand Info */}
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 dark:bg-white/5 border border-gray-200 dark:border-gray-700">
                <Eye className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{brandName}</span>
              </div>

              {/* Access Request State & Actions */}
              <div className="pt-4 w-full">
                {requestState === 'PENDING' ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30">
                      <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Access request pending</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      The brand owner will review your request. You'll be notified once approved.
                    </p>
                  </div>
                ) : requestState === 'APPROVED' ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/30">
                      <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">✓ Access approved! Reloading...</span>
                    </div>
                  </div>
                ) : requestState === 'REVOKED' ? (
                  <div className="space-y-3">
                    <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/30">
                      <p className="text-sm font-medium text-red-700 dark:text-red-300">Access request was declined</p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        You must wait 72 hours before requesting access again.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <FrostedButton
                      variant="primary"
                      onClick={async () => {
                        if (!me) {
                          const returnTo = `${window.location.pathname}${window.location.search}`;
                          navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
                          return;
                        }
                        setRequestingAccess(true);
                        try {
                          const res = await AccessApi.requestAccess(collectionId);
                          setRequestState(res.state);
                          if (res.state === 'APPROVED') {
                            toast.success('Access approved! Reloading collection...');
                            // Reload the collection
                            const d = await brandApi.getCollectionDetail(collectionId);
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
                      className="w-full sm:w-auto"
                    >
                      {requestingAccess ? 'Requesting...' : 'Request Access'}
                    </FrostedButton>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Once requested, you'll get access to all private content from {brandName}.
                    </p>
                  </div>
                )}
              </div>

              {/* Go Back Link */}
              <button
                onClick={onBack}
                className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium transition-colors"
              >
                ← Back to collections
              </button>
            </div>
          </div>
        </div>
      </div>
      );
    }
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

      {/* Collection Title & Piece Count - Fancy Typography */}
      <div className="flex items-center gap-3 px-2">
        <h2
          className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 tracking-tight italic uppercase drop-shadow-sm"
          style={{ fontFamily: 'Georgia, "Playfair Display", serif', fontWeight: 700, letterSpacing: '0.02em' }}
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
        <div className="lg:col-span-2 relative">
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
            tags={detail?.tags || []}
            price={{ 
              min: detail?.minPrice, 
              max: detail?.maxPrice, 
              saleMin: detail?.saleMinPrice ?? null, 
              saleMax: detail?.saleMaxPrice ?? null,
              saleStartAt: detail?.saleStartAt ?? null,
              saleEndAt: detail?.saleEndAt ?? null
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
              onCancelSale={isOwner ? handleCancelSale : undefined}
              onSetupSale={isOwner ? () => setShowDiscountModal(true) : undefined}
              ownerMenu={isOwner ? (
                <Dropdown
                  buttonLabel={<span className="text-base leading-none">✏️</span>}
                  variant="ghost"
                  className="!p-1 !rounded-md"
                  hideCaret
                  buttonClassName="!p-1 !rounded-md focus:ring-0 focus:ring-offset-0 outline-none focus:outline-none"
                  options={[
                    { label: 'Update Price & Tags', onClick: () => setShowUpdateMeta(true) },
                    ...(hasActiveSale 
                      ? [{ label: 'Cancel Discount Sale', onClick: handleCancelSale }]
                      : [{ label: 'Discount Sale', onClick: () => setShowDiscountModal(true) }]
                    ),
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
              <UnifiedCollectionComments 
                collectionId={collectionId} 
                highlightCommentId={highlightCommentId || undefined}
              />
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
      {isOwner && (
        <DiscountSaleModal
          open={showDiscountModal}
          onClose={() => setShowDiscountModal(false)}
          collectionId={collectionId}
          currentMin={detail?.minPrice}
          currentMax={detail?.maxPrice}
          onUpdated={async (p) => {
            setDetail((prev: any) => ({
              ...(prev ?? {}),
              saleMinPrice: p.saleMinPrice,
              saleMaxPrice: p.saleMaxPrice,
              saleStartAt: p.saleStartAt,
              saleEndAt: p.saleEndAt,
            }));
            if (onPriceUpdated) await onPriceUpdated();
          }}
        />
      )}
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

export default InlineCollectionViewer;
