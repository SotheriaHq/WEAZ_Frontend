import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  Heart, 
  Share2, 
  ShoppingBag, 
  ChevronDown, 
  Truck, 
  ShieldCheck,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/store';
import { addToCart, openCartDrawer } from '@/features/cartSlice';
// import { addToWishlist, removeFromWishlist } from '@/features/wishlistSlice';
import { productApi } from '@/api/ProductApi';
import type { ProductDto } from '@/api/ProductApi';
import MediaRenderer from '@/components/media/MediaRenderer';
import { formatPrice } from '@/utils/helpers';
import useSignedFileUrl from '@/hooks/useSignedFileUrl';

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
      mediaClassName="block h-auto w-auto"
      maxHeightClassName="max-h-[78vh]"
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
  const [product, setProduct] = useState<ProductDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  
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

  const currentMedia = mediaList[selectedMediaIndex];

  // Variants Logic
  const variants = useMemo(() => product?.variants || [], [product]);
  
  const colors = useMemo(() => {
    return Array.from(new Set(variants.map(v => v.color).filter(Boolean))) as string[];
  }, [variants]);

  const sizes = useMemo(() => {
    return Array.from(new Set(variants.map(v => v.size).filter(Boolean))) as string[];
  }, [variants]);

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

  const handleAddToCart = () => {
    if (!product) return;
    if (isOwnProduct || isStudioStoreView) {
      toast.info('You cannot add your own product to bag.');
      return;
    }
    
    // Find selected variant object
    const variant = variants.find(v => 
      (!selectedColor || v.color === selectedColor) && 
      (!selectedSize || v.size === selectedSize)
    );

    // If variants exist but none selected/found
    if (variants.length > 0 && (!variant)) {
       toast.error('Please select options');
       return;
    }

    dispatch(addToCart({
      productId: product.id,
      quantity: 1,
      selectedSize: variant?.size || selectedSize,
      selectedColor: variant?.color || selectedColor
    }));
    dispatch(openCartDrawer());
    toast.success('Added to bag');
  };

  const handleWishlist = () => {
    toast.success('Added to wishlist');
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: product.title,
          text: product.description || product.title,
          url,
        });
        return;
      } catch {
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Product link copied');
    } catch {
      toast.error('Unable to copy link');
    }
  };

  const currentVariant = variants.find(v => 
    (!selectedColor || v.color === selectedColor) && 
    (!selectedSize || v.size === selectedSize)
  );
  
  const isOutOfStock = variants.length > 0 ? (currentVariant?.stock === 0) : false;
  const isStudioStoreView = location.pathname.startsWith('/studio/store');
  const isOwnProduct = Boolean(
    currentUser?.id &&
    (product.brandId === currentUser.id || product.brand?.id === currentUser.id),
  );
  const showAddToBag = !isStudioStoreView && !isOwnProduct;
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

  return (
    <div className={`bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 ${isStudioStoreView ? 'min-h-0 pb-0' : 'min-h-screen pb-10'}`}>
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
            <div className="w-full flex items-start justify-center">
              {currentMedia ? (
                <SignedMediaItem
                  media={currentMedia}
                  alt={product.title}
                  className="w-full max-w-full"
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
                  </div>
                  <button
                    onClick={handleWishlist}
                    className="text-slate-500 hover:text-rose-500 transition-colors"
                    type="button"
                  >
                    <Heart size={20} />
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
                    <div className="font-semibold">{currentVariant?.stock ?? product.totalStock ?? product.stock ?? 0}</div>
                    <div>Stock</div>
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

                {(colors.length > 0 || sizes.length > 0) ? (
                  <div className="space-y-4 border-y border-black/10 dark:border-white/10 py-4">
                    {colors.length > 0 ? (
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Color</div>
                        <div className="flex flex-wrap gap-2">
                          {colors.map((color) => {
                            const isActive = selectedColor === color;
                            return (
                              <button
                                key={color}
                                onClick={() => setSelectedColor(color)}
                                type="button"
                                className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
                                  isActive
                                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-700 dark:text-emerald-200'
                                    : 'border-black/10 dark:border-white/15 text-slate-600 dark:text-slate-300 hover:border-emerald-500/60'
                                }`}
                              >
                                {color}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {sizes.length > 0 ? (
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Size</div>
                        <div className="flex flex-wrap gap-2">
                          {sizes.map((size) => {
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

                {showAddToBag ? (
                  <button
                    onClick={handleAddToCart}
                    disabled={isOutOfStock}
                    className={`w-full font-bold py-3.5 rounded-full transition-all flex items-center justify-center gap-2 ${
                      isOutOfStock
                        ? 'bg-slate-300 dark:bg-white/15 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-black'
                    }`}
                  >
                    <ShoppingBag size={18} />
                    {isOutOfStock ? 'Sold Out' : 'Add to Cart'}
                  </button>
                ) : (
                  <div className="rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                    This is your product. Customer checkout actions are hidden.
                  </div>
                )}

                <div className="text-center text-xs text-slate-500 dark:text-slate-400">Free shipping on eligible orders</div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleShare}
                    className="flex-1 h-10 rounded-full border border-black/10 dark:border-white/15 text-sm text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center gap-2"
                  >
                    <Share2 size={16} />
                    Share
                  </button>
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
    </div>
  );
}
