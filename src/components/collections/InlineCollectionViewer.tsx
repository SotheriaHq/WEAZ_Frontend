import React, { useEffect, useState, useMemo, useRef } from 'react';
import { brandApi } from '@/api/BrandApi';
import AccessApi, { type AccessState } from '@/api/AccessApi';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';
import StackedCarousel, { type CarouselMediaItem } from '@/components/collections/StackedCarousel';
import CollectionMetadata from '@/components/collections/CollectionMetadata';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/store';
import { ArrowLeft, Lock, Eye } from 'lucide-react';
import UnifiedCollectionComments from '@/components/collections/UnifiedCollectionComments';
import Dropdown from '@/components/Dropdown';
import UpdatePriceTagsModal from '@/components/collections/UpdatePriceTagsModal';
import DiscountSaleModal from '@/components/collections/DiscountSaleModal';
import { MessageCircle } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { FrostedButton } from '@/components/ui/FrostedButton';
import { addToCart, openCartDrawer } from '@/features/cartSlice';
import { CollectionCartPreviewModal } from '@/components/collections/CollectionCartPreviewModal';
import { getCollectionCartPreview, type CollectionCartPreviewResponse } from '@/api/collectionUploads';
import { buildCollectionUrl, shareOrCopyLink } from '@/utils/publicLinks';
import { customOrderConfigurationsApi } from '@/api/CustomOrderApi';
import LazyCustomOrderComposerPage from '@/components/custom-orders/LazyCustomOrderComposerPage';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useBagging } from '@/hooks/useBagging';
import MediaRenderer from '@/components/media/MediaRenderer';

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
  const [notFound, setNotFound] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const detailRef = useRef<any | null>(null);
  const onBackRef = useRef(onBack);
  const [requestState, setRequestState] = useState<AccessState | null>(null);
  const [isThreaded, setIsThreaded] = useState(false);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [, setActiveIndex] = useState(0); // track index changes for potential side-effects
  const [showUpdateMeta, setShowUpdateMeta] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const me = useSelector((s: RootState) => s.user.profile);
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const dispatch = useDispatch<AppDispatch>();
  const { bagProduct } = useBagging();
  const [resolvedItems, setResolvedItems] = useState<CarouselMediaItem[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [addingAll, setAddingAll] = useState(false);
  const [showCartPreview, setShowCartPreview] = useState(false);
  const [cartPreviewData, setCartPreviewData] = useState<CollectionCartPreviewResponse | null>(null);
  const [customComposerOpen, setCustomComposerOpen] = useState(false);
  const [customConfigurationId, setCustomConfigurationId] = useState<string | null>(null);
  const [openingCustomComposer, setOpeningCustomComposer] = useState(false);
  /* showQr disabled — only brand profile QR codes active */

  useEffect(() => {
    detailRef.current = detail;
  }, [detail]);

  useEffect(() => {
    onBackRef.current = onBack;
  }, [onBack]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!collectionId) return;
      const hasCurrentDetail = detailRef.current?.id === collectionId;
      if (!hasCurrentDetail) {
        setLoading(true);
        setDetail(null);
      }
      setLocked(false);
      setNotFound(false);
      setRequestState(null);
      
      try {
        const d = await brandApi.getCollectionDetail(collectionId);
        if (!mounted) return;
        if (d) {
          setDetail(d);
          setIsThreaded(false);
          setLocked(false);
          setNotFound(false);
        } else {
          setNotFound(true);
        }
      } catch (e: any) {
        if (mounted) {
          // Check if it's a 404 or permission error
          const status = e?.response?.status;
          
          if (status === 404 || status === 410) {
            setLocked(false);
            setNotFound(true);
            toast.error('Design not found.');
            onBackRef.current();
          } else if (status === 403 || status === 401) {
            setLocked(true);
            setNotFound(false);
          } else {
            // Other error - show toast and go back
            toast.error('Failed to load design');
            onBackRef.current();
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
  }, [collectionId, me?.id]);

  const isOwner = useMemo(
    () => Boolean(me?.id && detail?.owner?.id && me.id === detail.owner.id),
    [me?.id, detail?.owner?.id]
  );

  const hasActiveSale = useMemo(() => {
    return (detail?.saleMinPrice != null || detail?.saleMaxPrice != null);
  }, [detail]);
  /* canOpenQr disabled — only brand profile QR codes active */

  const mediaItems: CarouselMediaItem[] = useMemo(() => {
    const medias = (detail?.medias ?? []) as Array<any>;
    return medias
      .map((m: any, idx: number) => {
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
    })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [detail?.medias]);

  const productItems = useMemo(() => {
    const links = Array.isArray(detail?.products) ? detail.products : [];
    return links
      .map((link: any) => {
        const p = link?.product ?? link ?? {};
        return {
          id: p.id ?? link?.productId,
          name: p.name ?? p.title ?? 'Product',
          price: Number(p.price ?? 0),
          salePrice: p.salePrice != null ? Number(p.salePrice) : null,
          saleStartAt: p.saleStartAt ?? null,
          saleEndAt: p.saleEndAt ?? null,
          images: Array.isArray(p.images) ? p.images : [],
          thumbnail: p.thumbnail ?? null,
          sizes: Array.isArray(p.sizes) ? p.sizes : [],
          colors: Array.isArray(p.colors) ? p.colors : [],
          hasVariants: Array.isArray(p.variants)
            ? p.variants.length > 0
            : Boolean((p as any)?._count?.variants),
          totalStock: typeof p.totalStock === 'number' ? p.totalStock : 0,
          orderIndex: link?.orderIndex ?? 0,
        };
      })
      .filter((p: any) => Boolean(p.id))
      .sort((a: any, b: any) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  }, [detail?.products]);

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

  const mediaCount = useMemo(() => {
    if (typeof detail?._count?.medias === 'number') return detail._count.medias;
    return mediaItems.length;
  }, [detail?._count?.medias, mediaItems.length]);

  const totalItems = useMemo(() => mediaCount + productItems.length, [mediaCount, productItems.length]);
  const showProductSection = productItems.length > 0 || mediaItems.length === 0;
  const designSupportsCustomBag = Boolean(
    detail?.customOrderEnabled === true || detail?.customAvailable === true,
  );

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

  const handleThread = async () => {
    setIsThreaded(!isThreaded);
    toast.info('Thread feature coming soon');
  };

  const handleWishlist = async () => {
    setIsWishlisted((prev) => !prev);
    toast.success(!isWishlisted ? 'Added to saved items' : 'Removed from saved items');
  };

  const handleShare = async () => {
    const url = buildCollectionUrl(collectionId);
    await shareOrCopyLink({
      url,
      title: detail?.title || 'Collection',
      text: detail?.description || 'Check out this collection',
      successMessage: 'Collection link copied.',
      errorMessage: 'Failed to copy link.',
    });
  };

  const formatPrice = (value?: number | null) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return null;
    try {
      return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value);
    } catch {
      return `₦${Math.round(value).toLocaleString()}`;
    }
  };

  const handleAddAllToCart = async () => {
    if (!isAuth) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    // Fetch cart preview data and show modal
    setAddingAll(true);
    try {
      const preview = await getCollectionCartPreview(collectionId);
      setCartPreviewData(preview);
      setShowCartPreview(true);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load bag preview');
    } finally {
      setAddingAll(false);
    }
  };

  const handleCartPreviewConfirm = async (
    selections: Array<{ productId: string; quantity: number; variantSize?: string; variantColor?: string }>
  ) => {
    setAddingAll(true);
    try {
      const results = await Promise.all(
        selections.map((s) =>
          dispatch(addToCart({
            productId: s.productId,
            quantity: s.quantity,
            selectedSize: s.variantSize,
            selectedColor: s.variantColor,
          }))
            .unwrap()
            .then(() => true)
            .catch(() => false),
        ),
      );
      const successCount = results.filter(Boolean).length;
      if (successCount > 0) {
        dispatch(openCartDrawer());
        toast.success(`Added ${successCount} item${successCount === 1 ? '' : 's'} to your bag`);
      }
      if (successCount < selections.length) {
        toast.error('Some items could not be added to your bag');
      }
      setShowCartPreview(false);
    } finally {
      setAddingAll(false);
    }
  };

  const handleAddProductToCart = async (productId: string) => {
    try {
      await bagProduct({ id: productId });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to bag item');
    }
  };

  const handleOpenDesignCustomOrder = async () => {
    if (isOwner) {
      toast.info('Brands cannot place custom orders on their own designs.');
      return;
    }
    if (!isAuth) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    if (openingCustomComposer) {
      return;
    }

    setOpeningCustomComposer(true);
    try {
      const activeConfiguration =
        (customConfigurationId
          ? { id: customConfigurationId }
          : await customOrderConfigurationsApi.getActiveForDesign(collectionId)) ?? null;
      const resolvedConfigurationId = activeConfiguration?.id ?? null;

      if (!resolvedConfigurationId) {
        toast.error(
          'This design is not configured for custom orders yet. Complete the custom-order setup on the design first.',
        );
        return;
      }

      setCustomConfigurationId(resolvedConfigurationId);
      setCustomComposerOpen(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to bag this design.');
    } finally {
      setOpeningCustomComposer(false);
    }
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
                            const d = await brandApi.getCollectionDetail(collectionId, { forceRefresh: true });
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

  if (notFound || !detail) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Design not found</p>
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

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Carousel or Product Grid (2/3 width on desktop) */}
        <div className="lg:col-span-2 relative">
          {mediaItems.length > 0 ? (
            <StackedCarousel
              items={resolvedItems.length ? resolvedItems : mediaItems}
              initialIndex={0}
              onIndexChange={(index) => setActiveIndex(index)}
              className="mb-4"
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
          ) : null}
          {showProductSection ? (
            <div className="glass-panel rounded-2xl border border-white/20 bg-white/70 dark:bg-white/5 backdrop-blur-md p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Products in this collection</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{productItems.length} item{productItems.length === 1 ? '' : 's'}</p>
              </div>
              {!isOwner && productItems.length > 0 ? (
                <FrostedButton
                  onClick={handleAddAllToCart}
                  disabled={addingAll}
                  className="text-xs px-3 py-1.5"
                >
                  {addingAll ? 'Adding…' : 'Add all to Bag'}
                </FrostedButton>
              ) : null}
            </div>
            {productItems.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                This collection doesn’t have any products yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {productItems.map((product: (typeof productItems)[number]) => {
                  const now = Date.now();
                  const onSale =
                    product.salePrice != null &&
                    (!product.saleStartAt || new Date(product.saleStartAt).getTime() <= now) &&
                    (!product.saleEndAt || new Date(product.saleEndAt).getTime() >= now);
                  const price = formatPrice(product.price);
                  const salePrice = onSale ? formatPrice(product.salePrice) : null;
                  const image = product.thumbnail || product.images[0];
                    const canQuickAdd =
                      product.totalStock > 0 &&
                      product.sizes.length === 0 &&
                      product.colors.length === 0 &&
                      !product.hasVariants;
                  return (
                    <div key={product.id} className="rounded-xl border border-gray-200/60 dark:border-white/10 bg-white/80 dark:bg-white/5 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => navigate(`/products/${product.id}`)}
                        className="block w-full text-left"
                      >
                        <div className="aspect-square bg-gray-100 dark:bg-zinc-800/50 flex items-center justify-center">
                          {image ? (
                            <MediaRenderer
                              kind="image"
                              src={image}
                              alt={product.name}
                              fit="cover"
                              className="h-full w-full"
                              loading="eager"
                            />
                          ) : (
                            <span className="text-xs text-gray-400">No image</span>
                          )}
                        </div>
                        <div className="p-3">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">{product.name}</div>
                          <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                            {salePrice ? (
                              <div className="flex items-center gap-2">
                                <span className="text-rose-600 dark:text-rose-400 font-semibold">{salePrice}</span>
                                {price ? <span className="line-through text-gray-400">{price}</span> : null}
                              </div>
                            ) : (
                              <span>{price ?? 'Price unavailable'}</span>
                            )}
                          </div>
                        </div>
                      </button>
                      <div className="px-3 pb-3">
                        {canQuickAdd ? (
                          <button
                            type="button"
                            onClick={() => handleAddProductToCart(product.id)}
                            className="w-full rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold py-2"
                          >
                            🛍️ Bag it
                          </button>
                        ) : (
                        <button
                          type="button"
                          onClick={() => navigate(`/products/${product.id}?collectionId=${encodeURIComponent(collectionId)}&collectionTitle=${encodeURIComponent(detail?.title || 'Collection')}`)}
                          className="w-full rounded-lg border border-gray-300/70 dark:border-white/20 text-xs font-semibold py-2 text-gray-700 dark:text-gray-200"
                        >
                          View options
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
          ) : null}
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
                threads: detail?.totalThreads,
                comments: unifiedCommentsCount,
                items: totalItems,
                views: detail?._count?.views,
              }}
              price={{ min: detail?.minPrice, max: detail?.maxPrice, saleMin: detail?.saleMinPrice ?? null, saleMax: detail?.saleMaxPrice ?? null, saleStartAt: detail?.saleStartAt ?? null, saleEndAt: detail?.saleEndAt ?? null }}
              availabilityInStore={detail?.isAvailableInStore}
              visibility={detail?.visibility}
              isOwner={isOwner}
              isThreaded={isThreaded}
              onThread={handleThread}
              onShare={handleShare}
              onOpenQr={undefined}
              onAddToCart={!isOwner && productItems.length > 0 ? handleAddAllToCart : undefined}
              onAddToWishlist={handleWishlist}
              isWishlisted={isWishlisted}
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
                    { label: 'Edit Collection Details', onClick: () => { navigate(`/profile/collections/edit/${collectionId}`); } },
                  ]}
                />
              ) : undefined}
            />
          </div>

          {!isOwner && designSupportsCustomBag ? (
            <div className="glass-panel rounded-2xl border border-white/20 bg-white/70 p-4 backdrop-blur-md dark:bg-white/5">
              <button
                type="button"
                onClick={() => {
                  void handleOpenDesignCustomOrder();
                }}
                disabled={openingCustomComposer}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition hover:from-purple-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span aria-hidden="true">👜</span>
                {openingCustomComposer ? 'Loading...' : 'Bag this design'}
              </button>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                Place a custom order for this design directly from the brand catalog.
              </p>
            </div>
          ) : null}

          {/* Comments Section - Unified & Frosted Glassmorphism */}
          <div className="glass-panel rounded-2xl p-3 border border-white/20 bg-white/60 dark:bg-white/5 backdrop-blur-xl lg:h-[420px] overflow-hidden flex flex-col shadow-lg">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-200/50 dark:border-gray-700/50">
              <MessageCircle className="w-4 h-4 text-gray-700 dark:text-gray-300" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Comments ({unifiedCommentsCount})</h3>
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
            setDetail((prev: any) => ({ ...(prev ?? {}), minPrice: p.minPrice ?? prev?.minPrice, maxPrice: p.maxPrice ?? prev?.maxPrice, tags: p.tags ?? prev?.tags }));
            // Notify parent to refresh collections list so cards show updated prices
            if (onPriceUpdated) {
              await onPriceUpdated();
            }
          }}
        />
      )}
      {/* Collection QR modal disabled — only brand profile QR codes active */}
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
        isDestructive
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
      {showCartPreview && cartPreviewData && (
        <CollectionCartPreviewModal
          isOpen={showCartPreview}
          collection={{
            id: collectionId,
            title: String(detail?.title || detail?.name || cartPreviewData.collectionTitle || 'Collection'),
          }}
          previewData={cartPreviewData}
          onAddToCart={handleCartPreviewConfirm}
          onClose={() => setShowCartPreview(false)}
          isLoading={addingAll}
        />
      )}
      {customComposerOpen && customConfigurationId ? (
        <OverlayPortal>
          <div
            className="fixed inset-0 z-layer-modal flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setCustomComposerOpen(false);
              }
            }}
          >
            <div className="relative h-[92vh] w-[98vw] max-w-[1280px] overflow-y-auto rounded-3xl border border-white/20 bg-white/90 p-4 text-slate-900 shadow-2xl dark:bg-[#0d0b12] dark:text-white">
              <button
                type="button"
                aria-label="Close custom order composer"
                onClick={() => setCustomComposerOpen(false)}
                className="sticky top-2 float-right z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/80 text-slate-700 shadow-sm hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
              >
                <span aria-hidden="true" className="text-base">×</span>
              </button>
              <LazyCustomOrderComposerPage
                embedded
                configurationIdOverride={customConfigurationId}
                onClose={() => setCustomComposerOpen(false)}
                onOrderCreated={() => setCustomComposerOpen(false)}
              />
            </div>
          </div>
        </OverlayPortal>
      ) : null}
    </div>
  );
};

export default InlineCollectionViewer;
