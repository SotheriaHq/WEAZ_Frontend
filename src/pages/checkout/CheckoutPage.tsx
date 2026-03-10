import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';
import { checkout } from '@/api/StoreApi';
import type { CheckoutPaymentMethod, PaymentData, ShippingAddress } from '@/api/StoreApi';
import { paymentApi } from '@/api/PaymentApi';
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
import PaymentDetailsSection from '@/pages/checkout/PaymentDetailsSection';
import {
  CHECKOUT_PAYMENT_OPTIONS,
  buildContactInfo,
  buildPaymentSubmissionData,
  createInitialPaymentState,
  getPaymentSummaryLines,
  getReviewCtaLabel,
  type PaymentFormErrors,
  validatePaymentData,
} from '@/pages/checkout/paymentFlow';

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

type Step = 'shipping' | 'payment' | 'review';
const STEPS: Step[] = ['shipping', 'payment', 'review'];
const STEP_LABELS: Record<Step, string> = {
  shipping: 'Shipping',
  payment: 'Payment',
  review: 'Review',
};

const STEP_KICKERS: Record<Step, string> = {
  shipping: 'Delivery details',
  payment: 'Payment setup',
  review: 'Final confirmation',
};

const STEP_TITLES: Record<Step, string> = {
  shipping: 'Where should we send this order?',
  payment: 'How would you like to pay?',
  review: 'Review everything before you place the order',
};

const STEP_DESCRIPTIONS: Record<Step, string> = {
  shipping: 'Keep your delivery information accurate so shipping and tracking stay smooth.',
  payment: 'Choose the payment route that fits your checkout flow today.',
  review: 'Double-check your address, payment method, and items before we lock the order in.',
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

const CheckoutBackLink: React.FC<{
  label: string;
  onClick: () => void;
}> = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
  >
    <span aria-hidden>←</span>
    <span>{label}</span>
  </button>
);

const CheckoutPanel: React.FC<{
  kicker: string;
  title: string;
  description: string;
  children: React.ReactNode;
}> = ({ kicker, title, description, children }) => (
  <section className="relative overflow-hidden rounded-[32px] border border-white/60 bg-white/78 p-6 shadow-[0_28px_80px_rgba(148,163,184,0.16)] backdrop-blur-xl dark:border-white/10 dark:bg-[#060816]/82 sm:p-8">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top_left,_rgba(244,114,182,0.16),_transparent_50%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.12),_transparent_45%)]" />
    <div className="relative z-10 space-y-6">
      <div className="space-y-3">
        <div className="text-[11px] font-black uppercase tracking-[0.28em] text-fuchsia-500 dark:text-fuchsia-300">
          {kicker}
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white sm:text-[2rem]">
            {title}
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400 sm:text-base">
            {description}
          </p>
        </div>
      </div>
      {children}
    </div>
  </section>
);

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
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod | 'PENDING_SELECTION'>('PENDING_SELECTION');
  const [paymentState, setPaymentState] = useState(() =>
    createInitialPaymentState(user?.email ?? '', user?.phoneNumber ?? ''),
  );
  const [paymentErrors, setPaymentErrors] = useState<PaymentFormErrors>({});
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
  const activePaymentData = paymentMethod === 'PENDING_SELECTION' ? null : paymentState[paymentMethod];
  const paymentSummaryLines = useMemo(
    () => (activePaymentData && paymentMethod !== 'PENDING_SELECTION' ? getPaymentSummaryLines(paymentMethod, activePaymentData) : []),
    [activePaymentData, paymentMethod],
  );

  useEffect(() => {
    setPaymentState((prev) => ({
      PAYSTACK: {
        ...prev.PAYSTACK,
        email: prev.PAYSTACK.email || user?.email || '',
        phone: prev.PAYSTACK.phone || address.phone,
      },
      FLUTTERWAVE: {
        ...prev.FLUTTERWAVE,
        email: prev.FLUTTERWAVE.email || user?.email || '',
        phone: prev.FLUTTERWAVE.phone || address.phone,
      },
      BANK_TRANSFER: {
        ...prev.BANK_TRANSFER,
        email: prev.BANK_TRANSFER.email || user?.email || '',
        phone: prev.BANK_TRANSFER.phone || address.phone,
        senderPhone: prev.BANK_TRANSFER.senderPhone || address.phone,
      },
    }));
  }, [user?.email, address.phone]);

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
      const validationErrors = validatePaymentData(paymentMethod, paymentState[paymentMethod], address);
      setPaymentErrors(validationErrors);
      if (Object.keys(validationErrors).length > 0) {
        toast.error('Complete the payment details for the selected method');
        return;
      }
      setStep('review');
    }
  }, [step, validateShipping, paymentMethod, paymentState, address]);

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

  const updateSelectedPaymentData = useCallback((updater: (current: PaymentData) => PaymentData) => {
    if (paymentMethod === 'PENDING_SELECTION') return;
    setPaymentState((prev) => ({
      ...prev,
      [paymentMethod]: updater(prev[paymentMethod]),
    }));
    setPaymentErrors({});
  }, [paymentMethod]);

  const handleSelectPaymentMethod = useCallback((method: CheckoutPaymentMethod) => {
    setPaymentMethod(method);
    setPaymentErrors({});
  }, []);

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

      if (paymentMethod === 'PENDING_SELECTION' || !activePaymentData) {
        toast.error('Select and complete a payment method first');
        return;
      }

      const validationErrors = validatePaymentData(paymentMethod, activePaymentData, address);
      setPaymentErrors(validationErrors);
      if (Object.keys(validationErrors).length > 0) {
        toast.error('Complete the payment details for the selected method');
        return;
      }

      const paymentSubmissionData = buildPaymentSubmissionData(activePaymentData, address);
      const contactInfo = buildContactInfo(paymentSubmissionData, address);

      // 1. Place order via checkout endpoint
      const customerName = `${address.firstName} ${address.lastName}`.trim();
      const result = await checkout({
        customerName,
        shippingAddress: address,
        contactInfo,
        paymentMethod,
        paymentData: paymentSubmissionData,
        promoCode: promoApplied ? promoCode : undefined,
      });

      const orderIds = result.orders.map((o) => o.id);

      // 2. Initialize payment
      const paymentResult = await paymentApi.initialize({
        orderIds,
        paymentMethod,
        email: paymentSubmissionData.email,
        callbackUrl: `${window.location.origin}/checkout/payment-return`,
        paymentData: paymentSubmissionData,
      });

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
      if (paymentResult.authorizationUrl && paymentResult.nextAction?.type === 'REDIRECT') {
        toast.success('Redirecting to payment flow...');
        window.location.assign(paymentResult.authorizationUrl);
        return;
      }

      toast.success(paymentResult?.bankAccount ? 'Payment instructions are ready' : 'Payment flow started');

      navigate(`/checkout/confirmation?reference=${encodeURIComponent(paymentResult.reference)}`, {
        state: {
          orderIds,
          paymentMethod,
          paymentData: paymentSubmissionData,
          bankAccount: paymentResult.bankAccount,
          authorizationUrl: paymentResult.authorizationUrl,
          gateway: paymentResult.gateway,
          reference: paymentResult.reference,
          nextAction: paymentResult.nextAction,
          summary,
        },
      });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Checkout failed. Please try again.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [cart.items.length, address, paymentMethod, activePaymentData, promoApplied, promoCode, dispatch, navigate]);

  /* ─── Step Indicator ─── */
  const stepIdx = STEPS.indexOf(step);

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-fuchsia-300/18 blur-3xl dark:bg-fuchsia-500/12" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-sky-300/14 blur-3xl dark:bg-sky-500/10" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-violet-300/12 blur-3xl dark:bg-violet-500/10" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="mb-6 flex items-center justify-between gap-4">
        <CheckoutBackLink label="Back to bag" onClick={() => navigate(-1)} />
        <div className="hidden rounded-full border border-white/60 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-slate-400 sm:inline-flex">
          Secure checkout
        </div>
      </div>

      {/* Step indicator */}
      <nav className="mb-8 flex items-center justify-center gap-2 rounded-full border border-white/60 bg-white/72 px-3 py-3 shadow-[0_14px_40px_rgba(148,163,184,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5" aria-label="Checkout steps">
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
                className={`flex items-center gap-2 rounded-full px-2.5 py-1.5 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'text-fuchsia-600 dark:text-fuchsia-300'
                    : isCompleted
                      ? 'text-fuchsia-600 dark:text-fuchsia-300 cursor-pointer'
                      : 'text-slate-400 dark:text-zinc-500 cursor-default'
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black border-2 transition-colors ${
                    isActive
                      ? 'border-fuchsia-500 bg-fuchsia-500 text-white shadow-[0_0_0_8px_rgba(217,70,239,0.12)]'
                      : isCompleted
                        ? 'border-fuchsia-400 bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/18 dark:text-fuchsia-200'
                        : 'border-slate-300 dark:border-zinc-600 text-slate-400 dark:text-zinc-500'
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

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.75fr)_minmax(320px,0.95fr)] lg:items-start">
        {/* ─── Main panel ─── */}
        <div className="space-y-6">
          {/* STEP 1: Shipping */}
          {step === 'shipping' && (
            <CheckoutPanel
              kicker={STEP_KICKERS.shipping}
              title={STEP_TITLES.shipping}
              description={STEP_DESCRIPTIONS.shipping}
            >
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Input
                  label="First name"
                  value={address.firstName}
                  onChange={(e) => updateField('firstName', e.target.value)}
                  error={shippingErrors.firstName}
                  required
                  className="[&_input]:rounded-2xl [&_input]:border-white/60 [&_input]:bg-white/80 [&_input]:shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:[&_input]:border-white/10 dark:[&_input]:bg-white/[0.03]"
                />
                <Input
                  label="Last name"
                  value={address.lastName}
                  onChange={(e) => updateField('lastName', e.target.value)}
                  error={shippingErrors.lastName}
                  required
                  className="[&_input]:rounded-2xl [&_input]:border-white/60 [&_input]:bg-white/80 [&_input]:shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:[&_input]:border-white/10 dark:[&_input]:bg-white/[0.03]"
                />
              </div>

              <Input
                label="Street address"
                value={address.street}
                onChange={(e) => updateField('street', e.target.value)}
                placeholder="e.g. 12 Admiralty Way"
                error={shippingErrors.street}
                required
                className="[&_input]:rounded-2xl [&_input]:border-white/60 [&_input]:bg-white/80 [&_input]:shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:[&_input]:border-white/10 dark:[&_input]:bg-white/[0.03]"
              />

              <Input
                label="Apartment / Suite (optional)"
                value={address.apartment ?? ''}
                onChange={(e) => updateField('apartment', e.target.value)}
                placeholder="Apt 4B"
                className="[&_input]:rounded-2xl [&_input]:border-white/60 [&_input]:bg-white/80 [&_input]:shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:[&_input]:border-white/10 dark:[&_input]:bg-white/[0.03]"
              />

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Input
                  label="City"
                  value={address.city}
                  onChange={(e) => updateField('city', e.target.value)}
                  placeholder="e.g. Lekki"
                  error={shippingErrors.city}
                  required
                  className="[&_input]:rounded-2xl [&_input]:border-white/60 [&_input]:bg-white/80 [&_input]:shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:[&_input]:border-white/10 dark:[&_input]:bg-white/[0.03]"
                />
                <div className="w-full">
                  <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-zinc-300">
                    State <span className="text-purple-500 ml-1">*</span>
                  </label>
                  <select
                    value={address.state}
                    onChange={(e) => updateField('state', e.target.value)}
                    className={`w-full rounded-2xl border px-4 py-3 text-sm font-medium text-gray-900 shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition-all duration-200 focus:border-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/20 dark:text-white ${
                      shippingErrors.state
                        ? 'border-red-500 bg-white dark:border-red-500 dark:bg-white/[0.03]'
                        : 'border-white/60 bg-white/80 dark:border-white/10 dark:bg-white/[0.03]'
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

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Input
                  label="Postal code (optional)"
                  value={address.postalCode ?? ''}
                  onChange={(e) => updateField('postalCode', e.target.value)}
                  placeholder="100001"
                  className="[&_input]:rounded-2xl [&_input]:border-white/60 [&_input]:bg-white/80 [&_input]:shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:[&_input]:border-white/10 dark:[&_input]:bg-white/[0.03]"
                />
                <Input
                  label="Phone number"
                  type="tel"
                  value={address.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="080XXXXXXXX"
                  error={shippingErrors.phone}
                  required
                  className="[&_input]:rounded-2xl [&_input]:border-white/60 [&_input]:bg-white/80 [&_input]:shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:[&_input]:border-white/10 dark:[&_input]:bg-white/[0.03]"
                />
              </div>

              <div className="flex flex-col gap-4 border-t border-slate-200/70 pt-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                <CheckoutBackLink label="Back to bag" onClick={() => navigate(-1)} />
                <Button onClick={goNext} size="lg" className="rounded-2xl px-8 shadow-[0_16px_36px_rgba(217,70,239,0.28)]">
                  Continue to Payment
                </Button>
              </div>
            </CheckoutPanel>
          )}

          {/* STEP 2: Payment Method */}
          {step === 'payment' && (
            <CheckoutPanel
              kicker={STEP_KICKERS.payment}
              title={STEP_TITLES.payment}
              description={STEP_DESCRIPTIONS.payment}
            >

              <div className="space-y-3">
                {CHECKOUT_PAYMENT_OPTIONS.map((opt) => {
                  const isSelected = paymentMethod === opt.value;
                  const optionPaymentData = paymentState[opt.value];

                  return (
                    <div
                      key={opt.value}
                      className={`rounded-[28px] border transition-all duration-200 ${
                        isSelected
                          ? 'border-fuchsia-300/90 bg-[linear-gradient(135deg,rgba(245,208,254,0.26),rgba(224,231,255,0.54))] shadow-[0_14px_34px_rgba(217,70,239,0.12)] dark:bg-[linear-gradient(135deg,rgba(168,85,247,0.12),rgba(59,130,246,0.08))]'
                          : 'border-white/60 bg-white/75 shadow-[0_14px_32px_rgba(15,23,42,0.06)] hover:border-fuchsia-200 dark:border-white/10 dark:bg-white/[0.03]'
                      }`}
                    >
                      <label className="flex cursor-pointer items-center gap-4 p-5">
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={opt.value}
                          checked={isSelected}
                          onChange={() => handleSelectPaymentMethod(opt.value)}
                          className="sr-only"
                        />
                        <span className="text-2xl">{opt.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 dark:text-white">{opt.label}</p>
                          <p className="text-sm text-gray-500 dark:text-zinc-400">{opt.description}</p>
                        </div>
                        <span
                          className={`flex h-5 w-5 flex-shrink-0 rounded-full border-2 transition-colors ${
                            isSelected
                              ? 'border-fuchsia-500 bg-fuchsia-500'
                              : 'border-slate-300 dark:border-zinc-600'
                          }`}
                        >
                          {isSelected && (
                            <span className="block h-full w-full rounded-full bg-purple-500 ring-2 ring-white dark:ring-zinc-900" />
                          )}
                        </span>
                      </label>

                      {isSelected && (
                        <div className="border-t border-fuchsia-200/70 px-4 pb-4 pt-1 dark:border-white/10 sm:px-5 sm:pb-5">
                          <PaymentDetailsSection
                            paymentMethod={opt.value}
                            paymentData={optionPaymentData}
                            shippingAddress={address}
                            errors={paymentErrors}
                            onChange={updateSelectedPaymentData}
                            compact
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Promo code */}
              <div className="pt-2">
                <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-zinc-300">
                  Promo Code
                </label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value);
                      if (promoApplied) setPromoApplied(false);
                    }}
                    placeholder="Enter code"
                    disabled={promoApplied}
                    className="[&_input]:rounded-2xl [&_input]:border-white/60 [&_input]:bg-white/80 [&_input]:shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:[&_input]:border-white/10 dark:[&_input]:bg-white/[0.03]"
                  />
                  <Button
                    type="button"
                    variant={promoApplied ? 'secondary' : 'primary'}
                    onClick={promoApplied ? () => { setPromoApplied(false); setPromoCode(''); } : handleApplyPromo}
                    className="flex-shrink-0 rounded-2xl"
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

              <div className="flex flex-col gap-4 border-t border-slate-200/70 pt-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                <CheckoutBackLink label="Back to shipping" onClick={goBack} />
                <Button onClick={goNext} size="lg" className="rounded-2xl px-8 shadow-[0_16px_36px_rgba(217,70,239,0.28)]">
                  Review Order
                </Button>
              </div>
            </CheckoutPanel>
          )}

          {/* STEP 3: Review */}
          {step === 'review' && (
            <CheckoutPanel
              kicker={STEP_KICKERS.review}
              title={STEP_TITLES.review}
              description={STEP_DESCRIPTIONS.review}
            >
            <div className="space-y-6">
              {/* Shipping summary */}
              <div className="rounded-[28px] border border-white/60 bg-white/72 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">📍 Shipping Address</h3>
                  <button type="button" onClick={() => setStep('shipping')} className="text-sm font-semibold text-fuchsia-600 dark:text-fuchsia-300 hover:underline">
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
              <div className="rounded-[28px] border border-white/60 bg-white/72 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">💳 Payment Method</h3>
                  <button type="button" onClick={() => setStep('payment')} className="text-sm font-semibold text-fuchsia-600 dark:text-fuchsia-300 hover:underline">
                    Edit
                  </button>
                </div>
                <p className="text-sm text-gray-700 dark:text-zinc-300">
                  {CHECKOUT_PAYMENT_OPTIONS.find((o) => o.value === paymentMethod)?.emoji}{' '}
                  {CHECKOUT_PAYMENT_OPTIONS.find((o) => o.value === paymentMethod)?.label}
                </p>
                {paymentSummaryLines.length > 0 && (
                  <div className="mt-3 space-y-1 text-sm text-gray-500 dark:text-zinc-400">
                    {paymentSummaryLines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                )}
                {promoApplied && (
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    🎟️ Promo: {promoCode} (−{formatPrice(discountAmount)})
                  </p>
                )}
              </div>

              {/* Items grouped by brand */}
              <div className="rounded-[28px] border border-white/60 bg-white/72 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.03] space-y-4">
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

              <div className="flex flex-col gap-4 border-t border-slate-200/70 pt-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                <CheckoutBackLink label="Back to payment" onClick={goBack} />
                <Button onClick={handlePlaceOrder} size="lg" loading={submitting} disabled={submitting} className="rounded-2xl px-8 shadow-[0_16px_36px_rgba(217,70,239,0.28)]">
                  {submitting ? 'Processing...' : `${getReviewCtaLabel(paymentMethod === 'PENDING_SELECTION' ? 'PAYSTACK' : paymentMethod, activePaymentData ?? paymentState.PAYSTACK)} · ${formatPrice(grandTotal)}`}
                </Button>
              </div>
            </div>
            </CheckoutPanel>
          )}
        </div>

        {/* ─── Order Summary Sidebar ─── */}
        <div className="lg:sticky lg:top-24 self-start">
          <div className="threadly-summary-surface overflow-hidden rounded-[32px] p-6">
            <div className="space-y-6">
              <div className="space-y-1">
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-fuchsia-500 dark:text-fuchsia-300/80">Checkout</p>
                <h3 className="text-2xl font-black tracking-tight">Order Summary</h3>
              </div>

              <div className="space-y-4">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 rounded-[22px] border border-slate-200/80 bg-white/70 p-3 dark:border-white/8 dark:bg-white/[0.03]">
                    <div className="h-16 w-16 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70 dark:bg-white/10 dark:ring-white/10">
                      {item.product.thumbnail ? (
                        <ImageWithFallback
                          src={item.product.thumbnail}
                          alt={item.product.name}
                          className="h-full w-full"
                          fit="cover"
                          rounded="none"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xl">🛍️</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{item.product.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{item.brand.name}</p>
                        </div>
                        <span className="text-sm font-semibold text-slate-950 dark:text-white">{formatPrice(item.itemTotal)}</span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {item.selectedSize ? `Size: ${item.selectedSize}` : 'Size selected'}
                        {' · '}
                        Qty: {item.quantity}
                        {item.selectedColor ? ` · ${item.selectedColor}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 border-t border-slate-200/80 pt-4 text-sm dark:border-white/8">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Subtotal</span>
                  <span className="text-slate-950 dark:text-white">{formatPrice(cart.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Shipping</span>
                  <span className="text-slate-950 dark:text-white">{address.state ? formatPrice(shippingCost) : '—'}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-300">
                    <span>Discount</span>
                    <span>−{formatPrice(discountAmount)}</span>
                  </div>
                )}
              </div>

              <div className="flex items-end justify-between border-t border-slate-200/80 pt-5 dark:border-white/8">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-500 dark:text-slate-500">Total</p>
                  <p className="mt-1 text-3xl font-black tracking-tight">{formatPrice(grandTotal)}</p>
                </div>
                <div className="rounded-full border border-slate-200/80 bg-white/65 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
                  Secure checkout
                </div>
              </div>

              <div className="rounded-[22px] border border-fuchsia-300/35 bg-[linear-gradient(135deg,rgba(245,208,254,0.55),rgba(224,231,255,0.6))] px-4 py-4 text-sm text-slate-600 dark:border-fuchsia-500/16 dark:bg-[linear-gradient(135deg,rgba(168,85,247,0.18),rgba(59,130,246,0.08))] dark:text-slate-300">
                <div className="flex gap-3">
                  <span className="mt-0.5 text-base text-fuchsia-500 dark:text-fuchsia-300">◉</span>
                  <p>
                    Items in your order may ship separately when they come from different brands. Tracking updates will follow each package.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
