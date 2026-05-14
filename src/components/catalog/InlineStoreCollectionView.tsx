/**
 * InlineStoreCollectionView
 *
 * End-user view of a store collection, rendered inline within CatalogShopTab.
 * Shows collection header, product grid, gallery, and "Add All to Cart".
 *
 * Supports product drill-down via the `onViewProduct` callback which
 * lets CatalogShopTab render InlineProductDetail for a specific product.
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ArrowLeft, ShoppingCart, Grid3X3, Images, Package, ChevronRight } from 'lucide-react';
import { brandApi } from '@/api/BrandApi';
import { toast } from 'sonner';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/store';
import { addToCart, openCartDrawer } from '@/features/cartSlice';
import { getCollectionCartPreview, type CollectionCartPreviewResponse } from '@/api/collectionUploads';
import { CollectionCartPreviewModal } from '@/components/collections/CollectionCartPreviewModal';
import StoreProductCard, { type StoreProduct } from '@/components/designs/StoreProductCard';
import ImageWithFallback from '@/components/ImageWithFallback';
import ImageLightbox from './ImageLightbox';
import { useNavigate } from 'react-router-dom';
import { normalizeSizingMode, type SizingMode } from '@/types/sizing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CollectionProduct {
  id: string;
  name: string;
  price: number;
  salePrice?: number | null;
  saleStartAt?: string | null;
  saleEndAt?: string | null;
  images: string[];
  thumbnail?: string | null;
  sizes: string[];
  sizingMode?: SizingMode;
  customMeasurementKeys?: string[];
  customAvailable?: boolean;
  colors: string[];
  hasVariants: boolean;
  totalStock: number;
  orderIndex: number;
}

interface InlineStoreCollectionViewProps {
  collectionId: string;
  onBack: () => void;
  /** Called when user clicks a product to view details. */
  onViewProduct: (product: StoreProduct) => void;
  brandName?: string;
  brandId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const formatPrice = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `₦${Math.round(value).toLocaleString()}`;
  }
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const InlineStoreCollectionView: React.FC<InlineStoreCollectionViewProps> = ({
  collectionId,
  onBack,
  onViewProduct,
  brandName,
  brandId,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);

  // Gallery state
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'products' | 'gallery'>('products');

  // Cart preview
  const [addingAll, setAddingAll] = useState(false);
  const [showCartPreview, setShowCartPreview] = useState(false);
  const [cartPreviewData, setCartPreviewData] = useState<CollectionCartPreviewResponse | null>(null);

  // -----------------------------------------------------------------------
  // Fetch collection detail
  // -----------------------------------------------------------------------
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      if (!collectionId) return;
      setLoading(true);
      setNotFound(false);
      setDetail(null);
      try {
        const d = await brandApi.getCollectionDetail(collectionId, { scope: 'store' });
        if (!mounted) return;
        if (d) {
          setDetail(d);
        } else {
          setNotFound(true);
        }
      } catch (e: any) {
        if (mounted) {
          const status = e?.response?.status;
          if (status === 404 || status === 410) {
            setNotFound(true);
          } else {
            toast.error('Failed to load collection');
            onBack();
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void run();
    return () => { mounted = false; };
  }, [collectionId, onBack]);

  // -----------------------------------------------------------------------
  // Parse products from collection detail
  // -----------------------------------------------------------------------
  const products: CollectionProduct[] = useMemo(() => {
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
          sizingMode: normalizeSizingMode(p.sizingMode),
          customMeasurementKeys: Array.isArray(p.customMeasurementKeys)
            ? p.customMeasurementKeys
            : [],
          customAvailable:
            typeof p.customAvailable === 'boolean'
              ? p.customAvailable
              : false,
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

  // Map to StoreProduct for reuse with StoreProductCard
  const storeProducts: StoreProduct[] = useMemo(() => {
    return products.map((p) => {
      const now = Date.now();
      const onSale =
        p.salePrice != null &&
        (!p.saleStartAt || new Date(p.saleStartAt).getTime() <= now) &&
        (!p.saleEndAt || new Date(p.saleEndAt).getTime() >= now);
      const effectivePrice = onSale && p.salePrice != null ? p.salePrice : p.price;
      const discountPercent = onSale && p.salePrice != null
        ? Math.round(((p.price - p.salePrice) / p.price) * 100)
        : null;
      return {
        id: p.id,
        collectionId: collectionId,
        brandId: brandId ?? detail?.ownerId ?? '',
        name: p.name,
        price: p.price,
        salePrice: p.salePrice,
        effectivePrice,
        isOnSale: onSale,
        discountPercent,
        thumbnail: p.thumbnail ?? (p.images.length > 0 ? p.images[0] : undefined),
        images: p.images,
        sizes: p.sizes,
        sizingMode: p.sizingMode,
        customMeasurementKeys: p.customMeasurementKeys,
        customAvailable: p.customAvailable,
        sizeAvailability: p.sizes.map((s) => ({ size: s, inStock: true, quantity: 1 })),
        colors: p.colors,
        totalStock: p.totalStock,
        isLowStock: p.totalStock > 0 && p.totalStock <= 5,
        isOutOfStock: p.totalStock === 0,
        isFeatured: false,
        threadsCount: 0,
        viewsCount: 0,
        brand: {
          id: brandId ?? detail?.ownerId ?? '',
          name: brandName ?? detail?.owner?.brandFullName ?? 'Brand',
          logo: detail?.owner?.profileImage ?? undefined,
          currency: 'NGN',
        },
      } as StoreProduct;
    });
  }, [products, collectionId, brandId, brandName, detail]);

  // All product images combined for the gallery
  const allGalleryImages = useMemo(() => {
    const images: Array<{ id: string; url: string; label: string }> = [];
    for (const p of products) {
      if (p.thumbnail) {
        images.push({ id: `${p.id}-thumb`, url: p.thumbnail, label: p.name });
      }
      for (let i = 0; i < p.images.length; i++) {
        const url = p.images[i];
        if (url && url !== p.thumbnail) {
          images.push({ id: `${p.id}-img-${i}`, url, label: p.name });
        }
      }
    }
    return images;
  }, [products]);

  // -----------------------------------------------------------------------
  // Cart actions
  // -----------------------------------------------------------------------
  const handleAddAllToCart = useCallback(async () => {
    if (!isAuth) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
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
  }, [isAuth, collectionId, navigate]);

  const handleCartPreviewConfirm = useCallback(
    async (selections: Array<{ productId: string; quantity: number; variantSize?: string; variantColor?: string }>) => {
      setAddingAll(true);
      try {
        const results = await Promise.all(
          selections.map((s) =>
            dispatch(
              addToCart({
                productId: s.productId,
                quantity: s.quantity,
                selectedSize: s.variantSize,
                selectedColor: s.variantColor,
              }),
            )
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
          toast.error('Some items could not be added');
        }
        setShowCartPreview(false);
      } finally {
        setAddingAll(false);
      }
    },
    [dispatch],
  );

  // -----------------------------------------------------------------------
  // Price range
  // -----------------------------------------------------------------------
  const priceRange = useMemo(() => {
    if (products.length === 0) return null;
    const now = Date.now();
    const prices = products
      .map((p) => {
        const onSale =
          p.salePrice != null &&
          (!p.saleStartAt || new Date(p.saleStartAt).getTime() <= now) &&
          (!p.saleEndAt || new Date(p.saleEndAt).getTime() >= now);
        return onSale && p.salePrice != null ? p.salePrice : p.price;
      })
      .filter((n) => Number.isFinite(n));
    if (prices.length === 0) return null;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    return { min, max };
  }, [products]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-6 w-40 bg-gray-200 dark:bg-gray-800 rounded-lg" />
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-800 rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-gray-200 dark:bg-gray-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (notFound || !detail) {
    return (
      <div className="text-center py-16">
        <Package className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
        <p className="text-gray-500 dark:text-gray-400 mb-4">Collection not found</p>
        <button
          onClick={onBack}
          className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 font-medium text-sm"
        >
          ← Back to store
        </button>
      </div>
    );
  }

  const title = detail.title || detail.name || 'Collection';
  const description = detail.description || null;
  const tags: string[] = Array.isArray(detail.tags) ? detail.tags : [];

  return (
    <div className="space-y-5">
      {/* ============ Breadcrumb / Back ============ */}
      <nav className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 hover:text-purple-600 dark:hover:text-purple-400 transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Store
        </button>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        <span className="font-semibold text-gray-900 dark:text-white truncate max-w-[200px]">
          {title}
        </span>
      </nav>

      {/* ============ Collection Header ============ */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
              {title}
            </h2>
            {description && (
              <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300 line-clamp-3">
                {description}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1">
                <Package className="w-3.5 h-3.5" />
                {products.length} product{products.length === 1 ? '' : 's'}
              </span>
              {priceRange && (
                <span className="text-gray-900 dark:text-white font-semibold">
                  {priceRange.min === priceRange.max
                    ? formatPrice(priceRange.min)
                    : `${formatPrice(priceRange.min)} – ${formatPrice(priceRange.max)}`}
                </span>
              )}
            </div>
            {tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tags.slice(0, 6).map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-[11px] font-medium text-gray-600 dark:text-gray-300"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {products.length > 0 && (
              <button
                type="button"
                onClick={handleAddAllToCart}
                disabled={addingAll}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-60"
              >
                <ShoppingCart className="w-4 h-4" />
                {addingAll ? 'Loading…' : 'Add All to Bag'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============ View Toggle ============ */}
      {allGalleryImages.length > 0 && (
        <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700/50">
          <button
            type="button"
            onClick={() => setViewMode('products')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              viewMode === 'products'
                ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
            Products
          </button>
          <button
            type="button"
            onClick={() => setViewMode('gallery')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              viewMode === 'gallery'
                ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Images className="w-4 h-4" />
            Gallery
          </button>
        </div>
      )}

      {/* ============ Gallery View ============ */}
      {viewMode === 'gallery' && allGalleryImages.length > 0 && (
        <div className="columns-2 sm:columns-3 md:columns-4 gap-3 space-y-3">
          {allGalleryImages.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              onClick={() => {
                setGalleryIndex(idx);
                setGalleryOpen(true);
              }}
              className="group block w-full break-inside-avoid overflow-hidden rounded-xl transition-shadow hover:shadow-lg cursor-zoom-in"
            >
              <ImageWithFallback
                src={img.url}
                alt={img.label}
                fit="contain"
                className="block w-full h-auto max-w-full transition-transform duration-300 group-hover:scale-[1.03]"
                containerClassName="w-full"
                rounded="xl"
              />
            </button>
          ))}
        </div>
      )}

      {/* ============ Product Grid ============ */}
      {viewMode === 'products' && (
        <>
          {products.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                This collection doesn't have any products yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
              {storeProducts.map((p) => (
                <StoreProductCard
                  key={p.id}
                  product={p}
                  onViewProduct={onViewProduct}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ============ Lightbox ============ */}
      {galleryOpen && allGalleryImages.length > 0 && (
        <ImageLightbox
          images={allGalleryImages.map((img) => ({
            id: img.id,
            url: img.url,
            type: 'image' as const,
          }))}
          currentIndex={galleryIndex}
          productName={title}
          onClose={() => setGalleryOpen(false)}
          onPrevious={() => setGalleryIndex((prev) => (prev - 1 + allGalleryImages.length) % allGalleryImages.length)}
          onNext={() => setGalleryIndex((prev) => (prev + 1) % allGalleryImages.length)}
          onSelectIndex={setGalleryIndex}
        />
      )}

      {/* ============ Cart Preview Modal ============ */}
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
    </div>
  );
};

export default InlineStoreCollectionView;
