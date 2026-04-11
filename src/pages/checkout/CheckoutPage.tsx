import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';
import { checkout, getMyOrders } from '@/api/StoreApi';
import type { PaystackPaymentData, ShippingAddress } from '@/api/StoreApi';
import { paymentApi } from '@/api/PaymentApi';
import { createIdempotencyKey } from '@/api/idempotency';
import {
  customOrdersBuyerApi,
  type CustomOrderCheckoutBagLine,
  type CustomOrderPaymentInitResult,
} from '@/api/CustomOrderApi';
import {
  fetchCart,
  clearCart,
  selectCartPriceChangeNotices,
  selectCartRemovedItemNotices,
} from '@/features/cartSlice';
import type { CartItem } from '@/features/cartSlice';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import ImageWithFallback from '@/components/ImageWithFallback';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { formatPrice } from '@/utils/helpers';
import { openPaystackInline } from '@/lib/paystackInline';
import PaymentDetailsSection from '@/pages/checkout/PaymentDetailsSection';
import { unifiedCheckoutQueue } from '@/lib/unifiedCheckoutQueue';
import {
  loadDeliveryAddressBook,
  removeDeliveryAddress,
  toShippingAddress,
  upsertDeliveryAddress,
  type SavedDeliveryAddress,
} from '@/lib/customOrderAddressBook';
import {
  CHECKOUT_PAYMENT_OPTIONS,
  buildContactInfo,
  buildPaymentSubmissionData,
  createInitialPaymentState,
  getPaymentSummaryLines,
  getReviewCtaLabel,
  type PaymentFormErrors,
  type PaymentFormState,
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
type CheckoutPaymentSelection = keyof PaymentFormState | 'PENDING_SELECTION';
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

function normalizeSavedAddress(address: unknown): ShippingAddress | null {
  if (!address || typeof address !== 'object') return null;
  const candidate = address as Record<string, unknown>;
  const firstName = String(candidate.firstName ?? '').trim();
  const lastName = String(candidate.lastName ?? '').trim();
  const street = String(candidate.street ?? '').trim();
  const city = String(candidate.city ?? '').trim();
  const state = String(candidate.state ?? '').trim();
  const country = String(candidate.country ?? 'Nigeria').trim();
  const phone = String(candidate.phone ?? '').trim();

  if (!firstName || !lastName || !street || !city || !state || !phone) {
    return null;
  }

  return {
    firstName,
    lastName,
    street,
    apartment: String(candidate.apartment ?? '').trim(),
    city,
    state,
    postalCode: String(candidate.postalCode ?? '').trim(),
    country,
    phone,
  };
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
  const location = useLocation();
  const cart = useSelector((s: RootState) => s.cart);
  const priceChangeNotices = useSelector(selectCartPriceChangeNotices);
  const removedItemNotices = useSelector(selectCartRemovedItemNotices);
  const user = useSelector((s: RootState) => s.user.profile);
  const submittingRef = useRef(false);
  const checkoutIdempotencyKeyRef = useRef<string | null>(null);
  const paymentInitIdempotencyKeyRef = useRef<string | null>(null);

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
  const [savedAddresses, setSavedAddresses] = useState<SavedDeliveryAddress[]>([]);
  const [savedAddressesLoading, setSavedAddressesLoading] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [openAddressMenuId, setOpenAddressMenuId] = useState<string | null>(null);

  /* ── Payment state ── */
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentSelection>('PENDING_SELECTION');
  const [paymentState, setPaymentState] = useState(() =>
    createInitialPaymentState(user?.email ?? '', user?.phoneNumber ?? ''),
  );
  const [paymentErrors, setPaymentErrors] = useState<PaymentFormErrors>({});
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(false);

  /* ── Submission state ── */
  const [submitting, setSubmitting] = useState(false);
  const [cartLoading, setCartLoading] = useState(!cart.items.length);
  const [customBagItems, setCustomBagItems] = useState<CustomOrderCheckoutBagLine[]>([]);
  const [customBagLoading, setCustomBagLoading] = useState(true);
  const [customBagError, setCustomBagError] = useState<string | null>(null);

  const checkoutEntryState =
    (location.state as { promoCode?: string } | null) ?? null;

  const refreshCustomBag = useCallback(async () => {
    setCustomBagLoading(true);
    setCustomBagError(null);
    try {
      const response = await customOrdersBuyerApi.listCheckoutBag();
      setCustomBagItems(response.items || []);
    } catch (error: any) {
      setCustomBagItems([]);
      setCustomBagError(
        error?.response?.data?.message || 'Unable to load custom requests from your bag.',
      );
    } finally {
      setCustomBagLoading(false);
    }
  }, []);

  /* ── Fetch cart on mount if empty; redirect if still empty after fetch ── */
  useEffect(() => {
    if (!cart.items.length) {
      setCartLoading(true);
      dispatch(fetchCart()).finally(() => setCartLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void refreshCustomBag();
  }, [refreshCustomBag]);

  useEffect(() => {
    const incomingPromo = checkoutEntryState?.promoCode?.trim();
    if (!incomingPromo) return;
    setPromoCode(incomingPromo.toUpperCase());
    setPromoApplied(true);
  }, [checkoutEntryState?.promoCode]);

  useEffect(() => {
    if (!cartLoading && !customBagLoading && !cart.items.length && customBagItems.length === 0) {
      toast.error('Your bag is empty');
      navigate('/', { replace: true });
    }
  }, [cartLoading, cart.items.length, customBagItems.length, customBagLoading, navigate]);

  useEffect(() => {
    let active = true;

    const loadSavedAddresses = async () => {
      setSavedAddressesLoading(true);
      try {
        const stored = loadDeliveryAddressBook(user?.id);
        if (!active) return;

        if (stored.length > 0) {
          setSavedAddresses(stored);
          setEditingAddressId(stored[0].id);
          setAddress(toShippingAddress(stored[0]));
          return;
        }

        const response = await getMyOrders(1, 50);
        if (!active) return;
        const items = Array.isArray((response as any)?.items) ? (response as any).items : [];

        const seeded: SavedDeliveryAddress[] = [];

        items.forEach((order: any) => {
          const normalized = normalizeSavedAddress(order?.shippingAddress);
          if (!normalized) return;

          const customerName = `${normalized.firstName} ${normalized.lastName}`.trim();
          const next = upsertDeliveryAddress(user?.id, {
            customerName,
            firstName: normalized.firstName,
            lastName: normalized.lastName,
            contactEmail: user?.email ?? '',
            phone: normalized.phone,
            street: normalized.street,
            apartment: normalized.apartment,
            city: normalized.city,
            state: normalized.state,
            postalCode: normalized.postalCode,
            country: normalized.country,
          });

          seeded.splice(0, seeded.length, ...next);
        });

        const nextSavedAddresses = seeded.length > 0 ? seeded : loadDeliveryAddressBook(user?.id);
        setSavedAddresses(nextSavedAddresses);
        if (nextSavedAddresses[0]) {
          setEditingAddressId(nextSavedAddresses[0].id);
          setAddress(toShippingAddress(nextSavedAddresses[0]));
        }
      } catch {
        if (!active) return;
        setSavedAddresses([]);
      } finally {
        if (active) setSavedAddressesLoading(false);
      }
    };

    void loadSavedAddresses();

    return () => {
      active = false;
    };
  }, [user?.email, user?.id]);

  /* ── Derived ── */
  const priceNoticeByItemId = useMemo(
    () => new Map(priceChangeNotices.map((n) => [n.itemId, n])),
    [priceChangeNotices],
  );

  const payableCustomBagItems = useMemo(
    () => customBagItems.filter((item) => item.canProceedToPayment),
    [customBagItems],
  );

  const blockedCustomBagItems = useMemo(
    () => customBagItems.filter((item) => !item.canProceedToPayment),
    [customBagItems],
  );

  const shippingCost = address.state ? getShippingCost(address.state) : 0;
  const discountAmount = promoApplied ? Math.round(cart.subtotal * 0.1) : 0; // scaffold: 10% off
  const customSubtotal = payableCustomBagItems.reduce(
    (sum, item) => sum + Number(item.buyerPriceSummary?.grandTotal ?? 0),
    0,
  );
  const standardGrandTotal = Math.max(0, cart.subtotal + shippingCost - discountAmount);
  const grandTotal = standardGrandTotal + customSubtotal;
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
    }));
  }, [user?.email, address.phone]);

  useEffect(() => {
    checkoutIdempotencyKeyRef.current = null;
    paymentInitIdempotencyKeyRef.current = null;
  }, [activePaymentData, address, cart.items, paymentMethod, promoApplied, promoCode]);

  const currentAddressDraft = useMemo<SavedDeliveryAddress>(
    () => ({
      id: editingAddressId ?? '',
      firstName: address.firstName.trim(),
      lastName: address.lastName.trim(),
      customerName: `${address.firstName} ${address.lastName}`.trim(),
      contactEmail:
        user?.email?.trim() ||
        paymentState.PAYSTACK.email ||
        '',
      phone: address.phone.trim(),
      street: address.street.trim(),
      apartment: String(address.apartment ?? '').trim(),
      city: address.city.trim(),
      state: address.state.trim(),
      postalCode: String(address.postalCode ?? '').trim(),
      country: address.country.trim() || 'Nigeria',
      updatedAt: new Date().toISOString(),
    }),
    [address, editingAddressId, paymentState, user?.email],
  );

  const isCurrentAddressComplete = useMemo(
    () =>
      Boolean(
        currentAddressDraft.firstName &&
          currentAddressDraft.lastName &&
          currentAddressDraft.street &&
          currentAddressDraft.city &&
          currentAddressDraft.state &&
          currentAddressDraft.phone,
      ),
    [currentAddressDraft],
  );

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

  const applySavedAddress = useCallback((savedAddress: SavedDeliveryAddress) => {
    setAddress(toShippingAddress(savedAddress));
    setEditingAddressId(savedAddress.id);
    setOpenAddressMenuId(null);
    setShippingErrors({});
  }, []);

  const handleSaveCurrentAddress = useCallback(() => {
    if (!isCurrentAddressComplete) {
      toast.error('Complete the delivery details before saving this address.');
      return;
    }

    const nextAddresses = upsertDeliveryAddress(user?.id, currentAddressDraft);
    setSavedAddresses(nextAddresses);
    if (nextAddresses[0]) {
      setEditingAddressId(nextAddresses[0].id);
    }
    setOpenAddressMenuId(null);
    toast.success(editingAddressId ? 'Shipping address updated.' : 'Shipping address saved.');
  }, [currentAddressDraft, editingAddressId, isCurrentAddressComplete, user?.id]);

  const handleStartNewAddress = useCallback(() => {
    setEditingAddressId(null);
    setOpenAddressMenuId(null);
    setAddress({
      firstName: user?.firstName ?? address.firstName,
      lastName: user?.lastName ?? address.lastName,
      street: '',
      apartment: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'Nigeria',
      phone: user?.phoneNumber ?? address.phone,
    });
    setShippingErrors({});
  }, [address.firstName, address.lastName, address.phone, user?.firstName, user?.lastName, user?.phoneNumber]);

  const handleDeleteSavedAddress = useCallback(
    (addressId: string) => {
      const nextAddresses = removeDeliveryAddress(user?.id, addressId);
      setSavedAddresses(nextAddresses);
      setOpenAddressMenuId(null);

      if (editingAddressId === addressId) {
        setEditingAddressId(null);
        if (nextAddresses[0]) {
          applySavedAddress(nextAddresses[0]);
        } else {
          handleStartNewAddress();
        }
      }

      toast.success('Shipping address removed.');
    },
    [applySavedAddress, editingAddressId, handleStartNewAddress, user?.id],
  );

  /* ── Promo code (scaffold) ── */
  const handleApplyPromo = useCallback(() => {
    if (!promoCode.trim()) return;
    // Scaffold: any non-empty code works for 10% off
    setPromoApplied(true);
    toast.success('Promo code applied — 10% discount');
  }, [promoCode]);

  const updateSelectedPaymentData = useCallback((updater: (current: PaystackPaymentData) => PaystackPaymentData) => {
    const selectedPaymentMethod = paymentMethod;
    if (selectedPaymentMethod === 'PENDING_SELECTION') return;
    setPaymentState((prev) => ({
      ...prev,
      [selectedPaymentMethod]: updater(prev[selectedPaymentMethod]),
    }));
    setPaymentErrors({});
  }, [paymentMethod]);

  const handleSelectPaymentMethod = useCallback((method: keyof PaymentFormState) => {
    setPaymentMethod(method);
    setPaymentErrors({});
  }, []);

  const launchInitializedPayment = useCallback(async (paymentInit: {
    reference: string;
    gateway?: string;
    providerAccessCode?: string;
    authorizationUrl?: string;
  }) => {
    const resolvedGateway = paymentInit.gateway || 'PAYSTACK';

    if (paymentInit.providerAccessCode) {
      await openPaystackInline(paymentInit.providerAccessCode, {
        onSuccess: () => {
          navigate(
            `/bag/payment-return?reference=${encodeURIComponent(paymentInit.reference)}&gateway=${encodeURIComponent(resolvedGateway)}&uq=1`,
          );
        },
        onCancel: () => {
          toast.error('Payment was cancelled before completion.');
        },
        onError: (inlineError) => {
          toast.error(inlineError.message || 'Unable to open the payment window.');
        },
      });
      return;
    }

    if (paymentInit.authorizationUrl) {
      window.location.assign(paymentInit.authorizationUrl);
      return;
    }

    navigate(
      `/bag/payment-return?reference=${encodeURIComponent(paymentInit.reference)}&gateway=${encodeURIComponent(resolvedGateway)}&uq=1`,
    );
  }, [navigate]);

  const initializeCustomLinePayment = useCallback(async (params: {
    checkoutIntentId: string;
    paymentMethod: 'PAYSTACK' | 'FLUTTERWAVE' | 'BANK_TRANSFER';
    email: string;
    paymentData: Record<string, unknown>;
  }): Promise<CustomOrderPaymentInitResult> => {
    return customOrdersBuyerApi.initializePaymentForCheckoutIntent(
      params.checkoutIntentId,
      {
        paymentMethod: params.paymentMethod,
        email: params.email,
        callbackUrl: `${window.location.origin}/bag/payment-return?uq=1`,
        paymentData: params.paymentData,
      },
    );
  }, []);

  /* ── Place order flow ── */
  const handlePlaceOrder = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const hasStoreItems = cart.items.length > 0;
      const hasPayableCustomItems = payableCustomBagItems.length > 0;

      if (!hasStoreItems && !hasPayableCustomItems) {
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
      const nextAddresses = upsertDeliveryAddress(user?.id, {
        ...currentAddressDraft,
        contactEmail: currentAddressDraft.contactEmail || paymentSubmissionData.email || '',
      });
      setSavedAddresses(nextAddresses);
      if (nextAddresses[0]) {
        setEditingAddressId(nextAddresses[0].id);
      }

      const summary = {
        items: [
          ...cart.items.map((i) => ({
            name: i.product.name,
            quantity: i.quantity,
            price: i.product.effectivePrice,
          })),
          ...payableCustomBagItems.map((line) => ({
            name: `${line.sourceTitle} (Custom)` ,
            quantity: 1,
            price: Number(line.buyerPriceSummary?.grandTotal ?? 0),
          })),
        ],
        subtotal: cart.subtotal + customSubtotal,
        shippingCost,
        discount: discountAmount,
        grandTotal,
        shippingName: `${address.firstName} ${address.lastName}`,
        shippingCity: address.city,
        shippingState: address.state,
      };

      const normalizedPaymentMethod = paymentMethod as 'PAYSTACK' | 'FLUTTERWAVE' | 'BANK_TRANSFER';
      const queueLines = payableCustomBagItems.map((line) => ({
        checkoutIntentId: line.checkoutIntentId,
        sessionId: line.sessionId,
        sourceTitle: line.sourceTitle,
      }));

      let orderIds: string[] = [];
      let standardOrdersPlaced = false;
      let standardPaymentResult: Awaited<ReturnType<typeof paymentApi.initialize>> | null = null;
      let standardError: string | null = null;

      if (hasStoreItems) {
        try {
          const checkoutIdempotencyKey =
            checkoutIdempotencyKeyRef.current ?? createIdempotencyKey();
          checkoutIdempotencyKeyRef.current = checkoutIdempotencyKey;
          const paymentInitIdempotencyKey =
            paymentInitIdempotencyKeyRef.current ?? createIdempotencyKey();
          paymentInitIdempotencyKeyRef.current = paymentInitIdempotencyKey;

          const customerName = `${address.firstName} ${address.lastName}`.trim();
          const result = await checkout({
            customerName,
            shippingAddress: address,
            contactInfo,
            paymentMethod,
            promoCode: promoApplied ? promoCode : undefined,
          }, {
            idempotencyKey: checkoutIdempotencyKey,
          });

          orderIds = result.orders.map((o) => o.id);
          standardOrdersPlaced = orderIds.length > 0;

          standardPaymentResult = await paymentApi.initialize({
            orderIds,
            paymentMethod,
            email: paymentSubmissionData.email,
            callbackUrl: `${window.location.origin}/bag/payment-return?uq=1`,
            paymentData: paymentSubmissionData,
            idempotencyKey: paymentInitIdempotencyKey,
          });
        } catch (error: any) {
          standardError =
            error?.response?.data?.message ||
            error?.message ||
            'Store items could not be prepared for payment.';
        }
      }

      let customPrimaryPayment: CustomOrderPaymentInitResult | null = null;
      let remainingCustomQueue = [...queueLines];

      if (!standardPaymentResult && remainingCustomQueue.length > 0) {
        while (remainingCustomQueue.length > 0 && !customPrimaryPayment) {
          const [candidate, ...rest] = remainingCustomQueue;
          try {
            customPrimaryPayment = await initializeCustomLinePayment({
              checkoutIntentId: candidate.checkoutIntentId,
              paymentMethod: normalizedPaymentMethod,
              email: paymentSubmissionData.email,
              paymentData: paymentSubmissionData as unknown as Record<string, unknown>,
            });
            remainingCustomQueue = rest;
          } catch (error: any) {
            remainingCustomQueue = rest;
            toast.error(
              error?.response?.data?.message ||
                `${candidate.sourceTitle} could not be prepared for payment and remains in your bag.`,
            );
          }
        }
      }

      if (!standardPaymentResult && !customPrimaryPayment) {
        if (standardError) {
          throw new Error(standardError);
        }
        toast.error('No payable lines are ready. Refresh expired custom locks and try again.');
        return;
      }

      if (standardError && customPrimaryPayment) {
        toast.error(`${standardError} We started payment for available custom requests.`);
      }

      if (blockedCustomBagItems.length > 0) {
        toast.error(
          `${blockedCustomBagItems.length} custom ${blockedCustomBagItems.length === 1 ? 'request has' : 'requests have'} expired locks and will stay in your bag.`,
        );
      }

      if (standardOrdersPlaced && standardPaymentResult) {
        await dispatch(clearCart());
      }

      if (standardOrdersPlaced && !standardPaymentResult) {
        toast.error('Some store orders were created but payment could not start. Re-open Orders to retry payment.');
      }

      unifiedCheckoutQueue.save({
        paymentMethod: normalizedPaymentMethod,
        email: paymentSubmissionData.email,
        paymentData: paymentSubmissionData as unknown as Record<string, unknown>,
        lines: standardPaymentResult ? queueLines : remainingCustomQueue,
        summary,
      });

      if (standardPaymentResult) {
        await launchInitializedPayment(standardPaymentResult);
        return;
      }

      if (customPrimaryPayment) {
        await launchInitializedPayment(customPrimaryPayment);
        return;
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Checkout failed. Please try again.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [
    activePaymentData,
    address,
    blockedCustomBagItems,
    cart.items,
    cart.subtotal,
    currentAddressDraft,
    customSubtotal,
    discountAmount,
    dispatch,
    grandTotal,
    initializeCustomLinePayment,
    launchInitializedPayment,
    paymentMethod,
    payableCustomBagItems,
    promoApplied,
    promoCode,
    shippingCost,
    user?.id,
  ]);

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
      {(priceChangeNotices.length > 0 || removedItemNotices.length > 0 || blockedCustomBagItems.length > 0 || Boolean(customBagError)) && (
        <div className="rounded-xl border border-amber-200/70 dark:border-amber-700/40 bg-amber-50/70 dark:bg-amber-900/20 p-4 text-sm text-amber-900 dark:text-amber-100 mb-6">
          {removedItemNotices.length > 0 && (
            <p className="font-medium">Some items were removed because they are out of stock or no longer available.</p>
          )}
          {priceChangeNotices.length > 0 && (
            <p className="font-medium">
              Prices were updated for {priceChangeNotices.length} item{priceChangeNotices.length > 1 ? 's' : ''}. Review the changes below.
            </p>
          )}
          {blockedCustomBagItems.length > 0 && (
            <p className="font-medium">
              {blockedCustomBagItems.length} custom request{blockedCustomBagItems.length > 1 ? 's have' : ' has'} expired pricing locks. Refresh them from your bag before payment.
            </p>
          )}
          {customBagError && (
            <p className="font-medium">{customBagError}</p>
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
              <div className="space-y-4 rounded-[28px] border border-dashed border-slate-200/80 bg-white/55 p-4 dark:border-white/10 dark:bg-white/[0.02]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">Saved shipping addresses</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Checkout now uses the same saved delivery address book as custom orders. Your most recent address is selected first.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSaveCurrentAddress}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white"
                    >
                      {editingAddressId ? 'Update address' : 'Save current address'}
                    </button>
                    <button
                      type="button"
                      onClick={handleStartNewAddress}
                      className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-black"
                    >
                      Add new address
                    </button>
                  </div>
                </div>

                {savedAddressesLoading ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">Loading saved addresses...</p>
                ) : savedAddresses.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {savedAddresses.map((savedAddress) => {
                      const isSelected = editingAddressId === savedAddress.id;
                      return (
                        <div
                          key={savedAddress.id}
                          className={`rounded-[24px] border p-4 text-left transition-all ${
                            isSelected
                              ? 'border-fuchsia-300 bg-[linear-gradient(135deg,rgba(245,208,254,0.28),rgba(224,231,255,0.54))] shadow-[0_12px_28px_rgba(217,70,239,0.12)] dark:border-fuchsia-400/30 dark:bg-[linear-gradient(135deg,rgba(168,85,247,0.14),rgba(59,130,246,0.08))]'
                              : 'border-white/60 bg-white/75 hover:border-fuchsia-200 dark:border-white/10 dark:bg-white/[0.03]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => applySavedAddress(savedAddress)}
                              className="flex-1 text-left"
                            >
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {savedAddress.firstName} {savedAddress.lastName}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {savedAddress.street}{savedAddress.apartment ? `, ${savedAddress.apartment}` : ''}<br />
                            {savedAddress.city}, {savedAddress.state}{savedAddress.postalCode ? ` ${savedAddress.postalCode}` : ''}<br />
                            {savedAddress.country} • {savedAddress.phone}
                          </p>
                        </button>
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setOpenAddressMenuId((current) => (current === savedAddress.id ? null : savedAddress.id))}
                                className="rounded-full border border-black/10 px-2 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300"
                                aria-label="Open shipping address actions"
                              >
                                ...
                              </button>
                              {openAddressMenuId === savedAddress.id ? (
                                <div className="absolute right-0 top-10 z-10 w-36 rounded-2xl border border-black/10 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-slate-950">
                                  <button
                                    type="button"
                                    onClick={() => applySavedAddress(savedAddress)}
                                    className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
                                  >
                                    Use address
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      applySavedAddress(savedAddress);
                                      setOpenAddressMenuId(null);
                                    }}
                                    className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSavedAddress(savedAddress.id)}
                                    className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10"
                                  >
                                    Delete
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400">No saved delivery addresses yet. Fill the form below and save this address for both checkout and custom orders.</p>
                )}
              </div>

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
                  <UniversalSelect
                    label="State *"
                    value={address.state}
                    onChange={(value) => updateField('state', value)}
                    placeholder="Select state"
                    options={NIGERIAN_STATES.map((stateName) => ({
                      value: stateName,
                      label: stateName,
                    }))}
                    error={shippingErrors.state}
                  />
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
                <h3 className="font-semibold">🛍️ Bag lines</h3>

                {brandGroups.length > 0 && brandGroups.map((group) => (
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

                {payableCustomBagItems.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-500 dark:text-indigo-300">
                      Custom requests
                    </p>
                    {payableCustomBagItems.map((line) => (
                      <div key={line.sessionId} className="flex items-center justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{line.sourceTitle}</p>
                          <p className="text-gray-400 text-xs">
                            Qty: 1 · {line.sourceBrandName || 'Custom order'}
                            {line.rushSelected ? ' · Rush' : ''}
                          </p>
                        </div>
                        <span className="font-medium flex-shrink-0">
                          {formatPrice(line.buyerPriceSummary.grandTotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {blockedCustomBagItems.length > 0 && (
                  <div className="rounded-2xl border border-amber-300/70 bg-amber-50/80 p-3 text-xs text-amber-800 dark:border-amber-600/40 dark:bg-amber-500/10 dark:text-amber-100">
                    {blockedCustomBagItems.length} custom request{blockedCustomBagItems.length > 1 ? 's are' : ' is'} blocked by expired pricing locks and excluded from this payment.
                  </div>
                )}
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

                {payableCustomBagItems.map((line) => (
                  <div key={line.sessionId} className="flex items-start gap-3 rounded-[22px] border border-indigo-200/70 bg-indigo-50/70 p-3 dark:border-indigo-500/20 dark:bg-indigo-500/10">
                    <div className="h-16 w-16 overflow-hidden rounded-2xl bg-white ring-1 ring-indigo-200/70 dark:bg-white/10 dark:ring-indigo-500/30">
                      {line.sourcePrimaryMediaUrl ? (
                        <ImageWithFallback
                          src={line.sourcePrimaryMediaUrl}
                          alt={line.sourceTitle}
                          className="h-full w-full"
                          fit="cover"
                          rounded="none"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xl">🧵</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{line.sourceTitle}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{line.sourceBrandName || 'Custom order'}</p>
                        </div>
                        <span className="text-sm font-semibold text-slate-950 dark:text-white">
                          {formatPrice(line.buyerPriceSummary.grandTotal)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Qty: 1 · {line.measurementCount} measurements{line.rushSelected ? ' · Rush' : ''}
                      </p>
                    </div>
                  </div>
                ))}

                {customBagLoading && (
                  <div className="rounded-[22px] border border-slate-200/80 bg-white/70 p-3 text-xs text-slate-500 dark:border-white/8 dark:bg-white/[0.03] dark:text-slate-400">
                    Loading custom requests...
                  </div>
                )}
              </div>

              <div className="space-y-3 border-t border-slate-200/80 pt-4 text-sm dark:border-white/8">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Store items</span>
                  <span className="text-slate-950 dark:text-white">{formatPrice(cart.subtotal)}</span>
                </div>
                {payableCustomBagItems.length > 0 && (
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Custom requests</span>
                    <span className="text-slate-950 dark:text-white">{formatPrice(customSubtotal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Store shipping</span>
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
