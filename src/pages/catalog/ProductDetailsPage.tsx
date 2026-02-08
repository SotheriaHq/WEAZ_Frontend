import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@/store';
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
  const fileId = typeof media.id === 'string' && !media.url?.startsWith('http') 
    ? media.id 
    : undefined;
  const { url: signedUrl } = useSignedFileUrl(fileId, media.url);
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
        <MediaRenderer
          kind={mediaKind}
          src={signedUrl || ''}
          alt={alt}
          fit="cover"
          className="w-full h-full"
        />
      </button>
    );
  }

  return (
    <MediaRenderer
      kind={mediaKind}
      src={signedUrl || ''}
      alt={alt}
      fit="cover"
      className={className}
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
  const dispatch = useDispatch<AppDispatch>();
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

  // Safe currency fallback
  const currency = (product as any).brand?.currency || product.currency || 'USD';
  
  const handleAddToCart = () => {
    if (!product) return;
    
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

  const currentVariant = variants.find(v => 
    (!selectedColor || v.color === selectedColor) && 
    (!selectedSize || v.size === selectedSize)
  );
  
  const isOutOfStock = variants.length > 0 ? (currentVariant?.stock === 0) : false;

  return (
    <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white pb-20 lg:pb-0">
       <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
         {/* Breadcrumbs */}
         <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500">
           <Link to="/" className="hover:text-gray-900 dark:hover:text-white transition-colors">Home</Link>
           <ChevronRight size={14} className="text-gray-400" />
           {product.brand && (
             <>
               <Link 
                 to={`/brand/${product.brandId}?tab=store`} 
                 className="hover:text-gray-900 dark:hover:text-white transition-colors"
               >
                 {product.brand.name}
               </Link>
               <ChevronRight size={14} className="text-gray-400" />
             </>
           )}
           {product.category && (
             <>
               <span className="text-gray-400">{product.category.name}</span>
               <ChevronRight size={14} className="text-gray-400" />
             </>
           )}
           <span className="text-gray-900 dark:text-white font-medium truncate max-w-[200px]">{product.title}</span>
         </nav>

         <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-20">
            {/* Visuals Column */}
            <div className="space-y-4">
              {/* Main Image */}
              <div className="aspect-[3/4] lg:aspect-[4/5] bg-gray-50 dark:bg-white/5 rounded-3xl overflow-hidden relative group">
                {currentMedia ? (
                  <SignedMediaItem
                     media={currentMedia}
                     alt={product.title}
                     className="w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <span className="text-lg">No Image</span>
                  </div>
                )}
              </div>
              
              {/* Thumbnails */}
              {mediaList.length > 1 && (
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
              )}
            </div>

            {/* Details Column */}
            <div className="flex flex-col">
               {/* Header */}
               <div className="mb-8">
                 {product.category && (
                   <span className="text-sm font-medium text-purple-600 dark:text-purple-400 mb-2 block uppercase tracking-wider">
                     {product.category.name}
                   </span>
                 )}
                 <h1 className="text-3xl lg:text-4xl font-bold tracking-tight mb-4 font-serif">
                   {product.title}
                 </h1>
                 <div className="flex items-center justify-between">
                   <div className="text-2xl font-semibold">
                     {formatPrice(currentPrice)}
                   </div>
                   
                   {/* Actions: Share, Wishlist */}
                   <div className="flex gap-2">
                     <button className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition">
                       <Share2 size={20} />
                     </button>
                     <button 
                       onClick={handleWishlist}
                       className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition text-gray-500 hover:text-rose-500"
                     >
                       <Heart size={20} />
                     </button>
                   </div>
                 </div>
               </div>

               {/* Variants */}
               <div className="space-y-6 mb-8 border-t border-b border-gray-100 dark:border-white/10 py-6">
                 {/* Color Selector */}
                 {colors.length > 0 && (
                   <div className="space-y-3">
                     <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Color: <span className="text-gray-900 dark:text-white ml-1">{selectedColor}</span></span>
                     <div className="flex flex-wrap gap-3">
                       {colors.map(color => {
                         const isActive = selectedColor === color;
                         return (
                           <button
                             key={color}
                             onClick={() => setSelectedColor(color)}
                             className={`
                               h-10 px-4 rounded-full border transition-all text-sm font-medium
                               ${isActive
                                 ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-black'
                                 : 'border-gray-200 text-gray-600 hover:border-gray-900 dark:border-white/10 dark:text-gray-300 dark:hover:border-white'}
                             `}
                           >
                             {color}
                           </button>
                         );
                       })}
                     </div>
                   </div>
                 )}

                 {/* Size Selector */}
                 {sizes.length > 0 && (
                   <div className="space-y-3">
                     <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Size: <span className="text-gray-900 dark:text-white ml-1">{selectedSize}</span></span>
                     <div className="flex flex-wrap gap-3">
                        {sizes.map(size => {
                          const isActive = selectedSize === size;
                          return (
                            <button
                              key={size}
                              onClick={() => setSelectedSize(size)}
                              className={`
                                h-10 w-12 rounded-lg border transition-all text-sm font-medium flex items-center justify-center
                                ${isActive
                                  ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-black'
                                  : 'border-gray-200 text-gray-600 hover:border-gray-900 dark:border-white/10 dark:text-gray-300 dark:hover:border-white'}
                              `}
                            >
                              {size}
                            </button>
                          );
                        })}
                     </div>
                   </div>
                 )}
               </div>

               {/* Add to Cart */}
               <div className="flex gap-4 mb-8">
                 <button 
                   onClick={handleAddToCart}
                   disabled={isOutOfStock}
                   className={`
                     flex-1 h-14 rounded-full font-bold text-lg transition transform active:scale-[0.98] flex items-center justify-center gap-2
                     ${isOutOfStock 
                       ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-white/10' 
                       : 'bg-black dark:bg-white text-white dark:text-black hover:opacity-90'}
                   `}
                 >
                   <ShoppingBag size={20} />
                   {isOutOfStock ? 'Sold Out' : 'Add to Bag'}
                 </button>
               </div>

               {/* Collapsible Info */}
               <div className="space-y-0 divide-y divide-gray-100 dark:divide-white/10">
                 {/* Description */}
                 {product.description && (
                   <details className="group py-4 cursor-pointer" open>
                     <summary className="flex items-center justify-between font-medium list-none">
                       <span>Description</span>
                       <ChevronDown className="group-open:rotate-180 transition-transform" size={16} />
                     </summary>
                     <div className="pt-4 text-gray-600 dark:text-gray-400 leading-relaxed text-sm whitespace-pre-wrap">
                       {product.description}
                     </div>
                   </details>
                 )}
                 
                 {/* Shipping */}
                  <details className="group py-4 cursor-pointer">
                    <summary className="flex items-center justify-between font-medium list-none">
                     <span>Shipping & Returns</span>
                     <ChevronDown className="group-open:rotate-180 transition-transform" size={16} />
                   </summary>
                   <div className="pt-4 text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                     <div className="flex items-center gap-2 mb-2">
                        <Truck size={16} />
                        <span>Free shipping on orders over $100</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <ShieldCheck size={16} />
                        <span>30-day return policy</span>
                     </div>
                   </div>
                 </details>
               </div>
            </div>
         </div>
       </div>
    </div>
  );
}
