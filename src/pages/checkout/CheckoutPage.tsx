import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';
import { checkout } from '@/api/StoreApi';
import type { PaymentMethodType, ShippingAddress } from '@/api/StoreApi';
import { paymentApi } from '@/api/PaymentApi';
import type { PaymentInitResult } from '@/api/PaymentApi';
import {
  fetchCart,
  clearCart,
  selectCartPriceChangeNotices,
  selectCartRemovedItemNotices,
} from '@/features/cartSlice';
import type { CartItem } from '@/features/cartSlice';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import ImageWithFallback from '@/components/ImageWithFallback';
import { formatPrice } from '@/utils/helpers';

/* ─── Constants ─── */

const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
  'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
  'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba',
  'Yobe','Zamfara',
] as const;

const SHIPPING_RATES: Record<string, number> = {
  Lagos: 2500,
  Abuja: 3500,
  FCT: 3500,
  Rivers: 3500,
};
const DEFAULT_SHIPPING = 4000;

const PAYMENT_OPTIONS: { value: PaymentMethodType; label: string; emoji: string; description: string }[] = [
  { value: 'PAYSTACK', label: 'Pay with Card (Paystack)', emoji: '💳', description: 'Debit/credit card via Paystack' },
  { value: 'FLUTTERWAVE', label: 'Pay with Flutterwave', emoji: '🦋', description: 'Card, bank, USSD via Flutterwave' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer', emoji: '🏦', description: 'Transfer to a virtual account' },
  { value: 'PAY_ON_DELIVERY', label: 'Pay on Delivery', emoji: '📦', description: 'Pay when your order arrives' },
];

type Step = 'shipping' | 'payment' | 'review';
const STEPS: Step[] = ['shipping', 'payment', 'review'];
const STEP_LABELS: Record<Step, string> = {
  shipping: 'Shipping',
  payment: 'Payment',
  review: 'Review',
};

/* ─── Helpers ─── */

function getShippingCost(state: string): number {
  return SHIPPING_RATES[state] ?? DEFAULT_SHIPPING;
}

function groupByBrand(items: CartItem[]) {
  const groups = new Map<string, { brandName: string; brandLogo?: string; items: CartItem[] }>();
  for (const item of items) {
    const key = item.brand.id;
    if (!groups.has(key)) {
      groups.set(key, { brandName: item.brand.name, brandLogo: item.brand.logo, items: [] });
    }
    groups.get(key)!.items.push(item);
  }
  return Array.from(groups.values());
}

/* ─── Component ─── */

const CheckoutPage: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const cart = useSelector((s: RootState) => s.cart);
  const priceChangeNotices = useSelector(selectCartPriceChangeNotices);
  const removedItemNotices = useSelector(selectCartRemovedItemNotices);
  const user = useSelector((s: RootState) => s.user.profile);
  const submittingRef = useRef(false);

  /* ── Step state ── */
  const [step, setStep] = useState<Step>('shipping');

  /* ── Shipping form ── */
  const [address, setAddress] = useState<ShippingAddress>({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    street: '',
    apartment: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'Nigeria',
    phone: user?.phoneNumber ?? '',
  });
  const [shippingErrors, setShippingErrors] = useState<Partial<Record<keyof ShippingAddress, string>>>({});

  /* ── Payment state ── */
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('PENDING_SELECTION');
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);

  /* ── Submission state ── */
  const [submitting, setSubmitting] = useState(false);
  const [cartLoading, setCartLoading] = useState(!cart.items.length);

  /* ── Fetch cart on mount if empty; redirect if still empty after fetch ── */
  useEffect(() => {
    if (!cart.items.length) {
      setCartLoading(true);
      dispatch(fetchCart()).finally(() => setCartLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!cartLoading && !cart.items.length) {
      toast.error('Your bag is empty');
      navigate('/', { replace: true });
    }
  }, [cartLoading, cart.items.length, navigate]);

  /* ── Derived ── */
  const priceNoticeByItemId = useMemo(
    () => new Map(priceChangeNotices.map((n) => [n.itemId, n])),
    [priceChangeNotices],
  );

  const shippingCost = address.state ? getShippingCost(address.state) : 0;
  const discountAmount = promoApplied ? Math.round(cart.subtotal * 0.1) : 0; // scaffold: 10% off
  const grandTotal = cart.subtotal + shippingCost - discountAmount;
  const brandGroups = useMemo(() => groupByBrand(cart.items), [cart.items]);

  /* ── Validation ── */
  const validateShipping = useCallback((): boolean => {
    const errors: Partial<Record<keyof ShippingAddress, string>> = {};
    if (!address.firstName.trim()) errors.firstName = 'First name is required';
    if (!address.lastName.trim()) errors.lastName = 'Last name is required';
    if (!address.street.trim()) errors.street = 'Street address is required';
    if (!address.city.trim()) errors.city = 'City is required';
    if (!address.state) errors.state = 'State is required';
    if (!address.phone.trim()) errors.phone = 'Phone number is required';
    setShippingErrors(errors);
    return Object.keys(errors).length === 0;
  }, [address]);

  /* ── Step navigation ── */
  const goNext = useCallback(() => {
    if (step === 'shipping') {
      if (!validateShipping()) return;
      setStep('payment');
    } else if (step === 'payment') {
      if (paymentMethod === 'PENDING_SELECTION') {
        toast.error('Please select a payment method');
        return;
      }
      setStep('review');
    }
  }, [step, validateShipping, paymentMethod]);

  const goBack = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }, [step]);

  const goToStep = useCallback((target: Step) => {
    const targetIdx = STEPS.indexOf(target);
    const currentIdx = STEPS.indexOf(step);
    // Only allow going back to already-completed steps
    if (targetIdx < currentIdx) setStep(target);
  }, [step]);

  /* ── Address field updater ── */
  const updateField = useCallback(<K extends keyof ShippingAddress>(field: K, value: ShippingAddress[K]) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
    setShippingErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  /* ── Promo code (scaffold) ── */
  const handleApplyPromo = useCallback(() => {
    if (!promoCode.trim()) return;
    // Scaffold: any non-empty code works for 10% off
    setPromoApplied(true);
    toast.success('Promo code applied — 10% discount');
  }, [promoCode]);

  /* ── Place order flow ── */
  const handlePlaceOrder = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      if (!cart.items.length) {
        toast.error('Your bag is empty');
        return;
      }

      // 1. Place order via checkout endpoint
      const customerName = `${address.firstName} ${address.lastName}`.trim();
      const result = await checkout({
        customerName,
        shippingAddress: address,
        contactInfo: { phone: address.phone },
        paymentMethod,
        promoCode: promoApplied ? promoCode : undefined,
      });

      const orderIds = result.orders.map((o) => o.id);

      // 2. Initialize payment (unless Pay on Delivery)
      let paymentResult: PaymentInitResult | null = null;
      if (paymentMethod !== 'PAY_ON_DELIVERY') {
        paymentResult = await paymentApi.initialize({
          orderIds,
          paymentMethod,
          email: user?.email ?? '',
        });
      }

      // 3. Clear cart
      await dispatch(clearCart());

      // Build summary for confirmation page
      const summary = {
        items: cart.items.map((i) => ({
          name: i.product.name,
          quantity: i.quantity,
          price: i.product.effectivePrice,
        })),
        subtotal: cart.subtotal,
        shippingCost,
        discount: discountAmount,
        grandTotal,
        shippingName: `${address.firstName} ${address.lastName}`,
        shippingCity: address.city,
        shippingState: address.state,
      };

      // 4. Handle gateway-specific flows
      if (paymentMethod === 'PAY_ON_DELIVERY' || paymentResult?.directApproval) {
        toast.success('Order placed successfully!');
        navigate('/checkout/confirmation', { state: { orderIds, paymentMethod, summary } });
      } else if (paymentResult?.authorizationUrl) {
        // Scaffold: simulate redirect — in production, window.location.href = paymentResult.authorizationUrl
        toast.success('Redirecting to payment gateway...');
        navigate('/checkout/confirmation', {
          state: { orderIds, paymentMethod, reference: paymentResult.reference, gateway: paymentResult.gateway, summary },
        });
      } else if (paymentResult?.bankAccount) {
        toast.success('Order placed — complete your bank transfer');
        navigate('/checkout/confirmation', {
          state: { orderIds, paymentMethod, bankAccount: paymentResult.bankAccount, reference: paymentResult.reference, summary },
        });
      } else {
        toast.success('Order placed!');
        navigate('/checkout/confirmation', { state: { orderIds, paymentMethod, summary } });
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Checkout failed. Please try again.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [cart.items.length, address, paymentMethod, promoApplied, promoCode, user?.email, dispatch, navigate]);

  /* ─── Step Indicator ─── */
  const stepIdx = STEPS.indexOf(step);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Step indicator */}
      <nav className="flex items-center justify-center gap-2 mb-8" aria-label="Checkout steps">
        {STEPS.map((s, i) => {
          const isActive = s === step;
          const isCompleted = i < stepIdx;
          return (
            <React.Fragment key={s}>
              {i > 0 && (
                <div className={`h-px w-8 sm:w-12 ${isCompleted ? 'bg-purple-500' : 'bg-gray-300 dark:bg-zinc-700'}`} />
              )}
              <button
                type="button"
                onClick={() => goToStep(s)}
                disabled={i >= stepIdx}
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-purple-600 dark:text-purple-400'
                    : isCompleted
                      ? 'text-purple-600 dark:text-purple-400 cursor-pointer'
                      : 'text-gray-400 dark:text-zinc-500 cursor-default'
                }`}
              >
                <span
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2 transition-colors ${
                    isActive
                      ? 'border-purple-500 bg-purple-500 text-white'
                      : isCompleted
                        ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300'
                        : 'border-gray-300 dark:border-zinc-600 text-gray-400 dark:text-zinc-500'
                  }`}
                >
                  {isCompleted ? '✓' : i + 1}
                </span>
                <span className="hidden sm:inline">{STEP_LABELS[s]}</span>
              </button>
            </React.Fragment>
          );
        })}
      </nav>

      {/* Notices */}
      {(priceChangeNotices.length > 0 || removedItemNotices.length > 0) && (
        <div className="rounded-xl border border-amber-200/70 dark:border-amber-700/40 bg-amber-50/70 dark:bg-amber-900/20 p-4 text-sm text-amber-900 dark:text-amber-100 mb-6">
          {removedItemNotices.length > 0 && (
            <p className="font-medium">Some items were removed because they are out of stock or no longer available.</p>
          )}
          {priceChangeNotices.length > 0 && (
            <p className="font-medium">
              Prices were updated for {priceChangeNotices.length} item{priceChangeNotices.length > 1 ? 's' : ''}. Review the changes below.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Main panel ─── */}
        <div className="lg:col-span-2 space-y-6">
          {/* STEP 1: Shipping */}
          {step === 'shipping' && (
            <div className="border border-gray-200/70 dark:border-white/10 rounded-xl p-6 space-y-5">
              <h2 className="text-xl font-semibold">Shipping Address</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="First name"
                  value={address.firstName}
                  onChange={(e) => updateField('firstName', e.target.value)}
                  error={shippingErrors.firstName}
                  required
                />
                <Input
                  label="Last name"
                  value={address.lastName}
                  onChange={(e) => updateField('lastName', e.target.value)}
                  error={shippingErrors.lastName}
                  required
                />
              </div>

              <Input
                label="Street address"
                value={address.street}
                onChange={(e) => updateField('street', e.target.value)}
                placeholder="e.g. 12 Admiralty Way"
                error={shippingErrors.street}
                required
              />

              <Input
                label="Apartment / Suite (optional)"
                value={address.apartment ?? ''}
                onChange={(e) => updateField('apartment', e.target.value)}
                placeholder="Apt 4B"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="City"
                  value={address.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  placeholder="e.g. Lekki"
                  error={shippingErrors.city}
                  required
                />
                <div className="w-full">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                    State <span className="text-purple-500 ml-1">*</span>
                  </label>
                  <select
                    value={address.state}
                    onChange={(e) => updateField('state', e.target.value)}
                    className={`w-full px-4 py-3 text-sm font-medium bg-white dark:bg-zinc-900/60 border rounded-xl text-gray-900 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all duration-200 ${
                      shippingErrors.state
                        ? 'border-red-500 dark:border-red-500'
                        : 'border-gray-300/80 dark:border-zinc-700/60'
                    }`}
                  >
                    <option value="">Select state</option>
                    {NIGERIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  {shippingErrors.state && (
                    <p className="mt-1.5 text-xs text-red-500">{shippingErrors.state}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Postal code (optional)"
                  value={address.postalCode ?? ''}
                  onChange={(e) => updateField('postalCode', e.target.value)}
                  placeholder="100001"
                />
                <Input
                  label="Phone number"
                  type="tel"
                  value={address.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="080XXXXXXXX"
                  error={shippingErrors.phone}
                  required
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={goNext} size="lg">
                  Continue to Payment
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: Payment Method */}
          {step === 'payment' && (
            <div className="border border-gray-200/70 dark:border-white/10 rounded-xl p-6 space-y-5">
              <h2 className="text-xl font-semibold">Payment Method</h2>

              <div className="space-y-3">
                {PAYMENT_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                      paymentMethod === opt.value
                        ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-900/20'
                        : 'border-gray-200/70 dark:border-zinc-700/60 hover:border-gray-300 dark:hover:border-zinc-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={opt.value}
                      checked={paymentMethod === opt.value}
                      onChange={() => setPaymentMethod(opt.value)}
                      className="sr-only"
                    />
                    <span className="text-2xl">{opt.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white">{opt.label}</p>
                      <p className="text-sm text-gray-500 dark:text-zinc-400">{opt.description}</p>
                    </div>
                    <span
                      className={`flex-shrink-0 w-5 h-5 rounded-full border-2 transition-colors ${
                        paymentMethod === opt.value
                          ? 'border-purple-500 bg-purple-500'
                          : 'border-gray-300 dark:border-zinc-600'
                      }`}
                    >
                      {paymentMethod === opt.value && (
                        <span className="block w-full h-full rounded-full ring-2 ring-white dark:ring-zinc-900 bg-purple-500" />
                      )}
                    </span>
                  </label>
                ))}
              </div>

              {/* Promo code */}
              <div className="pt-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-zinc-300 mb-2">
                  Promo Code
                </label>
                <div className="flex gap-2">
                  <Input
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value);
                      if (promoApplied) setPromoApplied(false);
                    }}
                    placeholder="Enter code"
                    disabled={promoApplied}
                  />
                  <Button
                    type="button"
                    variant={promoApplied ? 'secondary' : 'primary'}
                    onClick={promoApplied ? () => { setPromoApplied(false); setPromoCode(''); } : handleApplyPromo}
                    className="flex-shrink-0"
                  >
                    {promoApplied ? 'Remove' : 'Apply'}
                  </Button>
                </div>
                {promoApplied && (
                  <p className="mt-1.5 text-xs text-green-600 dark:text-green-400">
                    ✅ 10% discount applied
                  </p>
                )}
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={goBack}>
                  ← Back
                </Button>
                <Button onClick={goNext} size="lg">
                  Review Order
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Review */}
          {step === 'review' && (
            <div className="space-y-6">
              {/* Shipping summary */}
              <div className="border border-gray-200/70 dark:border-white/10 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">📍 Shipping Address</h3>
                  <button type="button" onClick={() => setStep('shipping')} className="text-sm text-purple-600 dark:text-purple-400 hover:underline">
                    Edit
                  </button>
                </div>
                <p className="text-sm text-gray-700 dark:text-zinc-300">
                  {address.firstName} {address.lastName}<br />
                  {address.street}{address.apartment ? `, ${address.apartment}` : ''}<br />
                  {address.city}, {address.state}{address.postalCode ? ` ${address.postalCode}` : ''}<br />
                  {address.country}<br />
                  📞 {address.phone}
                </p>
              </div>

              {/* Payment summary */}
              <div className="border border-gray-200/70 dark:border-white/10 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">💳 Payment Method</h3>
                  <button type="button" onClick={() => setStep('payment')} className="text-sm text-purple-600 dark:text-purple-400 hover:underline">
                    Edit
                  </button>
                </div>
                <p className="text-sm text-gray-700 dark:text-zinc-300">
                  {PAYMENT_OPTIONS.find((o) => o.value === paymentMethod)?.emoji}{' '}
                  {PAYMENT_OPTIONS.find((o) => o.value === paymentMethod)?.label}
                </p>
                {promoApplied && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    🎟️ Promo: {promoCode} (−{formatPrice(discountAmount)})
                  </p>
                )}
              </div>

              {/* Items grouped by brand */}
              <div className="border border-gray-200/70 dark:border-white/10 rounded-xl p-5 space-y-4">
                <h3 className="font-semibold">🛍️ Items</h3>
                {brandGroups.map((group) => (
                  <div key={group.brandName} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                      {group.brandName}
                    </p>
                    {group.items.map((item) => {
                      const notice = priceNoticeByItemId.get(item.id);
                      return (
                        <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                          <div className="flex items-center gap-3 min-w-0">
                            {item.product.thumbnail && (
                              <ImageWithFallback
                                src={item.product.thumbnail}
                                alt={item.product.name}
                                className="w-10 h-10 flex-shrink-0"
                                fit="cover"
                                rounded="lg"
                              />
                            )}
                            <div className="min-w-0">
                              <p className="font-medium truncate">{item.product.name}</p>
                              <p className="text-gray-400 text-xs">
                                Qty: {item.quantity}
                                {item.selectedSize && <> · Size {item.selectedSize}</>}
                                {item.selectedColor && <> · {item.selectedColor}</>}
                              </p>
                            </div>
                          </div>
                          <span className="font-medium flex-shrink-0">
                            {notice ? (
                              <>
                                <span className="line-through text-gray-400 mr-1 text-xs">{formatPrice(notice.oldPrice * item.quantity)}</span>
                                <span className="text-amber-600 dark:text-amber-300">{formatPrice(notice.newPrice * item.quantity)}</span>
                              </>
                            ) : (
                              formatPrice(item.itemTotal)
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={goBack}>
                  ← Back
                </Button>
                <Button onClick={handlePlaceOrder} size="lg" loading={submitting} disabled={submitting}>
                  {submitting ? 'Processing...' : `Pay ${formatPrice(grandTotal)}`}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ─── Order Summary Sidebar ─── */}
        <div className="lg:sticky lg:top-24 self-start">
          <div className="border border-gray-200/70 dark:border-white/10 rounded-xl p-6 space-y-4">
            <h3 className="text-lg font-semibold">Order Summary</h3>

            <div className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
              {cart.items.map((item) => (
                <div key={item.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{item.product.name}</p>
                    <p className="text-gray-500 text-xs">
                      {item.quantity} × {formatPrice(item.product.effectivePrice)}
                    </p>
                  </div>
                  <span className="font-medium flex-shrink-0">{formatPrice(item.itemTotal)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span>{formatPrice(cart.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Shipping</span>
                <span>{address.state ? formatPrice(shippingCost) : '—'}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-600 dark:text-green-400">
                  <span>Discount</span>
                  <span>−{formatPrice(discountAmount)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between font-bold text-lg pt-3 border-t border-gray-200 dark:border-gray-700">
              <span>Total</span>
              <span>{formatPrice(grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
