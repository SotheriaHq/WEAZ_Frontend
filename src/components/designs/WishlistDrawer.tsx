import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { X, Heart, ShoppingBag, Trash2, Sparkles, AlertTriangle, AlertCircle } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import type { AppDispatch, RootState } from '@/store';
import {
  closeWishlistDrawer,
  removeFromWishlist,
  fetchWishlist,
  selectWishlistItems,
  selectWishlistTotal,
  selectWishlistIsDrawerOpen,
  selectWishlistIsLoading,
  selectWishlistPriceChangeNotices,
  clearWishlistNotices,
} from '@/features/wishlistSlice';
import AuthRequiredPrompt from '@/components/auth/AuthRequiredPrompt';
import ImageWithFallback from '@/components/ImageWithFallback';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useBagging } from '@/hooks/useBagging';
import { BAG_IT_EMOJI, BAG_IT_LABEL } from '@/constants/bagging';

const WishlistDrawer: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();

  const isOpen = useSelector(selectWishlistIsDrawerOpen);
  const items = useSelector(selectWishlistItems);
  const total = useSelector(selectWishlistTotal);
  const isLoading = useSelector(selectWishlistIsLoading);
  const priceChangeNotices = useSelector(selectWishlistPriceChangeNotices);
  const user = useSelector((state: RootState) => state.user.profile);
  const isAuthenticated = !!user;
  const { bagProduct } = useBagging();

  useEffect(() => {
    if (!isOpen) {
      dispatch(clearWishlistNotices());
    }
  }, [isOpen, dispatch]);

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      void dispatch(fetchWishlist({ page: 1, limit: 200 }));
    }
  }, [dispatch, isAuthenticated, isOpen]);

  // Periodically refresh while drawer is open to catch availability changes
  useEffect(() => {
    if (!isOpen || !isAuthenticated) return;
    const interval = setInterval(() => {
      void dispatch(fetchWishlist({ page: 1, limit: 200 }));
    }, 30_000);
    return () => clearInterval(interval);
  }, [dispatch, isAuthenticated, isOpen]);

  const formatPrice = (price: number, currency: string = 'NGN') =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);

  const handleRemoveItem = async (productId: string) => {
    try {
      await dispatch(removeFromWishlist(productId)).unwrap();
      toast.success('Removed from wishlist');
    } catch (error: any) {
      toast.error(error || 'Failed to remove item');
    }
  };

  const requiresOptionSelection = (product: any): boolean => {
    const hasSizes = Array.isArray(product?.sizes) && product.sizes.length > 0;
    const hasColors = Array.isArray(product?.colors) && product.colors.length > 0;
    return hasSizes || hasColors;
  };

  const resolveStoreProductRoute = (product: any) => {
    const productId = product?.id;
    const ownerId =
      typeof product?.brand?.ownerId === 'string' && product.brand.ownerId.trim().length > 0
        ? product.brand.ownerId.trim()
        : '';
    const currentProfileIdMatch = location.pathname.match(/^\/profile\/([^/?#]+)/);
    const currentProfileId = currentProfileIdMatch?.[1] ? decodeURIComponent(currentProfileIdMatch[1]) : '';
    const brandIdFromProduct =
      typeof product?.brandId === 'string' && product.brandId.trim().length > 0
        ? product.brandId.trim()
        : '';
    const brandObjectId =
      typeof product?.brand?.id === 'string' && product.brand.id.trim().length > 0
        ? product.brand.id.trim()
        : '';

    const profileId = ownerId || currentProfileId || brandIdFromProduct || brandObjectId;

    if (productId && profileId) {
      return `/profile/${encodeURIComponent(profileId)}?tab=Store&productId=${encodeURIComponent(productId)}`;
    }
    if (productId) {
      return `/products/${productId}`;
    }
    return '/profile?tab=Store';
  };

  const availabilityCopy = (status?: string) => {
    switch (status) {
      case 'OUT_OF_STOCK':
        return {
          chip: 'Out of stock',
          detail: 'This product is out of stock right now.',
        };
      case 'ARCHIVED':
        return {
          chip: 'Unavailable',
          detail: 'This product is currently unavailable.',
        };
      case 'DELETED':
        return {
          chip: 'Deleted',
          detail: 'This product has been deleted by the brand.',
        };
      case 'UNPUBLISHED':
        return {
          chip: 'Unavailable',
          detail: 'This product is no longer available in store.',
        };
      case 'STORE_CLOSED':
        return {
          chip: 'Store closed',
          detail: 'This brand store is currently closed.',
        };
      case 'OWN_PRODUCT':
        return {
          chip: 'Your product',
          detail: 'You cannot order your own brand product.',
        };
      default:
        return {
          chip: 'Available',
          detail: 'Available for checkout.',
        };
    }
  };

  const handleAddToCart = async (item: any) => {
    const product = item?.product;
    if (!product) return;

    if (item?.canAddToCart === false) {
      toast.error(availabilityCopy(item?.availabilityStatus).detail);
      return;
    }

    try {
      dispatch(closeWishlistDrawer());
      await bagProduct({ id: product.id, name: product.name });
    } catch (error: any) {
      toast.error(error || 'Failed to bag item');
    }
  };

  const handleViewProduct = (product: any) => {
    dispatch(closeWishlistDrawer());
    navigate(resolveStoreProductRoute(product));
  };


  const handleClose = () => {
    dispatch(closeWishlistDrawer());
  };

  const unavailableCount = items.filter((item) => item?.isAvailable === false).length;

  const drawerVariants = {
    hidden: { x: '100%', opacity: 0 },
    visible: {
      x: 0,
      opacity: 1,
      transition: { type: 'spring' as const, damping: 30, stiffness: 300 },
    },
    exit: {
      x: '100%',
      opacity: 0,
      transition: { duration: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.05 },
    }),
  };

  if (isOpen && !isAuthenticated) {
    return <AuthRequiredPrompt isOpen={isOpen} onClose={handleClose} feature="wishlist" />;
  }

  return (
    <OverlayPortal>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-layer-overlay"
              onClick={handleClose}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-indigo-900/50 to-blue-900/40" />
              <div className="absolute inset-0 backdrop-blur-xl" />
              <div className="absolute inset-0 surface-overlay-strong" />
            </motion.div>

            <motion.div
              variants={drawerVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="fixed right-0 top-0 bottom-0 z-layer-drawer w-full max-w-md flex flex-col"
              role="dialog"
              aria-modal="true"
              aria-label="Wishlist"
            >
              <div className="surface-modal h-full backdrop-blur-2xl shadow-2xl border-l flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-theme">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500 to-red-500 shadow-lg shadow-pink-500/30">
                      <Heart size={20} className="text-white" fill="white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-theme">Your Wishlist</h2>
                      {total > 0 && (
                        <p className="text-xs text-theme-secondary">
                          {total} saved {total === 1 ? 'item' : 'items'}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className="surface-interactive-hover p-2 rounded-full transition-colors"
                  >
                    <X size={22} className="text-[color:var(--text-secondary)]" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {(unavailableCount > 0 || priceChangeNotices.length > 0) && (
                    <div className="p-4 pb-0">
                      <div className="rounded-2xl border border-amber-200/70 dark:border-amber-700/40 bg-amber-50/70 dark:bg-amber-900/20 p-4">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                            <AlertCircle size={18} className="text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">We updated your wishlist</p>
                              <button
                                onClick={() => dispatch(clearWishlistNotices())}
                                className="text-xs font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100"
                              >
                                Dismiss
                              </button>
                            </div>

                            {unavailableCount > 0 && (
                              <p className="text-xs text-amber-800 dark:text-amber-200">
                                {unavailableCount} saved {unavailableCount === 1 ? 'item is' : 'items are'} currently unavailable.
                                You can still remove them anytime.
                              </p>
                            )}

                            {priceChangeNotices.length > 0 && (
                              <div className="space-y-1">
                                {priceChangeNotices.map((notice) => (
                                  <p key={notice.productId} className="text-xs text-amber-800 dark:text-amber-200">
                                    {notice.name} price changed from {formatPrice(notice.oldPrice, notice.currency)} to{' '}
                                    {formatPrice(notice.newPrice, notice.currency)}.
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}


                  {isLoading && items.length === 0 && total > 0 ? (
                    <div className="flex h-full items-center justify-center p-6">
                      <div className="text-sm text-theme-secondary">Loading wishlist...</div>
                    </div>
                  ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6">
                      <div className="relative mb-6">
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-100 to-red-100 dark:from-pink-900/30 dark:to-red-900/30 flex items-center justify-center">
                          <Heart size={40} className="text-pink-500" />
                        </div>
                        <div className="absolute -right-1 -bottom-1 w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center shadow-lg">
                          <Sparkles size={18} className="text-white" />
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-theme mb-2">Start Your Collection</h3>
                      <p className="text-theme-secondary mb-6 max-w-xs">
                        Save items you love to create your perfect African fashion wishlist
                      </p>
                      <button
                        onClick={handleClose}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all"
                      >
                        Explore Collections
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 space-y-3">
                      {items.map((item, index) => {
                        const product = item.product;
                        const isOnSale = product.isOnSale && product.salePrice;
                        const discountPercent = isOnSale
                          ? Math.round(((product.price - product.salePrice!) / product.price) * 100)
                          : 0;
                        const availability = availabilityCopy(item.availabilityStatus);

                        return (
                          <motion.div
                            key={item.id}
                            custom={index}
                            variants={itemVariants}
                            initial="hidden"
                            animate="visible"
                            layout
                            className={`relative group rounded-xl border p-2.5 shadow-sm transition-all duration-300 ${
                              item.isAvailable === false
                                ? 'surface-control opacity-90'
                                : 'surface-card hover:shadow-md'
                            }`}
                          >
                            {/* Frosted overlay for unavailable items */}
                            {item.isAvailable === false && (
                              <div className="surface-overlay-soft absolute inset-0 z-10 rounded-xl backdrop-blur-[1.5px] pointer-events-none" />
                            )}
                            <div className="flex gap-3">
                              <div
                                className="relative size-[4.5rem] shrink-0 overflow-hidden rounded-lg cursor-pointer bg-theme-muted"
                                onClick={() => handleViewProduct(product)}
                              >
                                {product.thumbnail ? (
                                  <ImageWithFallback
                                    src={product.thumbnail}
                                    alt={product.name}
                                    className="h-full w-full object-cover rounded-lg"
                                  />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center">
                                    <Heart size={20} className="text-[color:var(--text-secondary)]" />
                                  </div>
                                )}

                                {isOnSale && (
                                  <div className="absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold shadow-sm">
                                    -{discountPercent}%
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
                                <div>
                                  <div className="flex justify-between items-start gap-2">
                                    <div className="min-w-0 flex-1">
                                      {product.brand?.name && (
                                        <p className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mb-0.5 truncate">
                                          {product.brand.name}
                                        </p>
                                      )}
                                      <h4
                                        className="text-sm font-semibold text-theme truncate cursor-pointer hover:text-[color:var(--brand-primary)] transition-colors"
                                        onClick={() => handleViewProduct(product)}
                                      >
                                        {product.name}
                                      </h4>
                                    </div>
                                    <button
                                      onClick={() => handleRemoveItem(product.id)}
                                      className="relative z-20 p-1.5 -mt-1 -mr-1 rounded-full text-[color:var(--text-secondary)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0"
                                      aria-label="Remove from wishlist"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-sm font-bold text-theme leading-none">
                                      {formatPrice(product.effectivePrice, product.brand?.currency)}
                                    </span>
                                    {isOnSale && (
                                      <span className="text-[10px] text-theme-secondary line-through">
                                        {formatPrice(product.price, product.brand?.currency)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="mt-2 flex items-center gap-2">
                                  {item.isAvailable === false ? (
                                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400 text-[10px] font-medium truncate">
                                      <AlertTriangle size={10} className="shrink-0" />
                                      <span className="truncate">{availability.chip}</span>
                                    </div>
                                  ) : (
                                    <div className="flex-1" /> // spacer
                                  )}
                                  
                                  {item.canAddToCart !== false && (
                                    <button
                                      onClick={() => handleAddToCart(item)}
                                      disabled={isLoading}
                                      className={`ml-auto shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-all duration-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20 border border-indigo-100 dark:border-indigo-500/20`}
                                    >
                                      <ShoppingBag size={12} />
                                      {requiresOptionSelection(product) ? 'Select Options' : `${BAG_IT_EMOJI} ${BAG_IT_LABEL}`}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </OverlayPortal>
  );
};

export default WishlistDrawer;
