import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/store';
import { addToCart, openCartDrawer } from '@/features/cartSlice';
import { addToWishlist, removeFromWishlist } from '@/features/wishlistSlice';
import { brandApi } from '@/api/BrandApi';
import { toast } from 'sonner';
import MediaRenderer from '@/components/media/MediaRenderer';
import type { SizingMode } from '@/types/sizing';
import {
  getProductStockState,
  isCustomOrderOnlyProduct,
  isStrictlyOutOfStockProduct,
} from '@/lib/productAvailability';

export interface StoreProduct {
  id: string;
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
  media?: Array<{ id: string; url: string; type: string; isPrimary?: boolean }>;
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
const MEDIA_MAX_HEIGHT_CLASS = 'max-h-[320px]';

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

export const StoreProductCard: React.FC<StoreProductCardProps> = ({
  product,
  onViewProduct,
  className = '',
  enableHoverGallery = false,
  onPreviewNavigationActiveChange,
  isOwnerView = false,
  onEdit,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const currentUser = useSelector((s: RootState) => s.user.profile);
  const wishlistedIds = useSelector((s: RootState) => s.wishlist.wishlistedIds);

  const [imgError, setImgError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [showCustomLabel, setShowCustomLabel] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [failedGalleryKeys, setFailedGalleryKeys] = useState<string[]>([]);
  const [resolvedGalleryImages, setResolvedGalleryImages] = useState<ResolvedGalleryImage[]>([]);
  const [activeImage, setActiveImage] = useState<ResolvedGalleryImage | null>(null);

  const isOwnProduct = Boolean(currentUser?.id && product.brandId === currentUser.id);
  const redHeartEmoji = String.fromCodePoint(0x2764, 0xfe0f);
  const whiteHeartEmoji = String.fromCodePoint(0x1f90d);
  const isCustomAvailable =
    product.customAvailable === true || product.customOrderEnabled === true;
  const isCustomOrderOnly = isCustomOrderOnlyProduct(product);
  const isStrictlyOutOfStock = isStrictlyOutOfStockProduct(product);
  const stockState = getProductStockState(product);
  const ownerStatus = (() => {
    if (!isOwnerView) return null;
    if (product.deletedAt) {
      return { emoji: '🗑️', label: 'Deleted', className: 'bg-rose-500/90 text-white' };
    }
    if (product.archivedAt) {
      return { emoji: '📦', label: 'Archived', className: 'bg-gray-500/90 text-white' };
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

  const handleQuickAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation();
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

    const requiresMeasuredBagFlow =
      product.sizingMode === 'RTW_PLUS_FITTINGS' &&
      Array.isArray(product.customMeasurementKeys) &&
      product.customMeasurementKeys.length > 0;

    if (
      product.sizes.length > 0 ||
      product.colors.length > 0 ||
      requiresMeasuredBagFlow ||
      isCustomAvailable
    ) {
      onViewProduct?.(product);
      return;
    }

    setCartLoading(true);
    try {
      await dispatch(addToCart({ productId: product.id, quantity: 1 })).unwrap();
      dispatch(openCartDrawer());
      toast.success('Bagged!');
    } catch (error: any) {
      toast.error(error || 'Failed to bag item');
    } finally {
      setCartLoading(false);
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
      fileId:
        typeof primaryMedia?.id === 'string' && !primaryMedia.id.startsWith('http')
          ? primaryMedia.id
          : undefined,
      url: primaryMedia?.url || product.thumbnail || product.images[0] || null,
    });

    appendSource({
      fileId:
        typeof secondaryMedia?.id === 'string' && !secondaryMedia.id.startsWith('http')
          ? secondaryMedia.id
          : undefined,
      url: secondaryMedia?.url || (product.images.length > 1 ? product.images[1] : null),
    });

    product.media?.forEach((item) => {
      appendSource({
        fileId:
          typeof item.id === 'string' && !item.id.startsWith('http')
            ? item.id
            : undefined,
        url: item.url,
      });
    });

    product.mediaIds?.forEach((mediaId) => {
      if (typeof mediaId === 'string' && mediaId.trim().length > 0) {
        appendSource({ fileId: mediaId });
      }
    });

    product.images.forEach((imageUrl) => {
      appendSource({ url: imageUrl });
    });

    return sources.slice(0, MAX_GALLERY_ITEMS);
  }, [product.images, product.media, product.mediaIds, product.thumbnail]);

  useEffect(() => {
    let alive = true;

    const resolveImages = async () => {
      if (gallerySources.length === 0) {
        setResolvedGalleryImages([]);
        return;
      }

      const resolved = await Promise.all(
        gallerySources.map(async (source) => {
          if (source.fileId) {
            try {
              const signed = await brandApi.getSignedFileUrl(source.fileId);
              if (signed) {
                return signed;
              }
            } catch {
            }
          }

          if (source.url && source.url.includes('.s3.') && !source.url.includes('?')) {
            try {
              const signed = await brandApi.getSignedS3Url(source.url);
              if (signed) {
                return signed;
              }
            } catch {
            }
          }

          return source.url ?? null;
        }),
      );

      if (!alive) return;

      setResolvedGalleryImages(
        resolved.reduce<ResolvedGalleryImage[]>((acc, candidate, index) => {
          if (!candidate) return acc;
          const source = gallerySources[index];
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
  }, [gallerySources]);

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

  return (
    <article
      className={`
        group relative cursor-pointer overflow-hidden rounded-2xl
        bg-transparent shadow-sm transition-all duration-300 ease-out hover:shadow-lg
        ${className}
      `}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        onPreviewNavigationActiveChange?.(false);
      }}
    >
      <div
        className="relative overflow-hidden bg-transparent"
        style={activeImage?.url ? undefined : { minHeight: 240 }}
      >
        {hasDisplayImage && !activeImage?.url && !imgError ? (
          <div className="absolute inset-0 animate-pulse">
            <div className="h-full min-h-[240px] w-full bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 dark:from-zinc-900/60 dark:via-zinc-800/50 dark:to-zinc-900/60" />
          </div>
        ) : null}

        {!imgError && activeImage?.url ? (
          <MediaRenderer
            kind="image"
            src={activeImage.url}
            alt={product.name}
            fit="contain"
            className={`block w-full transition-transform duration-500 ease-out ${isHovered ? 'scale-[1.02]' : 'scale-100'}`}
            mediaClassName="block h-auto w-full object-contain"
            maxHeightClassName={MEDIA_MAX_HEIGHT_CLASS}
            maxWidthClassName="max-w-full"
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
        ) : (
          <div className="flex min-h-[240px] flex-col items-center justify-center bg-transparent">
            <span className="mb-1.5 text-3xl">🖼️</span>
            <span className="text-xs text-gray-400 dark:text-zinc-500">No image</span>
          </div>
        )}

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

        <div className="absolute left-2.5 top-2.5 z-10 flex flex-col gap-1.5">
          {ownerStatus ? (
            <span
              className="group/badge relative cursor-default text-base leading-none drop-shadow-md"
              title={ownerStatus.label}
            >
              {ownerStatus.emoji}
              <span className="pointer-events-none absolute left-full top-1/2 ml-1.5 -translate-y-1/2 whitespace-nowrap rounded bg-gray-900/90 px-2 py-0.5 text-[10px] font-semibold text-white opacity-0 transition-opacity group-hover/badge:opacity-100">
                {ownerStatus.label}
              </span>
            </span>
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
          <div
            className={`
              absolute inset-0 z-20 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-all duration-300
              ${isHovered ? 'opacity-100' : 'opacity-0'}
            `}
          >
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onEdit?.(product);
              }}
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 shadow-xl transition-all hover:bg-gray-100 active:scale-95"
            >
              Edit Product
            </button>
          </div>
        ) : null}

        {isStrictlyOutOfStock ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 backdrop-blur-[2px] dark:bg-black/60">
            <span className="rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-xl dark:bg-white dark:text-gray-900">
              Sold Out
            </span>
          </div>
        ) : null}

        {isCustomOrderOnly ? (
          <div className="absolute inset-x-0 top-4 z-20 flex justify-center px-4">
            <span className="rounded-full bg-violet-600/90 px-3 py-1 text-xs font-semibold text-white shadow-xl backdrop-blur-sm">
              ✂️ Custom order only
            </span>
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/82 via-black/42 to-transparent px-4 pb-4 pt-16">
          <h3 className="line-clamp-1 text-sm font-semibold leading-snug text-white drop-shadow-sm">
            {product.name}
          </h3>

          <p className="mt-0.5 line-clamp-1 text-[11px] text-white/70">
            {product.brand.name}
          </p>

          <div className="mt-1.5 flex items-center justify-between">
            <div className="flex items-baseline gap-1.5">
              <span className={`text-sm font-bold drop-shadow-sm ${product.isOnSale ? 'text-rose-300' : 'text-white'}`}>
                {formatPrice(product.effectivePrice, product.brand.currency)}
              </span>
              {product.isOnSale && product.salePrice ? (
                <span className="text-[11px] text-white/50 line-through">
                  {formatPrice(product.price, product.brand.currency)}
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-1">
              {isCustomAvailable ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowCustomLabel((prev) => !prev);
                  }}
                  onMouseEnter={() => setShowCustomLabel(true)}
                  onMouseLeave={() => setShowCustomLabel(false)}
                  onFocus={() => setShowCustomLabel(true)}
                  onBlur={() => setShowCustomLabel(false)}
                  className="inline-flex items-center gap-1 rounded-full bg-purple-500/80 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm backdrop-blur-sm"
                  aria-label="Custom available"
                  title="Custom available"
                >
                  <span role="img" aria-hidden="true">{String.fromCodePoint(0x2702, 0xfe0f)}</span>
                  {showCustomLabel ? <span>Custom</span> : null}
                </button>
              ) : null}

              {!isOwnerView ? (
                <button
                  type="button"
                  onClick={handleQuickAddToCart}
                  disabled={cartLoading || isStrictlyOutOfStock || isOwnProduct}
                  title={
                    isOwnProduct
                      ? 'Brands cannot bag their own products'
                      : isStrictlyOutOfStock
                        ? 'Item is out of stock'
                        : isCustomOrderOnly
                          ? 'Bag as a custom order'
                          : 'Bag it'
                  }
                  className={`
                    flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200
                    ${isStrictlyOutOfStock || isOwnProduct ? 'cursor-not-allowed text-white/30' : 'text-white/80 hover:bg-white/15 hover:text-white active:scale-95'}
                    ${cartLoading ? 'cursor-wait opacity-70' : ''}
                  `}
                >
                  <span role="img" aria-hidden="true" className="text-sm leading-none">
                    🛍️
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-2 text-[10px] text-white/50">
                  <span className="inline-flex items-center gap-0.5">
                    <span role="img" aria-hidden="true">👁️</span>
                    {product.viewsCount}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

export default StoreProductCard;
