import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  Heart, 
  ChevronDown, 
  Truck, 
  ShieldCheck,
  ChevronRight,
  Check,
  X,
  Ruler,
} from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import VLoader from '@/components/loaders/VLoader';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/store';
import { addToWishlist, checkWishlistStatus, removeFromWishlist } from '@/features/wishlistSlice';
import { productApi } from '@/api/ProductApi';
import type { ProductDto } from '@/api/ProductApi';
import MediaRenderer from '@/components/media/MediaRenderer';
import { formatPrice } from '@/utils/helpers';
import useSignedFileUrl from '@/hooks/useSignedFileUrl';
import { SizeFitApi } from '@/api/SizeFitApi';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import LazyCustomOrderComposerPage from '@/components/custom-orders/LazyCustomOrderComposerPage';
import { buildProductUrl, shareOrCopyLink } from '@/utils/publicLinks';
import { useActiveCustomOrderConfiguration } from '@/hooks/useActiveCustomOrderConfiguration';
import BagPulseIcon from '@/components/bagging/BagPulseIcon';
import { useBagging } from '@/hooks/useBagging';
import { BAG_IT_EMOJI, BAG_IT_LABEL } from '@/constants/bagging';
import ProductReviewSection from '@/components/reviews/ProductReviewSection';
import { normalizeSizingMode } from '@/types/sizing';
import { formatMeasurementLabel } from '@/utils/measurementLabels';
import {
  isCustomOrderOnlyProduct,
  isStrictlyOutOfStockProduct,
} from '@/lib/productAvailability';
import { resolveVariantColorPresentation } from '@/utils/variantColors';

const findMappedColorValue = (
  map: Record<string, string> | undefined,
  color: string,
) => {
  if (!map) return null;
  if (map[color]) return map[color];
  const normalizedColor = color.toLowerCase();
  const match = Object.entries(map).find(([key]) => key.toLowerCase() === normalizedColor);
  if (match) return match[1];
  const partialMatch = Object.entries(map).find(([key]) =>
    normalizedColor.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedColor),
  );
  if (partialMatch) return partialMatch[1];
  return null;
};

// Helper component to render signed media
function SignedMediaItem({ 
  media, 
  alt, 
  className, 
  onClick,
  isActive,
  isThumbnail = false 
}: { 
  media: { id: string; url: string; type: string }; 
  alt: string;
  className?: string;
  onClick?: () => void;
  isActive?: boolean;
  isThumbnail?: boolean;
}) {
  const fileId = typeof media.id === 'string' && !media.id.startsWith('img-')
    ? media.id 
    : undefined;
  const { url: signedUrl } = useSignedFileUrl(fileId, media.url);
  const resolvedSrc = typeof signedUrl === 'string' && signedUrl.trim().length > 0 ? signedUrl : null;
  const mediaKind = media.type?.toLowerCase()?.includes('video') ? 'video' : 'image';

  if (isThumbnail) {
    return (
      <button
        onClick={onClick}
        className={`
          relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all
          ${isActive 
            ? 'border-black dark:border-white' 
            : 'border-transparent opacity-70 hover:opacity-100'}
        `}
      >
        {resolvedSrc ? (
          <MediaRenderer
            kind={mediaKind}
            src={resolvedSrc}
            alt={alt}
            fit="cover"
            className="w-full h-full"
          />
        ) : (
          <div className="w-full h-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-300">
            <span className="text-xs">No image</span>
          </div>
        )}
      </button>
    );
  }

  if (!resolvedSrc) {
    return (
      <div className="w-full min-h-[240px] flex items-center justify-center text-gray-300">
        <span className="text-sm">No image</span>
      </div>
    );
  }

  return (
    <MediaRenderer
      kind={mediaKind}
      src={resolvedSrc}
      alt={alt}
      fit="contain"
      className={className}
      mediaClassName="block w-full h-auto"
      maxHeightClassName="max-h-[85vh]"
      maxWidthClassName="max-w-full"
    />
  );
}
// Skeleton Component
function ProductDetailsSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-pulse">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div className="space-y-4">
          <div className="aspect-[3/4] bg-gray-100 dark:bg-white/5 rounded-2xl w-full" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="aspect-square bg-gray-100 dark:bg-white/5 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="space-y-8 pt-4">
          <div className="space-y-4">
            <div className="h-4 w-24 bg-gray-100 dark:bg-white/5 rounded" />
            <div className="h-10 w-3/4 bg-gray-100 dark:bg-white/5 rounded" />
            <div className="h-6 w-32 bg-gray-100 dark:bg-white/5 rounded" />
          </div>
          <div className="space-y-6">
             <div className="h-20 w-full bg-gray-100 dark:bg-white/5 rounded-xl" />
             <div className="h-12 w-full bg-gray-100 dark:bg-white/5 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch<AppDispatch>();
  const currentUser = useSelector((s: RootState) => s.user.profile);
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const wishlistedIds = useSelector((s: RootState) => s.wishlist.wishlistedIds);
  const { addStandard, bagProduct, beginCustomFlow, getPulseStatus, loadingByProductId } = useBagging();
  const [product, setProduct] = useState<ProductDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [measurementValues, setMeasurementValues] = useState<Record<string, string>>({});
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [modalMeasurementValues, setModalMeasurementValues] = useState<Record<string, string>>({});
  const [savingMeasurements, setSavingMeasurements] = useState(false);
  /* showQr disabled — only brand profile QR codes active */
  const [startingCustomOrder, setStartingCustomOrder] = useState(false);
  const [customOrderComposerOpen, setCustomOrderComposerOpen] = useState(false);
  
  // Fetch product
  useEffect(() => {
    if (!id) return;
    const loadProduct = async () => {
      try {
        setLoading(true);
        const data = await productApi.getProduct(id, { includeDeleted: false });
        if (data) {
          setProduct(data);
          // Auto-select first available options if any
          const variants = data.variants || [];
          const inStock = variants.find(v => v.stock > 0) || variants[0];
          if (inStock) {
             if (inStock.size) setSelectedSize(inStock.size);
             if (inStock.color) setSelectedColor(inStock.color);
          }
        } else {
           setError('Product not found');
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load product');
      } finally {
        setLoading(false);
      }
    };
    loadProduct();
  }, [id]);

  // Derived media list
  const mediaList = useMemo(() => {
    if (!product) return [];
    if (Array.isArray((product as any).media) && (product as any).media.length > 0) {
      return (product as any).media;
    }
    if (Array.isArray((product as any).images) && (product as any).images.length > 0) {
      return (product as any).images.map((url: string, idx: number) => ({
        id: `img-${idx}`,
        url,
        type: 'IMAGE'
      }));
    }
    return [];
  }, [product]);

  const colorImageUrl = useMemo(
    () => findMappedColorValue(product?.colorImages, selectedColor),
    [product?.colorImages, selectedColor],
  );

  const colorHexCodes = useMemo(() => product?.colorHexCodes ?? {}, [product?.colorHexCodes]);

  const activeMedia = useMemo(() => {
    if (colorImageUrl) {
      return {
        id: `color-${selectedColor}`,
        url: colorImageUrl,
        type: 'IMAGE',
      };
    }
    return mediaList[selectedMediaIndex] ?? null;
  }, [colorImageUrl, mediaList, selectedColor, selectedMediaIndex]);

  /* canOpenQr disabled — only brand profile QR codes active */

  // Variants Logic
  const variants = useMemo(() => product?.variants || [], [product]);
  
  const colors = useMemo(() => {
    return Array.from(new Set(variants.map(v => v.color).filter(Boolean))) as string[];
  }, [variants]);

  const sizes = useMemo(() => {
    return Array.from(new Set(variants.map(v => v.size).filter(Boolean))) as string[];
  }, [variants]);

  const availableSizes = useMemo(() => {
    if (sizes.length > 0) return sizes;
    if (Array.isArray(product?.sizes)) {
      return product.sizes.filter(
        (size): size is string => typeof size === 'string' && size.trim().length > 0,
      );
    }
    return [] as string[];
  }, [product?.sizes, sizes]);

  const sizingMode = useMemo(() => {
    return normalizeSizingMode(product?.sizingMode);
  }, [product?.sizingMode]);

  const isCustomAvailable =
    product?.customAvailable === true || product?.customOrderEnabled === true;
  const customOrderAvailability = useActiveCustomOrderConfiguration({
    sourceType: 'PRODUCT',
    sourceId: product?.id,
    enabled: isCustomAvailable,
    unavailableReason:
      'This product is marked custom-order enabled, but it is not configured for custom bagging yet. Ask the brand to complete custom-order setup.',
  });
  const customOrderUnavailableReason = customOrderAvailability.isAvailable
    ? null
    : customOrderAvailability.isLoading
      ? 'Checking custom-order availability...'
      : customOrderAvailability.unavailableReason ||
        'This product is not configured for custom orders yet. Ask the brand to complete custom-order setup.';

  const customOrderMeasurementKeys = useMemo(() => {
    if (customOrderAvailability.isLoading && isCustomAvailable) {
      return [];
    }
    if (!customOrderAvailability.configuration) {
      return null;
    }
    return customOrderAvailability.configuration.requiredMeasurementKeys.filter(
      (key): key is string => typeof key === 'string' && key.trim().length > 0,
    );
  }, [customOrderAvailability.configuration, customOrderAvailability.isLoading, isCustomAvailable]);

  const requiredMeasurementKeys = useMemo(() => {
    if (customOrderMeasurementKeys !== null) {
      return customOrderMeasurementKeys;
    }
    if (!Array.isArray(product?.customMeasurementKeys)) return [];
    return product.customMeasurementKeys.filter(
      (key): key is string => typeof key === 'string' && key.trim().length > 0,
    );
  }, [customOrderMeasurementKeys, product?.customMeasurementKeys]);

  const isCustomOrderOnly = isCustomOrderOnlyProduct(product);
  const requiresMeasurements =
    sizingMode === 'RTW_PLUS_FITTINGS' && requiredMeasurementKeys.length > 0;

  useEffect(() => {
    if (!product?.id || !isAuth) return;
    dispatch(checkWishlistStatus(product.id));
  }, [dispatch, isAuth, product?.id]);

  useEffect(() => {
    let active = true;
    const hydrateMeasurements = async () => {
      if (!isAuth || requiredMeasurementKeys.length === 0) return;
      try {
        const profile = await SizeFitApi.getMyProfile();
        if (!active) return;
        const profileMeasurements =
          profile?.measurements && typeof profile.measurements === 'object'
            ? (profile.measurements as Record<string, unknown>)
            : {};

        setMeasurementValues((prev) => {
          const next = { ...prev };
          requiredMeasurementKeys.forEach((key) => {
            if (next[key] && next[key].trim().length > 0) return;
            const raw = profileMeasurements[key];
            if (typeof raw === 'number' && Number.isFinite(raw)) {
              next[key] = String(raw);
              return;
            }
            if (typeof raw === 'object' && raw && 'value' in (raw as Record<string, unknown>)) {
              const nested = (raw as { value?: unknown }).value;
              if (typeof nested === 'number' && Number.isFinite(nested)) {
                next[key] = String(nested);
              }
            }
          });
          return next;
        });
      } catch {
      }
    };

    void hydrateMeasurements();

    return () => {
      active = false;
    };
  }, [isAuth, requiredMeasurementKeys]);

  useEffect(() => {
    if (!selectedColor || !colorImageUrl || mediaList.length === 0) return;
    const imageIndex = mediaList.findIndex((item: { url?: string | null }) => item.url === colorImageUrl);
    if (imageIndex >= 0 && imageIndex !== selectedMediaIndex) {
      setSelectedMediaIndex(imageIndex);
    }
  }, [colorImageUrl, mediaList, selectedColor, selectedMediaIndex]);

  const currentPrice = useMemo(() => {
    if (!product) return 0;
    const variant = variants.find(v => 
      (!selectedColor || v.color === selectedColor) && 
      (!selectedSize || v.size === selectedSize)
    );
    return variant?.price ?? product.price;
  }, [product, variants, selectedColor, selectedSize]);

  const searchParams = new URLSearchParams(location.search);
  const sourceCollectionId = searchParams.get('collectionId');
  const sourceCollectionTitle = searchParams.get('collectionTitle') || 'Collection';

  if (loading) return <ProductDetailsSkeleton />;
  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <h2 className="text-xl font-semibold">Product Not Found</h2>
        <button onClick={() => navigate(-1)} className="text-purple-600 hover:underline">
          Go Back
        </button>
      </div>
    );
  }

  const handleAddToCart = async () => {
    if (!product) return;
    if (isOwnProduct || isStudioStoreView) {
      toast.info('You cannot add your own product to bag.');
      return;
    }

    const normalizedMeasurements = requiredMeasurementKeys.reduce(
      (acc, key) => {
        const rawValue = measurementValues[key];
        const parsedValue = Number(rawValue);
        if (Number.isFinite(parsedValue) && parsedValue > 0) {
          acc[key] = {
            value: parsedValue,
            unit: 'CM',
          };
        }
        return acc;
      },
      {} as Record<string, { value: number; unit: 'CM' }>,
    );

    const sizeFitData =
      Object.keys(normalizedMeasurements).length > 0
        ? { measurements: normalizedMeasurements }
        : undefined;

    const result = await bagProduct(
      { id: product.id, name: product.title },
      {
        quantity: 1,
        size: selectedSize || undefined,
        color: selectedColor || undefined,
        sizingMode,
        requiredMeasurementKeys,
        sizeFitData,
      },
    );

    if (!result) return;

    if (result.action === 'OPEN_SELECTOR' || result.action === 'OPEN_CUSTOM_FLOW' || result.action === 'OPEN_FITTINGS') {
      return;
    }
  };

  const handleWishlist = async () => {
    if (!product?.id) return;
    if (!isAuth) {
      toast.info('Please sign in to use wishlist');
      return;
    }
    setWishlistBusy(true);
    try {
      const isWishlisted = wishlistedIds.has(product.id);
      if (isWishlisted) {
        await dispatch(removeFromWishlist(product.id)).unwrap();
        toast.success('Removed from wishlist');
      } else {
        await dispatch(addToWishlist(product.id)).unwrap();
        toast.success('Added to wishlist');
      }
    } catch (error: any) {
      toast.error(error || 'Failed to update wishlist');
    } finally {
      setWishlistBusy(false);
    }
  };

  const handleShare = async () => {
    if (!product) return;
    const url = buildProductUrl({ id: product.id, slug: (product as ProductDto & { slug?: string }).slug });
    await shareOrCopyLink({
      url,
      title: product.title,
      text: product.description || product.title,
      successMessage: 'Product link copied.',
      errorMessage: 'Unable to copy link.',
    });
  };

  const currentVariant = variants.find(v => 
    (!selectedColor || v.color === selectedColor) && 
    (!selectedSize || v.size === selectedSize)
  );

  const handleStartCustomOrder = async () => {
    if (!product?.id) return;
    if (isOwnProduct || isStudioStoreView) {
      toast.info('Custom-order checkout is hidden on your own product view.');
      return;
    }
    if (startingCustomOrder) {
      return;
    }
    try {
      setStartingCustomOrder(true);
      await beginCustomFlow({ id: product.id, name: product.title });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to open custom-order checkout.');
    } finally {
      setStartingCustomOrder(false);
    }
  };
  
  const isOutOfStock = (() => {
    if (!product) return false;
    if (isCustomOrderOnly) return false;
    if (variants.length > 0) {
      return Number(currentVariant?.stock ?? 0) <= 0;
    }
    return isStrictlyOutOfStockProduct(product);
  })();
  const isStudioStoreView = location.pathname.startsWith('/studio/store');
  const ownerCandidates = [
    product.brandId,
    product.brand?.id,
    (product as ProductDto & { ownerId?: string }).ownerId,
    (product as ProductDto & { brand?: { ownerId?: string } }).brand?.ownerId,
  ]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
  const viewerCandidates = [
    currentUser?.id,
    (currentUser as { brandId?: string } | null)?.brandId,
  ]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
  const isOwnProduct = viewerCandidates.some((viewerId) => ownerCandidates.includes(viewerId));
  const showAddToBag = !isStudioStoreView && !isOwnProduct;
  const bagButtonLoading = Boolean(loadingByProductId[product.id]);
  const bagPulseStatus = getPulseStatus(product.id, isOutOfStock || !showAddToBag);
  const compareAt = typeof product.compareAtPrice === 'number' && product.compareAtPrice > currentPrice
    ? product.compareAtPrice
    : null;
  const productViews = typeof product.viewsCount === 'number' ? product.viewsCount : null;
  const productThreads = typeof product.threadsCount === 'number' ? product.threadsCount : null;
  const goToSourceCollection = () => {
    if (!sourceCollectionId) return;
    if (isStudioStoreView) {
      const params = new URLSearchParams();
      params.set('view', 'collections');
      params.set('collectionId', sourceCollectionId);
      navigate(`/studio/store?${params.toString()}`);
      return;
    }
    navigate(`/collections/${sourceCollectionId}`);
  };

  // Handle saving modal measurements and retrying add-to-bag
  const handleModalSaveAndAdd = async () => {
    // Build normalised values from modal inputs
    const normalised: Record<string, { value: number; unit: 'CM' }> = {};
    requiredMeasurementKeys.forEach((key) => {
      const parsed = Number(modalMeasurementValues[key]);
      if (Number.isFinite(parsed) && parsed > 0) {
        normalised[key] = { value: parsed, unit: 'CM' };
      }
    });

    const missingKeys = requiredMeasurementKeys.filter((k) => !normalised[k]);
    if (missingKeys.length > 0) {
      toast.error(`Please fill in all ${missingKeys.length} missing measurement(s)`);
      return;
    }

    setSavingMeasurements(true);
    try {
      // Persist to user profile so they don't have to enter again
      await SizeFitApi.updateProfile({ measurements: normalised });
      // Update local state so the inline form also reflects the values
      setMeasurementValues((prev) => ({
        ...prev,
        ...modalMeasurementValues,
      }));
      setShowMeasurementModal(false);

      // Now add to bag with the updated measurements
      const variant = variants.find(v =>
        (!selectedColor || v.color === selectedColor) &&
        (!selectedSize || v.size === selectedSize),
      );
      await addStandard(product.id, {
        quantity: 1,
        size: variant?.size || selectedSize,
        color: variant?.color || selectedColor,
        sizingMode,
        requiredMeasurementKeys,
        sizeFitData: { measurements: normalised },
      });
      toast.success('Measurements saved & bagged!');
    } catch (err: any) {
      toast.error(err || 'Failed to bag item');
    } finally {
      setSavingMeasurements(false);
    }
  };

  // Count missing measurements for modal display
  const missingMeasurementKeys = requiredMeasurementKeys.filter((key) => {
    const raw = modalMeasurementValues[key];
    const parsed = Number(raw);
    return !(Number.isFinite(parsed) && parsed > 0);
  });

  return (
    <div className={`bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 ${isStudioStoreView ? 'min-h-0 pb-0' : 'min-h-screen pb-10'}`}>
      {/* Measurement Modal */}
      <AnimatePresence>
        {showMeasurementModal && (
          <OverlayPortal>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-layer-overlay bg-black/50 backdrop-blur-sm"
              onClick={() => setShowMeasurementModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed inset-0 z-layer-modal flex items-center justify-center p-4"
            >
              <div className="w-full max-w-md bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10 bg-gradient-to-r from-purple-500/10 to-fuchsia-500/10 dark:from-purple-500/5 dark:to-fuchsia-500/5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/15 flex items-center justify-center">
                      <Ruler size={18} className="text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Measurements Required</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {missingMeasurementKeys.length} of {requiredMeasurementKeys.length} missing
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMeasurementModal(false)}
                    className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                  >
                    <X size={18} className="text-slate-500" />
                  </button>
                </div>

                {/* Body */}
                <div className="px-5 py-4 max-h-[50vh] overflow-y-auto space-y-3">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    This product requires custom measurements. Fill in the values below to add it to your bag.
                  </p>
                  {requiredMeasurementKeys.map((key) => {
                    const isMissing = missingMeasurementKeys.includes(key);
                    return (
                      <label key={key} className="flex flex-col gap-1">
                        <span className={`text-xs font-medium flex items-center gap-1.5 ${isMissing ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          {formatMeasurementLabel(key)}
                          {isMissing && <span className="text-[10px]">(required)</span>}
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          value={modalMeasurementValues[key] ?? ''}
                          onChange={(e) =>
                            setModalMeasurementValues((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          className={`h-10 rounded-xl border px-3 text-sm bg-white/80 dark:bg-white/5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40 ${
                            isMissing ? 'border-red-300 dark:border-red-500/30' : 'border-black/10 dark:border-white/15'
                          }`}
                          placeholder="cm"
                        />
                      </label>
                    );
                  })}
                </div>

                {/* Footer */}
                <div className="px-5 py-4 border-t border-black/10 dark:border-white/10 space-y-2.5">
                  <button
                    type="button"
                    onClick={handleModalSaveAndAdd}
                    disabled={savingMeasurements}
                    className="w-full py-3 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {savingMeasurements ? (
                      <>
                        <VLoader size={16} phase="loading" showLabel={false} /> Saving...
                      </>
                    ) : (
                      <>
                        <span aria-hidden="true">{BAG_IT_EMOJI}</span>
                        Save Measurements & {BAG_IT_LABEL}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMeasurementModal(false);
                      navigate('/settings?tab=fittings');
                    }}
                    className="w-full py-2.5 rounded-full border border-black/10 dark:border-white/15 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                  >
                    <Ruler size={14} />
                    Go to My Fittings
                  </button>
                </div>
              </div>
            </motion.div>
          </OverlayPortal>
        )}
      </AnimatePresence>

      <main className={`flex-grow w-full max-w-[1440px] mx-auto px-4 md:px-8 lg:px-12 py-8 lg:py-10 ${isStudioStoreView ? 'rounded-2xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-white/5 shadow-lg' : ''}`}>
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          {isStudioStoreView ? (
            <>
              <Link to="/studio" className="hover:text-slate-900 dark:hover:text-white transition-colors">Studio</Link>
              <ChevronRight size={14} className="text-slate-400" />
              <Link to="/studio/store" className="hover:text-slate-900 dark:hover:text-white transition-colors">Store</Link>
              {sourceCollectionId ? (
                <>
                  <ChevronRight size={14} className="text-slate-400" />
                  <button
                    type="button"
                    onClick={goToSourceCollection}
                    className="hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    {sourceCollectionTitle}
                  </button>
                </>
              ) : null}
              <ChevronRight size={14} className="text-slate-400" />
              <span className="text-slate-900 dark:text-white font-medium truncate max-w-[260px]">{product.title}</span>
            </>
          ) : sourceCollectionId ? (
            <>
              <Link to="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">Home</Link>
              <ChevronRight size={14} className="text-slate-400" />
              <button
                type="button"
                onClick={goToSourceCollection}
                className="hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Collections
              </button>
              <ChevronRight size={14} className="text-slate-400" />
              <button
                type="button"
                onClick={goToSourceCollection}
                className="hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                {sourceCollectionTitle}
              </button>
              <ChevronRight size={14} className="text-slate-400" />
              <span className="text-slate-900 dark:text-white font-medium truncate max-w-[260px]">{product.title}</span>
            </>
          ) : (
            <>
              <Link to="/" className="hover:text-slate-900 dark:hover:text-white transition-colors">Home</Link>
              <ChevronRight size={14} className="text-slate-400" />
              {product.brand && (
                <>
                  <Link
                    to={`/profile/${product.brandId}`}
                    className="hover:text-slate-900 dark:hover:text-white transition-colors"
                  >
                    {product.brand.name}
                  </Link>
                  <ChevronRight size={14} className="text-slate-400" />
                </>
              )}
              <span className="text-slate-900 dark:text-white font-medium truncate max-w-[260px]">{product.title}</span>
            </>
          )}
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="w-full overflow-hidden rounded-2xl">
              {activeMedia ? (
                <SignedMediaItem
                  media={activeMedia}
                  alt={product.title}
                  className="w-full"
                />
              ) : (
                <div className="w-full min-h-[220px] flex items-center justify-center text-slate-500 dark:text-slate-400">
                  No image
                </div>
              )}
            </div>

            {mediaList.length > 1 ? (
              <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                {mediaList.map((m: any, idx: number) => (
                  <SignedMediaItem
                    key={m.id || idx}
                    media={m}
                    alt={`View ${idx + 1}`}
                    onClick={() => setSelectedMediaIndex(idx)}
                    isActive={selectedMediaIndex === idx}
                    isThumbnail
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div className="lg:col-span-4">
            <div className="sticky top-24 flex flex-col gap-4">
              <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur p-6 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    {product.category?.name ? (
                      <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 mb-2">
                        {product.category.name}
                      </span>
                    ) : null}
                    <h1 className="text-2xl md:text-3xl font-bold leading-tight text-slate-900 dark:text-white">{product.title}</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {product.brand?.name ? `${product.brand.name} drop` : 'Limited release'}
                    </p>
                    {isCustomAvailable ? (
                      <span className="mt-2 inline-flex items-center rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-[11px] font-semibold text-purple-700 dark:text-purple-200">
                        ✂️ Custom Available
                      </span>
                    ) : null}
                  </div>
                  <button
                    onClick={handleWishlist}
                    disabled={wishlistBusy}
                    className={`transition-colors ${wishlistedIds.has(product.id) ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'}`}
                    type="button"
                    aria-label={wishlistedIds.has(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                  >
                    <Heart size={22} fill={wishlistedIds.has(product.id) ? 'currentColor' : 'none'} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-xl bg-black/5 dark:bg-white/5 px-3 py-2 text-center text-slate-600 dark:text-slate-300">
                    <div className="font-semibold">{productThreads ?? 0}</div>
                    <div>Threads</div>
                  </div>
                  <div className="rounded-xl bg-black/5 dark:bg-white/5 px-3 py-2 text-center text-slate-600 dark:text-slate-300">
                    <div className="font-semibold">{productViews ?? 0}</div>
                    <div>Views</div>
                  </div>
                  <div className="rounded-xl bg-black/5 dark:bg-white/5 px-3 py-2 text-center text-slate-600 dark:text-slate-300">
                    <div className="font-semibold">
                      {isCustomOrderOnly
                        ? 'Custom'
                        : currentVariant?.stock ?? product.totalStock ?? product.stock ?? 0}
                    </div>
                    <div>{isCustomOrderOnly ? 'Mode' : 'Stock'}</div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-end gap-3">
                    <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{formatPrice(currentPrice)}</span>
                    {compareAt ? (
                      <span className="text-slate-400 line-through">{formatPrice(compareAt)}</span>
                    ) : null}
                  </div>
                </div>

                {(colors.length > 0 || availableSizes.length > 0) ? (
                  <div className="space-y-4 border-y border-black/10 dark:border-white/10 py-4">
                    {colors.length > 0 ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wide">
                            Color {selectedColor && <span className="font-normal text-slate-500 dark:text-slate-400 normal-case">— {selectedColor}</span>}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {colors.map((color) => {
                            const isActive = selectedColor === color;
                            const presentation = resolveVariantColorPresentation(color, {
                              colorHexCodes,
                              colorImages: product?.colorImages ?? null,
                            });
                            return (
                              <button
                                key={color}
                                onClick={() => setSelectedColor(color)}
                                type="button"
                                className={`flex min-h-16 min-w-[8.5rem] items-center gap-2 rounded-2xl border px-3 py-2 text-left transition-all ${
                                  isActive
                                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-500/10'
                                    : 'border-black/10 dark:border-white/15 hover:border-emerald-500/60'
                                }`}
                                title={color}
                              >
                                <span
                                  className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border ${
                                    isActive
                                      ? 'border-emerald-500/50'
                                      : 'border-black/10 dark:border-white/15'
                                  }`}
                                  style={presentation.swatchStyle}
                                >
                                  {isActive ? (
                                    <Check size={15} className="absolute inset-0 m-auto text-white drop-shadow" />
                                  ) : null}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-xs font-semibold text-slate-900 dark:text-white">
                                    {presentation.label}
                                  </span>
                                  <span className="block text-[10px] text-slate-500 dark:text-slate-400">
                                    {presentation.toneLabel}
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {availableSizes.length > 0 ? (
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Size</div>
                        <div className="flex flex-wrap gap-2">
                          {availableSizes.map((size) => {
                            const isActive = selectedSize === size;
                            return (
                              <button
                                key={size}
                                onClick={() => setSelectedSize(size)}
                                type="button"
                                className={`h-9 min-w-9 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                                  isActive
                                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-700 dark:text-emerald-200'
                                    : 'border-black/10 dark:border-white/15 text-slate-600 dark:text-slate-300 hover:border-emerald-500/60'
                                }`}
                              >
                                {size}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {requiresMeasurements ? (
                  <div className="space-y-3 border-b border-black/10 dark:border-white/10 pb-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Required Measurements (cm)
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {requiredMeasurementKeys.map((key) => (
                        <label key={key} className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {key.replace(/_/g, ' ')}
                          </span>
                          <input
                            type="number"
                            min={0}
                            step="0.1"
                            value={measurementValues[key] ?? ''}
                            onChange={(event) => {
                              const value = event.target.value;
                              setMeasurementValues((prev) => ({
                                ...prev,
                                [key]: value,
                              }));
                            }}
                            className="h-10 rounded-xl border border-black/10 dark:border-white/15 bg-white/80 dark:bg-white/5 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                            placeholder="e.g. 38"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}

                {showAddToBag ? (
                  <div className="space-y-2.5">
                    <div className={`grid gap-2 ${isCustomAvailable && !isCustomOrderOnly ? 'sm:grid-cols-2' : ''}`}>
                      {isCustomAvailable ? (
                        <span className="block w-full" title={customOrderUnavailableReason ?? undefined}>
                          <button
                            onClick={handleStartCustomOrder}
                            type="button"
                            disabled={startingCustomOrder || customOrderAvailability.isLoading || !customOrderAvailability.isAvailable}
                            className="w-full rounded-full border border-emerald-400/50 bg-emerald-500/10 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:text-emerald-200"
                          >
                            {startingCustomOrder
                              ? 'Opening custom-order bag...'
                              : `${BAG_IT_EMOJI} Custom ${BAG_IT_LABEL}`}
                          </button>
                        </span>
                      ) : null}
                      {!isCustomOrderOnly ? (
                        <button
                          onClick={handleAddToCart}
                          disabled={isOutOfStock || bagButtonLoading}
                          className={`w-full font-bold py-3.5 rounded-full transition-all flex items-center justify-center gap-2 ${
                            isOutOfStock
                              ? 'bg-slate-300 dark:bg-white/15 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                              : 'bg-emerald-500 hover:bg-emerald-400 text-black'
                          }`}
                        >
                          <BagPulseIcon
                            status={bagPulseStatus}
                            context="detail"
                            size={32}
                            disabled={isOutOfStock || bagButtonLoading}
                          />
                          {isOutOfStock ? 'Sold Out' : `${BAG_IT_EMOJI} ${BAG_IT_LABEL}`}
                        </button>
                      ) : null}
                    </div>
                    <button
                      onClick={handleWishlist}
                      disabled={wishlistBusy}
                      className={`w-full py-3 rounded-full border text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                        wishlistedIds.has(product.id)
                          ? 'border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400'
                          : 'border-black/10 dark:border-white/15 text-slate-600 dark:text-slate-300 hover:border-rose-400 hover:text-rose-500'
                      }`}
                    >
                      <Heart size={16} fill={wishlistedIds.has(product.id) ? 'currentColor' : 'none'} />
                      {wishlistedIds.has(product.id) ? 'Remove from Wishlist' : 'Add to Wishlist'}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                    This is your product. Customer checkout actions are hidden.
                  </div>
                )}

                <div className="text-center text-xs text-slate-500 dark:text-slate-400">Free shipping on eligible orders</div>

                <div className={`grid gap-2 ${sourceCollectionId ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="flex-1 h-10 rounded-full border border-black/10 dark:border-white/15 text-sm text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center gap-2"
                  >
                    <span aria-hidden="true">🔗</span>
                    Share
                  </button>
                  {/* Product QR button disabled — only brand profile QR codes active */}
                  {sourceCollectionId ? (
                    <button
                      type="button"
                      onClick={goToSourceCollection}
                      className="flex-1 h-10 rounded-full border border-black/10 dark:border-white/15 text-sm text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      Back to Collection
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Community Vibes</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{productThreads ?? 0} threads</span>
                </div>
                <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/15 p-4 text-sm text-slate-500 dark:text-slate-400">
                  Community comments will appear here as people discuss this product.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-black/10 dark:border-white/10 bg-white/50 dark:bg-white/5 p-6">
          <div className="space-y-0 divide-y divide-black/10 dark:divide-white/10">
            {product.description ? (
              <details className="group py-4 cursor-pointer" open>
                <summary className="flex items-center justify-between font-medium list-none text-slate-900 dark:text-white">
                  <span>Description</span>
                  <ChevronDown className="group-open:rotate-180 transition-transform" size={16} />
                </summary>
                <div className="pt-4 text-slate-600 dark:text-slate-300 leading-relaxed text-sm whitespace-pre-wrap">
                  {product.description}
                </div>
              </details>
            ) : null}

            <details className="group py-4 cursor-pointer">
              <summary className="flex items-center justify-between font-medium list-none text-slate-900 dark:text-white">
                <span>Shipping & Returns</span>
                <ChevronDown className="group-open:rotate-180 transition-transform" size={16} />
              </summary>
              <div className="pt-4 text-slate-600 dark:text-slate-300 leading-relaxed text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Truck size={16} />
                  <span>Shipping timelines vary by destination and carrier.</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} />
                  <span>Returns follow brand policy at checkout.</span>
                </div>
              </div>
            </details>
          </div>
        </div>
      </main>

      {customOrderComposerOpen && customOrderAvailability.configurationId ? (
        <OverlayPortal>
          <div
            className="fixed inset-0 z-layer-modal flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setCustomOrderComposerOpen(false);
              }
            }}
          >
            <div className="relative h-[92vh] w-[98vw] max-w-[1280px] overflow-y-auto rounded-3xl border border-white/20 bg-white/90 p-4 text-slate-900 shadow-2xl dark:bg-[#0d0b12] dark:text-white">
              <button
                type="button"
                aria-label="Close custom order composer"
                onClick={() => setCustomOrderComposerOpen(false)}
                className="sticky top-2 float-right z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white/80 text-slate-700 shadow-sm hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
              >
                <span aria-hidden="true" className="text-base">×</span>
              </button>
              <LazyCustomOrderComposerPage
                embedded
                configurationIdOverride={customOrderAvailability.configurationId}
                onClose={() => setCustomOrderComposerOpen(false)}
                onOrderCreated={() => setCustomOrderComposerOpen(false)}
              />
            </div>
          </div>
        </OverlayPortal>
      ) : null}

      <div className="mx-auto w-full max-w-[1440px] px-4 pb-10 md:px-8 lg:px-12">
        <ProductReviewSection productId={product.id} />
      </div>
      {/* Product QR modal disabled — only brand profile QR codes active */}
    </div>
  );
}
