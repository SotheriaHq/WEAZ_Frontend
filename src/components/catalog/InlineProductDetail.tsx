import { useState, useMemo, useCallback } from 'react';
import { 
  ChevronRight, 
  Heart, 
  Share2, 
  ShoppingBag, 
  ChevronDown, 
  Truck, 
  RotateCcw,
  ArrowLeft,
  Star,
  Minus,
  Plus,
  ZoomIn
} from 'lucide-react';
import { toast } from 'sonner';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@/store';
import { addToCart, openCartDrawer } from '@/features/cartSlice';
import type { StoreProduct } from '@/components/designs/StoreProductCard';
import useSignedFileUrl from '@/hooks/useSignedFileUrl';
import MediaRenderer from '@/components/media/MediaRenderer';
import { formatPrice } from '@/utils/helpers';
import ImageLightbox from './ImageLightbox';

interface InlineProductDetailProps {
  product: StoreProduct;
  onBack: () => void;
  brandName?: string;
}

// Signed media component for proper URL handling
function SignedImage({ 
  media, 
  alt, 
  className,
  onClick,
  isActive,
  isThumbnail = false
}: { 
  media: { id: string; url: string; type?: string }; 
  alt: string;
  className?: string;
  onClick?: () => void;
  isActive?: boolean;
  isThumbnail?: boolean;
}) {
  const fileId = typeof media.id === 'string' && 
    !media.id.startsWith('img-') && 
    !media.id.startsWith('thumb-') 
    ? media.id 
    : undefined;
  const { url: signedUrl } = useSignedFileUrl(fileId, media.url);
  const resolvedSrc = typeof signedUrl === 'string' && signedUrl.trim().length > 0 ? signedUrl : null;

  if (isThumbnail) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`
          flex-shrink-0 w-20 h-20 lg:w-24 lg:h-24 rounded-xl overflow-hidden border-2 transition-all
          ${isActive 
            ? 'border-purple-600 dark:border-purple-400' 
            : 'border-transparent opacity-70 hover:opacity-100 hover:border-purple-300'}
        `}
      >
        {resolvedSrc ? (
          <img
            src={resolvedSrc}
            alt={alt}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-300">
            <ShoppingBag size={18} />
          </div>
        )}
      </button>
    );
  }

  if (!resolvedSrc) {
    return (
      <div className="w-full min-h-[220px] flex items-center justify-center text-gray-300 bg-gray-100 dark:bg-white/5 rounded-xl">
        <ShoppingBag size={28} />
      </div>
    );
  }

  return (
    <MediaRenderer
      kind="image"
      src={resolvedSrc}
      alt={alt}
      fit="contain"
      className={className}
      mediaClassName="rounded-2xl transition-transform duration-300 group-hover:scale-[1.02]"
      maxHeightClassName="max-h-[70vh]"
    />
  );
}

// Accordion section component
function AccordionSection({ 
  title, 
  children, 
  defaultOpen = false 
}: { 
  title: string; 
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-200 dark:border-white/10">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex justify-between items-center w-full py-3 text-left hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-900 dark:text-white">{title}</span>
        <ChevronDown 
          size={18} 
          className={`text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 pb-4' : 'max-h-0'}`}>
        <div className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function InlineProductDetail({ product, onBack, brandName }: InlineProductDetailProps) {
  const dispatch = useDispatch<AppDispatch>();
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Build media list from product
  const mediaList = useMemo(() => {
    if (Array.isArray(product.media) && product.media.length > 0) {
      return product.media;
    }
    if (Array.isArray(product.images) && product.images.length > 0) {
      return product.images.map((url: string, idx: number) => ({
        id: `img-${idx}`,
        url,
        type: 'IMAGE'
      }));
    }
    if (product.thumbnail) {
      return [{ id: 'thumb-0', url: product.thumbnail, type: 'IMAGE' }];
    }
    return [];
  }, [product]);

  const currentMedia = mediaList[selectedMediaIndex];

  // Get variants data
  const variants = useMemo(() => {
    if (Array.isArray((product as any).variants)) {
      return (product as any).variants;
    }
    return [];
  }, [product]);

  const colors = useMemo(() => {
    if (product.colors && product.colors.length > 0) {
      return product.colors;
    }
    return Array.from(new Set(variants.map((v: any) => v.color).filter(Boolean)));
  }, [product.colors, variants]);

  const sizes = useMemo(() => {
    if (product.sizes && product.sizes.length > 0) {
      return product.sizes;
    }
    return Array.from(new Set(variants.map((v: any) => v.size).filter(Boolean)));
  }, [product.sizes, variants]);

  // Price calculations
  const currentPrice = product.effectivePrice || product.price;
  const comparePrice = product.salePrice ? product.price : undefined;
  const isOnSale = product.isOnSale || (comparePrice && comparePrice > currentPrice);

  const handleAddToCart = () => {
    dispatch(addToCart({
      productId: product.id,
      quantity,
      selectedSize: selectedSize || undefined,
      selectedColor: selectedColor || undefined
    }));
    dispatch(openCartDrawer());
    toast.success(`Added ${quantity} item(s) to bag`);
  };

  const handleWishlist = () => {
    setIsWishlisted(!isWishlisted);
    toast.success(isWishlisted ? 'Removed from wishlist' : 'Added to wishlist');
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: product.name,
        text: product.description,
        url: window.location.href
      });
    } else {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    }
  };

  // Lightbox navigation handlers
  const handleOpenLightbox = useCallback(() => {
    if (mediaList.length > 0) {
      setIsLightboxOpen(true);
    }
  }, [mediaList.length]);

  const handleCloseLightbox = useCallback(() => {
    setIsLightboxOpen(false);
  }, []);

  const handleLightboxPrevious = useCallback(() => {
    setSelectedMediaIndex((prev) => (prev === 0 ? mediaList.length - 1 : prev - 1));
  }, [mediaList.length]);

  const handleLightboxNext = useCallback(() => {
    setSelectedMediaIndex((prev) => (prev === mediaList.length - 1 ? 0 : prev + 1));
  }, [mediaList.length]);

  return (
    <div className="w-full animate-fadeIn">
      {/* Breadcrumbs - Desktop */}
      <nav className="hidden sm:flex items-center gap-2 mb-6 text-sm">
        <button 
          type="button"
          onClick={onBack}
          className="text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
        >
          Store
        </button>
        <ChevronRight size={14} className="text-gray-400" />
        {product.brand && (
          <>
            <span className="text-gray-500 dark:text-gray-400">{brandName || product.brand.name}</span>
            <ChevronRight size={14} className="text-gray-400" />
          </>
        )}
        <span className="text-gray-900 dark:text-white font-medium truncate max-w-[200px]">
          {product.name}
        </span>
      </nav>

      {/* Mobile Back Button */}
      <div className="sm:hidden sticky top-0 z-40 bg-white/80 dark:bg-black/80 backdrop-blur-md px-4 py-3 -mx-4 mb-4 flex items-center justify-between border-b border-gray-100 dark:border-white/5">
        <button 
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-medium"
        >
          <ArrowLeft size={18} />
          <span className="text-sm uppercase tracking-wide">Back to Store</span>
        </button>
        <div className="flex gap-3">
          <button type="button" onClick={handleShare} className="text-gray-400 hover:text-gray-600">
            <Share2 size={20} />
          </button>
          <button type="button" onClick={handleWishlist} className={isWishlisted ? 'text-rose-500' : 'text-gray-400'}>
            <Heart size={20} fill={isWishlisted ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        
        {/* Left Column: Image Gallery */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Main Image - Adaptive container */}
          <div 
            className="relative w-full rounded-2xl cursor-zoom-in group flex justify-center"
            onClick={handleOpenLightbox}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleOpenLightbox()}
            aria-label="Click to zoom image"
          >
            {currentMedia ? (
              <>
                <SignedImage
                  media={currentMedia}
                  alt={product.name}
                  className="flex justify-center"
                />
                {/* Zoom hint */}
                <div className="absolute bottom-4 right-4 bg-black/50 backdrop-blur-sm rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ZoomIn size={18} className="text-white" />
                </div>
              </>
            ) : (
              <div className="w-full min-h-[220px] flex items-center justify-center text-gray-400">
                <ShoppingBag size={48} />
              </div>
            )}
            
            {/* Sale badge */}
            {isOnSale && (
              <span className="absolute top-4 left-4 bg-rose-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                SALE
              </span>
            )}
          </div>
          
          {/* Thumbnails */}
          {mediaList.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              {mediaList.map((m: any, idx: number) => (
                <SignedImage
                  key={m.id || idx}
                  media={m}
                  alt={`${product.name} - View ${idx + 1}`}
                  onClick={() => setSelectedMediaIndex(idx)}
                  isActive={selectedMediaIndex === idx}
                  isThumbnail
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Product Details */}
        <div className="lg:col-span-5 flex flex-col gap-6 lg:sticky lg:top-24 h-fit">
          
          {/* Header */}
          <div className="space-y-3">
            {/* Badges & Rating */}
            <div className="flex items-center gap-3 flex-wrap">
              {product.isFeatured && (
                <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                  Featured
                </span>
              )}
              {product.isLowStock && (
                <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                  Low Stock
                </span>
              )}
              {/* Star rating placeholder */}
              <div className="flex items-center text-amber-400">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} size={14} fill={star <= 4 ? 'currentColor' : 'none'} />
                ))}
                <span className="text-gray-400 text-xs ml-1">({product.likesCount || 0})</span>
              </div>
            </div>

            {/* Title */}
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white leading-tight">
              {product.name}
            </h1>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-2xl lg:text-3xl font-bold text-purple-600 dark:text-purple-400">
                {formatPrice(currentPrice)}
              </span>
              {comparePrice && (
                <span className="text-lg text-gray-400 line-through">
                  {formatPrice(comparePrice)}
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          {product.description && (
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
              {product.description}
            </p>
          )}

          {/* Color Selector */}
          {colors.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Color{selectedColor ? `: ${selectedColor}` : ''}
              </h3>
              <div className="flex gap-3 flex-wrap">
                {(colors as string[]).map((color: string) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`
                      px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all
                      ${selectedColor === color 
                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' 
                        : 'border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-purple-300'}
                    `}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size Selector */}
          {sizes.length > 0 && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Select Size
                </h3>
                <button type="button" className="text-xs font-semibold text-purple-600 dark:text-purple-400 underline hover:text-purple-700">
                  Size Guide
                </button>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {(sizes as string[]).map((size: string) => {
                  const sizeAvail = product.sizeAvailability?.find(s => s.size === size);
                  const isAvailable = sizeAvail ? sizeAvail.inStock : true;
                  
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => isAvailable && setSelectedSize(size)}
                      disabled={!isAvailable}
                      className={`
                        py-3 rounded-lg border-2 text-sm font-medium transition-all
                        ${!isAvailable 
                          ? 'border-gray-100 dark:border-white/5 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                          : selectedSize === size 
                            ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' 
                            : 'border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-purple-300'}
                      `}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quantity + Add to Bag */}
          <div className="flex flex-col gap-3 pt-2">
            <div className="flex items-center gap-4">
              {/* Quantity Selector */}
              <div className="flex items-center border border-gray-200 dark:border-white/10 rounded-xl h-14 bg-gray-50 dark:bg-white/5">
                <button 
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-4 h-full text-gray-500 hover:text-purple-600 transition-colors"
                >
                  <Minus size={16} />
                </button>
                <span className="w-10 text-center font-bold text-gray-900 dark:text-white">{quantity}</span>
                <button 
                  type="button"
                  onClick={() => setQuantity(quantity + 1)}
                  className="px-4 h-full text-gray-500 hover:text-purple-600 transition-colors"
                >
                  <Plus size={16} />
                </button>
              </div>

              {/* Add to Bag Button */}
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={product.isOutOfStock}
                className={`
                  flex-1 h-14 rounded-xl font-bold flex items-center justify-center gap-2 transition-all
                  ${product.isOutOfStock 
                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-600/25'}
                `}
              >
                <ShoppingBag size={18} />
                {product.isOutOfStock ? 'Out of Stock' : 'Add to Bag'}
              </button>
            </div>

            {/* Wishlist Button - Desktop */}
            <button
              type="button"
              onClick={handleWishlist}
              className={`
                hidden sm:flex w-full h-12 rounded-xl font-medium items-center justify-center gap-2 border-2 transition-all
                ${isWishlisted 
                  ? 'border-rose-500 text-rose-500 bg-rose-50 dark:bg-rose-900/10'
                  : 'border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-purple-300'}
              `}
            >
              <Heart size={18} fill={isWishlisted ? 'currentColor' : 'none'} />
              {isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
            </button>
          </div>

          {/* Accordion Sections */}
          <div className="pt-4">
            <div className="rounded-2xl border border-gray-200/70 dark:border-white/10 bg-white/70 dark:bg-white/5 overflow-hidden">
              <div className="px-4">
                <AccordionSection title="Product Description" defaultOpen>
                  {product.description || 'No description available.'}
                </AccordionSection>
                
                <AccordionSection title="Shipping & Returns">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-start gap-2 rounded-lg bg-gray-50 dark:bg-white/5 px-3 py-2">
                      <Truck size={16} className="text-purple-600 mt-0.5" />
                      <span>Free shipping on orders over NGN 50,000</span>
                    </div>
                    <div className="flex items-start gap-2 rounded-lg bg-gray-50 dark:bg-white/5 px-3 py-2">
                      <RotateCcw size={16} className="text-purple-600 mt-0.5" />
                      <span>30-day return policy</span>
                    </div>
                  </div>
                </AccordionSection>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Cart Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-black border-t border-gray-200 dark:border-white/5 p-4 pb-6 flex items-center gap-3 shadow-[0_-10px_30px_rgba(0,0,0,0.1)]">
        {/* Quantity */}
        <div className="flex items-center bg-gray-100 dark:bg-white/5 rounded-lg h-12 border border-gray-200 dark:border-white/10">
          <button 
            type="button"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="px-3 h-full text-gray-500"
          >
            <Minus size={14} />
          </button>
          <span className="w-8 text-center font-bold text-sm">{quantity}</span>
          <button 
            type="button"
            onClick={() => setQuantity(quantity + 1)}
            className="px-3 h-full text-gray-500"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Add to Bag */}
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={product.isOutOfStock}
          className={`
            flex-1 h-12 rounded-lg font-bold flex items-center justify-center gap-2 text-sm
            ${product.isOutOfStock 
              ? 'bg-gray-300 text-gray-500'
              : 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'}
          `}
        >
          Add to Bag
          <ShoppingBag size={16} />
        </button>
      </div>

      {/* Bottom padding for mobile sticky bar */}
      <div className="sm:hidden h-24" />

      {/* Image Lightbox */}
      {isLightboxOpen && mediaList.length > 0 && (
        <ImageLightbox
          images={mediaList}
          currentIndex={selectedMediaIndex}
          productName={product.name}
          onClose={handleCloseLightbox}
          onPrevious={handleLightboxPrevious}
          onNext={handleLightboxNext}
          onSelectIndex={setSelectedMediaIndex}
        />
      )}
    </div>
  );
}
