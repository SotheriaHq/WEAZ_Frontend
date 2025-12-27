import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { X, Heart, ShoppingCart, Trash2, Sparkles, ChevronRight, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import type { AppDispatch, RootState } from '@/store';
import {
  closeWishlistDrawer,
  removeFromWishlist,
  selectWishlistItems,
  selectWishlistTotal,
  selectWishlistIsDrawerOpen,
  selectWishlistIsLoading,
} from '@/features/wishlistSlice';
import { addToCart, openCartDrawer } from '@/features/cartSlice';
import AuthRequiredPrompt from '@/components/auth/AuthRequiredPrompt';
import MediaRenderer from '@/components/media/MediaRenderer';

/**
 * WishlistDrawer Component
 * 
 * A modern slide-in wishlist drawer with:
 * - Gradient blur backdrop (unified with CartDrawer)
 * - Framer Motion animations
 * - Grid layout for wishlist items
 * - Quick add to cart functionality
 * - Stock availability indicators
 * - Sale badges
 * 
 * Design: Matches the Threadly design system
 */
const WishlistDrawer: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const isOpen = useSelector(selectWishlistIsDrawerOpen);
  const items = useSelector(selectWishlistItems);
  const total = useSelector(selectWishlistTotal);
  const isLoading = useSelector(selectWishlistIsLoading);
  const user = useSelector((state: RootState) => state.user.profile);
  const isAuthenticated = !!user;

  const formatPrice = (price: number, currency: string = 'NGN') => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const handleRemoveItem = async (productId: string) => {
    try {
      await dispatch(removeFromWishlist(productId)).unwrap();
      toast.success('Removed from wishlist');
    } catch (error: any) {
      toast.error(error || 'Failed to remove item');
    }
  };

  const handleAddToCart = async (product: any) => {
    // If product has sizes, navigate to product detail
    if (product.sizes && product.sizes.length > 0) {
      dispatch(closeWishlistDrawer());
      navigate(`/products/${product.id}`);
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

  const handleViewProduct = (productId: string) => {
    dispatch(closeWishlistDrawer());
    navigate(`/products/${productId}`);
  };

  const handleClose = () => {
    dispatch(closeWishlistDrawer());
  };

  const availableItems = items.filter((item) => !item.product.isOutOfStock);
  const itemsWithoutSize = availableItems.filter((item) => !item.product.sizes || item.product.sizes.length === 0);

  const handleAddAllToCart = async () => {
    if (itemsWithoutSize.length === 0) {
      toast.info('All items require size selection - please view each product');
      return;
    }
    
    try {
      for (const item of itemsWithoutSize) {
        await dispatch(addToCart({ productId: item.product.id, quantity: 1 })).unwrap();
      }
      dispatch(closeWishlistDrawer());
      dispatch(openCartDrawer());
      toast.success(`${itemsWithoutSize.length} items added to cart`);
    } catch (error: any) {
      toast.error(error || 'Failed to add items to cart');
    }
  };

  // Animation variants
  const drawerVariants = {
    hidden: { x: '100%', opacity: 0 },
    visible: { 
      x: 0, 
      opacity: 1,
      transition: { type: 'spring' as const, damping: 30, stiffness: 300 }
    },
    exit: { 
      x: '100%', 
      opacity: 0,
      transition: { duration: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.05 }
    })
  };

  // Show auth prompt for unauthenticated users
  if (isOpen && !isAuthenticated) {
    return (
      <AuthRequiredPrompt
        isOpen={isOpen}
        onClose={handleClose}
        feature="wishlist"
      />
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with gradient blur - matches CartDrawer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50"
            onClick={handleClose}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-indigo-900/50 to-blue-900/40" />
            <div className="absolute inset-0 backdrop-blur-xl" />
            <div className="absolute inset-0 bg-black/40" />
          </motion.div>

          {/* Drawer Panel */}
          <motion.div
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed right-0 top-0 bottom-0 w-full max-w-md z-50 flex flex-col"
          >
            {/* Glass panel */}
            <div className="h-full bg-white/95 dark:bg-gray-950/95 backdrop-blur-2xl shadow-2xl border-l border-white/20 dark:border-white/10 flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-pink-500 to-red-500 shadow-lg shadow-pink-500/30">
                    <Heart size={20} className="text-white" fill="white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                      Your Wishlist
                    </h2>
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

              {/* Wishlist Items */}
              <div className="flex-1 overflow-y-auto">
                {items.length === 0 ? (
                  /* Empty State */
                  <div className="flex flex-col items-center justify-center h-full text-center p-6">
                    <div className="relative mb-6">
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-pink-100 to-red-100 dark:from-pink-900/30 dark:to-red-900/30 flex items-center justify-center">
                        <Heart size={40} className="text-pink-500" />
                      </div>
                      <div className="absolute -right-1 -bottom-1 w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center shadow-lg">
                        <Sparkles size={18} className="text-white" />
                      </div>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      💜 Start Your Collection
                    </h3>
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
                  /* Items Grid */
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-3">
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
                            className="relative group rounded-2xl overflow-hidden bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300"
                          >
                            {/* Remove Button */}
                            <motion.button
                              initial={{ opacity: 0, scale: 0.8 }}
                              whileHover={{ scale: 1.1 }}
                              onClick={() => handleRemoveItem(product.id)}
                              className="absolute top-2 right-2 z-10 p-2 rounded-full bg-white/90 dark:bg-gray-900/90 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg backdrop-blur-sm"
                            >
                              <Trash2 size={14} />
                            </motion.button>

                            {/* Sale Badge */}
                            {isOnSale && (
                              <div className="absolute top-2 left-2 z-10 px-2 py-1 rounded-full bg-gradient-to-r from-red-500 to-orange-500 text-white text-[10px] font-bold shadow-lg">
                                -{discountPercent}%
                              </div>
                            )}

                            {/* Image */}
                            <div
                              className="relative overflow-y-auto cursor-pointer"
                              onClick={() => handleViewProduct(product.id)}
                            >
                              {product.thumbnail ? (
                                <MediaRenderer
                                  kind="image"
                                  src={product.thumbnail}
                                  alt={product.name}
                                  maxHeightClassName="max-h-48"
                                  className="rounded-none"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center">
                                  <Heart size={24} className="text-gray-400" />
                                </div>
                              )}

                              {/* Out of Stock Overlay */}
                              {product.isOutOfStock && (
                                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-black/80 rounded-lg">
                                    <AlertTriangle size={12} className="text-orange-400" />
                                    <span className="text-white text-xs font-medium">Out of Stock</span>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="p-3">
                              {/* Brand */}
                              {product.brand?.name && (
                                <p className="text-[10px] text-purple-600 dark:text-purple-400 font-medium mb-0.5">
                                  {product.brand.name}
                                </p>
                              )}
                              
                              {/* Name */}
                              <h4
                                className="text-xs font-semibold text-gray-900 dark:text-white line-clamp-2 mb-2 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                                onClick={() => handleViewProduct(product.id)}
                              >
                                {product.name}
                              </h4>

                              {/* Price */}
                              <div className="flex items-center gap-1.5 mb-3">
                                <span className="text-sm font-bold text-gray-900 dark:text-white">
                                  {formatPrice(product.effectivePrice, product.brand?.currency)}
                                </span>
                                {isOnSale && (
                                  <span className="text-[10px] text-gray-400 line-through">
                                    {formatPrice(product.price, product.brand?.currency)}
                                  </span>
                                )}
                              </div>

                              {/* Add to Cart Button */}
                              <button
                                onClick={() => handleAddToCart(product)}
                                disabled={product.isOutOfStock || isLoading}
                                className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-200 ${
                                  product.isOutOfStock
                                    ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 hover:shadow-purple-500/40'
                                }`}
                              >
                                <ShoppingCart size={12} />
                                {product.isOutOfStock 
                                  ? 'Unavailable' 
                                  : product.sizes?.length > 0 
                                    ? 'Select Size' 
                                    : 'Add to Cart'
                                }
                                {product.sizes?.length > 0 && !product.isOutOfStock && (
                                  <ChevronRight size={12} />
                                )}
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              {items.length > 0 && (
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gradient-to-t from-white to-white/80 dark:from-gray-950 dark:to-gray-950/80"
                >
                  {/* Stock Summary */}
                  <div className="flex items-center justify-between text-sm mb-4">
                    <span className="text-gray-600 dark:text-gray-400">
                      Available items
                    </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {availableItems.length} of {items.length}
                    </span>
                  </div>

                  {/* Add All Button */}
                  {availableItems.length > 0 && (
                    <button
                      onClick={handleAddAllToCart}
                      disabled={isLoading || itemsWithoutSize.length === 0}
                      className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 bg-[length:200%_auto] hover:bg-right text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      <ShoppingCart size={18} />
                      {itemsWithoutSize.length > 0 
                        ? `Add ${itemsWithoutSize.length} to Cart`
                        : 'View Products to Add'
                      }
                    </button>
                  )}

                  {/* Note for items with sizes */}
                  {availableItems.length > itemsWithoutSize.length && itemsWithoutSize.length > 0 && (
                    <p className="text-[10px] text-center text-gray-500 dark:text-gray-400 mt-2">
                      Some items require size selection
                    </p>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default WishlistDrawer;
