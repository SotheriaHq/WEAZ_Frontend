import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import type { StoreProduct } from '@/components/designs/StoreProductCard';
import ImageWithFallback from '@/components/ImageWithFallback';
import ImageLightbox from './ImageLightbox';
import type { AppDispatch, RootState } from '@/store';
import { addToWishlist, removeFromWishlist } from '@/features/wishlistSlice';
import { SizeFitApi } from '@/api/SizeFitApi';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import LazyCustomOrderComposerPage from '@/components/custom-orders/LazyCustomOrderComposerPage';
import { buildProductUrl, shareOrCopyLink } from '@/utils/publicLinks';
import { CONTENT_DISPLAY_FRAME_CLASS, CONTENT_DISPLAY_MEDIA_CLASS } from '@/components/media/contentDisplayPresets';
import { formatMeasurementLabel } from '@/utils/measurementLabels';
import { normalizeSizingMode } from '@/types/sizing';
import { useActiveCustomOrderConfiguration } from '@/hooks/useActiveCustomOrderConfiguration';
import BagPulseIcon from '@/components/bagging/BagPulseIcon';
import { useBagging } from '@/hooks/useBagging';
import { BAG_IT_EMOJI, BAG_IT_LABEL } from '@/constants/bagging';
import {
  isCustomOrderOnlyProduct,
  isStrictlyOutOfStockProduct,
} from '@/lib/productAvailability';
import MarketSuggestionBlocks from '@/components/market/MarketSuggestionBlocks';

interface InlineProductDetailProps {
  product: StoreProduct;
  onBack: () => void;
  brandName?: string;
}

// Color name to hex mapping
const COLOR_HEX_MAP: Record<string, string> = {
  'Black': '#000000',
  'White': '#FFFFFF',
  'Navy': '#1E3A5F',
  'Indigo': '#4F46E5',
  'Red': '#DC2626',
  'Green': '#16A34A',
  'Yellow': '#EAB308',
  'Purple': '#9333EA',
  'Orange': '#EA580C',
  'Blue': '#2563EB',
  'Pink': '#EC4899',
  'Brown': '#92400E',
  'Gray': '#6B7280',
  'Burgundy': '#800020',
  'Teal': '#14B8A6',
  'Gold': '#D4AF37',
  'Black/Gold': 'linear-gradient(135deg, #000000 50%, #D4AF37 50%)',
  'Multi': 'linear-gradient(135deg, #EC4899, #8B5CF6, #3B82F6, #10B981)',
};

const resolveColorStyle = (color: string, colorHexCodes?: Record<string, string> | null) => {
  if (colorHexCodes?.[color]) return colorHexCodes[color];

  const normalizedColor = color.toLowerCase();
  const exactCustom = colorHexCodes
    ? Object.entries(colorHexCodes).find(([key]) => key.toLowerCase() === normalizedColor)?.[1]
    : null;
  if (exactCustom) return exactCustom;

  const partialCustom = colorHexCodes
    ? Object.entries(colorHexCodes).find(([key]) =>
        normalizedColor.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedColor),
      )?.[1]
    : null;
  if (partialCustom) return partialCustom;

  const exactPalette = Object.entries(COLOR_HEX_MAP).find(([key]) => key.toLowerCase() === normalizedColor)?.[1];
  if (exactPalette) return exactPalette;

  const partialPalette = Object.entries(COLOR_HEX_MAP).find(([key]) =>
    normalizedColor.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedColor),
  )?.[1];
  return partialPalette ?? '#9CA3AF';
};

export default function InlineProductDetail({
  product,
  onBack,
  brandName,
}: InlineProductDetailProps) {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const currentUser = useSelector((s: RootState) => s.user.profile);
  const { addStandard, bagProduct, beginCustomFlow, getPulseStatus, loadingByProductId } = useBagging();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [wishlistBusy, setWishlistBusy] = useState(false);
  const [measurementValues, setMeasurementValues] = useState<Record<string, string>>({});
  const [modalMeasurementValues, setModalMeasurementValues] = useState<Record<string, string>>({});
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [savingMeasurements, setSavingMeasurements] = useState(false);
  const [startingCustomOrder, setStartingCustomOrder] = useState(false);
  const [customOrderComposerOpen, setCustomOrderComposerOpen] = useState(false);
  /* QR disabled — only brand profile QR codes active for now */

  const sizingMode = useMemo(
    () => normalizeSizingMode(product.sizingMode),
    [product.sizingMode],
  );

  const isCustomOrderProduct =
    product.customAvailable === true || product.customOrderEnabled === true;
  const customOrderAvailability = useActiveCustomOrderConfiguration({
    sourceType: 'PRODUCT',
    sourceId: product.id,
    enabled: isCustomOrderProduct,
    unavailableReason:
      'This product is marked custom-order enabled, but it is not configured for custom bagging yet. Ask the brand to complete custom-order setup.',
  });

  const customOrderMeasurementKeys = useMemo(() => {
    if (customOrderAvailability.isLoading && isCustomOrderProduct) {
      return [];
    }
    if (!customOrderAvailability.configuration) {
      return null;
    }
    return customOrderAvailability.configuration.requiredMeasurementKeys.filter(
      (key): key is string => typeof key === 'string' && key.trim().length > 0,
    );
  }, [customOrderAvailability.configuration, customOrderAvailability.isLoading, isCustomOrderProduct]);

  const requiredMeasurementKeys = useMemo(() => {
    if (customOrderMeasurementKeys !== null) {
      return customOrderMeasurementKeys;
    }
    const raw = product.customMeasurementKeys;
    if (!Array.isArray(raw)) return [];
    return raw.filter((key): key is string => typeof key === 'string' && key.trim().length > 0);
  }, [customOrderMeasurementKeys, product.customMeasurementKeys]);

  const wishlistedIds = useSelector((s: RootState) => s.wishlist.wishlistedIds);
  const isWishlisted = wishlistedIds.has(product.id);

  useEffect(() => {
    setMeasurementValues({});
    setModalMeasurementValues({});
    setShowMeasurementModal(false);
  }, [product.id]);

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

        const hydrated: Record<string, string> = {};
        requiredMeasurementKeys.forEach((key) => {
          const raw = profileMeasurements[key];
          if (typeof raw === 'number' && Number.isFinite(raw)) {
            hydrated[key] = String(raw);
            return;
          }
          if (typeof raw === 'object' && raw && 'value' in (raw as Record<string, unknown>)) {
            const nested = (raw as { value?: unknown }).value;
            if (typeof nested === 'number' && Number.isFinite(nested)) {
              hydrated[key] = String(nested);
            }
          }
        });

        setMeasurementValues((prev) => ({ ...hydrated, ...prev }));
      } catch {
      }
    };

    void hydrateMeasurements();

    return () => {
      active = false;
    };
  }, [isAuth, requiredMeasurementKeys]);

  // Get product images
  const getProductImages = () => {
    const images: Array<{ id: string; url: string; type?: string; fileId?: string }> = [];
    
    // Add media items
    if (Array.isArray((product as any)?.media)) {
      const media = (product as any).media as Array<{ id?: string; url?: string; type?: string }>;
      media.forEach((m, idx) => {
        if (m.url) {
          const candidateId = typeof m.id === 'string' ? m.id.trim() : '';
          const looksLikeFileId =
            candidateId.length > 0 &&
            !candidateId.startsWith('img-') &&
            !candidateId.startsWith('thumb-') &&
            !candidateId.startsWith('media-') &&
            !candidateId.includes('/');
          images.push({
            id: m.id || `media-${idx}`,
            url: m.url,
            type: m.type,
            fileId: looksLikeFileId ? candidateId : undefined,
          });
        }
      });
    }
    
    // Fallback to thumbnail/images array
    if (images.length === 0) {
      if (product.thumbnail) {
        images.push({ id: 'thumb-0', url: product.thumbnail });
      }
      if (Array.isArray(product.images)) {
        product.images.forEach((img, idx) => {
          if (img && !images.some(i => i.url === img)) {
            images.push({ id: `img-${idx}`, url: img });
          }
        });
      }
    }
    
    return images;
  };

  const productImages = getProductImages();
  const currentImage = productImages[selectedImageIndex];

  const moveImage = (direction: -1 | 1) => {
    if (productImages.length <= 1) return;
    setSelectedImageIndex((prev) => {
      const next = prev + direction;
      if (next < 0) return productImages.length - 1;
      if (next >= productImages.length) return 0;
      return next;
    });
  };

  const formatCurrency = (price?: number | null) => {
    if (price === null || price === undefined) return '—';
    try {
      return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(price);
    } catch {
      return `₦${price.toLocaleString()}`;
    }
  };

  const sizes = useMemo(() => product.sizes || [], [product.sizes]);
  const colors = useMemo(() => product.colors || [], [product.colors]);
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const hasVariants = variants.length > 0;
  const inStockVariants = variants.filter((variant) => Number(variant.stock || 0) > 0);
  const isCustomOrderOnly = isCustomOrderOnlyProduct(product);
  const isStrictlyOutOfStock = isStrictlyOutOfStockProduct(product);
  const selectableVariants = isCustomOrderOnly ? variants : inStockVariants;
  const compareAtPrice = (product as any).compareAtPrice as number | undefined;
  const isOutOfStock = !product.totalStock || product.totalStock <= 0;
  const ownerCandidates = [
    product.brandId,
    product.brand?.id,
    (product as StoreProduct & { ownerId?: string }).ownerId,
    (product as StoreProduct & { brand?: { ownerId?: string } }).brand?.ownerId,
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
  const bagButtonLoading = Boolean(loadingByProductId[product.id]);
  const bagPulseStatus = getPulseStatus(product.id, isStrictlyOutOfStock || isOwnProduct);
  const customOrderUnavailableReason = customOrderAvailability.isAvailable
    ? null
    : customOrderAvailability.isLoading
      ? 'Checking custom-order availability...'
      : customOrderAvailability.unavailableReason ||
        'This product is not configured for custom orders yet. Ask the brand to complete custom-order setup.';
  const brandProfileId = useMemo(() => {
    const candidates = [product.brandId, product.brand?.id]
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean);
    return candidates[0] ?? null;
  }, [product.brand?.id, product.brandId]);

  const handleOpenBrandStore = () => {
    if (!brandProfileId) return;
    navigate(`/profile/${encodeURIComponent(brandProfileId)}?tab=Store`);
  };

  const availableSizes = useMemo(() => {
    if (!hasVariants) return sizes;
    const matches = selectedColor
      ? selectableVariants.filter((variant) => (variant.color || null) === selectedColor)
      : selectableVariants;
    return Array.from(
      new Set(
        matches
          .map((variant) => variant.size)
          .filter((size): size is string => typeof size === 'string' && size.length > 0),
      ),
    );
  }, [hasVariants, selectableVariants, selectedColor, sizes]);

  const availableColors = useMemo(() => {
    if (!hasVariants) return colors;
    const matches = selectedSize
      ? selectableVariants.filter((variant) => (variant.size || null) === selectedSize)
      : selectableVariants;
    return Array.from(
      new Set(
        matches
          .map((variant) => variant.color)
          .filter((color): color is string => typeof color === 'string' && color.length > 0),
      ),
    );
  }, [colors, hasVariants, selectableVariants, selectedSize]);

  useEffect(() => {
    if (!selectedSize) return;
    if (!availableSizes.includes(selectedSize)) {
      setSelectedSize(null);
    }
  }, [availableSizes, selectedSize]);

  useEffect(() => {
    if (!selectedColor) return;
    if (!availableColors.includes(selectedColor)) {
      setSelectedColor(null);
    }
  }, [availableColors, selectedColor]);

  const selectedVariant = useMemo(() => {
    if (!hasVariants) return null;
    if (!selectedSize || !selectedColor) return null;
    return selectableVariants.find(
      (variant) => (variant.size || null) === selectedSize && (variant.color || null) === selectedColor,
    ) ?? null;
  }, [hasVariants, selectableVariants, selectedColor, selectedSize]);

  const normalizeMeasurements = (values: Record<string, string>) => {
    return requiredMeasurementKeys.reduce((acc, key) => {
      const parsed = Number(values[key]);
      if (Number.isFinite(parsed) && parsed > 0) {
        acc[key] = { value: parsed, unit: 'CM' as const };
      }
      return acc;
    }, {} as Record<string, { value: number; unit: 'CM' }>);
  };

  const missingMeasurementKeys = requiredMeasurementKeys.filter((key) => {
    const parsed = Number(modalMeasurementValues[key]);
    return !(Number.isFinite(parsed) && parsed > 0);
  });

  const handleAddToBag = async () => {
    if (isOwnProduct) {
      toast.info('You cannot bag your own product.');
      return;
    }
    if (isStrictlyOutOfStock) {
      toast.error('This product is out of stock.');
      return;
    }

    const normalizedMeasurements = normalizeMeasurements(measurementValues);
    const result = await bagProduct(
      { id: product.id, name: product.name },
      {
        quantity: 1,
        size: selectedSize || undefined,
        color: selectedColor || undefined,
        sizingMode,
        requiredMeasurementKeys,
        sizeFitData:
          Object.keys(normalizedMeasurements).length > 0
            ? { measurements: normalizedMeasurements }
            : undefined,
      },
    );

    if (!result) return;

    if (result.action === 'OPEN_CUSTOM_FLOW' || result.action === 'OPEN_FITTINGS' || result.action === 'OPEN_SELECTOR') {
      return;
    }
  };

  const handleToggleWishlist = async () => {
    if (isOwnProduct) {
      toast.info('You cannot wishlist your own product.');
      return;
    }
    if (!isAuth) {
      toast.info('Please sign in to use wishlist.');
      return;
    }

    setWishlistBusy(true);
    try {
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
    const url = buildProductUrl({ id: product.id, slug: (product as StoreProduct & { slug?: string }).slug });
    await shareOrCopyLink({
      url,
      title: product.name,
      text: product.description || product.name,
      successMessage: 'Product link copied.',
      errorMessage: 'Unable to copy link.',
    });
  };

  const handleStartCustomOrder = async () => {
    if (isOwnProduct) {
      toast.info('You cannot start a custom order on your own product.');
      return;
    }
    if (startingCustomOrder) {
      return;
    }

    try {
      setStartingCustomOrder(true);
      await beginCustomFlow({ id: product.id, name: product.name });
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          'Unable to open custom-order checkout.',
      );
    } finally {
      setStartingCustomOrder(false);
    }
  };

  const handleModalSaveAndAdd = async () => {
    const normalized = normalizeMeasurements({
      ...measurementValues,
      ...modalMeasurementValues,
    });
    const missing = requiredMeasurementKeys.filter((key) => !normalized[key]);
    if (missing.length > 0) {
      toast.error(`Please fill in all ${missing.length} missing measurement(s)`);
      return;
    }
    if (hasVariants && !selectedVariant) {
      toast.warning('Please choose an available size and color combination.');
      return;
    }

    setSavingMeasurements(true);
    try {
      await SizeFitApi.updateProfile({ measurements: normalized });
      setMeasurementValues((prev) => ({
        ...prev,
        ...modalMeasurementValues,
      }));

      await addStandard(product.id, {
        quantity: 1,
        size: selectedSize || undefined,
        color: selectedColor || undefined,
        sizingMode,
        requiredMeasurementKeys,
        sizeFitData: { measurements: normalized },
      });

      setShowMeasurementModal(false);
      toast.success('Measurements saved and item bagged!');
    } catch (error: any) {
      toast.error(error || 'Failed to save measurements');
    } finally {
      setSavingMeasurements(false);
    }
  };

  return (
    <div className="w-full animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Back Button */}
      <button
        type="button"
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors group"
      >
        <span className="group-hover:-translate-x-1 transition-transform">⬅️</span>
        <span>Back to products</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image Gallery */}
        <div className="space-y-4">
          {/* Main Image */}
          <div 
            className="relative w-full overflow-hidden rounded-2xl cursor-zoom-in group"
            onClick={() => productImages.length > 0 && setLightboxOpen(true)}
          >
            {currentImage ? (
              <ImageWithFallback
                src={currentImage.url || undefined}
                fileId={currentImage.fileId}
                alt={product.name}
                fit="contain"
                maxHeightClassName=""
                className={CONTENT_DISPLAY_MEDIA_CLASS}
                containerClassName={`${CONTENT_DISPLAY_FRAME_CLASS} rounded-2xl`}
                rounded="xl"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-gray-400 text-lg">No image available</span>
              </div>
            )}

            {productImages.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    moveImage(-1);
                  }}
                  className="absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white/90 text-lg text-gray-900 shadow-lg backdrop-blur transition hover:scale-[1.03] dark:border-white/10 dark:bg-black/55 dark:text-white"
                  aria-label="Show previous image"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    moveImage(1);
                  }}
                  className="absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-black/10 bg-white/90 text-lg text-gray-900 shadow-lg backdrop-blur transition hover:scale-[1.03] dark:border-white/10 dark:bg-black/55 dark:text-white"
                  aria-label="Show next image"
                >
                  →
                </button>
              </>
            ) : null}
            
            {/* Zoom hint */}
            <div className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Click to zoom
            </div>
          </div>

          {/* Thumbnail Strip */}
          {productImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {productImages.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                    idx === selectedImageIndex
                      ? 'border-purple-500 ring-2 ring-purple-500/30'
                      : 'border-gray-200 dark:border-white/10 hover:border-purple-300'
                  }`}
                >
                  <ImageWithFallback
                    src={img.url || undefined}
                    fileId={img.fileId}
                    alt={`${product.name} - ${idx + 1}`}
                    fit="cover"
                    className="w-full h-full object-cover"
                    containerClassName="w-full h-full"
                    rounded="lg"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          {/* Header */}
          <div>
            {brandName && (
              brandProfileId ? (
                <button
                  type="button"
                  onClick={handleOpenBrandStore}
                  className="mb-1 text-sm font-medium text-purple-600 transition-colors hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                  title={`Open ${brandName} catalog`}
                >
                  {brandName}
                </button>
              ) : (
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-1">{brandName}</p>
              )
            )}
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">{product.name}</h1>
            {isCustomOrderProduct && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-purple-400/40 bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300">
                <span>✂️</span>
                <span>Custom Order</span>
                {requiredMeasurementKeys.length > 0 ? (
                  <span className="text-[11px] opacity-80">({requiredMeasurementKeys.length} points)</span>
                ) : null}
              </div>
            )}
            
            {/* Rating placeholder */}
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-0.5 text-sm" aria-label="4 out of 5 stars">⭐⭐⭐⭐☆</div>
              <span className="text-sm text-gray-500">(12 reviews)</span>
            </div>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {formatCurrency(product.price)}
            </span>
            {compareAtPrice && compareAtPrice > (product.price || 0) && (
              <span className="text-lg text-gray-400 line-through">{formatCurrency(compareAtPrice)}</span>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{product.description}</p>
          )}

          {/* Size Selection */}
          {sizes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Size</h3>
              <div className="flex flex-wrap gap-2">
                {sizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    disabled={hasVariants && !availableSizes.includes(size)}
                    onClick={() => setSelectedSize(size === selectedSize ? null : size)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      selectedSize === size
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300'
                        : hasVariants && !availableSizes.includes(size)
                          ? 'border-gray-200/60 dark:border-white/5 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-60'
                          : 'border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-purple-300'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color Selection */}
          {colors.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  Color {selectedColor && <span className="font-normal text-gray-500 dark:text-gray-400">— {selectedColor}</span>}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => {
                  const isAvailable = !hasVariants || availableColors.includes(color);
                  const colorStyle = resolveColorStyle(
                    color,
                    ((product as StoreProduct & { colorHexCodes?: Record<string, string> }).colorHexCodes) ?? null,
                  );
                  const isGradient = colorStyle.includes('gradient');
                  
                  return (
                    <button
                      key={color}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => setSelectedColor(color === selectedColor ? null : color)}
                      className={`w-10 h-10 rounded-full border-2 transition-all relative ${
                        selectedColor === color
                          ? 'border-purple-500 ring-2 ring-purple-500/30 scale-110'
                          : !isAvailable
                            ? 'border-gray-200/60 dark:border-gray-700/60 opacity-50 cursor-not-allowed'
                            : 'border-gray-200 dark:border-gray-700 hover:border-purple-400'
                      }`}
                      style={{
                        background: isGradient ? colorStyle : colorStyle,
                      }}
                      title={color}
                    >
                      {selectedColor === color && (
                        <span
                          className={`absolute inset-0 m-auto flex h-full w-full items-center justify-center text-sm ${color === 'White' || color === 'Yellow' ? 'text-gray-900' : 'text-white'}`}
                          aria-hidden="true"
                        >
                          ✅
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stock Info */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isCustomOrderOnly
                    ? 'bg-violet-500'
                    : !isOutOfStock
                      ? 'bg-green-500'
                      : 'bg-red-500'
                }`}
              />
              <span className="text-gray-600 dark:text-gray-400">
                {isCustomOrderOnly
                  ? 'Custom order only'
                  : !isOutOfStock
                    ? `${product.totalStock} in stock`
                    : 'Out of stock'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          {!isOwnProduct ? (
            <div className={`mb-3 grid gap-3 ${isCustomOrderProduct && !isCustomOrderOnly ? 'sm:grid-cols-2' : ''}`}>
              {isCustomOrderProduct ? (
                <span className="block w-full" title={customOrderUnavailableReason ?? undefined}>
                  <button
                    type="button"
                    onClick={() => {
                      void handleStartCustomOrder();
                    }}
                    disabled={startingCustomOrder || customOrderAvailability.isLoading || !customOrderAvailability.isAvailable}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-purple-300/60 bg-purple-50 text-sm font-semibold text-purple-700 transition-all hover:border-purple-400 hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-200 dark:hover:bg-purple-500/20"
                  >
                    <span aria-hidden="true">{BAG_IT_EMOJI}</span>
                    {startingCustomOrder ? 'Bagging as custom order...' : `Custom ${BAG_IT_LABEL}`}
                  </button>
                </span>
              ) : null}

              {!isCustomOrderOnly ? (
                <button
                  onClick={handleAddToBag}
                  disabled={isStrictlyOutOfStock || startingCustomOrder || bagButtonLoading}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:scale-100"
                >
                  <BagPulseIcon
                    status={bagPulseStatus}
                    context="detail"
                    size={32}
                    disabled={isStrictlyOutOfStock || startingCustomOrder || bagButtonLoading}
                  />
                  {bagButtonLoading ? 'Bagging...' : BAG_IT_LABEL}
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="flex gap-3 pt-4">
            {isOwnProduct ? (
              <div className="flex-1 flex items-center justify-center px-6 py-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm font-medium text-gray-600 dark:text-gray-300">
                Your product
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center px-6 py-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm font-medium text-gray-600 dark:text-gray-300">
                {isCustomOrderOnly ? 'Custom-order only' : 'Bag the item above to continue'}
              </div>
            )}
            {!isOwnProduct ? (
              <>
                <button
                  type="button"
                  onClick={handleToggleWishlist}
                  disabled={wishlistBusy}
                  className="w-12 h-12 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:text-pink-500 hover:border-pink-300 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                >
                  <span aria-hidden="true">{isWishlisted ? '❤️' : '🤍'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="w-12 h-12 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:text-purple-500 hover:border-purple-300 transition-all flex items-center justify-center"
                  aria-label="Share product"
                >
                  <span aria-hidden="true">🔗</span>
                </button>
              </>
            ) : null}
            {/* QR button disabled — only brand profile QR codes active */}
          </div>
        </div>
      </div>

      <MarketSuggestionBlocks
        context="PRODUCT_DETAIL"
        targetType="PRODUCT"
        targetId={product.id}
        className="pt-6"
      />

      {/* Lightbox */}
      {lightboxOpen && productImages.length > 0 && (
        <ImageLightbox
          images={productImages}
          currentIndex={selectedImageIndex}
          productName={product.name}
          onClose={() => setLightboxOpen(false)}
          onPrevious={() => setSelectedImageIndex((prev) => (prev === 0 ? productImages.length - 1 : prev - 1))}
          onNext={() => setSelectedImageIndex((prev) => (prev === productImages.length - 1 ? 0 : prev + 1))}
          onSelectIndex={setSelectedImageIndex}
        />
      )}

      <AnimatePresence>
        {showMeasurementModal && (
          <OverlayPortal>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1400] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                className="w-full max-w-md bg-white dark:bg-gray-950 rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10 bg-gradient-to-r from-purple-500/10 to-fuchsia-500/10 dark:from-purple-500/5 dark:to-fuchsia-500/5">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Measurements Required</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {missingMeasurementKeys.length} of {requiredMeasurementKeys.length} missing
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMeasurementModal(false)}
                    className="px-2 py-1 text-xs rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-500"
                  >
                    Close
                  </button>
                </div>

                <div className="px-5 py-4 max-h-[50vh] overflow-y-auto scrollbar-threadly-strong space-y-3">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    This product needs custom measurements. Add only the required points below to buy now.
                  </p>
                  {missingMeasurementKeys.map((key) => {
                    const isMissing = missingMeasurementKeys.includes(key);
                    return (
                      <label key={key} className="flex flex-col gap-1">
                        <span className={`text-xs font-medium ${isMissing ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                          {formatMeasurementLabel(key)}
                          {isMissing ? ' (required)' : ''}
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="0.1"
                          value={modalMeasurementValues[key] ?? ''}
                          onChange={(event) =>
                            setModalMeasurementValues((prev) => ({
                              ...prev,
                              [key]: event.target.value,
                            }))
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

                <div className="px-5 py-4 border-t border-black/10 dark:border-white/10 space-y-2.5">
                  <button
                    type="button"
                    onClick={handleModalSaveAndAdd}
                    disabled={savingMeasurements}
                    className="w-full py-3 rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50"
                  >
                    {savingMeasurements ? 'Saving...' : `${BAG_IT_EMOJI} Save Measurements & ${BAG_IT_LABEL}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMeasurementModal(false);
                      navigate('/settings?tab=fittings');
                    }}
                    className="w-full py-2.5 rounded-full border border-black/10 dark:border-white/15 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    📏 Go to My Fittings
                  </button>
                </div>
              </motion.div>
            </motion.div>
          </OverlayPortal>
        )}
      </AnimatePresence>

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

      {/* Product QR modal disabled — only brand profile QR codes active */}
    </div>
  );
}
