import React, { useState, useEffect, useRef } from 'react';
import {
  X, ShoppingCart, Minus, Plus, Star, ChevronRight, AlertTriangle, Check, Share2,
  ChevronDown, Truck, Ruler, Package, Sparkles, Copy
} from 'lucide-react';
import { FaInstagram, FaWhatsapp } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import type { AppDispatch, RootState } from '@/store';
import { addToCart, openCartDrawer } from '@/features/cartSlice';
import { addToWishlist, removeFromWishlist } from '@/features/wishlistSlice';
import MediaRenderer from '@/components/media/MediaRenderer';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';

// Types
export interface ProductDetailData {
  id: string;
  name: string;
  description?: string;
  price: number;
  salePrice?: number;
  images: string[];
  thumbnail?: string;
  sizes: string[];
  sizeStock?: Record<string, number>;
  colors: string[];
  colorImages?: Record<string, string>;
  totalStock: number;
  brand: {
    id: string;
    name: string;
    logo?: string;
  };
  collection?: {
    id: string;
    name: string;
  };
  rating?: number;
  reviewsCount?: number;
  tags?: string[];
}

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductDetailData | null;
  relatedProducts?: ProductDetailData[];
  onViewProduct?: (product: ProductDetailData) => void;
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

/**
 * ProductDetailModal Component
 * 
 * A full-featured product detail modal with:
 * - Image gallery with thumbnail navigation
 * - Color & size selection
 * - Stock availability indicators
 * - Add to cart with quantity
 * - Wishlist toggle
 * - Related products carousel
 * - Reviews summary link
 * 
 * Design: Matches the provided Figma mockup
 */
const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  isOpen,
  onClose,
  product,
  relatedProducts = [],
  onViewProduct,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const wishlistedIds = useSelector((s: RootState) => s.wishlist.wishlistedIds);
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const currentUser = useSelector((s: RootState) => s.user.profile);

  // Local state
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  
  // Accordion states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    description: true,
    sizeGuide: false,
    shipping: false,
    care: false,
  });
  
  // Share menu state
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useFocusTrap({
    containerRef: dialogRef,
    active: isOpen,
    onEscape: onClose,
  });

  // Close share menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setIsShareMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset state when product changes
  useEffect(() => {
    if (product) {
      setSelectedImage(0);
      setSelectedColor(product.colors[0] || null);
      setSelectedSize(null);
      setQuantity(1);
    }
  }, [product]);

  // Update main image when color changes (if colorImages available)
  useEffect(() => {
    if (product?.colorImages && selectedColor) {
      const colorImage = product.colorImages[selectedColor];
      if (colorImage) {
        const imageIndex = product.images.indexOf(colorImage);
        if (imageIndex !== -1) {
          setSelectedImage(imageIndex);
        }
      }
    }
  }, [selectedColor, product]);

  // Scroll Locking
  useEffect(() => {
    if (isOpen) {
      const originalBodyOverflow = document.body.style.overflow;
      const originalHtmlOverflow = document.documentElement.style.overflow;
      
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
      };
    }
  }, [isOpen]);

  if (!product) return null;

  const isWishlisted = wishlistedIds.has(product.id);
  const isOwnProduct = Boolean(currentUser?.id && product.brand.id === currentUser.id);
  const filledHeartEmoji = String.fromCodePoint(0x2764, 0xfe0f);
  const outlineHeartEmoji = String.fromCodePoint(0x1f5a4);
  const isOnSale = product.salePrice && product.salePrice < product.price;
  const effectivePrice = isOnSale ? product.salePrice! : product.price;
  const discountPercent = isOnSale 
    ? Math.round(((product.price - product.salePrice!) / product.price) * 100)
    : 0;

  // Stock helpers
  const getSizeStock = (size: string): number => {
    if (product.sizeStock && product.sizeStock[size] !== undefined) {
      return product.sizeStock[size];
    }
    return product.totalStock > 0 ? Math.ceil(product.totalStock / product.sizes.length) : 0;
  };

  const isSizeAvailable = (size: string): boolean => getSizeStock(size) > 0;
  
  const selectedSizeStock = selectedSize ? getSizeStock(selectedSize) : product.totalStock;
  const isLowStock = selectedSizeStock > 0 && selectedSizeStock <= 5;
  const isOutOfStock = selectedSizeStock === 0;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const handleToggleWishlist = async () => {
    if (isOwnProduct) {
      toast.info('Brands cannot add their own product to wishlist.');
      return;
    }
    if (!isAuth) {
      toast.info('Please sign in to save items');
      return;
    }

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
    }
  };

  const handleAddToCart = async () => {
    if (isOwnProduct) {
      toast.info('Brands cannot add their own product to cart.');
      return;
    }
    if (!isAuth) {
      toast.info('Please sign in to add items to cart');
      return;
    }

    if (product.sizes.length > 0 && !selectedSize) {
      toast.warning('Please select a size');
      return;
    }

    if (isOutOfStock) {
      toast.error('This item is out of stock');
      return;
    }

    setIsAddingToCart(true);
    try {
      await dispatch(addToCart({
        productId: product.id,
        quantity,
        selectedSize: selectedSize || undefined,
        selectedColor: selectedColor || undefined,
      })).unwrap();
      
      toast.success('Added to cart!');
      dispatch(openCartDrawer());
      onClose();
    } catch (error: any) {
      toast.error(error || 'Failed to add to cart');
    } finally {
      setIsAddingToCart(false);
    }
  };

  // Toggle accordion section
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Share handlers
  const getShareUrl = () => `${window.location.origin}/products/${product.id}`;
  
  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(getShareUrl());
    toast.success('Link copied to clipboard');
    setIsShareMenuOpen(false);
  };

  const handleShareInstagram = () => {
    // Instagram doesn't have direct URL sharing, open profile/DM
    window.open('https://www.instagram.com/', '_blank');
    setIsShareMenuOpen(false);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(`Check out ${product.name}: ${getShareUrl()}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
    setIsShareMenuOpen(false);
  };

  const handleShareTwitter = () => {
    const text = encodeURIComponent(`Check out ${product.name}`);
    const url = encodeURIComponent(getShareUrl());
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
    setIsShareMenuOpen(false);
  };

  // Calculate estimated delivery date (5-8 business days from now)
  const getEstimatedDelivery = () => {
    const today = new Date();
    const minDays = 5;
    const maxDays = 8;
    const minDate = new Date(today);
    const maxDate = new Date(today);
    minDate.setDate(today.getDate() + minDays);
    maxDate.setDate(today.getDate() + maxDays);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${minDate.toLocaleDateString('en-US', options)} - ${maxDate.toLocaleDateString('en-US', options)}`;
  };

  return (
    <OverlayPortal>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-layer-overlay"
              onClick={onClose}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-indigo-900/50 to-blue-900/40" />
              <div className="absolute inset-0 backdrop-blur-xl" />
              <div className="absolute inset-0 bg-black/40" />
            </motion.div>

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-4 md:inset-8 lg:inset-12 z-layer-modal flex items-center justify-center"
              role="dialog"
              aria-modal="true"
              aria-label={product?.name ?? 'Product details'}
            >
              <div ref={dialogRef} tabIndex={-1} className="w-full max-w-6xl max-h-full neu-modal-surface bg-white dark:bg-gray-950 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm hover:bg-white dark:hover:bg-gray-900 transition-colors shadow-lg"
              >
                <X size={20} className="text-gray-600 dark:text-gray-400" />
              </button>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto glass-scrollbar pb-20 lg:pb-0 overscroll-contain">
                {/* Main content grid */}
                <div className="grid lg:grid-cols-2 gap-0">
                  {/* Left - Image Gallery */}
                  <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-6">
                    {/* Main image */}
                    <div className="relative rounded-2xl overflow-hidden shadow-lg">
                      <MediaRenderer
                        kind="image"
                        src={product.images[selectedImage] || product.thumbnail || ''}
                        alt={product.name}
                        maxHeightClassName="max-h-[60vh]"
                        className="rounded-2xl"
                        mediaClassName="rounded-2xl"
                      />
                      
                      {/* Sale badge */}
                      {isOnSale && (
                        <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-bold shadow-lg">
                          -{discountPercent}% OFF
                        </div>
                      )}

                      {/* Wishlist button */}
                      <button
                        type="button"
                        onClick={handleToggleWishlist}
                        disabled={isOwnProduct}
                        aria-label={isOwnProduct ? 'Wishlist disabled for your own product' : isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                        title={isOwnProduct ? 'Brands cannot wishlist their own products' : isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                        className={`absolute top-4 right-4 p-3 rounded-full backdrop-blur-md transition-all duration-200 shadow-lg ${
                          isWishlisted
                            ? 'bg-red-500 text-white'
                            : 'bg-white/90 dark:bg-gray-900/90 text-gray-600 dark:text-gray-400 hover:text-red-500'
                        } ${isOwnProduct ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span role="img" aria-hidden="true" className="text-lg leading-none">
                          {isWishlisted ? filledHeartEmoji : outlineHeartEmoji}
                        </span>
                      </button>
                    </div>

                    {/* Thumbnail strip */}
                    {product.images.length > 1 && (
                      <div className="flex gap-2 mt-4 overflow-x-auto pb-2">
                        {product.images.map((img, i) => (
                          <button
                            key={i}
                            onClick={() => setSelectedImage(i)}
                            className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                              selectedImage === i
                                ? 'border-purple-500 ring-2 ring-purple-500/30'
                                : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                          >
                            <MediaRenderer
                              kind="image"
                              src={img}
                              alt=""
                              maxHeightClassName="max-h-20"
                              maxWidthClassName="max-w-16"
                              className="rounded-lg"
                              mediaClassName="rounded-lg"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right - Product Details */}
                  <div className="p-6 lg:p-8 flex flex-col">
                    {/* Breadcrumb */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-4">
                      <span className="hover:text-purple-500 cursor-pointer">{product.brand.name}</span>
                      <ChevronRight size={12} />
                      {product.collection && (
                        <>
                          <span className="hover:text-purple-500 cursor-pointer">{product.collection.name}</span>
                          <ChevronRight size={12} />
                        </>
                      )}
                      <span className="text-gray-700 dark:text-gray-300 truncate">{product.name}</span>
                    </div>

                    {/* Title */}
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                      {product.name}
                    </h1>

                    {/* Rating */}
                    {product.rating && (
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={16}
                              fill={i < Math.floor(product.rating!) ? '#FBBF24' : 'none'}
                              className={i < Math.floor(product.rating!) ? 'text-amber-400' : 'text-gray-300 dark:text-gray-600'}
                            />
                          ))}
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {product.rating.toFixed(1)}
                        </span>
                        {product.reviewsCount && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            ({product.reviewsCount} reviews)
                          </span>
                        )}
                      </div>
                    )}

                    {/* Price */}
                    <div className="flex items-baseline gap-3 mb-6">
                      <span className="text-3xl font-bold text-gray-900 dark:text-white">
                        {formatPrice(effectivePrice)}
                      </span>
                      {isOnSale && (
                        <>
                          <span className="text-lg text-gray-400 line-through">
                            {formatPrice(product.price)}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold">
                            SAVE {formatPrice(product.price - product.salePrice!)}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Color Selection */}
                    {product.colors.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Color: <span className="font-semibold text-gray-900 dark:text-white">{selectedColor}</span>
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {product.colors.map((color) => {
                            const colorStyle = COLOR_HEX_MAP[color] || '#9CA3AF';
                            const isGradient = colorStyle.includes('gradient');
                            
                            return (
                              <button
                                key={color}
                                onClick={() => setSelectedColor(color)}
                                className={`w-10 h-10 rounded-full border-2 transition-all relative ${
                                  selectedColor === color
                                    ? 'border-purple-500 ring-2 ring-purple-500/30 scale-110'
                                    : 'border-gray-300 dark:border-gray-600 hover:border-purple-400'
                                }`}
                                style={{
                                  background: isGradient ? colorStyle : colorStyle,
                                }}
                                title={color}
                              >
                                {selectedColor === color && (
                                  <Check size={16} className={`absolute inset-0 m-auto ${color === 'White' || color === 'Yellow' ? 'text-gray-900' : 'text-white'}`} />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Size Selection */}
                    {product.sizes.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Size {selectedSize && <span className="font-semibold text-gray-900 dark:text-white">({selectedSize})</span>}
                          </span>
                          <button className="text-sm text-purple-600 hover:text-purple-700 font-medium">
                            Size Guide
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {product.sizes.map((size) => {
                            const available = isSizeAvailable(size);
                            const stock = getSizeStock(size);
                            
                            return (
                              <button
                                key={size}
                                onClick={() => available && setSelectedSize(size)}
                                disabled={!available}
                                className={`min-w-[44px] h-11 px-3 rounded-lg border-2 text-sm font-semibold transition-all relative ${
                                  !available
                                    ? 'border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 text-gray-400 cursor-not-allowed line-through'
                                    : selectedSize === size
                                    ? 'border-purple-500 bg-purple-500 text-white shadow-lg shadow-purple-500/30'
                                    : 'border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500 text-gray-900 dark:text-white'
                                }`}
                              >
                                {size}
                                {available && stock <= 3 && (
                                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-orange-500" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Quantity */}
                    <div className="mb-6">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">
                        Quantity
                      </span>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center rounded-xl border border-gray-300 dark:border-gray-600 overflow-hidden">
                          <button
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            disabled={quantity <= 1}
                            className="w-12 h-12 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
                          >
                            <Minus size={18} />
                          </button>
                          <span className="w-12 text-center text-lg font-semibold text-gray-900 dark:text-white">
                            {quantity}
                          </span>
                          <button
                            onClick={() => setQuantity(Math.min(selectedSizeStock, quantity + 1))}
                            disabled={quantity >= selectedSizeStock}
                            className="w-12 h-12 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
                          >
                            <Plus size={18} />
                          </button>
                        </div>

                        {/* Stock indicator */}
                        {isLowStock && !isOutOfStock && (
                          <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 text-sm">
                            <AlertTriangle size={14} />
                            Only {selectedSizeStock} left in stock
                          </div>
                        )}
                        {isOutOfStock && (
                          <div className="flex items-center gap-1.5 text-red-500 text-sm font-medium">
                            <AlertTriangle size={14} />
                            Out of stock
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Add to Cart & Buy Now */}
                    <div className="flex gap-3 mb-6">
                      {!isOwnProduct ? (
                        <button
                          onClick={handleAddToCart}
                          disabled={isAddingToCart || isOutOfStock || (product.sizes.length > 0 && !selectedSize)}
                          title="Add selected item to cart"
                          className="flex-1 h-14 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                          <ShoppingCart size={20} />
                          {isAddingToCart ? 'Adding...' : 'Add to Cart'}
                        </button>
                      ) : (
                        <div className="flex-1 h-14 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 font-medium flex items-center justify-center">
                          Your product
                        </div>
                      )}
                      
                      {/* Share button with dropdown */}
                      <div className="relative" ref={shareMenuRef}>
                        <button
                          onClick={() => setIsShareMenuOpen(!isShareMenuOpen)}
                          className="w-14 h-14 rounded-xl border border-gray-300 dark:border-gray-600 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <Share2 size={20} className="text-gray-600 dark:text-gray-400" />
                        </button>
                        
                        {/* Share dropdown menu */}
                        <AnimatePresence>
                          {isShareMenuOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -10, scale: 0.95 }}
                              transition={{ duration: 0.15 }}
                              className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden z-20"
                            >
                              <button
                                onClick={handleCopyLink}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                              >
                                <Copy size={18} className="text-gray-500 dark:text-gray-400" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Copy Link</span>
                              </button>
                              <button
                                onClick={handleShareInstagram}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                              >
                                <FaInstagram size={18} className="text-pink-500" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">Instagram</span>
                              </button>
                              <button
                                onClick={handleShareWhatsApp}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                              >
                                <FaWhatsapp size={18} className="text-green-500" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">WhatsApp</span>
                              </button>
                              <button
                                onClick={handleShareTwitter}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
                              >
                                <FaXTwitter size={18} className="text-gray-900 dark:text-white" />
                                <span className="text-sm text-gray-700 dark:text-gray-300">X (Twitter)</span>
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Delivery Estimate */}
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/30 mb-6">
                      <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-800/40 flex items-center justify-center">
                        <Truck size={20} className="text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Estimated Delivery</p>
                        <p className="text-sm text-purple-600 dark:text-purple-400 font-semibold">{getEstimatedDelivery()}</p>
                      </div>
                    </div>

                    {/* Expandable Sections */}
                    <div className="border-t border-gray-200 dark:border-gray-800">
                      {/* Description Accordion */}
                      {product.description && (
                        <div className="border-b border-gray-200 dark:border-gray-800">
                          <button
                            onClick={() => toggleSection('description')}
                            className="w-full flex items-center justify-between py-4 text-left"
                          >
                            <div className="flex items-center gap-2">
                              <Sparkles size={18} className="text-purple-500" />
                              <span className="font-semibold text-gray-900 dark:text-white">Description</span>
                            </div>
                            <ChevronDown
                              size={20}
                              className={`text-gray-500 transition-transform duration-200 ${expandedSections.description ? 'rotate-180' : ''}`}
                            />
                          </button>
                          <AnimatePresence>
                            {expandedSections.description && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <p className="pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                                  {product.description}
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

                      {/* Size Guide Accordion */}
                      <div className="border-b border-gray-200 dark:border-gray-800">
                        <button
                          onClick={() => toggleSection('sizeGuide')}
                          className="w-full flex items-center justify-between py-4 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <Ruler size={18} className="text-purple-500" />
                            <span className="font-semibold text-gray-900 dark:text-white">Size Guide</span>
                          </div>
                          <ChevronDown
                            size={20}
                            className={`text-gray-500 transition-transform duration-200 ${expandedSections.sizeGuide ? 'rotate-180' : ''}`}
                          />
                        </button>
                        <AnimatePresence>
                          {expandedSections.sizeGuide && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="pb-4 text-sm text-gray-600 dark:text-gray-400">
                                <div className="grid grid-cols-4 gap-2 text-center mb-2">
                                  <div className="font-semibold text-gray-900 dark:text-white">Size</div>
                                  <div className="font-semibold text-gray-900 dark:text-white">Chest</div>
                                  <div className="font-semibold text-gray-900 dark:text-white">Waist</div>
                                  <div className="font-semibold text-gray-900 dark:text-white">Length</div>
                                </div>
                                <div className="grid grid-cols-4 gap-2 text-center py-1 border-t border-gray-100 dark:border-gray-800">
                                  <div>S</div><div>36"</div><div>30"</div><div>27"</div>
                                </div>
                                <div className="grid grid-cols-4 gap-2 text-center py-1 border-t border-gray-100 dark:border-gray-800">
                                  <div>M</div><div>38"</div><div>32"</div><div>28"</div>
                                </div>
                                <div className="grid grid-cols-4 gap-2 text-center py-1 border-t border-gray-100 dark:border-gray-800">
                                  <div>L</div><div>40"</div><div>34"</div><div>29"</div>
                                </div>
                                <div className="grid grid-cols-4 gap-2 text-center py-1 border-t border-gray-100 dark:border-gray-800">
                                  <div>XL</div><div>42"</div><div>36"</div><div>30"</div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Shipping & Returns Accordion */}
                      <div className="border-b border-gray-200 dark:border-gray-800">
                        <button
                          onClick={() => toggleSection('shipping')}
                          className="w-full flex items-center justify-between py-4 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <Package size={18} className="text-purple-500" />
                            <span className="font-semibold text-gray-900 dark:text-white">Shipping & Returns</span>
                          </div>
                          <ChevronDown
                            size={20}
                            className={`text-gray-500 transition-transform duration-200 ${expandedSections.shipping ? 'rotate-180' : ''}`}
                          />
                        </button>
                        <AnimatePresence>
                          {expandedSections.shipping && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="pb-4 text-sm text-gray-600 dark:text-gray-400 space-y-2">
                                <p>• Free shipping on orders over ₦50,000</p>
                                <p>• Standard delivery: 5-8 business days</p>
                                <p>• Express delivery available at checkout</p>
                                <p>• 30-day return policy for unworn items</p>
                                <p>• Free returns on all orders</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Care Instructions Accordion */}
                      <div>
                        <button
                          onClick={() => toggleSection('care')}
                          className="w-full flex items-center justify-between py-4 text-left"
                        >
                          <div className="flex items-center gap-2">
                            <Sparkles size={18} className="text-purple-500" />
                            <span className="font-semibold text-gray-900 dark:text-white">Care Instructions</span>
                          </div>
                          <ChevronDown
                            size={20}
                            className={`text-gray-500 transition-transform duration-200 ${expandedSections.care ? 'rotate-180' : ''}`}
                          />
                        </button>
                        <AnimatePresence>
                          {expandedSections.care && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="pb-4 text-sm text-gray-600 dark:text-gray-400 space-y-2">
                                <p>• Machine wash cold with similar colors</p>
                                <p>• Do not bleach</p>
                                <p>• Tumble dry low</p>
                                <p>• Iron on low heat if needed</p>
                                <p>• Do not dry clean</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Related Products */}
                {relatedProducts.length > 0 && (
                  <div className="px-6 lg:px-8 pb-8 border-t border-gray-200 dark:border-gray-800">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 pt-6">
                      From This Collection
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {relatedProducts.slice(0, 4).map((relProd) => (
                        <button
                          key={relProd.id}
                          onClick={() => onViewProduct?.(relProd)}
                          className="text-left group"
                        >
                          <div className="rounded-xl overflow-y-auto mb-2 group-hover:ring-2 ring-purple-500 transition-all">
                            <MediaRenderer
                              kind="image"
                              src={relProd.thumbnail || relProd.images[0] || ''}
                              alt={relProd.name}
                              maxHeightClassName="max-h-48"
                              className="rounded-xl"
                              mediaClassName="rounded-xl"
                            />
                          </div>
                          <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {relProd.name}
                          </h4>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                              {formatPrice(relProd.salePrice || relProd.price)}
                            </span>
                            {relProd.salePrice && (
                              <span className="text-xs text-gray-400 line-through">
                                {formatPrice(relProd.price)}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Sticky Footer */}
              <div className="lg:hidden fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-20">
                <div className="flex items-center gap-3">
                  {/* Price display */}
                  <div className="flex-shrink-0">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {formatPrice(effectivePrice)}
                    </div>
                    {isOnSale && (
                      <div className="text-xs text-gray-400 line-through">
                        {formatPrice(product.price)}
                      </div>
                    )}
                  </div>
                  
                  {/* Add to Cart button */}
                  {!isOwnProduct ? (
                    <button
                      onClick={handleAddToCart}
                      disabled={isAddingToCart || isOutOfStock || (product.sizes.length > 0 && !selectedSize)}
                      title="Add selected item to cart"
                      className="flex-1 h-12 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      <ShoppingCart size={18} />
                      {isAddingToCart ? 'Adding...' : isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
                    </button>
                  ) : (
                    <div className="flex-1 h-12 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 font-medium flex items-center justify-center">
                      Your product
                    </div>
                  )}
                </div>
              </div>
            </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </OverlayPortal>
  );
};

export default ProductDetailModal;
