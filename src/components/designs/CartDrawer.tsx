import React, { useState } from 'react';
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
} from '@/features/cartSlice';
import { FrostedButton } from '@/components/ui/FrostedButton';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import AuthRequiredPrompt from '@/components/auth/AuthRequiredPrompt';
import MediaRenderer from '@/components/media/MediaRenderer';
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
  const user = useSelector((state: RootState) => state.user.profile);
  const isAuthenticated = !!user;

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
      toast.success('Item removed from cart');
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
              aria-label="Cart"
            >
              {/* Glass panel */}
              <div className="h-full bg-white/98 dark:bg-gray-950/98 backdrop-blur-2xl border-l border-white/30 dark:border-white/10 shadow-2xl flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-gray-200/60 dark:border-gray-800/60">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Your Cart
                  </h2>
                  {totalQuantity > 0 && (
                    <span className="px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-sm font-semibold">
                      {totalQuantity} {totalQuantity === 1 ? 'item' : 'items'}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => dispatch(closeCartDrawer())}
                  className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors"
                >
                  <X size={22} className="text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* Cart Items */}
              <div className="flex-1 overflow-y-auto">
                {items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-6">
                    <div className="relative mb-6">
                      <div className="w-28 h-28 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 flex items-center justify-center">
                        <ShoppingBag size={48} className="text-purple-400 dark:text-purple-500" />
                      </div>
                      <span className="absolute -top-1 -right-1 text-3xl">🛒</span>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Your cart is empty
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-xs leading-relaxed">
                      Discover amazing fashion from African designers and add items to your cart
                    </p>
                    <FrostedButton variant="primary" onClick={handleContinueShopping}>
                      Start Shopping
                    </FrostedButton>
                  </div>
                ) : (
                  <div className="p-4 space-y-3">
                    {items.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="group relative flex gap-4 p-3 rounded-2xl bg-gray-50/80 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-800/60 hover:border-purple-200 dark:hover:border-purple-800/40 transition-all duration-200"
                      >
                        {/* Delete button - top right */}
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={isLoading}
                          className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200"
                        >
                          <Trash2 size={16} />
                        </button>

                        {/* Thumbnail */}
                        <div className="max-w-20 max-h-24 flex-shrink-0 rounded-xl overflow-hidden">
                          {item.product.thumbnail ? (
                            <MediaRenderer
                              kind="image"
                              src={item.product.thumbnail}
                              alt={item.product.name}
                              maxHeightClassName="max-h-24"
                              maxWidthClassName="max-w-20"
                              className="rounded-xl"
                              mediaClassName="rounded-xl"
                            />
                          ) : (
                            <div className="w-20 h-24 flex items-center justify-center text-gray-400 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
                              <ShoppingBag size={24} />
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0 pr-6">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug">
                            {item.product.name}
                          </h4>
                          
                          {/* Variant info */}
                          {(item.selectedSize || item.selectedColor) && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              {[
                                item.selectedSize && `Size: ${item.selectedSize}`,
                                item.selectedColor && `Color: ${item.selectedColor}`,
                              ]
                                .filter(Boolean)
                                .join(' • ')}
                            </p>
                          )}

                          {/* Quantity controls */}
                          <div className="flex items-center gap-3 mt-3">
                            <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900">
                              <button
                                onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                disabled={item.quantity <= 1 || isLoading}
                                className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                              >
                                <Minus size={14} />
                              </button>
                              <span className="w-8 text-center text-sm font-semibold text-gray-900 dark:text-white">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                disabled={isLoading}
                                className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 transition-colors"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Price - right aligned */}
                        <div className="flex flex-col items-end justify-between py-1">
                          {item.product.isOnSale && item.product.salePrice ? (
                            <>
                              <span className="text-xs text-gray-400 line-through">
                                {formatPrice(item.product.price * item.quantity)}
                              </span>
                              <span className="text-base font-bold text-gray-900 dark:text-white">
                                {formatPrice(item.product.effectivePrice * item.quantity)}
                              </span>
                            </>
                          ) : (
                            <span className="text-base font-bold text-gray-900 dark:text-white mt-auto">
                              {formatPrice(item.product.effectivePrice * item.quantity)}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer - only show when cart has items */}
              {items.length > 0 && (
                <div className="border-t border-gray-200/60 dark:border-gray-800/60 bg-gradient-to-t from-white via-white to-white/80 dark:from-gray-950 dark:via-gray-950 dark:to-gray-950/80 p-5">
                  {/* Promo Code Section */}
                  <div className="mb-4">
                    {appliedPromo ? (
                      <div className="flex items-center justify-between p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/40">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                            <Check size={16} className="text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                              {appliedPromo.code} applied
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-400">
                              -{formatPrice(discount)} off
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleRemovePromo}
                          className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Tag size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              value={promoInput}
                              onChange={(e) => {
                                setPromoInput(e.target.value.toUpperCase());
                                setPromoError(null);
                              }}
                              placeholder="Enter promo code"
                              className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                              onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                            />
                          </div>
                          <button
                            onClick={handleApplyPromo}
                            disabled={applyingPromo || !promoInput.trim()}
                            className="px-5 h-11 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold text-sm hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {applyingPromo ? '...' : 'Apply'}
                          </button>
                        </div>
                        {promoError && (
                          <div className="flex items-center gap-1.5 text-red-500 text-xs">
                            <AlertCircle size={12} />
                            {promoError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Order Summary */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                      <span className="font-medium text-gray-900 dark:text-white">{formatPrice(subtotal)}</span>
                    </div>
                    
                    {appliedPromo && discount > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Discount</span>
                        <span className="font-medium text-green-600 dark:text-green-400">-{formatPrice(discount)}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Shipping</span>
                      <span className="text-gray-500 dark:text-gray-400 text-xs italic">Calculated at checkout</span>
                    </div>
                    
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-800">
                      <span className="text-base font-semibold text-gray-900 dark:text-white">Total</span>
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">{formatPrice(total)}</span>
                    </div>
                  </div>

                  {/* Checkout Button */}
                  <button
                    onClick={handleCheckout}
                    disabled={isLoading}
                    className="w-full h-14 rounded-xl bg-gradient-to-r from-purple-600 via-purple-600 to-indigo-600 hover:from-purple-700 hover:via-purple-700 hover:to-indigo-700 text-white font-semibold text-base flex items-center justify-center gap-2 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Lock size={18} />
                    Proceed to Checkout
                  </button>

                  {/* Continue Shopping */}
                  <button
                    onClick={handleContinueShopping}
                    className="w-full mt-3 flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 text-sm font-medium transition-colors"
                  >
                    <ArrowLeft size={16} />
                    Continue Shopping
                  </button>

                  {/* Payment Methods */}
                  <div className="flex items-center justify-center gap-4 mt-5 pt-4 border-t border-gray-200/50 dark:border-gray-800/50">
                    <span className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800/80 text-xs font-bold text-gray-700 dark:text-gray-300 border border-gray-200/60 dark:border-gray-700/60">
                      PAYSTACK
                    </span>
                    <span className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800/80 text-xs font-bold text-gray-700 dark:text-gray-300 border border-gray-200/60 dark:border-gray-700/60">
                      FLUTTERWAVE
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-8 h-5 rounded bg-gradient-to-r from-blue-600 to-blue-700 flex items-center justify-center shadow-sm">
                        <span className="text-[8px] font-bold text-white tracking-wide">VISA</span>
                      </div>
                      <div className="w-8 h-5 rounded bg-gradient-to-r from-red-500 to-orange-500 flex items-center justify-center shadow-sm">
                        <span className="text-[8px] font-bold text-white tracking-wide">MC</span>
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
