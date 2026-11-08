import { isStorageProviderUrl } from '@/utils/mediaUrlPolicy';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/store';
import { addToWishlist, removeFromWishlist } from '@/features/wishlistSlice';
import { brandApi } from '@/api/BrandApi';
import { toast } from 'sonner';
import type { SizingMode } from '@/types/sizing';
import type { CatalogEntityType } from '@/constants/catalogDomain';
import { PriceEstimate } from '@/currency/PriceEstimate';
import { useBagging } from '@/hooks/useBagging';
import { BAG_IT_LABEL } from '@/constants/bagging';
import { CustomOrderIndicator } from '@/components/custom-orders/CustomOrderIndicator';
import {
  getProductStockState,
  isCustomOrderOnlyProduct,
  isStrictlyOutOfStockProduct,
} from '@/lib/productAvailability';
import MediaRenderer from '@/components/media/MediaRenderer';
import {
  getContentStatusLabel,
  getContentStatusTone,
  type ContentPublicationStatus,
} from '@/utils/contentIntegrity';
import { DeferredOverlay } from '@/components/ui/DeferredOverlay';
import {
  BagItButton,
  PRODUCT_TILE_IMAGE_CLASS,
  ProductTile,
} from '@/components/commerce/ProductTile';
const ContentReviewDecisionModal = React.lazy(() => import('@/components/content-integrity/ContentReviewDecisionModal'));

export interface StoreProduct {
  id: string;
  entityType?: CatalogEntityType;
  collectionId: string;
  brandId: string;
  name: string;
  description?: string;
  price: number;
  salePrice?: number | null;
  effectivePrice: number;
  isOnSale: boolean;
  discountPercent?: number | null;
  thumbnail?: string;
  images: string[];
  media?: Array<{
    id: string;
    fileUploadId?: string | null;
    url: string;
    type: string;
    isPrimary?: boolean;
    width?: number | null;
    height?: number | null;
    aspectRatio?: number | null;
  }>;
  mediaIds?: string[];
  sizes: string[];
  sizingMode?: SizingMode;
  customMeasurementKeys?: string[];
  customAvailable?: boolean;
  customOrderEnabled?: boolean;
  isCustomOrderOnly?: boolean;
  canBagWhenOutOfStock?: boolean;
  sizeAvailability: { size: string; inStock: boolean; quantity: number }[];
  colors: string[];
  variants?: Array<{
    id: string;
    size: string | null;
    color: string | null;
    stock: number;
    price?: number | null;
    sku?: string | null;
    colorHex?: string | null;
  }>;
  totalStock: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  isFeatured: boolean;
  isActive?: boolean;
  publicationStatus?: ContentPublicationStatus | string | null;
  reviewMode?: string | null;
  submissionId?: string | null;
  archivedAt?: string | null;
  deletedAt?: string | null;
  publishAt?: string | null;
  threadsCount: number;
  viewsCount: number;
  brand: {
    id: string;
    name: string;
    logo?: string;
    currency: string;
  };
}

interface StoreProductCardProps {
  product: StoreProduct;
  onViewProduct?: (product: StoreProduct) => void;
  isWishlisted?: boolean;
  className?: string;
  enableHoverGallery?: boolean;
  onPreviewNavigationActiveChange?: (active: boolean) => void;
  isOwnerView?: boolean;
  onEdit?: (product: StoreProduct) => void;
  /** First-row / LCP cards: eager + high fetch priority. Default lazy. */
  priority?: boolean;
}

type GallerySource = {
  key: string;
  fileId?: string;
  url?: string | null;
};

type ResolvedGalleryImage = {
  key: string;
  url: string;
};

const MAX_GALLERY_ITEMS = 6;

const normalizeGalleryUrl = (value?: string | null) => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return raw.split('?')[0] || raw;
  }
};

/**
 * Turn one gallery source into a URL the browser can load.
 *
 * Every lookup goes through `brandApi`'s signed-URL cache, which also folds
 * concurrent requests for the same source into one, so a product shown in
 * three rails at once still costs one request.
 */
const resolveGallerySource = async (source: GallerySource): Promise<string | null> => {
  // Prefer signing raw R2 URLs by key first — this is the market/admin hot
  // path and does not require ownership of the FileUpload row.
  const rawUrl = source.url ?? '';
  const isUnsignedR2 = isStorageProviderUrl(rawUrl);
  const alreadySigned =
    rawUrl.includes('X-Amz-Signature') ||
    rawUrl.includes('X-Amz-Credential') ||
    rawUrl.includes('Signature=');

  if (rawUrl && isUnsignedR2 && !alreadySigned) {
    try {
      const signed = await brandApi.getSignedS3Url(rawUrl);
      if (signed) return signed;
    } catch {
      /* fall through */
    }
  }

  if (alreadySigned && rawUrl) {
    return rawUrl;
  }

  if (source.fileId) {
    try {
      const signed = await brandApi.getSignedFileUrl(source.fileId);
      if (signed) return signed;
    } catch {
      /* fall through */
    }
  }

  return source.url ?? null;
};

export const StoreProductCard: React.FC<StoreProductCardProps> = ({
  product,
  onViewProduct,
  className = '',
  enableHoverGallery = false,
  onPreviewNavigationActiveChange,
  isOwnerView = false,
  onEdit,
  priority = false,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const currentUser = useSelector((s: RootState) => s.user.profile);
  const wishlistedIds = useSelector((s: RootState) => s.wishlist.wishlistedIds);
  const { bagProduct, getPulseStatus, loadingByProductId } = useBagging();

  const [imgError, setImgError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  /**
   * Only the cover is fetched until someone hovers the card.
   *
   * Every card used to resolve up to six gallery images the moment it
   * mounted, although only the first is ever painted without a hover. A rail
   * of twelve cards therefore asked for up to seventy-two signed URLs to show
   * twelve pictures, and touch devices — which never hover — paid for all of
   * them. The rest of the gallery is now requested on the first hover.
   */
  const [galleryRequested, setGalleryRequested] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [failedGalleryKeys, setFailedGalleryKeys] = useState<string[]>([]);
  const [resolvedGalleryImages, setResolvedGalleryImages] = useState<ResolvedGalleryImage[]>([]);
  const [activeImage, setActiveImage] = useState<ResolvedGalleryImage | null>(null);
  const [reviewDecisionOpen, setReviewDecisionOpen] = useState(false);

  const isOwnProduct = Boolean(currentUser?.id && product.brandId === currentUser.id);
  const redHeartEmoji = String.fromCodePoint(0x2764, 0xfe0f);
  const whiteHeartEmoji = String.fromCodePoint(0x1f90d);
  const isCustomAvailable =
    product.customAvailable === true || product.customOrderEnabled === true;
  const isCustomOrderOnly = isCustomOrderOnlyProduct(product);
  const isStrictlyOutOfStock = isStrictlyOutOfStockProduct(product);
  const stockState = getProductStockState(product);
  const cartLoading = Boolean(loadingByProductId[product.id]);
  const pulseStatus = getPulseStatus(product.id, isStrictlyOutOfStock || isOwnProduct);
  // `getPulseStatus` already folds in brand accounts, sold-out and own
  // products, so the button can take its live/still state from it directly.
  const bagUnavailable = pulseStatus === 'disabled';
  const ownerStatus = (() => {
    if (!isOwnerView) return null;
    if (product.deletedAt) {
      return { emoji: '🗑️', label: 'Deleted', className: 'bg-rose-500/90 text-white' };
    }
    if (product.archivedAt) {
      return { emoji: '📦', label: 'Archived', className: 'bg-gray-500/90 text-white' };
    }
    const publicationStatus = String(product.publicationStatus ?? '').toUpperCase();
    if (
      publicationStatus === 'IN_REVIEW' ||
      publicationStatus === 'CHANGES_REQUESTED' ||
      publicationStatus === 'REJECTED' ||
      publicationStatus === 'FAILED'
    ) {
      return {
        emoji: publicationStatus === 'CHANGES_REQUESTED' ? '!' : publicationStatus === 'REJECTED' ? 'X' : 'R',
        label: getContentStatusLabel(publicationStatus),
        className: getContentStatusTone(publicationStatus),
      };
    }
    if (publicationStatus === 'DRAFT') {
      return { emoji: '📝', label: 'Draft', className: 'bg-amber-500/90 text-white' };
    }
    const publishAtTs = product.publishAt ? new Date(product.publishAt).getTime() : null;
    const isScheduled = typeof publishAtTs === 'number' && Number.isFinite(publishAtTs) && publishAtTs > Date.now();
    if (isScheduled) {
      return { emoji: '⏰', label: 'Scheduled', className: 'bg-sky-500/90 text-white' };
    }
    if (product.isActive === false) {
      return { emoji: '📝', label: 'Draft', className: 'bg-amber-500/90 text-white' };
    }
    return { emoji: '✅', label: 'Published', className: 'bg-emerald-500/90 text-white' };
  })();
  const productReviewStatus = String(product.publicationStatus ?? '').toUpperCase();
  const needsReviewDecision =
    isOwnerView &&
    (productReviewStatus === 'CHANGES_REQUESTED' ||
      productReviewStatus === 'REJECTED');

  const isProductWishlisted = wishlistedIds.has(product.id);

  const formatPrice = useCallback((price: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  }, []);

  const handleWishlistToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOwnProduct) {
      toast.info('Brands cannot add their own product to wishlist.');
      return;
    }
    if (!isAuth) {
      toast.info('Please sign in to use wishlist');
      return;
    }

    setWishlistLoading(true);
    try {
      if (isProductWishlisted) {
        await dispatch(removeFromWishlist(product.id)).unwrap();
        toast.success('Removed from wishlist');
      } else {
        await dispatch(addToWishlist(product.id)).unwrap();
        toast.success('Added to wishlist');
      }
    } catch (error: any) {
      toast.error(error || 'Failed to update wishlist');
    } finally {
      setWishlistLoading(false);
    }
  };

  const handleQuickAddToCart = async () => {
    // A second tap while the first request is in flight must not send a
    // second bag request; the button is also inert while busy.
    if (cartLoading) return;
    if (isOwnProduct) {
      toast.info('Brands cannot bag their own products.');
      return;
    }
    if (!isAuth) {
      toast.info('Please sign in to bag items');
      return;
    }

    if (isStrictlyOutOfStock) {
      toast.error('This product is out of stock');
      return;
    }

    try {
      await bagProduct({ id: product.id, name: product.name });
    } catch (error: any) {
      toast.error(error || 'Failed to bag item');
    }
  };

  const handleCardClick = () => {
    if (isOwnerView && onEdit) {
      onEdit(product);
    } else {
      onViewProduct?.(product);
    }
  };

  const gallerySources = useMemo(() => {
    const seen = new Set<string>();
    const sources: GallerySource[] = [];

    const resolveMediaFileId = (item?: {
      id?: string;
      fileUploadId?: string | null;
      url?: string | null;
    } | null) => {
      // Prefer FileUpload id — ProductMedia.id is a different table UUID and
      // causes the signed media endpoint to fail.
      const fromUpload =
        typeof item?.fileUploadId === 'string' ? item.fileUploadId.trim() : '';
      if (fromUpload) return fromUpload;
      return undefined;
    };

    const appendSource = (source: { fileId?: string; url?: string | null }) => {
      const fileId = typeof source.fileId === 'string' && source.fileId.trim().length > 0
        ? source.fileId.trim()
        : undefined;
      const normalizedUrl = normalizeGalleryUrl(source.url);
      const key = fileId ?? (normalizedUrl ? `url:${normalizedUrl}` : null);
      if (!key || seen.has(key)) {
        return;
      }

      seen.add(key);
      sources.push({
        key,
        fileId,
        url: source.url ?? normalizedUrl,
      });
    };

    const primaryMedia = product.media?.find((item) => item.isPrimary) ?? product.media?.[0];
    const secondaryMedia = product.media && product.media.length > 1
      ? product.media.find((item) => !item.isPrimary) ?? product.media[1]
      : undefined;

    appendSource({
      fileId: resolveMediaFileId(primaryMedia),
      url: primaryMedia?.url || product.thumbnail || product.images[0] || null,
    });

    appendSource({
      fileId: resolveMediaFileId(secondaryMedia),
      url: secondaryMedia?.url || (product.images.length > 1 ? product.images[1] : null),
    });

    product.media?.forEach((item) => {
      appendSource({ fileId: resolveMediaFileId(item), url: item.url });
    });

    // mediaIds are ProductMedia row ids, NOT FileUpload ids — do not pass them
    // to the signed media endpoint. Prefer URLs / fileUploadId from media slots above.

    product.images.forEach((imageUrl) => {
      appendSource({ url: imageUrl });
    });

    return sources.slice(0, MAX_GALLERY_ITEMS);
  }, [product.images, product.media, product.thumbnail]);

  const requestedSources = useMemo(
    () => (galleryRequested ? gallerySources : gallerySources.slice(0, 1)),
    [galleryRequested, gallerySources],
  );

  useEffect(() => {
    // `alive` drops a response that lands after the card has moved on to a
    // different product or a different source list, so a slow request for the
    // previous product can never paint over the current one.
    let alive = true;

    const resolveImages = async () => {
      if (requestedSources.length === 0) {
        setResolvedGalleryImages([]);
        return;
      }

      const resolved = await Promise.all(requestedSources.map(resolveGallerySource));

      if (!alive) return;

      setResolvedGalleryImages(
        resolved.reduce<ResolvedGalleryImage[]>((acc, candidate, index) => {
          if (!candidate) return acc;
          const source = requestedSources[index];
          if (!source || acc.some((entry) => entry.key === source.key)) {
            return acc;
          }
          acc.push({ key: source.key, url: candidate });
          return acc;
        }, []),
      );
    };

    void resolveImages();

    return () => {
      alive = false;
    };
  }, [requestedSources]);

  const galleryImages = useMemo(
    () => resolvedGalleryImages.filter((entry) => !failedGalleryKeys.includes(entry.key)),
    [failedGalleryKeys, resolvedGalleryImages],
  );

  const hoverGalleryEnabled = enableHoverGallery && galleryImages.length > 1;
  const safePreviewIndex =
    galleryImages.length > 0
      ? Math.min(previewIndex, galleryImages.length - 1)
      : 0;
  const desiredImage = hoverGalleryEnabled
    ? galleryImages[safePreviewIndex] ?? galleryImages[0] ?? null
    : isHovered && galleryImages[1]
      ? galleryImages[1]
      : galleryImages[0] ?? null;
  const hasDisplayImage = Boolean(activeImage?.url || desiredImage?.url);

  useEffect(() => {
    if (!isHovered || !hoverGalleryEnabled) {
      setPreviewIndex(0);
      onPreviewNavigationActiveChange?.(false);
    }
  }, [hoverGalleryEnabled, isHovered, onPreviewNavigationActiveChange]);

  useEffect(() => {
    let cancelled = false;

    if (!desiredImage?.url) {
      setActiveImage(null);
      setImgError(false);
      return;
    }

    if (activeImage?.key === desiredImage.key && activeImage.url === desiredImage.url) {
      setImgError(false);
      return;
    }

    setImgError(false);

    const preloader = new window.Image();
    preloader.decoding = 'async';
    preloader.onload = () => {
      if (cancelled) return;
      setActiveImage(desiredImage);
    };
    preloader.onerror = () => {
      if (cancelled) return;
      if (galleryImages.length > 1) {
        setFailedGalleryKeys((prev) => (
          prev.includes(desiredImage.key) ? prev : [...prev, desiredImage.key]
        ));
        return;
      }
      setActiveImage(null);
      setImgError(true);
    };
    preloader.src = desiredImage.url;

    return () => {
      cancelled = true;
      preloader.onload = null;
      preloader.onerror = null;
    };
  }, [activeImage?.key, activeImage?.url, desiredImage, galleryImages.length]);

  useEffect(() => {
    setFailedGalleryKeys([]);
    setResolvedGalleryImages([]);
    setPreviewIndex(0);
    setActiveImage(null);
    setImgError(false);
    setGalleryRequested(false);
  }, [product.id]);

  const movePreview = useCallback((direction: -1 | 1) => {
    if (!hoverGalleryEnabled) {
      return;
    }

    setPreviewIndex((current) => {
      const next = current + direction;
      if (next < 0) {
        return galleryImages.length - 1;
      }
      if (next >= galleryImages.length) {
        return 0;
      }
      return next;
    });
  }, [galleryImages.length, hoverGalleryEnabled]);

  const bagTitle = isOwnProduct
    ? 'Brands cannot bag their own products'
    : isStrictlyOutOfStock
      ? 'Item is out of stock'
      : isCustomOrderOnly
        ? 'Bag as a custom order'
        : BAG_IT_LABEL;

  return (
    <>
    <ProductTile.Root
      data-entity-type={product.entityType ?? 'PRODUCT'}
      data-card-branch="product"
      className={`cursor-pointer ${className}`}
      onClick={handleCardClick}
      onMouseEnter={() => {
        setIsHovered(true);
        if (gallerySources.length > 1) setGalleryRequested(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onPreviewNavigationActiveChange?.(false);
      }}
    >
      {/* The photograph owns the top of the card, edge to edge and at full
          colour. Nothing is laid across it except small corner controls; all
          reading copy sits in the body below. */}
      <ProductTile.Media>
        {hasDisplayImage && !activeImage?.url && !imgError ? (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 dark:from-zinc-900/60 dark:via-zinc-800/50 dark:to-zinc-900/60" />
        ) : null}

        {!imgError && activeImage?.url ? (
          <MediaRenderer
            kind="image"
            src={activeImage.url}
            alt={product.name}
            fit="cover"
            className="absolute inset-0 block h-full w-full max-w-full"
            mediaClassName={PRODUCT_TILE_IMAGE_CLASS}
            maxHeightClassName="max-h-none"
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'low'}
            onError={() => {
              setFailedGalleryKeys((prev) => (
                activeImage?.key && !prev.includes(activeImage.key)
                  ? [...prev, activeImage.key]
                  : prev
              ));
              setActiveImage(null);
              if (galleryImages.length <= 1) {
                setImgError(true);
              }
            }}
          />
        ) : !hasDisplayImage || imgError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="mb-1.5 text-3xl">🖼️</span>
            <span className="text-xs text-gray-400 dark:text-zinc-500">No image</span>
          </div>
        ) : null}

        {hoverGalleryEnabled && isHovered ? (
          <div
            className="absolute inset-x-3 top-1/2 z-20 flex -translate-y-1/2 items-center justify-between"
            onMouseEnter={() => onPreviewNavigationActiveChange?.(true)}
            onMouseLeave={() => onPreviewNavigationActiveChange?.(false)}
          >
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                movePreview(-1);
              }}
              onFocus={() => onPreviewNavigationActiveChange?.(true)}
              onBlur={() => onPreviewNavigationActiveChange?.(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-lg text-white shadow-lg backdrop-blur-sm transition hover:bg-black/70"
              aria-label="Show previous preview"
            >
              ←
            </button>
            <div className="rounded-full bg-black/45 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              {safePreviewIndex + 1}/{galleryImages.length}
            </div>
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                movePreview(1);
              }}
              onFocus={() => onPreviewNavigationActiveChange?.(true)}
              onBlur={() => onPreviewNavigationActiveChange?.(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-lg text-white shadow-lg backdrop-blur-sm transition hover:bg-black/70"
              aria-label="Show next preview"
            >
              →
            </button>
          </div>
        ) : null}

        <div className="absolute left-2.5 top-2.5 z-10 flex flex-col items-start gap-1.5">
          {ownerStatus ? (
            <button
              type="button"
              onClick={(event) => {
                if (!needsReviewDecision) return;
                event.preventDefault();
                event.stopPropagation();
                setReviewDecisionOpen(true);
              }}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none shadow-sm ${ownerStatus.className} ${needsReviewDecision ? 'cursor-pointer' : 'cursor-default'}`}
              title={needsReviewDecision ? 'View reviewer feedback' : ownerStatus.label}
            >
              {ownerStatus.emoji}
              <span>{ownerStatus.label}</span>
            </button>
          ) : null}
          {product.isOnSale && product.discountPercent ? (
            <span className="rounded-full bg-rose-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
              -{product.discountPercent}%
            </span>
          ) : null}
          {product.isLowStock && !isCustomOrderOnly && !product.isOutOfStock ? (
            <span className="group/badge relative cursor-default text-base leading-none drop-shadow-md" title="Low Stock">
              ⚠️
              <span className="pointer-events-none absolute left-full top-1/2 ml-1.5 -translate-y-1/2 whitespace-nowrap rounded bg-gray-900/90 px-2 py-0.5 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover/badge:opacity-100">
                Low Stock
              </span>
            </span>
          ) : null}
          {isOwnerView && stockState !== 'OUT_OF_STOCK' ? (
            <span
              className="group/badge relative cursor-default text-base leading-none drop-shadow-md"
              title={
                isCustomOrderOnly
                  ? 'Out of stock, but still baggable as a custom order'
                  : `${product.totalStock} in stock`
              }
            >
              {isCustomOrderOnly ? '✂️' : '📦'}
              <span className="pointer-events-none absolute left-full top-1/2 ml-1.5 -translate-y-1/2 whitespace-nowrap rounded bg-gray-900/90 px-2 py-0.5 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover/badge:opacity-100">
                {isCustomOrderOnly ? 'Custom order only' : `${product.totalStock} in stock`}
              </span>
            </span>
          ) : null}
        </div>

        {!isOwnerView ? (
          <button
            type="button"
            onClick={handleWishlistToggle}
            disabled={wishlistLoading || isOwnProduct}
            aria-label={isProductWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            title={
              isOwnProduct
                ? 'Brands cannot wishlist their own products'
                : isProductWishlisted
                  ? 'Remove from wishlist'
                  : 'Add to wishlist'
            }
            className={`
              absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 shadow-sm backdrop-blur-sm transition-all duration-200 ease-out dark:bg-black/40
              ${wishlistLoading || isOwnProduct ? 'cursor-not-allowed opacity-50' : 'active:scale-95 hover:scale-110'}
            `}
          >
            <span role="img" aria-hidden="true" className="text-sm leading-none">
              {isProductWishlisted ? redHeartEmoji : whiteHeartEmoji}
            </span>
          </button>
        ) : null}

        {product.isFeatured ? (
          <div className="absolute right-0 top-0 z-[5]">
            <div className="rounded-bl-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-white shadow-sm">
              Featured
            </div>
          </div>
        ) : null}

        {isOwnerView && onEdit ? (
          <div className="absolute inset-0 z-20 hidden items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 md:flex">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onEdit?.(product);
              }}
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 transition-all hover:bg-gray-100 active:scale-95 dark:bg-white/5 dark:text-white"
            >
              Edit Product
            </button>
          </div>
        ) : null}

        {isStrictlyOutOfStock ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-[2px] dark:bg-black/60">
            <span className="rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-gray-900">
              Sold Out
            </span>
          </div>
        ) : null}

        {isCustomOrderOnly ? (
          <div className="absolute inset-x-0 bottom-3 z-20 flex justify-center px-4">
            <CustomOrderIndicator
              pointsCount={product.customMeasurementKeys?.length}
              size="sm"
            />
          </div>
        ) : null}
      </ProductTile.Media>

      <ProductTile.Body>
        <div className="min-w-0">
          <ProductTile.Title>{product.name}</ProductTile.Title>
          <ProductTile.Meta className="mt-0.5">
            {isOwnerView ? (
              <span className="inline-flex items-center gap-1">
                <span role="img" aria-hidden="true">👁️</span>
                {product.viewsCount} views
              </span>
            ) : (
              <span className="truncate">{product.brand.name}</span>
            )}
          </ProductTile.Meta>

          <div className="mt-1 flex items-center justify-between gap-1.5">
            <ProductTile.Price
              price={formatPrice(product.effectivePrice, product.brand.currency)}
              compareAt={
                product.isOnSale && product.salePrice
                  ? formatPrice(product.price, product.brand.currency)
                  : null
              }
            />
            {isCustomAvailable ? (
              <CustomOrderIndicator
                pointsCount={product.customMeasurementKeys?.length}
                size="sm"
              />
            ) : null}
          </div>
          <PriceEstimate
            amount={product.effectivePrice}
            currency={product.brand.currency}
            className="text-[11px] text-gray-500 dark:text-zinc-400"
          />
        </div>

        {!isOwnerView ? (
          <div className="flex items-center pt-1.5">
            <BagItButton
              onClick={() => {
                void handleQuickAddToCart();
              }}
              busy={cartLoading}
              disabled={bagUnavailable}
              title={bagTitle}
            />
          </div>
        ) : onEdit ? (
          <div className="flex items-center pt-1.5">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onEdit(product);
              }}
              className="flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-800 transition-colors hover:bg-gray-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
            >
              <span aria-hidden="true">✏️</span>
              <span>Edit</span>
            </button>
          </div>
        ) : null}
      </ProductTile.Body>
    </ProductTile.Root>
    <DeferredOverlay open={reviewDecisionOpen}>
    <ContentReviewDecisionModal
      open={reviewDecisionOpen}
      onClose={() => setReviewDecisionOpen(false)}
      submissionId={product.submissionId}
      status={product.publicationStatus}
      title={product.name}
      onEdit={onEdit ? () => onEdit(product) : undefined}
    />
    </DeferredOverlay>
    </>
  );
};

export default StoreProductCard;
