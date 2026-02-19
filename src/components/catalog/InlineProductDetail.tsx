import { ArrowLeft, ShoppingBag, Heart, Share2, Star } from 'lucide-react';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import type { StoreProduct } from '@/components/designs/StoreProductCard';
import ImageWithFallback from '@/components/ImageWithFallback';
import ImageLightbox from './ImageLightbox';
import type { AppDispatch, RootState } from '@/store';
import { addToCart, openCartDrawer } from '@/features/cartSlice';

interface InlineProductDetailProps {
  product: StoreProduct;
  onBack: () => void;
  brandName?: string;
}

export default function InlineProductDetail({
  product,
  onBack,
  brandName,
}: InlineProductDetailProps) {
  const dispatch = useDispatch<AppDispatch>();
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const currentUser = useSelector((s: RootState) => s.user.profile);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // Get product images
  const getProductImages = () => {
    const images: Array<{ id: string; url: string; type?: string }> = [];
    
    // Add media items
    if (Array.isArray((product as any)?.media)) {
      const media = (product as any).media as Array<{ id?: string; url?: string; type?: string }>;
      media.forEach((m, idx) => {
        if (m.url) {
          images.push({
            id: m.id || `media-${idx}`,
            url: m.url,
            type: m.type,
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

  const formatCurrency = (price?: number | null) => {
    if (price === null || price === undefined) return '—';
    try {
      return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(price);
    } catch {
      return `₦${price.toLocaleString()}`;
    }
  };

  const sizes = product.sizes || [];
  const colors = product.colors || [];
  const compareAtPrice = (product as any).compareAtPrice as number | undefined;
  const isOutOfStock = !product.totalStock || product.totalStock <= 0;
  const isOwnProduct = Boolean(currentUser?.id && product.brandId === currentUser.id);

  const handleAddToBag = async () => {
    if (isOwnProduct) {
      toast.info('You cannot add your own product to bag.');
      return;
    }
    if (!isAuth) {
      toast.info('Please sign in to add items to bag.');
      return;
    }
    if (isOutOfStock) {
      toast.error('This product is out of stock.');
      return;
    }
    if (sizes.length > 0 && !selectedSize) {
      toast.warning('Please select a size.');
      return;
    }
    if (colors.length > 0 && !selectedColor) {
      toast.warning('Please select a color.');
      return;
    }

    try {
      await dispatch(
        addToCart({
          productId: product.id,
          quantity: 1,
          selectedSize: selectedSize || undefined,
          selectedColor: selectedColor || undefined,
        }),
      ).unwrap();
      dispatch(openCartDrawer());
      toast.success('Added to bag');
    } catch (error: any) {
      toast.error(error || 'Failed to add to bag');
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
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
        <span>Back to products</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Image Gallery */}
        <div className="space-y-4">
          {/* Main Image */}
          <div 
            className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 dark:from-white/10 dark:to-white/5 border border-gray-200/70 dark:border-white/10 cursor-zoom-in group"
            onClick={() => productImages.length > 0 && setLightboxOpen(true)}
          >
            {currentImage ? (
              <ImageWithFallback
                src={currentImage.url.startsWith('http') ? currentImage.url : undefined}
                fileId={!currentImage.url.startsWith('http') ? currentImage.id : undefined}
                alt={product.name}
                fit="contain"
                className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                containerClassName="w-full h-full"
                rounded="xl"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-gray-400 text-lg">No image available</span>
              </div>
            )}
            
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
                    src={img.url.startsWith('http') ? img.url : undefined}
                    fileId={!img.url.startsWith('http') ? img.id : undefined}
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
              <p className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-1">{brandName}</p>
            )}
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">{product.name}</h1>
            
            {/* Rating placeholder */}
            <div className="flex items-center gap-2 mt-2">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={14}
                    className={star <= 4 ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'}
                  />
                ))}
              </div>
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
                    onClick={() => setSelectedSize(size === selectedSize ? null : size)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      selectedSize === size
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300'
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
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Color</h3>
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color === selectedColor ? null : color)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      selectedColor === color
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300'
                        : 'border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:border-purple-300'
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stock Info */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${!isOutOfStock ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-gray-600 dark:text-gray-400">
                {!isOutOfStock 
                  ? `${product.totalStock} in stock` 
                  : 'Out of stock'}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            {!isOwnProduct ? (
              <button
                type="button"
                onClick={handleAddToBag}
                disabled={isOutOfStock}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:scale-100"
              >
                <ShoppingBag size={18} />
                Add to bag
              </button>
            ) : (
              <div className="flex-1 flex items-center justify-center px-6 py-3.5 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm font-medium text-gray-600 dark:text-gray-300">
                Your product
              </div>
            )}
            <button
              type="button"
              className="w-12 h-12 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:text-pink-500 hover:border-pink-300 transition-all flex items-center justify-center"
            >
              <Heart size={20} />
            </button>
            <button
              type="button"
              className="w-12 h-12 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 hover:text-purple-500 hover:border-purple-300 transition-all flex items-center justify-center"
            >
              <Share2 size={20} />
            </button>
          </div>
        </div>
      </div>

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
    </div>
  );
}
