import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { X, Minus, Plus, Trash2, ShoppingBag, Lock, ArrowLeft, Tag, Check, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AppDispatch, RootState } from '@/store';
import {
  closeCartDrawer,
  updateCartItem,
  removeFromCart,
  selectCartItems,
  selectCartSubtotal,
  selectCartTotalQuantity,
  selectCartCurrency,
  selectCartIsDrawerOpen,
  selectCartIsLoading,
  selectCartRemovedItemNotices,
  selectCartPriceChangeNotices,
  clearCartNotices,
} from '@/features/cartSlice';
import { FrostedButton } from '@/components/ui/FrostedButton';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import AuthRequiredPrompt from '@/components/auth/AuthRequiredPrompt';
import useSignedFileUrl from '@/hooks/useSignedFileUrl';
import { OverlayPortal } from '@/components/ui/OverlayPortal';

// Promo code type
interface PromoCode {
  code: string;
  discountPercent?: number;
  discountAmount?: number;
  minOrderAmount?: number;
}

// Mock promo codes - in production these would come from the backend
const VALID_PROMO_CODES: Record<string, PromoCode> = {
  'SAVE20': { code: 'SAVE20', discountPercent: 20, minOrderAmount: 50000 },
  'FIRST10': { code: 'FIRST10', discountPercent: 10 },
  'FLAT5000': { code: 'FLAT5000', discountAmount: 5000, minOrderAmount: 30000 },
};

// Small component to handle signed URL resolution for cart thumbnails
const CartItemThumbnail: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const { url, loading } = useSignedFileUrl(undefined, src);
  if (loading) {
    return <div className="w-full h-full animate-pulse bg-gray-200 dark:bg-gray-700 rounded-lg" />;
  }
  return (
    <img
      src={url || src}
      alt={alt}
      className="w-full h-full object-cover rounded-lg"
      loading="eager"
    />
  );
};

/**
 * CartDrawer Component
 * 
 * A slide-in drawer displaying the shopping cart with:
 * - Product list with quantity controls
 * - Promo code input with validation
 * - Order summary with discounts
 * - Checkout CTA with payment methods
 * 
 * Design: Glassmorphism with gradient blur backdrop
 */
const CartDrawer: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const isOpen = useSelector(selectCartIsDrawerOpen);
  const items = useSelector(selectCartItems) || []; // Defensive: default to empty array
  const subtotal = useSelector(selectCartSubtotal) || 0;
  const totalQuantity = useSelector(selectCartTotalQuantity) || 0;
  const currency = useSelector(selectCartCurrency);
  const isLoading = useSelector(selectCartIsLoading);
  const removedItemNotices = useSelector(selectCartRemovedItemNotices);
  const priceChangeNotices = useSelector(selectCartPriceChangeNotices);
  const user = useSelector((state: RootState) => state.user.profile);
  const isAuthenticated = !!user;

  useEffect(() => {
    if (!isOpen) {
      dispatch(clearCartNotices());
    }
  }, [isOpen, dispatch]);

  // Promo code state
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [applyingPromo, setApplyingPromo] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency || 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Calculate discount
  const calculateDiscount = (): number => {
    if (!appliedPromo) return 0;
    
    if (appliedPromo.discountPercent) {
      return Math.round(subtotal * (appliedPromo.discountPercent / 100));
    }
    
    if (appliedPromo.discountAmount) {
      return appliedPromo.discountAmount;
    }
    
    return 0;
  };

  const discount = calculateDiscount();
  const total = Math.max(0, subtotal - discount);

  const handleApplyPromo = async () => {
    const code = promoInput.trim().toUpperCase();
    
    if (!code) {
      setPromoError('Please enter a promo code');
      return;
    }

    setApplyingPromo(true);
    setPromoError(null);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));

    const promo = VALID_PROMO_CODES[code];
    
    if (!promo) {
      setPromoError('Invalid promo code');
      setApplyingPromo(false);
      return;
    }

    if (promo.minOrderAmount && subtotal < promo.minOrderAmount) {
      setPromoError(`Minimum order of ${formatPrice(promo.minOrderAmount)} required`);
      setApplyingPromo(false);
      return;
    }

    setAppliedPromo(promo);
    setPromoInput('');
    toast.success(`Promo code ${code} applied!`);
    setApplyingPromo(false);
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoError(null);
  };

  const handleQuantityChange = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    try {
      await dispatch(updateCartItem({ itemId, quantity: newQuantity })).unwrap();
    } catch (error: any) {
      toast.error(error || 'Failed to update quantity');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    try {
      await dispatch(removeFromCart(itemId)).unwrap();
      toast.success('Item removed from bag');
    } catch (error: any) {
      toast.error(error || 'Failed to remove item');
    }
  };

  const handleCheckout = () => {
    dispatch(closeCartDrawer());
    navigate('/checkout', { state: { promoCode: appliedPromo?.code } });
  };

  const handleContinueShopping = () => {
    dispatch(closeCartDrawer());
  };

  if (!isOpen) return null;

  // Show auth prompt for unauthenticated users
  if (!isAuthenticated) {
    return (
      <AuthRequiredPrompt
        isOpen={isOpen}
        onClose={() => dispatch(closeCartDrawer())}
        feature="cart"
      />
    );
  }

  return (
    <OverlayPortal>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop with gradient blur - matching the design */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-layer-overlay"
              onClick={() => dispatch(closeCartDrawer())}
            >
              {/* Multi-layer gradient blur background */}
              <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-indigo-900/50 to-blue-900/40" />
              <div className="absolute inset-0 bg-gradient-to-tr from-violet-600/20 via-transparent to-cyan-600/20" />
              <div className="absolute inset-0 backdrop-blur-xl" />
              <div className="absolute inset-0 bg-black/30" />
            </motion.div>

            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-layer-drawer w-full max-w-md flex flex-col"
              role="dialog"
              aria-modal="true"
              aria-label="Shopping Bag"
            >
              {/* Glass panel */}
              <div className="h-full bg-white/98 dark:bg-gray-950/98 backdrop-blur-2xl border-l border-white/30 dark:border-white/10 shadow-2xl flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200/60 dark:border-gray-800/60">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                    Your Bag
                  </h2>
                  {totalQuantity > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[10px] font-semibold">
                      {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => dispatch(closeCartDrawer())}
                  className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors"
                >
                  <X size={16} className="text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Cart Items */}
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
                            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                              We updated your bag
                            </p>
                            <button
                              onClick={() => dispatch(clearCartNotices())}
                              className="text-xs font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100"
                            >
                              Dismiss
                            </button>
                          </div>

                          {removedItemNotices.length > 0 && (
                            <div className="space-y-1">
                              {removedItemNotices.map((notice) => (
                                <p key={notice.itemId} className="text-xs text-amber-800 dark:text-amber-200">
                                  {notice.name} was removed because it is{' '}
                                  {notice.reason === 'out_of_stock' ? 'out of stock' : 'no longer available'}.
                                </p>
                              ))}
                            </div>
                          )}

                          {priceChangeNotices.length > 0 && (
                            <div className="space-y-1">
                              {priceChangeNotices.map((notice) => (
                                <p key={notice.itemId} className="text-xs text-amber-800 dark:text-amber-200">
                                  {notice.name} price changed from {formatPrice(notice.oldPrice)} to{' '}
                                  {formatPrice(notice.newPrice)}.
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6">
                    <div className="relative mb-6">
                      <div className="w-28 h-28 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 flex items-center justify-center">
                        <ShoppingBag size={48} className="text-purple-400 dark:text-purple-500" />
                      </div>
                      <span className="absolute -top-1 -right-1 text-3xl">🛒</span>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Your bag is empty
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs leading-relaxed">
                      Discover amazing fashion from African designers and add items to your bag
                    </p>
                    <FrostedButton variant="primary" onClick={handleContinueShopping}>
                      Start Shopping
                    </FrostedButton>
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    {items.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04 }}
                        className="group relative flex gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/80 border border-gray-200/80 dark:border-gray-700/60 shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700/50 transition-all duration-200"
                      >
                        {/* Delete button - top right */}
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={isLoading}
                          className="absolute -top-1.5 -right-1.5 p-1 text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-sm hover:text-red-500 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
                        >
                          <Trash2 size={12} />
                        </button>

                        {/* Thumbnail - fixed size */}
                        <div 
                          className="w-16 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-pointer"
                          onClick={() => {
                            dispatch(closeCartDrawer());
                            navigate(`/products/${item.productId}`);
                          }}
                        >
                          {item.product.thumbnail ? (
                            <CartItemThumbnail
                              src={item.product.thumbnail}
                              alt={item.product.name}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                              <ShoppingBag size={20} />
                            </div>
                          )}
                        </div>

                        {/* Details & Controls */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                          {/* Top: Name + Brand */}
                          <div 
                            className="cursor-pointer group/link"
                            onClick={() => {
                              dispatch(closeCartDrawer());
                              navigate(`/products/${item.productId}`);
                            }}
                          >
                            <h4 className="text-xs font-semibold text-gray-900 dark:text-white line-clamp-1 leading-tight group-hover/link:text-purple-600 dark:group-hover/link:text-purple-400 transition-colors">
                              {item.product.name}
                            </h4>
                            {item.brand?.name && (
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                                {item.brand.name}
                              </p>
                            )}
                            
                            {/* Variant info */}
                            {(item.selectedSize || item.selectedColor) && (
                              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                                {[
                                  item.selectedSize && `Size: ${item.selectedSize}`,
                                  item.selectedColor && `Color: ${item.selectedColor}`,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                            )}
                          </div>

                          {/* Bottom: Quantity + Price */}
                          <div className="flex items-center justify-between mt-1.5">
                            {/* Compact quantity stepper */}
                            <div className="flex items-center rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900/80">
                              <button
                                onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                disabled={item.quantity <= 1 || isLoading}
                                className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                              >
                                <Minus size={10} />
                              </button>
                              <span className="w-6 text-center text-xs font-semibold text-gray-900 dark:text-white">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                disabled={isLoading}
                                className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 transition-colors"
                              >
                                <Plus size={10} />
                              </button>
                            </div>

                            {/* Price */}
                            <div className="flex flex-col items-end">
                              {item.product.isOnSale && item.product.salePrice ? (
                                <>
                                  <span className="text-[10px] text-gray-400 line-through leading-none">
                                    {formatPrice(item.product.price * item.quantity)}
                                  </span>
                                  <span className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                                    {formatPrice(item.product.effectivePrice * item.quantity)}
                                  </span>
                                </>
                              ) : (
                                <span className="text-sm font-bold text-gray-900 dark:text-white">
                                  {formatPrice(item.product.effectivePrice * item.quantity)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer - only show when cart has items */}
              {items.length > 0 && (
                <div className="border-t border-gray-200/60 dark:border-gray-800/60 bg-white/40 dark:bg-gray-950/40 backdrop-blur-2xl px-3 py-1.5">
                  {/* Promo Code Section */}
                  <div className="mb-1.5">
                    {appliedPromo ? (
                      <div className="flex items-center justify-between p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                            <Check size={12} className="text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-green-700 dark:text-green-300 leading-tight">
                              {appliedPromo.code} applied
                            </p>
                            <p className="text-[10px] text-green-600 dark:text-green-400 leading-tight">
                              -{formatPrice(discount)} off
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleRemovePromo}
                          className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-xs font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex gap-1.5">
                          <div className="relative flex-1">
                            <Tag size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              value={promoInput}
                              onChange={(e) => {
                                setPromoInput(e.target.value.toUpperCase());
                                setPromoError(null);
                              }}
                              placeholder="Promo code"
                              className="w-full h-7 pl-8 pr-3 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-[11px] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                              onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                            />
                          </div>
                          <button
                            onClick={handleApplyPromo}
                            disabled={applyingPromo || !promoInput.trim()}
                            className="px-2.5 h-7 rounded-md bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold text-[11px] hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {applyingPromo ? '...' : 'Apply'}
                          </button>
                        </div>
                        {promoError && (
                          <div className="flex items-center gap-1 text-red-500 text-[10px]">
                            <AlertCircle size={10} />
                            {promoError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Order Summary */}
                  <div className="space-y-0.5 mb-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
                      <span className="font-medium text-gray-900 dark:text-white">{formatPrice(subtotal)}</span>
                    </div>
                    
                    {appliedPromo && discount > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Discount</span>
                        <span className="font-medium text-green-600 dark:text-green-400">-{formatPrice(discount)}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 dark:text-gray-400">Shipping</span>
                      <span className="text-gray-400 dark:text-gray-500 text-[10px] italic">At checkout</span>
                    </div>
                    
                    <div className="flex items-center justify-between pt-1 border-t border-gray-200 dark:border-gray-800">
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">Total</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{formatPrice(total)}</span>
                    </div>
                  </div>

                  {/* Checkout + Continue */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleContinueShopping}
                      className="flex-shrink-0 px-3 h-8 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 text-[11px] font-medium transition-colors flex items-center gap-1"
                    >
                      <ArrowLeft size={11} />
                      Back
                    </button>
                    <button
                      onClick={handleCheckout}
                      disabled={isLoading}
                      className="flex-1 h-8 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold text-[11px] flex items-center justify-center gap-1 shadow-md shadow-purple-500/25 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Lock size={12} />
                      Checkout
                    </button>
                  </div>

                  {/* Payment Methods */}
                  <div className="flex items-center justify-center gap-2 mt-1.5 pt-1 border-t border-gray-100 dark:border-gray-800/50">
                    <span className="text-[9px] text-gray-400">Pay with</span>
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800/80 text-[9px] font-bold text-gray-500 dark:text-gray-400">PAYSTACK</span>
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800/80 text-[9px] font-bold text-gray-500 dark:text-gray-400">FLUTTERWAVE</span>
                    <div className="flex items-center gap-0.5">
                      <div className="w-6 h-3.5 rounded bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-center">
                        <span className="text-[6px] font-bold text-white">VISA</span>
                      </div>
                      <div className="w-6 h-3.5 rounded bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center">
                        <span className="text-[6px] font-bold text-white">MC</span>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </OverlayPortal>
  );
};

export default CartDrawer;
