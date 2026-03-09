import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Share2, Heart, MessageCircle, Eye, 
  ChevronDown, ChevronLeft, ChevronRight,
  ShoppingCart, Store, Clock, Play, Star,
  Lock
} from 'lucide-react';
import { toast } from 'sonner';
import type { AppDispatch, RootState } from '@/store';
import { brandApi } from '@/api/BrandApi';
import AccessApi, { type AccessState } from '@/api/AccessApi';
import ThreadButton from '@/components/ui/ThreadButton';
import UnifiedCollectionComments from '@/components/collections/UnifiedCollectionComments';
import MediaRenderer from '@/components/media/MediaRenderer';
import { selectImageVariant } from '@/utils/selectImageVariant';
import { addToCart, openCartDrawer } from '@/features/cartSlice';
import { apiClient } from '@/api/httpClient';

// ============================================
// TYPES
// ============================================
interface MediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  fileId?: string | null;
  caption?: string | null;
  order?: number;
  processingStatus?: 'PENDING' | 'READY' | 'FAILED' | string;
  variants?: {
    thumb?: { url: string; width: number; height: number; format?: string };
    card?: { url: string; width: number; height: number; format?: string };
    detail?: { url: string; width: number; height: number; format?: string };
    zoom?: { url: string; width: number; height: number; format?: string };
    avatar?: { url: string; width: number; height: number; format?: string };
    banner?: { url: string; width: number; height: number; format?: string };
  };
}

interface CollectionDetail {
  id: string;
  title: string;
  description?: string | null;
  visibility: 'PUBLIC' | 'PRIVATE';
  coverMediaId?: string | null;
  coverImageUrl?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  saleMinPrice?: number | null;
  saleMaxPrice?: number | null;
  saleStartAt?: string | null;
  saleEndAt?: string | null;
  isAvailableInStore?: boolean;
  tags?: string[];
  totalThreads?: number;
  commentsCount?: number;
  medias?: any[];
  owner?: {
    id: string;
    username?: string;
    brand?: {
      id: string;
      brandName?: string;
      logo?: string;
      logoFileId?: string | null;
      location?: string;
      bio?: string;
      collectionsCount?: number;
      patchesCount?: number;
      isVerified?: boolean;
    };
  };
  _count?: {
    medias?: number;
    comments?: number;
    views?: number;
  };
  products?: any[];
}

interface ProductItem {
  id: string;
  name: string;
  price: number;
  salePrice?: number | null;
  saleStartAt?: string | null;
  saleEndAt?: string | null;
  images: string[];
  thumbnail?: string | null;
  sizes: string[];
  colors: string[];
  hasVariants: boolean;
  totalStock: number;
  orderIndex?: number;
}

interface RelatedCollection {
  id: string;
  title: string;
  coverImage?: string;
  coverFileId?: string | null;
  itemCount?: number;
  minPrice?: number;
  maxPrice?: number;
  brandName?: string;
  username?: string;
}

// ============================================
// UTILITIES
// ============================================
const formatPrice = (n?: number | null): string | null => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  return new Intl.NumberFormat('en-NG', { 
    style: 'currency', 
    currency: 'NGN', 
    maximumFractionDigits: 0 
  }).format(n);
};

const formatCompactNumber = (n?: number): string => {
  if (!n) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}m`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
};

// ============================================
// MEDIA GALLERY SECTION
// ============================================
interface MediaGalleryProps {
  items: MediaItem[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  coverMediaId?: string | null;
  isOwner?: boolean;
  onSetCover?: (item: MediaItem) => void;
}

const MediaGallery: React.FC<MediaGalleryProps> = ({
  items,
  currentIndex,
  onIndexChange,
  coverMediaId,
  isOwner,
  onSetCover,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const currentItem = items[currentIndex];
  const currentVariant =
    currentItem?.type === 'image'
      ? selectImageVariant(
          {
            processingStatus: currentItem.processingStatus,
            variants: currentItem.variants,
            fallbackUrl: currentItem.url,
          },
          'detail',
        )
      : null;

  const handlePrev = useCallback(() => {
    onIndexChange((currentIndex - 1 + items.length) % items.length);
  }, [currentIndex, items.length, onIndexChange]);

  const handleNext = useCallback(() => {
    onIndexChange((currentIndex + 1) % items.length);
  }, [currentIndex, items.length, onIndexChange]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handlePrev, handleNext]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="flex-1 lg:w-2/3">
      {/* Featured Media */}
      <div className="relative mb-8 group">
        <div className="flex items-center justify-center">
          <div className="relative w-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentItem?.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full"
              >
                {currentItem ? (
                  currentItem.type === 'video' ? (
                    <MediaRenderer
                      kind="video"
                      src={currentItem.url}
                      videoRef={videoRef}
                      controls={false}
                      autoPlay
                      muted
                      loop
                      playsInline
                      maxHeightClassName="max-h-[80vh]"
                      className="w-full rounded-2xl shadow-2xl"
                      mediaClassName="rounded-2xl"
                    />
                  ) : (
                    <MediaRenderer
                      kind="image"
                      src={currentVariant?.src || currentItem.url}
                      srcSet={currentVariant?.srcSet}
                      sizes={currentVariant?.sizes}
                      alt={currentItem.caption || 'Collection Item'}
                      maxHeightClassName="max-h-[80vh]"
                      className="w-full rounded-2xl shadow-2xl"
                      mediaClassName="rounded-2xl"
                    />
                  )
                ) : null}
              </motion.div>
            </AnimatePresence>

            {/* Video play/pause overlay */}
            {currentItem?.type === 'video' && (
              <button
                onClick={togglePlay}
                className="absolute bottom-4 right-4 p-3 rounded-full bg-black/50 backdrop-blur-sm text-white hover:bg-black/70 transition-colors"
              >
                {isPlaying ? <Play className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
            )}

            {/* Navigation Arrows */}
            {items.length > 1 && (
              <>
                <button
                  onClick={handlePrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 hover:bg-purple-500/20 transition-all"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={handleNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 hover:bg-purple-500/20 transition-all"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Set as Cover button (owner only) */}
            {isOwner && onSetCover && currentItem && coverMediaId !== currentItem.id && (
              <button
                onClick={() => onSetCover(currentItem)}
                className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 rounded-full bg-black/50 backdrop-blur-sm text-white text-sm hover:bg-black/70 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Star className="w-4 h-4" />
                Set as Cover
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Thumbnail Strip */}
      <div className="flex flex-col items-center gap-4">
        <div className="thumbnail-strip flex gap-3 overflow-x-auto pb-4 px-4 max-w-full" style={{ scrollbarWidth: 'thin' }}>
          {items.map((item, idx) => {
            const isSelected = idx === currentIndex;
            const isCover = item.id === coverMediaId;
            
            return (
              <button
                key={item.id}
                onClick={() => onIndexChange(idx)}
                className={`flex-shrink-0 rounded-xl relative border-2 transition-all ${
                  isSelected 
                    ? 'border-purple-500 shadow-lg shadow-purple-500/30' 
                    : 'border-transparent hover:border-purple-400/50'
                }`}
              >
                {item.type === 'video' ? (
                  <>
                    <MediaRenderer
                      kind="video"
                      src={item.url}
                      controls={false}
                      muted
                      playsInline
                      preload="metadata"
                      maxHeightClassName="max-h-20"
                      maxWidthClassName="max-w-20"
                      className="rounded-xl"
                      mediaClassName="rounded-xl"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Play className="w-6 h-6 text-white" />
                    </div>
                  </>
                ) : (
                  (() => {
                    const thumb = selectImageVariant(
                      {
                        processingStatus: item.processingStatus,
                        variants: item.variants,
                        fallbackUrl: item.url,
                      },
                      'card',
                    );
                    return (
                  <MediaRenderer
                    kind="image"
                    src={thumb.src}
                    srcSet={thumb.srcSet}
                    sizes={thumb.sizes}
                    alt={`Thumbnail ${idx + 1}`}
                    maxHeightClassName="max-h-20"
                    maxWidthClassName="max-w-20"
                    className="rounded-xl"
                    mediaClassName="rounded-xl"
                  />
                    );
                  })()
                )}
                
                {/* Cover badge */}
                {isCover && (
                  <div className="absolute top-1 right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                    <Star className="w-3 h-3 text-white fill-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-white/60 text-sm">{currentIndex + 1} of {items.length}</p>
      </div>
    </div>
  );
};

// ============================================
// PRODUCT GRID SECTION (MEDIA-LESS COLLECTIONS)
// ============================================
interface ProductGridProps {
  products: ProductItem[];
  isOwner?: boolean;
  addingAll?: boolean;
  onAddAll?: () => void;
  onAddToCart: (productId: string) => void;
  onViewProduct: (productId: string) => void;
}

const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  isOwner,
  addingAll,
  onAddAll,
  onAddToCart,
  onViewProduct,
}) => {
  return (
    <div className="flex-1">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pt-8 border-t border-white/10">
        <h2 className="text-xl font-bold text-white tracking-tight">
          Products in this collection
          <span className="text-white/40 ml-2 text-base font-normal">({products.length} item{products.length === 1 ? '' : 's'})</span>
        </h2>
        {!isOwner && onAddAll ? (
          <button
            type="button"
            onClick={onAddAll}
            disabled={addingAll}
            className="group flex items-center justify-center gap-2 px-5 py-2.5 rounded-full border border-white/15 text-white hover:bg-white/10 hover:border-white/30 transition-all duration-300 disabled:opacity-60"
          >
            <span className="font-medium text-sm">{addingAll ? 'Adding…' : 'Add all to cart'}</span>
            <span className="text-sm">🛍️</span>
          </button>
        ) : null}
      </div>

      {products.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-white/60">
          This collection doesn’t have any products yet.
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => {
            const now = Date.now();
            const onSale =
              product.salePrice != null &&
              (!product.saleStartAt || new Date(product.saleStartAt).getTime() <= now) &&
              (!product.saleEndAt || new Date(product.saleEndAt).getTime() >= now);
            const price = formatPrice(product.price);
            const salePrice = onSale ? formatPrice(product.salePrice ?? null) : null;
            const image = product.thumbnail || product.images[0];
            const canQuickAdd =
              product.totalStock > 0 &&
              product.sizes.length === 0 &&
              product.colors.length === 0 &&
              !product.hasVariants;
            const saleLabel = onSale && price && salePrice
              ? `-${Math.max(1, Math.round((1 - (product.salePrice ?? product.price) / product.price) * 100))}%`
              : null;

            return (
              <div
                key={product.id}
                className="group relative flex flex-col rounded-3xl overflow-hidden bg-white/5 backdrop-blur-md border border-white/10 hover:border-purple-400/40 hover:bg-white/10 transition-all duration-300"
              >
                <button
                  type="button"
                  onClick={() => onViewProduct(product.id)}
                  className="block w-full text-left"
                >
                  <div className="relative aspect-square bg-white/5 flex items-center justify-center overflow-hidden">
                    {image ? (
                      <img src={image} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                    ) : (
                      <span className="text-xs text-white/40">No image</span>
                    )}

                    {saleLabel ? (
                      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-purple-500/90 text-white text-[10px] font-bold uppercase tracking-wide">
                        {saleLabel}
                      </div>
                    ) : null}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-white line-clamp-1 group-hover:text-purple-300 transition-colors">{product.name}</div>
                        <div className="mt-1 text-xs text-white/40">
                          {product.hasVariants ? 'Variants available' : 'Single option'}
                        </div>
                      </div>
                      <div className="text-right min-w-[92px]">
                      {salePrice ? (
                        <div>
                          <p className="text-purple-300 font-bold text-sm">{salePrice}</p>
                          {price ? <p className="line-through text-white/40 text-xs">{price}</p> : null}
                        </div>
                      ) : (
                        <p className="text-purple-200 font-bold text-sm">{price ?? 'Price unavailable'}</p>
                      )}
                      </div>
                    </div>
                  </div>
                </button>
                <div className="px-5 pb-5 mt-auto">
                  {canQuickAdd ? (
                    <button
                      type="button"
                      onClick={() => onAddToCart(product.id)}
                      className="w-full rounded-xl bg-purple-500 hover:bg-purple-400 text-white text-sm font-semibold py-2.5 transition-colors"
                    >
                      Add to cart
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onViewProduct(product.id)}
                      className="w-full rounded-xl border border-white/20 text-sm font-semibold py-2.5 text-white/80 hover:text-white hover:border-white/40"
                    >
                      View options
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-center mt-10">
          <button
            type="button"
            className="flex items-center gap-2 px-8 py-3 rounded-full border border-white/15 text-white/70 hover:text-white hover:border-purple-400 hover:bg-purple-500/10 transition-all font-medium"
          >
            Show more products
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
        </>
      )}
    </div>
  );
};

// ============================================
// COMMENTS PANEL
// ============================================
interface CommentsPanelProps {
  collectionId: string;
  threadsCount: number;
  commentsCount: number;
  viewsCount: number;
  ownerId?: string;
  highlightCommentId?: string | null;
  price?: { min?: number | null; max?: number | null; saleMin?: number | null; saleMax?: number | null; saleEndAt?: string | null };
  onAddToCart?: () => void;
  onToggleSave: () => void;
  isSaved: boolean;
  saveBusy: boolean;
  onShare: () => void;
  onContactBrand: () => void;
  onVisitStore: () => void;
}

const CommentsPanel: React.FC<CommentsPanelProps> = ({
  collectionId,
  threadsCount,
  commentsCount,
  viewsCount,
  ownerId,
  highlightCommentId,
  price,
  onAddToCart,
  onToggleSave,
  isSaved,
  saveBusy,
  onShare,
  onContactBrand,
  onVisitStore,
}) => {
  const hasSale = price?.saleMin != null || price?.saleMax != null;
  const baseBand = (() => {
    const min = formatPrice(price?.min);
    const max = formatPrice(price?.max);
    if (min && max) return `${min} - ${max}`;
    if (min) return min;
    if (max) return max;
    return null;
  })();
  const saleBand = (() => {
    const min = formatPrice(price?.saleMin);
    const max = formatPrice(price?.saleMax);
    if (min && max) return `${min} - ${max}`;
    if (min) return min;
    if (max) return max;
    return null;
  })();

  const countdown = React.useMemo(() => {
    if (!price?.saleEndAt) return null;
    const now = Date.now();
    const end = new Date(price.saleEndAt).getTime();
    const diff = end - now;
    if (diff <= 0) return null;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days}d ${hours}h`;
  }, [price?.saleEndAt]);

  const handleSave = () => {
    if (saveBusy) return;
    onToggleSave();
  };

  return (
    <div className="lg:w-1/3 flex flex-col">
      <div className="bg-white/5 text-white border border-white/10 shadow-2xl rounded-2xl p-6 flex flex-col h-full backdrop-blur-xl">
        {/* Stats Bar */}
        <div className="flex items-center justify-around py-4 border-b border-white/10 mb-6">
          <div className="flex flex-col items-center gap-1">
            <ThreadButton 
              contentType="COLLECTION" 
              contentId={collectionId} 
              initialCount={threadsCount}
              ownerId={ownerId}
              size={24}
            />
          </div>
          <div className="flex flex-col items-center gap-1">
            <MessageCircle className="w-6 h-6 text-indigo-300" />
            <span className="text-xs font-semibold text-white">{formatCompactNumber(commentsCount)}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Eye className="w-6 h-6 text-white/70" />
            <span className="text-xs font-semibold text-white">{formatCompactNumber(viewsCount)}</span>
          </div>
        </div>

        {/* Price & CTAs */}
        <div className="space-y-3 mb-6">
          <div className="flex items-baseline gap-3">
            {hasSale && saleBand ? (
              <>
                <span className="text-2xl font-bold text-green-400">{saleBand}</span>
                {baseBand && <span className="text-lg text-white/60 line-through">{baseBand}</span>}
              </>
            ) : (
              <span className="text-2xl font-bold text-white">{baseBand || 'Price on request'}</span>
            )}
          </div>
          {hasSale && countdown && (
            <div className="flex items-center gap-2 text-orange-300 text-sm">
              <Clock className="w-4 h-4" />
              <span>Sale ends in {countdown}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {onAddToCart ? (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onAddToCart}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-shadow"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Add to Cart</span>
              </motion.button>
            ) : null}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
              className={`border-2 border-purple-500 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors ${
                isSaved ? 'bg-purple-500/20 text-purple-100' : 'text-purple-200 hover:bg-purple-500/10'
              }`}
            >
              <Heart className={`w-4 h-4 ${isSaved ? 'fill-purple-300' : ''}`} />
              <span>{isSaved ? 'Saved' : 'Save'}</span>
            </motion.button>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <button
              onClick={onContactBrand}
              className="bg-white/10 border border-white/15 px-3 py-2 rounded-lg text-white hover:bg-white/15 transition-colors flex items-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Contact Brand</span>
            </button>
            <button
              onClick={onVisitStore}
              className="bg-white/10 border border-white/15 px-3 py-2 rounded-lg text-white hover:bg-white/15 transition-colors flex items-center gap-2"
            >
              <Store className="w-4 h-4" />
              <span>Visit Store</span>
            </button>
            <button
              onClick={onShare}
              className="bg-white/10 border border-white/15 px-3 py-2 rounded-lg text-white hover:bg-white/15 transition-colors flex items-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>
          </div>
        </div>

        {/* Comments Header */}
        <h3 className="text-lg font-bold text-white mb-4">Comments</h3>
        
        {/* Comments List */}
        <div className="flex-1 overflow-y-auto mb-4 pr-2 comments-scroll" style={{ maxHeight: '500px' }}>
          <UnifiedCollectionComments 
            collectionId={collectionId}
            highlightCommentId={highlightCommentId || undefined}
          />
        </div>

        <button className="text-purple-300 hover:text-purple-200 text-sm font-medium mb-4 text-center">
          View all {commentsCount} comments
        </button>
      </div>
    </div>
  );
};

// ============================================
// RELATED COLLECTIONS CAROUSEL
// ============================================
interface RelatedCollectionCardProps {
  collection: RelatedCollection;
  onClick: () => void;
}

const RelatedCollectionCard: React.FC<RelatedCollectionCardProps> = ({ collection, onClick }) => {
  const [resolvedCover, setResolvedCover] = useState<string | undefined>(collection.coverImage);

  useEffect(() => {
    let mounted = true;
    const resolve = async () => {
      if (collection.coverFileId) {
        const url = await brandApi.getSignedFileUrl(collection.coverFileId);
        if (mounted && url) setResolvedCover(url);
      }
    };
    resolve();
    return () => { mounted = false; };
  }, [collection.coverFileId]);

  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      onClick={onClick}
      className="flex-shrink-0 w-64 cursor-pointer"
    >
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden">
        <div>
          {resolvedCover ? (
            <MediaRenderer
              kind="image"
              src={resolvedCover}
              alt={collection.title}
              maxHeightClassName="max-h-64"
              className="w-full"
            />
          ) : (
            <div className="w-full h-64 bg-gradient-to-br from-purple-900/50 to-indigo-900/50 flex items-center justify-center">
              <span className="text-4xl font-bold text-white/20">{collection.title.charAt(0)}</span>
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-white mb-2 truncate">{collection.title}</h3>
          {(collection.brandName || collection.username) && (
            <p className="text-sm text-gray-400 mb-2">
              {collection.brandName ? collection.brandName : `@${collection.username}`} • {collection.itemCount || 0} pieces
            </p>
          )}
          {(collection.minPrice || collection.maxPrice) && (
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-green-400">
                {formatPrice(collection.minPrice)}
              </span>
              {collection.maxPrice && collection.minPrice !== collection.maxPrice && (
                <span className="text-sm text-gray-500">- {formatPrice(collection.maxPrice)}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

interface RelatedCollectionsSectionProps {
  title: string;
  collections: RelatedCollection[];
  onCollectionClick: (id: string) => void;
}

const RelatedCollectionsSection: React.FC<RelatedCollectionsSectionProps> = ({
  title,
  collections,
  onCollectionClick,
}) => {
  if (collections.length === 0) return null;

  return (
    <section className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-8">{title}</h2>
        
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollbarWidth: 'thin' }}>
          {collections.map((collection) => (
            <RelatedCollectionCard
              key={collection.id}
              collection={collection}
              onClick={() => onCollectionClick(collection.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

// ============================================
// LOCKED STATE
// ============================================
interface LockedStateProps {
  brandName?: string;
  requestState: AccessState | null;
  onRequestAccess: () => void;
  onBack: () => void;
  isRequesting: boolean;
}

const LockedState: React.FC<LockedStateProps> = ({
  brandName = 'Brand',
  requestState,
  onRequestAccess,
  onBack,
  isRequesting,
}) => {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full"
      >
        <div className="bg-gradient-to-br from-purple-900/20 via-indigo-900/10 to-black border border-purple-500/20 rounded-3xl p-8 backdrop-blur-xl">
          <div className="flex flex-col items-center text-center space-y-6">
            {/* Icon */}
            <div className="relative">
              <div className="absolute inset-0 bg-purple-500/20 blur-2xl rounded-full" />
              <div className="relative bg-gradient-to-br from-purple-900/40 to-indigo-900/30 p-5 rounded-2xl border border-purple-500/30">
                <Lock className="w-10 h-10 text-purple-400" />
              </div>
            </div>

            {/* Title */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Private Collection</h2>
              <p className="text-gray-400">
                Request access to view exclusive content from {brandName}
              </p>
            </div>

            {/* Request State */}
            {requestState === 'PENDING' ? (
              <div className="w-full px-4 py-3 rounded-xl bg-amber-900/20 border border-amber-700/30">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span className="text-amber-300 font-medium">Request pending</span>
                </div>
              </div>
            ) : requestState === 'APPROVED' ? (
              <div className="w-full px-4 py-3 rounded-xl bg-green-900/20 border border-green-700/30">
                <span className="text-green-300 font-medium">✓ Access approved! Loading...</span>
              </div>
            ) : requestState === 'REVOKED' ? (
              <div className="w-full px-4 py-3 rounded-xl bg-red-900/20 border border-red-700/30">
                <p className="text-red-300 font-medium mb-1">Access declined</p>
                <p className="text-red-400 text-sm">Wait 72 hours to request again</p>
              </div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onRequestAccess}
                disabled={isRequesting}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold py-3 px-6 rounded-xl shadow-lg shadow-purple-500/25 disabled:opacity-50"
              >
                {isRequesting ? 'Requesting...' : 'Request Access'}
              </motion.button>
            )}

            <button
              onClick={onBack}
              className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
            >
              ← Back to collections
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ============================================
// LOADING STATE
// ============================================
const LoadingState: React.FC = () => (
  <div className="min-h-screen bg-black">
    {/* Hero skeleton */}
    <div className="w-full h-[70vh] bg-gray-900 animate-pulse" />
    
    {/* Content skeleton */}
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 lg:w-2/3">
          <div className="aspect-[4/5] bg-gray-800 rounded-2xl animate-pulse" />
          <div className="flex gap-3 mt-8 justify-center">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-20 h-20 bg-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
        <div className="lg:w-1/3">
          <div className="h-[600px] bg-gray-800 rounded-2xl animate-pulse" />
        </div>
      </div>
    </div>
  </div>
);

// ============================================
// MAIN COMPONENT
// ============================================
const DesignView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const me = useSelector((s: RootState) => s.user.profile);
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const dispatch = useDispatch<AppDispatch>();

  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [detail, setDetail] = useState<CollectionDetail | null>(null);
  const [requestState, setRequestState] = useState<AccessState | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [productItems, setProductItems] = useState<ProductItem[]>([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [moreFromBrand, setMoreFromBrand] = useState<RelatedCollection[]>([]);
  const [youMightLike, setYouMightLike] = useState<RelatedCollection[]>([]);
  const [addingAll, setAddingAll] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  const highlightCommentId = new URLSearchParams(window.location.search).get('commentId');

  const isOwner = useMemo(
    () => Boolean(me?.id && detail?.owner?.id && me.id === detail.owner.id),
    [me?.id, detail?.owner?.id]
  );

  // Load collection detail
  useEffect(() => {
    let mounted = true;
    
    const loadCollection = async () => {
      if (!id) return;
      
      setLoading(true);
      setLocked(false);
      
      try {
        const d = await brandApi.getCollectionDetail(id);
        if (!mounted) return;
        
        if (d) {
          setDetail(d);

          const products: ProductItem[] = (d.products ?? [])
            .map((link: any): ProductItem => {
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
                colors: Array.isArray(p.colors) ? p.colors : [],
                hasVariants: Array.isArray(p.variants)
                  ? p.variants.length > 0
                  : Boolean((p as any)?._count?.variants),
                totalStock: typeof p.totalStock === 'number' ? p.totalStock : 0,
                orderIndex: link?.orderIndex ?? 0,
              };
            })
            .filter((p: ProductItem) => Boolean(p.id))
            .sort((a: ProductItem, b: ProductItem) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
          if (mounted) {
            setProductItems(products);
          }
          
          // Process media items
          const medias = (d.medias ?? []).map((m: any, idx: number) => {
            const file = m?.file;
            const rawUrl = file?.s3Url || file?.url || '';
            const mime = file?.mimeType || '';
            const type: 'image' | 'video' = mime.startsWith('video') ? 'video' : 'image';
            return {
              id: m.id,
              url: rawUrl,
              type,
              fileId: file?.id,
              caption: m.caption ?? null,
              order: m.orderIndex ?? idx,
              processingStatus: file?.processingStatus,
              variants: file?.variants,
            };
          });
          
          // Resolve signed URLs
          const resolved = await Promise.all(
            medias.map(async (item: MediaItem) => {
              if (item.fileId) {
                try {
                  const url = await brandApi.getSignedFileUrl(item.fileId);
                  return { ...item, url: url || item.url };
                } catch {
                  return item;
                }
              }
              return item;
            })
          );
          
          if (mounted) {
            setMediaItems(resolved);
          }
        } else {
          setLocked(true);
          setProductItems([]);
        }
      } catch (e: any) {
        if (mounted) {
          const status = e?.response?.status;
          if (status === 404 || status === 403 || status === 410) {
            setLocked(true);
          } else {
            toast.error('Failed to load design');
            navigate(-1);
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadCollection();
    return () => { mounted = false; };
  }, [id, navigate]);

  // Load related collections
  useEffect(() => {
    // TODO: Implement API calls to fetch related collections when backend endpoint is available
    // For now, set empty arrays to satisfy TypeScript
    setMoreFromBrand([]);
    setYouMightLike([]);
  }, [detail?.owner?.id]);

  const handleBack = () => navigate(-1);
  
  const handleShare = async () => {
    const url = `${window.location.origin}/collections/${id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: detail?.title || 'Collection',
          text: detail?.description || 'Check out this collection',
          url,
        });
      } catch {
        // User cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard');
      } catch {
        toast.error('Failed to copy link');
      }
    }
  };

  const handleRequestAccess = async () => {
    if (!me) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    
    setIsRequesting(true);
    try {
      const res = await AccessApi.requestAccess(id!);
      setRequestState(res.state);
      
      if (res.state === 'APPROVED') {
        toast.success('Access approved!');
        // Reload collection
        const d = await brandApi.getCollectionDetail(id!);
        if (d) {
          setDetail(d);
          setLocked(false);
        }
      } else if (res.state === 'PENDING') {
        toast.info('Access request sent');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      if (msg?.includes('wait')) {
        toast.error(msg);
        setRequestState('REVOKED');
      } else {
        toast.error('Unable to request access');
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const handleAddToCart = () => {
    void handleAddAllToCart();
  };

  const handleAddAllToCart = async () => {
    if (!isAuth) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    const eligible = productItems.filter(
      (p) =>
        p.totalStock > 0 &&
        p.sizes.length === 0 &&
        p.colors.length === 0 &&
        !p.hasVariants,
    );
    if (eligible.length === 0) {
      toast.info('No products available for quick add');
      return;
    }
    setAddingAll(true);
    try {
      const results = await Promise.all(
        eligible.map((p) =>
          dispatch(addToCart({ productId: p.id, quantity: 1 }))
            .unwrap()
            .then(() => true)
            .catch(() => false),
        ),
      );
      const successCount = results.filter(Boolean).length;
      if (successCount > 0) {
        dispatch(openCartDrawer());
        toast.success(`Added ${successCount} item${successCount === 1 ? '' : 's'} to cart`);
      }
      if (successCount < eligible.length) {
        toast.error('Some items could not be added to cart');
      }
    } finally {
      setAddingAll(false);
    }
  };

  const handleAddProductToCart = async (productId: string) => {
    if (!isAuth) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    try {
      await dispatch(addToCart({ productId, quantity: 1 })).unwrap();
      dispatch(openCartDrawer());
      toast.success('Added to cart');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to add to cart');
    }
  };

  useEffect(() => {
    let mounted = true;
    const loadSaved = async () => {
      if (!id || !isAuth) {
        if (mounted) setIsSaved(false);
        return;
      }
      try {
        const res = await apiClient.get('/saved/check', {
          params: { targetType: 'COLLECTION', targetId: id },
        });
        if (mounted) {
          setIsSaved(Boolean(res.data?.isSaved));
        }
      } catch {
        if (mounted) setIsSaved(false);
      }
    };
    void loadSaved();
    return () => { mounted = false; };
  }, [id, isAuth]);

  const handleToggleSave = async () => {
    if (!id) return;
    if (!isAuth) {
      const returnTo = `${window.location.pathname}${window.location.search}`;
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    if (saveBusy) return;
    try {
      setSaveBusy(true);
      if (isSaved) {
        await apiClient.delete('/saved', { data: { targetType: 'COLLECTION', targetId: id } });
        setIsSaved(false);
        toast.success('Removed from saved.');
      } else {
        await apiClient.post('/saved', { targetType: 'COLLECTION', targetId: id });
        setIsSaved(true);
        toast.success('Saved for later.');
      }
    } catch {
      toast.error('Unable to update saved items.');
    } finally {
      setSaveBusy(false);
    }
  };

  const handleSetCover = async (item: MediaItem) => {
    if (!isOwner || !id) return;
    try {
      const res = await brandApi.updateCollection(id, { coverMediaId: item.id } as any);
      if (res) {
        setDetail(d => d ? { ...d, coverMediaId: item.id } : d);
        toast.success('Cover updated');
      }
    } catch {
      toast.error('Failed to set cover');
    }
  };

  const handleContactBrand = () => {
    toast.info('Contact feature coming soon');
  };

  const handleVisitStore = () => {
    if (detail?.owner?.brand?.id) {
      navigate(`/profile/${detail.owner.brand.id}`);
    }
  };

  const handleCollectionClick = (collectionId: string) => {
    navigate(`/collections/${collectionId}`);
  };

  const handleViewProduct = (productId: string) => {
    if (!detail) return;
    const params = new URLSearchParams({
      collectionId: detail.id,
      collectionTitle: detail.title,
    });
    navigate(`/products/${productId}?${params.toString()}`);
  };

  // Loading state
  if (loading) {
    return <LoadingState />;
  }

  // Locked state
  if (locked) {
    return (
      <LockedState
        brandName={detail?.owner?.brand?.brandName || detail?.owner?.username}
        requestState={requestState}
        onRequestAccess={handleRequestAccess}
        onBack={handleBack}
        isRequesting={isRequesting}
      />
    );
  }

  // Not found
  if (!detail) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Design not found</p>
          <button 
            onClick={handleBack}
            className="text-purple-400 hover:text-purple-300 font-medium"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const commentsCount = (detail.commentsCount ?? detail._count?.comments ?? 0) +
    (detail.medias?.reduce((sum: number, m: any) => sum + (m?.commentsCount || 0), 0) || 0);
  const hasMedia = mediaItems.length > 0;
  const hasProducts = productItems.length > 0;
  const mediaCount = detail._count?.medias ?? mediaItems.length;
  const itemCount = (mediaCount || 0) + productItems.length;

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="w-full px-4 md:px-8 xl:px-16 py-8 flex justify-center">
        <div className="w-full max-w-[1280px]">
          <div className="flex items-center gap-2 mb-8 text-sm">
            <button onClick={() => navigate('/')} className="text-white/60 hover:text-purple-300 transition-colors" type="button">Home</button>
            <span className="text-white/40">/</span>
            <button onClick={handleBack} className="text-white/60 hover:text-purple-300 transition-colors" type="button">Collections</button>
            <span className="text-white/40">/</span>
            <span className="text-white font-medium truncate">{detail.title}</span>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div className="space-y-2">
              <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">{detail.title}</h1>
              <p className="text-white/60 max-w-3xl">
                {detail.description || `A curated collection from @${detail.owner?.username || 'threadly'} with ${itemCount} piece${itemCount === 1 ? '' : 's'}.`}
              </p>
            </div>
            <div className="flex gap-3">
              <button type="button" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white/80 hover:text-white transition-all text-sm font-medium">
                Filter
              </button>
              <button type="button" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white/80 hover:text-white transition-all text-sm font-medium">
                Sort by: Newest
              </button>
            </div>
          </div>

          <ProductGrid
            products={productItems}
            isOwner={isOwner}
            addingAll={addingAll}
            onAddAll={!isOwner && hasProducts ? handleAddAllToCart : undefined}
            onAddToCart={handleAddProductToCart}
            onViewProduct={handleViewProduct}
          />

          <section className="pt-14">
            <div className="flex flex-col lg:flex-row gap-8">
              {hasMedia ? (
                <MediaGallery
                  items={mediaItems}
                  currentIndex={currentMediaIndex}
                  onIndexChange={setCurrentMediaIndex}
                  coverMediaId={detail.coverMediaId}
                  isOwner={isOwner}
                  onSetCover={handleSetCover}
                />
              ) : (
                <div className="flex-1 lg:w-2/3 rounded-2xl border border-white/10 bg-white/5 p-8 text-white/60">
                  Collection media is not available for this drop.
                </div>
              )}

              <CommentsPanel
                collectionId={detail.id}
                threadsCount={detail.totalThreads || 0}
                commentsCount={commentsCount}
                viewsCount={detail._count?.views || 0}
                ownerId={detail.owner?.id}
                highlightCommentId={highlightCommentId}
                price={{
                  min: detail.minPrice,
                  max: detail.maxPrice,
                  saleMin: detail.saleMinPrice,
                  saleMax: detail.saleMaxPrice,
                  saleEndAt: detail.saleEndAt,
                }}
                onAddToCart={!isOwner && hasProducts ? handleAddToCart : undefined}
                onToggleSave={handleToggleSave}
                isSaved={isSaved}
                saveBusy={saveBusy}
                onShare={handleShare}
                onContactBrand={handleContactBrand}
                onVisitStore={handleVisitStore}
              />
            </div>
          </section>
        </div>
      </main>

      {/* More from Brand */}
      <div className="bg-black">
        <RelatedCollectionsSection
          title={`More from ${detail.owner?.brand?.brandName || detail.owner?.username || 'Brand'}`}
          collections={moreFromBrand}
          onCollectionClick={handleCollectionClick}
        />
      </div>

      {/* You Might Also Thread */}
      <div className="bg-gray-900">
        <RelatedCollectionsSection
          title="You Might Also Thread"
          collections={youMightLike}
          onCollectionClick={handleCollectionClick}
        />
      </div>

      {/* Custom scrollbar styles */}
      <style>{`
        .thumbnail-strip::-webkit-scrollbar {
          height: 4px;
        }
        .thumbnail-strip::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }
        .thumbnail-strip::-webkit-scrollbar-thumb {
          background: rgba(147, 51, 234, 0.5);
          border-radius: 2px;
        }
        .comments-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .comments-scroll::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }
        .comments-scroll::-webkit-scrollbar-thumb {
          background: rgba(147, 51, 234, 0.5);
          border-radius: 3px;
        }
      `}</style>
    </div>
  );
};

export default DesignView;
