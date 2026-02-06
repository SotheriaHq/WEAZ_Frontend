import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';
import { checkout } from '@/api/StoreApi';
import {
  fetchCart,
  clearCart,
  selectCartPriceChangeNotices,
  selectCartRemovedItemNotices,
} from '@/features/cartSlice';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';

const CheckoutPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const cart = useSelector((s: RootState) => s.cart);
  const priceChangeNotices = useSelector(selectCartPriceChangeNotices);
  const removedItemNotices = useSelector(selectCartRemovedItemNotices);
  const user = useSelector((s: RootState) => s.user.profile);

  const [customerName, setCustomerName] = useState(() => `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim());
  const [shippingAddress, setShippingAddress] = useState('');
  const [contactInfo, setContactInfo] = useState(user?.phoneNumber || '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!cart.items.length) {
      dispatch(fetchCart());
    }
  }, [cart.items.length, dispatch]);

  const priceNoticeByItemId = useMemo(() => {
    return new Map(priceChangeNotices.map((notice) => [notice.itemId, notice]));
  }, [priceChangeNotices]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart.items.length) {
      toast.error('Your cart is empty');
      return;
    }

    setSubmitting(true);
    try {
      await checkout({
        customerName: customerName || undefined,
        shippingAddress: shippingAddress ? { address: shippingAddress } : undefined,
        contactInfo: contactInfo ? { phone: contactInfo } : undefined,
      });
      await dispatch(clearCart());
      toast.success('Order placed successfully');
      navigate('/orders');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Checkout</h1>
          <p className="text-sm text-gray-500">Confirm your details and place your order.</p>
        </div>

        {(priceChangeNotices.length > 0 || removedItemNotices.length > 0) && (
          <div className="rounded-xl border border-amber-200/70 dark:border-amber-700/40 bg-amber-50/70 dark:bg-amber-900/20 p-4 text-sm text-amber-900 dark:text-amber-100">
            {removedItemNotices.length > 0 && (
              <p className="font-medium">
                Some items were removed because they are out of stock or no longer available.
              </p>
            )}
            {priceChangeNotices.length > 0 && (
              <p className="font-medium">
                Prices were updated for {priceChangeNotices.length} item
                {priceChangeNotices.length > 1 ? 's' : ''}. Review the changes below.
              </p>
            )}
          </div>
        )}

        <div className="bg-transparent border border-gray-200/70 dark:border-white/10 rounded-xl p-6 space-y-4">
          <Input
            label="Full name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Jane Doe"
            required
          />
          <Textarea
            label="Shipping address"
            rows={3}
            value={shippingAddress}
            onChange={(e) => setShippingAddress(e.target.value)}
            placeholder="Street, city, state"
            required
          />
          <Input
            label="Contact info"
            value={contactInfo}
            onChange={(e) => setContactInfo(e.target.value)}
            placeholder="Phone or email"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-black text-white disabled:opacity-50"
        >
          {submitting ? 'Placing order...' : 'Place order'}
        </button>
      </form>

      <div className="bg-transparent border border-gray-200/70 dark:border-white/10 rounded-xl p-6 space-y-4">
        <h3 className="text-lg font-semibold">Order summary</h3>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {cart.items.map((item) => (
            <div key={item.id} className="py-3 flex items-start justify-between gap-4 text-sm">
              <div>
                <div className="font-medium">{item.product.name}</div>
                <div className="text-gray-500">
                  {(() => {
                    const notice = priceNoticeByItemId.get(item.id);
                    if (!notice) {
                      return (
                        <>
                          {item.quantity} ×{' '}
                          {item.product.effectivePrice.toLocaleString('en-NG', {
                            style: 'currency',
                            currency: cart.currency,
                          })}
                        </>
                      );
                    }
                    return (
                      <>
                        {item.quantity} ×{' '}
                        <span className="line-through text-gray-400 mr-1">
                          {notice.oldPrice.toLocaleString('en-NG', {
                            style: 'currency',
                            currency: cart.currency,
                          })}
                        </span>
                        <span className="text-amber-700 dark:text-amber-300 font-medium">
                          {notice.newPrice.toLocaleString('en-NG', {
                            style: 'currency',
                            currency: cart.currency,
                          })}
                        </span>
                      </>
                    );
                  })()}
                </div>
                <div className="text-gray-400">
                  {item.selectedSize && <span className="mr-2">Size {item.selectedSize}</span>}
                  {item.selectedColor && <span>Color {item.selectedColor}</span>}
                </div>
              </div>
              <div className="font-medium">
                {(item.itemTotal).toLocaleString('en-NG', { style: 'currency', currency: cart.currency })}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between font-semibold text-lg pt-3">
          <span>Subtotal</span>
          <span>{cart.subtotal.toLocaleString('en-NG', { style: 'currency', currency: cart.currency })}</span>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
