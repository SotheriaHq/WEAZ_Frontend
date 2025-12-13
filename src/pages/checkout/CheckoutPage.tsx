import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { checkout } from '@/api/StoreApi';
import { fetchCart, clearCart } from '@/features/cartSlice';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const CheckoutPage: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const cart = useSelector((s: RootState) => s.cart);
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

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-4 shadow-sm">
          <div>
            <label className="text-sm text-gray-600">Full name</label>
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Jane Doe"
              required
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Shipping address</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2"
              rows={3}
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              placeholder="Street, city, state"
              required
            />
          </div>
          <div>
            <label className="text-sm text-gray-600">Contact info</label>
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="Phone or email"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-black text-white disabled:opacity-50"
        >
          {submitting ? 'Placing order...' : 'Place order'}
        </button>
      </form>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 space-y-4 shadow-sm">
        <h3 className="text-lg font-semibold">Order summary</h3>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {cart.items.map((item) => (
            <div key={item.id} className="py-3 flex items-start justify-between gap-4 text-sm">
              <div>
                <div className="font-medium">{item.product.name}</div>
                <div className="text-gray-500">
                  {item.quantity} × {item.product.effectivePrice.toLocaleString('en-NG', { style: 'currency', currency: cart.currency })}
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
