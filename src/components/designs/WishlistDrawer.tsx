import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { X, Heart, ShoppingCart, Trash2, Sparkles, ChevronRight, AlertTriangle, AlertCircle } from 'lucide-react';
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
  selectWishlistRemovedItemNotices,
  selectWishlistPriceChangeNotices,
  clearWishlistNotices,
} from '@/features/wishlistSlice';
import { addToCart, openCartDrawer } from '@/features/cartSlice';
import AuthRequiredPrompt from '@/components/auth/AuthRequiredPrompt';
import MediaRenderer from '@/components/media/MediaRenderer';
import { OverlayPortal } from '@/components/ui/OverlayPortal';

const WishlistDrawer: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();

  const isOpen = useSelector(selectWishlistIsDrawerOpen);
  const items = useSelector(selectWishlistItems);
  const total = useSelector(selectWishlistTotal);
  const isLoading = useSelector(selectWishlistIsLoading);
  const removedItemNotices = useSelector(selectWishlistRemovedItemNotices);
  const priceChangeNotices = useSelector(selectWishlistPriceChangeNotices);
  const user = useSelector((state: RootState) => state.user.profile);
  const isAuthenticated = !!user;

  useEffect(() => {
    if (!isOpen) {
      dispatch(clearWishlistNotices());
    }
  }, [isOpen, dispatch]);

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      void dispatch(fetchWishlist({ page: 1, limit: 50 }));
    }
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

  const handleAddToCart = async (product: any) => {
    if (requiresOptionSelection(product)) {
      dispatch(closeWishlistDrawer());
      navigate(resolveStoreProductRoute(product));
      return;
    }

    try {
      await dispatch(addToCart({ productId: product.id, quantity: 1 })).unwrap();
      dispatch(closeWishlistDrawer());
      dispatch(openCartDrawer());
      toast.success('Added to cart');
    } catch (error: any) {
      toast.error(error || 'Failed to add to cart');
    }
  };

  const handleViewProduct = (product: any) => {
    dispatch(closeWishlistDrawer());
    navigate(resolveStoreProductRoute(product));
  };


  const handleClose = () => {
    dispatch(closeWishlistDrawer());
  };

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
              <div className="absolute inset-0 bg-black/40" />
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
              <div className="h-full bg-white/95 dark:bg-gray-950/95 backdrop-blur-2xl shadow-2xl border-l border-white/20 dark:border-white/10 flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500 to-red-500 shadow-lg shadow-pink-500/30">
                      <Heart size={20} className="text-white" fill="white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-gray-900 dark:text-white">Your Wishlist</h2>
                      {total > 0 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {total} saved {total === 1 ? 'item' : 'items'}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <X size={22} className="text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {(removedItemNotices.length > 0 || priceChangeNotices.length > 0) && (
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

                            {removedItemNotices.length > 0 && (
                              <div className="space-y-1">
                                {removedItemNotices.map((notice) => (
                                  <p key={notice.productId} className="text-xs text-amber-800 dark:text-amber-200">
                                    {notice.name} was removed because it is{' '}
                                    {notice.reason === 'out_of_stock' ? 'out of stock' : 'no longer available'}.
                                  </p>
                                ))}
                              </div>
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
                      <div className="text-sm text-gray-500 dark:text-gray-400">Loading wishlist...</div>
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
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Start Your Collection</h3>
                      <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-xs">
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

                        return (
                          <motion.div
                            key={item.id}
                            custom={index}
                            variants={itemVariants}
                            initial="hidden"
                            animate="visible"
                            layout
                            className="relative group rounded-2xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 p-3 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300"
                          >
                            <motion.button
                              initial={{ opacity: 0.7, scale: 0.95 }}
                              whileHover={{ scale: 1.1 }}
                              onClick={() => handleRemoveItem(product.id)}
                              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/90 dark:bg-gray-900/90 text-red-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-lg backdrop-blur-sm"
                            >
                              <Trash2 size={14} />
                            </motion.button>

                            <div className="flex gap-3">
                              <div
                                className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl cursor-pointer"
                                onClick={() => handleViewProduct(product)}
                              >
                                {product.thumbnail ? (
                                  <MediaRenderer
                                    kind="image"
                                    src={product.thumbnail}
                                    alt={product.name}
                                    maxHeightClassName="max-h-24"
                                    maxWidthClassName="max-w-24"
                                    className="h-full w-full"
                                    mediaClassName="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="h-full w-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center">
                                    <Heart size={20} className="text-gray-400" />
                                  </div>
                                )}

                                {isOnSale && (
                                  <div className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-red-500 to-orange-500 text-white text-[10px] font-bold shadow-lg">
                                    -{discountPercent}%
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0 flex-1 pr-10">
                                {product.brand?.name && (
                                  <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium mb-0.5 truncate">
                                    {product.brand.name}
                                  </p>
                                )}

                                <h4
                                  className="text-lg font-semibold text-gray-900 dark:text-white line-clamp-1 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                  onClick={() => handleViewProduct(product)}
                                >
                                  {product.name}
                                </h4>

                                <div className="flex items-center gap-1.5 mt-1.5 mb-3">
                                  <span className="text-2xl font-bold text-gray-900 dark:text-white leading-none">
                                    {formatPrice(product.effectivePrice, product.brand?.currency)}
                                  </span>
                                  {isOnSale && (
                                    <span className="text-xs text-gray-400 line-through">
                                      {formatPrice(product.price, product.brand?.currency)}
                                    </span>
                                  )}
                                </div>

                                {product.isOutOfStock && (
                                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/80 text-white text-xs mb-3">
                                    <AlertTriangle size={12} className="text-orange-400" />
                                    Out of Stock
                                  </div>
                                )}

                                <button
                                  onClick={() => handleAddToCart(product)}
                                  disabled={product.isOutOfStock || isLoading}
                                  className={`w-full py-2.5 px-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-all duration-200 ${
                                    product.isOutOfStock
                                      ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                                      : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 hover:shadow-purple-500/40'
                                  }`}
                                >
                                  <ShoppingCart size={14} />
                                  {product.isOutOfStock
                                    ? 'Unavailable'
                                    : requiresOptionSelection(product)
                                      ? 'Select Options'
                                      : 'Add to Cart'}
                                  {requiresOptionSelection(product) && !product.isOutOfStock && <ChevronRight size={14} />}
                                </button>
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
