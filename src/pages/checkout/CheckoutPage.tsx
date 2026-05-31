import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '@/store';
import { getMyOrders } from '@/api/StoreApi';
import type { PaystackPaymentData, ShippingAddress } from '@/api/StoreApi';
import {
  paymentApi,
  type CardValidationSessionSummary,
  type SavedPaymentCardSummary,
} from '@/api/PaymentApi';
import { createIdempotencyKey } from '@/api/idempotency';
import {
  customOrdersBuyerApi,
  type CustomOrderCheckoutBagLine,
} from '@/api/CustomOrderApi';
import {
  fetchCart,
  closeCartDrawer,
  selectCartPriceChangeNotices,
  selectCartRemovedItemNotices,
} from '@/features/cartSlice';
import type { CartItem } from '@/features/cartSlice';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import ImageWithFallback from '@/components/ImageWithFallback';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { formatPrice } from '@/utils/helpers';
import { openPaystackInline } from '@/lib/paystackInline';
import {
  resolveInAppPaymentSession,
  resolvePaymentGateway,
} from '@/lib/inAppPaymentSession';
import { AnimatePresence, motion } from 'framer-motion';
import PaymentDetailsSection from '@/pages/checkout/PaymentDetailsSection';
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
  setRuntimeCardholderNameMatchMode,
  type PaymentFormErrors,
  type PaymentFormState,
  validatePaymentData,
} from '@/pages/checkout/paymentFlow';
import { BAG_IT_EMOJI } from '@/constants/bagging';

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

const hasCollectedPaystackCardDraft = (
  paymentData: Pick<PaystackPaymentData, 'newCardDraft'>,
): boolean =>
  [
    paymentData.newCardDraft?.cardHolderName,
    paymentData.newCardDraft?.cardNumber,
    paymentData.newCardDraft?.expiry,
    paymentData.newCardDraft?.cvv,
  ].some((value) => String(value ?? '').trim().length > 0);

type Step = 'shipping' | 'payment' | 'review';
type CheckoutPaymentSelection = keyof PaymentFormState | 'PENDING_SELECTION';
type CheckoutProgressStage =
  | 'IDLE'
  | 'VALIDATING_DETAILS'
  | 'PREPARING_PAYMENT'
  | 'OPENING_SECURE_WINDOW'
  | 'POPUP_BLOCKED'
  | 'FAILED';

type InlinePaymentLaunchSession = {
  reference: string;
  gateway?: string;
  providerAccessCode?: string;
};

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

const CHECKOUT_PROGRESS_STAGE_LABELS: Record<CheckoutProgressStage, string> = {
  IDLE: 'Checkout status',
  VALIDATING_DETAILS: 'Stage 1/3 - Validating details',
  PREPARING_PAYMENT: 'Stage 2/3 - Preparing payment session',
  OPENING_SECURE_WINDOW: 'Stage 3/3 - Opening secure window',
  POPUP_BLOCKED: 'Secure window blocked',
  FAILED: 'Checkout action required',
};

const POPUP_BLOCKED_CHECKOUT_MESSAGE =
  'Secure checkout could not open because your browser blocked the popup window. Retry to continue payment.';

const getBlockedCustomBagMessage = (count: number) =>
  `${count} custom request${count > 1 ? 's have' : ' has'} expired pricing locks. Refresh them from your bag before payment.`;

const isPopupBlockedInlineError = (error: { message?: string } | null | undefined) => {
  const message = String(error?.message ?? '').trim().toLowerCase();
  if (!message) {
    return false;
  }
  return (
    (message.includes('popup') && (message.includes('block') || message.includes('window'))) ||
    message.includes('user gesture')
  );
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

function normalizeCheckoutMediaUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (
    lower.includes('async () =>') ||
    lower.includes('const providedregion') ||
    lower.includes('[object promise]')
  ) {
    return null;
  }

  if (
    lower.includes('x-amz-algorithm=') ||
    lower.includes('x-amz-signature=') ||
    lower.includes('x-amz-credential=') ||
    /[?&]expires=/.test(lower)
  ) {
    const [withoutQuery] = trimmed.split('?');
    return withoutQuery?.trim() || null;
  }

  return trimmed;
}

function toSavedCardDisplay(card: SavedPaymentCardSummary): NonNullable<PaystackPaymentData['savedCardDisplay']> {
  return {
    id: card.id,
    brand: card.brand,
    bank: card.bank,
    last4: card.last4,
    expMonth: card.expMonth,
    expYear: card.expYear,
    reusable: card.reusable,
    lastUsedAt: card.lastUsedAt,
  };
}

function isActiveCardValidationSession(
  session: CardValidationSessionSummary | null,
): session is CardValidationSessionSummary {
  if (!session || session.status !== 'VALIDATED') {
    return false;
  }
  const expiry = new Date(session.expiresAt).getTime();
  return Number.isFinite(expiry) && expiry > Date.now();
}

const CheckoutBackLink: React.FC<{
  label: string;
  onClick: () => void;
}> = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 underline decoration-slate-400/80 decoration-2 underline-offset-4 transition-colors hover:text-slate-900 dark:text-slate-200 dark:decoration-slate-500 dark:hover:text-white"
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
  <section className="threadly-chrome-surface relative overflow-hidden rounded-[32px] p-6 sm:p-8">
    <div className="space-y-6">
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

interface CheckoutPageProps {
  embedded?: boolean;
  onClose?: () => void;
}

const PROMO_CODES_UNAVAILABLE_MESSAGE =
  'Promo codes are not available during MVP checkout. Final totals are calculated securely by Threadly at payment time.';

/* ─── Component ─── */

const CheckoutPage: React.FC<CheckoutPageProps> = ({
  embedded = false,
  onClose,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const cart = useSelector((s: RootState) => s.cart);
  const priceChangeNotices = useSelector(selectCartPriceChangeNotices);
  const removedItemNotices = useSelector(selectCartRemovedItemNotices);
  const user = useSelector((s: RootState) => s.user.profile);
  const submittingRef = useRef(false);
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
  const [savedCards, setSavedCards] = useState<SavedPaymentCardSummary[]>([]);
  const [savedCardsLoading, setSavedCardsLoading] = useState(false);
  const [savedCardsError, setSavedCardsError] = useState<string | null>(null);
  const [checkoutProgressMessage, setCheckoutProgressMessage] = useState<string | null>(null);
  const [checkoutProgressStage, setCheckoutProgressStage] =
    useState<CheckoutProgressStage>('IDLE');
  const [pendingInlineSession, setPendingInlineSession] =
    useState<InlinePaymentLaunchSession | null>(null);
  const [retryingInlineLaunch, setRetryingInlineLaunch] = useState(false);
  const [savedCardMutatingId, setSavedCardMutatingId] = useState<string | null>(null);
  const [cardValidationSession, setCardValidationSession] =
    useState<CardValidationSessionSummary | null>(null);
  const [cardValidationLoading, setCardValidationLoading] = useState(false);

  /* ── Submission state ── */
  const [submitting, setSubmitting] = useState(false);
  const [cartLoading, setCartLoading] = useState(!cart.items.length);
  const [customBagItems, setCustomBagItems] = useState<CustomOrderCheckoutBagLine[]>([]);
  const [customBagLoading, setCustomBagLoading] = useState(true);
  const [customBagError, setCustomBagError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void paymentApi
      .getPolicy()
      .then((policy) => {
        if (!active) {
          return;
        }

        setRuntimeCardholderNameMatchMode(policy.paystack.cardholderNameMatchMode);
      })
      .catch(() => {
        if (active) {
          setRuntimeCardholderNameMatchMode(null);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const clearCheckoutProgress = useCallback(() => {
    setCheckoutProgressMessage(null);
    setCheckoutProgressStage('IDLE');
    setPendingInlineSession(null);
  }, []);

  const refreshSavedCards = useCallback(async () => {
    if (!user?.id) {
      setSavedCards([]);
      setSavedCardsError(null);
      return [] as SavedPaymentCardSummary[];
    }

    setSavedCardsLoading(true);
    setSavedCardsError(null);
    try {
      const cards = await paymentApi.listSavedCards();
      setSavedCards(cards);
      return cards;
    } catch {
      setSavedCards([]);
      setSavedCardsError('Saved cards are temporarily unavailable. You can still continue with a new card.');
      return [] as SavedPaymentCardSummary[];
    } finally {
      setSavedCardsLoading(false);
    }
  }, [user?.id]);

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
    let active = true;

    if (!user?.id) {
      setSavedCards([]);
      setSavedCardsError(null);
      setSavedCardsLoading(false);
      return () => {
        active = false;
      };
    }

    const loadSavedCards = async () => {
      setSavedCardsLoading(true);
      setSavedCardsError(null);
      try {
        const cards = await paymentApi.listSavedCards();
        if (!active) return;
        setSavedCards(cards);
      } catch {
        if (!active) return;
        setSavedCards([]);
        setSavedCardsError('Saved cards are temporarily unavailable. You can still continue with a new card.');
      } finally {
        if (active) {
          setSavedCardsLoading(false);
        }
      }
    };

    void loadSavedCards();

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (savedCards.length === 0) {
      return;
    }

    setPaymentState((prev) => {
      if (prev.PAYSTACK.savedCardId || prev.PAYSTACK.useSavedCard) {
        return prev;
      }

      const first = savedCards[0];
      return {
        ...prev,
        PAYSTACK: {
          ...prev.PAYSTACK,
          channel: 'CARD',
          useSavedCard: true,
          savedCardId: first.id,
          savedCardDisplay: toSavedCardDisplay(first),
        },
      };
    });
  }, [savedCards]);

  useEffect(() => {
    if (!cartLoading && !customBagLoading && !cart.items.length && customBagItems.length === 0) {
      toast.error('Your bag is empty');
      if (embedded) {
        onClose?.();
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [
    cartLoading,
    cart.items.length,
    customBagItems.length,
    customBagLoading,
    embedded,
    navigate,
    onClose,
  ]);

  const handleBackToBag = useCallback(() => {
    if (embedded) {
      onClose?.();
      return;
    }
    navigate(-1);
  }, [embedded, navigate, onClose]);

  const handleReturnToSourcePage = useCallback(() => {
    if (embedded) {
      dispatch(closeCartDrawer());
      return;
    }
    navigate(-1);
  }, [dispatch, embedded, navigate]);

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

  const blockedCustomBagMessage = useMemo(
    () =>
      blockedCustomBagItems.length > 0
        ? getBlockedCustomBagMessage(blockedCustomBagItems.length)
        : null,
    [blockedCustomBagItems.length],
  );

  const shippingCost = address.state ? getShippingCost(address.state) : 0;
  const discountAmount = 0;
  const customSubtotal = payableCustomBagItems.reduce(
    (sum, item) => sum + Number(item.buyerPriceSummary?.grandTotal ?? 0),
    0,
  );
  const standardGrandTotal = Math.max(0, cart.subtotal + shippingCost - discountAmount);
  const grandTotal = standardGrandTotal + customSubtotal;
  const brandGroups = useMemo(() => groupByBrand(cart.items), [cart.items]);
  const activePaymentData = paymentMethod === 'PENDING_SELECTION' ? null : paymentState[paymentMethod];
  const isHostedNewCardSelection =
    paymentMethod === 'PAYSTACK' &&
    activePaymentData?.channel === 'CARD' &&
    !activePaymentData.useSavedCard &&
    !hasCollectedPaystackCardDraft(activePaymentData);
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
    paymentInitIdempotencyKeyRef.current = null;
  }, [activePaymentData, address, cart.items, paymentMethod]);

  useEffect(() => {
    setCardValidationSession(null);
    clearCheckoutProgress();
  }, [activePaymentData, address, clearCheckoutProgress, paymentMethod]);

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

  const getFirstPaymentErrorMessage = useCallback((errors: PaymentFormErrors): string => {
    const firstError = Object.values(errors).find(
      (value) => typeof value === 'string' && value.trim().length > 0,
    );
    return firstError ?? 'Complete the payment details for the selected method';
  }, []);

  const ensureCardValidationSession = useCallback(
    async (paymentSubmissionData: PaystackPaymentData): Promise<CardValidationSessionSummary> => {
      if (paymentSubmissionData.channel !== 'CARD') {
        throw new Error('Card validation is only required for card checkouts.');
      }

      if (isActiveCardValidationSession(cardValidationSession)) {
        try {
          const refreshed = await paymentApi.getCardValidationSession(
            cardValidationSession.sessionId,
          );
          if (isActiveCardValidationSession(refreshed)) {
            setCardValidationSession(refreshed);
            return refreshed;
          }
        } catch {
          // Fall through to fresh validation.
        }
      }

      setCardValidationLoading(true);
      setCheckoutProgressStage('VALIDATING_DETAILS');
      setCheckoutProgressMessage('Validating card details before secure checkout...');

      try {
        const validated = await paymentApi.validateCard({
          paymentMethod: 'PAYSTACK',
          paymentData: paymentSubmissionData,
        });

        if (!isActiveCardValidationSession(validated)) {
          throw new Error(
            'Card validation session expired before checkout could continue. Validate and retry.',
          );
        }

        setCardValidationSession(validated);
        setPaymentErrors((prev) => {
          if (!prev.validationSessionId) {
            return prev;
          }
          const next = { ...prev };
          delete next.validationSessionId;
          return next;
        });

        return validated;
      } catch (error: any) {
        const message =
          error?.response?.data?.message ||
          error?.message ||
          'Card validation failed. Review payment details and try again.';
        setCheckoutProgressStage('FAILED');
        setPaymentErrors((prev) => ({ ...prev, validationSessionId: message }));
        throw new Error(message);
      } finally {
        setCardValidationLoading(false);
      }
    },
    [cardValidationSession],
  );

  /* ── Step navigation ── */
  const goNext = useCallback(async () => {
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
        setCheckoutProgressStage('FAILED');
        setCheckoutProgressMessage('Resolve the highlighted payment details before moving to review.');
        toast.error(getFirstPaymentErrorMessage(validationErrors));
        return;
      }

      try {
        const paymentSubmissionData = buildPaymentSubmissionData(
          paymentState[paymentMethod],
          address,
        ) as PaystackPaymentData;
        const requiresCardValidation =
          paymentSubmissionData.channel === 'CARD' &&
          (paymentSubmissionData.useSavedCard ||
            hasCollectedPaystackCardDraft(paymentSubmissionData));

        if (requiresCardValidation) {
          await ensureCardValidationSession(paymentSubmissionData);
        } else {
          setCardValidationSession(null);
        }
      } catch (error: any) {
        const message = error?.message || 'Card validation failed. Review details and try again.';
        setCheckoutProgressStage('FAILED');
        setCheckoutProgressMessage(message);
        toast.error(message);
        return;
      }

      setStep('review');
    }
  }, [
    step,
    validateShipping,
    paymentMethod,
    paymentState,
    address,
    getFirstPaymentErrorMessage,
    ensureCardValidationSession,
  ]);

  const goBack = useCallback(() => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) {
      setStep(STEPS[idx - 1]);
      clearCheckoutProgress();
    }
  }, [clearCheckoutProgress, step]);

  const goToStep = useCallback((target: Step) => {
    const targetIdx = STEPS.indexOf(target);
    const currentIdx = STEPS.indexOf(step);
    // Only allow going back to already-completed steps
    if (targetIdx < currentIdx) {
      setStep(target);
      clearCheckoutProgress();
    }
  }, [clearCheckoutProgress, step]);

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

  const updateSelectedPaymentData = useCallback((updater: (current: PaystackPaymentData) => PaystackPaymentData) => {
    const selectedPaymentMethod = paymentMethod;
    if (selectedPaymentMethod === 'PENDING_SELECTION') return;
    setPaymentState((prev) => ({
      ...prev,
      [selectedPaymentMethod]: updater(prev[selectedPaymentMethod]),
    }));
    setPaymentErrors({});
    setCardValidationSession(null);
    clearCheckoutProgress();
  }, [clearCheckoutProgress, paymentMethod]);

  const handleSelectPaymentMethod = useCallback((method: keyof PaymentFormState) => {
    setPaymentMethod(method);
    setPaymentErrors({});
    setCardValidationSession(null);
    clearCheckoutProgress();
  }, [clearCheckoutProgress]);

  const launchInitializedPayment = useCallback(async (
    paymentInit: InlinePaymentLaunchSession,
    options?: { retry?: boolean },
  ) => {
    const resolvedGateway = resolvePaymentGateway(paymentInit);
    const session = resolveInAppPaymentSession(paymentInit);
    const returnPath =
      `/bag/payment-return?reference=${encodeURIComponent(paymentInit.reference)}&gateway=${encodeURIComponent(resolvedGateway)}`;

    if (embedded) {
      dispatch(closeCartDrawer());
    }

    setPendingInlineSession(paymentInit);
    setCheckoutProgressStage('OPENING_SECURE_WINDOW');
    setCheckoutProgressMessage(
      options?.retry
        ? 'Retrying secure checkout inside Threadly...'
        : 'Opening secure checkout inside Threadly...',
    );

    await openPaystackInline(session.accessCode, {
      onSuccess: () => {
        clearCheckoutProgress();
        navigate(returnPath);
      },
      onCancel: () => {
        setCheckoutProgressStage('FAILED');
        setCheckoutProgressMessage(
          'Secure checkout was cancelled before completion. Retry the secure window to continue payment.',
        );
        toast.error('Payment was cancelled before completion.');
      },
      onError: (inlineError) => {
        if (isPopupBlockedInlineError(inlineError)) {
          setCheckoutProgressStage('POPUP_BLOCKED');
          setCheckoutProgressMessage(POPUP_BLOCKED_CHECKOUT_MESSAGE);
          toast.error(POPUP_BLOCKED_CHECKOUT_MESSAGE);
          return;
        }

        setCheckoutProgressStage('FAILED');
        setCheckoutProgressMessage(
          'Secure checkout could not be opened. Retry to continue your payment.',
        );
        toast.error(inlineError.message || 'Unable to open the payment window.');
      },
    });
  }, [clearCheckoutProgress, dispatch, embedded, navigate]);

  const handleSetDefaultSavedCard = useCallback(async (savedCardId: string) => {
    setSavedCardMutatingId(savedCardId);
    try {
      await paymentApi.setDefaultSavedCard(savedCardId);
      await refreshSavedCards();
      toast.success('Default card updated.');
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          'Unable to set this card as default right now.',
      );
    } finally {
      setSavedCardMutatingId(null);
    }
  }, [refreshSavedCards]);

  const handleRemoveSavedCard = useCallback(async (savedCardId: string) => {
    setSavedCardMutatingId(savedCardId);
    try {
      await paymentApi.removeSavedCard(savedCardId);
      const nextCards = await refreshSavedCards();

      setPaymentState((prev) => {
        if (!prev.PAYSTACK.useSavedCard || prev.PAYSTACK.savedCardId !== savedCardId) {
          return prev;
        }

        const nextSavedCard = nextCards[0] ?? null;
        if (!nextSavedCard) {
          return {
            ...prev,
            PAYSTACK: {
              ...prev.PAYSTACK,
              useSavedCard: false,
              savedCardId: null,
              savedCardDisplay: null,
            },
          };
        }

        return {
          ...prev,
          PAYSTACK: {
            ...prev.PAYSTACK,
            useSavedCard: true,
            savedCardId: nextSavedCard.id,
            savedCardDisplay: toSavedCardDisplay(nextSavedCard),
          },
        };
      });

      toast.success('Saved card removed.');
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          'Unable to remove this card right now.',
      );
    } finally {
      setSavedCardMutatingId(null);
    }
  }, [refreshSavedCards]);

  const handleRetryInlineLaunch = useCallback(async () => {
    if (!pendingInlineSession) {
      return;
    }

    setRetryingInlineLaunch(true);
    try {
      await launchInitializedPayment(pendingInlineSession, { retry: true });
    } finally {
      setRetryingInlineLaunch(false);
    }
  }, [launchInitializedPayment, pendingInlineSession]);

  /* ── Place order flow ── */
  const handlePlaceOrder = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setPendingInlineSession(null);
    setCheckoutProgressStage('VALIDATING_DETAILS');
    setCheckoutProgressMessage('Validating checkout details...');

    try {
      const hasStoreItems = cart.items.length > 0;
      const hasPayableCustomItems = payableCustomBagItems.length > 0;

      if (!hasStoreItems && !hasPayableCustomItems) {
        setCheckoutProgressStage('FAILED');
        setCheckoutProgressMessage('Your bag is empty. Add an item before checkout.');
        toast.error('Your bag is empty');
        return;
      }

      if (paymentMethod === 'PENDING_SELECTION' || !activePaymentData) {
        setCheckoutProgressStage('FAILED');
        setCheckoutProgressMessage('Select and complete a payment method before placing your order.');
        toast.error('Select and complete a payment method first');
        return;
      }

      const validationErrors = validatePaymentData(paymentMethod, activePaymentData, address);
      setPaymentErrors(validationErrors);
      if (Object.keys(validationErrors).length > 0) {
        setCheckoutProgressStage('FAILED');
        setCheckoutProgressMessage('Resolve the highlighted payment details before continuing.');
        toast.error(getFirstPaymentErrorMessage(validationErrors));
        return;
      }

      const paymentSubmissionData = buildPaymentSubmissionData(activePaymentData, address);
      let cardValidationSessionId: string | undefined;

      if (paymentMethod === 'PAYSTACK') {
        const paystackSubmissionData = paymentSubmissionData as PaystackPaymentData;
        const requiresCardValidation =
          paystackSubmissionData.channel === 'CARD' &&
          (paystackSubmissionData.useSavedCard ||
            hasCollectedPaystackCardDraft(paystackSubmissionData));

        if (requiresCardValidation) {
          const validatedSession = await ensureCardValidationSession(
            paystackSubmissionData,
          );
          cardValidationSessionId = validatedSession.sessionId;

          setCheckoutProgressStage('PREPARING_PAYMENT');
          setCheckoutProgressMessage(
            'Card details validated. Preparing your secure payment session...',
          );
        }
      }

      const contactInfo = buildContactInfo(paymentSubmissionData, address);
      const nextAddresses = upsertDeliveryAddress(user?.id, {
        ...currentAddressDraft,
        contactEmail: currentAddressDraft.contactEmail || paymentSubmissionData.email || '',
      });
      setSavedAddresses(nextAddresses);
      if (nextAddresses[0]) {
        setEditingAddressId(nextAddresses[0].id);
      }

      setCheckoutProgressStage('PREPARING_PAYMENT');
      setCheckoutProgressMessage('Preparing your secure payment session...');

      const paymentInitIdempotencyKey =
        paymentInitIdempotencyKeyRef.current ?? createIdempotencyKey();
      paymentInitIdempotencyKeyRef.current = paymentInitIdempotencyKey;

      const customerName = `${address.firstName} ${address.lastName}`.trim();
      const unifiedPaymentInit = await paymentApi.initializeUnified({
        paymentMethod,
        email: paymentSubmissionData.email,
        customerName,
        shippingAddress: address,
        contactInfo,
        callbackUrl: `${window.location.origin}/bag/payment-return`,
        paymentData: paymentSubmissionData,
        idempotencyKey: paymentInitIdempotencyKey,
        validationSessionId: cardValidationSessionId,
      });

      if (blockedCustomBagMessage) {
        toast.error(blockedCustomBagMessage);
      }

      if ((unifiedPaymentInit.blockedLines?.length ?? 0) > 0) {
        toast.error(getBlockedCustomBagMessage(unifiedPaymentInit.blockedLines!.length));
      }

      setCheckoutProgressStage('OPENING_SECURE_WINDOW');
      setPendingInlineSession(unifiedPaymentInit);
      await launchInitializedPayment(unifiedPaymentInit);
      return;
    } catch (error: any) {
      setCheckoutProgressStage('FAILED');
      setCheckoutProgressMessage('Checkout could not be completed. Review the payment state and retry.');
      toast.error(error?.response?.data?.message || error?.message || 'Checkout failed. Please try again.');
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [
    activePaymentData,
    address,
    blockedCustomBagMessage,
    cart.items,
    currentAddressDraft,
    ensureCardValidationSession,
    launchInitializedPayment,
    getFirstPaymentErrorMessage,
    paymentMethod,
    payableCustomBagItems,
    user?.id,
  ]);

  /* ─── Step Indicator ─── */
  const stepIdx = STEPS.indexOf(step);
  const shellClassName = embedded
    ? 'threadly-shell-bg min-h-full'
    : 'threadly-shell-bg min-h-screen';
  const contentClassName = embedded
    ? 'relative mx-auto max-w-7xl px-4 py-6 sm:px-5 lg:px-8 lg:py-8'
    : 'relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12';
  const checkoutProgressToneClass =
    checkoutProgressStage === 'FAILED'
      ? 'border-rose-200/80 bg-rose-50/85 text-rose-900 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-100'
      : checkoutProgressStage === 'POPUP_BLOCKED'
        ? 'border-amber-200/80 bg-amber-50/85 text-amber-900 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100'
        : 'border-sky-200/80 bg-sky-50/80 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100';

  return (
    <div className={shellClassName}>
      <div className={contentClassName}>
      <div className="mb-6 flex items-center justify-between gap-4">
        <CheckoutBackLink label="Back to bag" onClick={handleBackToBag} />
        {embedded ? (
          <button
            type="button"
            onClick={handleReturnToSourcePage}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 dark:border-white/15 dark:bg-white/[0.04] dark:text-slate-300 dark:hover:border-white/25 dark:hover:text-white"
          >
            Return to shopping
          </button>
        ) : (
          <div className="hidden rounded-full border border-white/60 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-slate-400 sm:inline-flex">
            Secure checkout
          </div>
        )}
      </div>

      {/* Step indicator */}
      <nav className="threadly-chrome-surface mb-8 flex items-center justify-center gap-2 rounded-full px-3 py-3" aria-label="Checkout steps">
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
          {blockedCustomBagMessage && (
            <p className="font-medium">{blockedCustomBagMessage}</p>
          )}
          {customBagError && (
            <p className="font-medium">{customBagError}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.75fr)_minmax(320px,0.95fr)] lg:items-start">
        {/* ─── Main panel ─── */}
        <div className="space-y-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            >
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
                              ? 'border-fuchsia-300 bg-white shadow-[0_12px_28px_rgba(99,102,241,0.12)] dark:border-fuchsia-400/35 dark:bg-white/[0.06]'
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
                <CheckoutBackLink label="Back to bag" onClick={handleBackToBag} />
                <Button onClick={() => { void goNext(); }} size="lg" className="rounded-2xl px-8 shadow-[0_16px_36px_rgba(217,70,239,0.28)]">
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
                          ? 'border-fuchsia-300/90 bg-white shadow-[0_14px_34px_rgba(99,102,241,0.12)] dark:border-fuchsia-400/35 dark:bg-white/[0.06]'
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
                            savedCards={savedCards}
                            savedCardsLoading={savedCardsLoading}
                            savedCardsError={savedCardsError}
                            savedCardMutatingId={savedCardMutatingId}
                            onSetDefaultSavedCard={handleSetDefaultSavedCard}
                            onRemoveSavedCard={handleRemoveSavedCard}
                            cardValidationSession={cardValidationSession}
                            cardValidationLoading={cardValidationLoading}
                            onStartNewCardCheckout={handlePlaceOrder}
                            startingNewCardCheckout={submitting}
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
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  {PROMO_CODES_UNAVAILABLE_MESSAGE}
                </div>
              </div>

              <div className="flex flex-col gap-4 border-t border-slate-200/70 pt-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                <CheckoutBackLink label="Back to shipping" onClick={goBack} />
                {!isHostedNewCardSelection ? (
                  <Button
                    onClick={() => { void goNext(); }}
                    size="lg"
                    disabled={cardValidationLoading}
                    className="rounded-2xl px-8 shadow-[0_16px_36px_rgba(217,70,239,0.28)]"
                  >
                    {cardValidationLoading ? 'Validating card details...' : 'Review Order'}
                  </Button>
                ) : null}
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
              {checkoutProgressMessage && (
                <div className={`rounded-[24px] border px-4 py-3 text-sm ${checkoutProgressToneClass}`}>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em]">
                    {CHECKOUT_PROGRESS_STAGE_LABELS[checkoutProgressStage]}
                  </p>
                  <p className="mt-1">{checkoutProgressMessage}</p>
                  {checkoutProgressStage === 'POPUP_BLOCKED' && pendingInlineSession ? (
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => { void handleRetryInlineLaunch(); }}
                        loading={retryingInlineLaunch}
                        disabled={retryingInlineLaunch || submitting}
                        className="rounded-xl"
                      >
                        Retry secure checkout window
                      </Button>
                      <p className="text-xs">
                        If this repeats, allow popups for this site and retry once.
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
              {/* Shipping summary */}
              <div className="rounded-[28px] border border-white/60 bg-white/72 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">📍 Shipping Address</h3>
                  <button type="button" onClick={() => setStep('shipping')} className="text-sm font-semibold text-indigo-700 underline decoration-indigo-300 decoration-2 underline-offset-4 dark:text-indigo-300 dark:decoration-indigo-500">
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
                  <button type="button" onClick={() => setStep('payment')} className="text-sm font-semibold text-indigo-700 underline decoration-indigo-300 decoration-2 underline-offset-4 dark:text-indigo-300 dark:decoration-indigo-500">
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
              </div>

              {/* Items grouped by brand */}
              <div className="rounded-[28px] border border-white/60 bg-white/72 p-5 shadow-[0_12px_32px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.03] space-y-4">
                <h3 className="font-semibold">{BAG_IT_EMOJI} Bag lines</h3>

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
                    {payableCustomBagItems.map((line) => {
                      const mediaUrl = normalizeCheckoutMediaUrl(line.sourcePrimaryMediaUrl);
                      return (
                        <div key={line.sessionId} className="flex items-center justify-between gap-3 text-sm">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="h-10 w-10 overflow-hidden rounded-xl bg-white ring-1 ring-indigo-200/70 dark:bg-white/10 dark:ring-indigo-500/30">
                              {mediaUrl ? (
                                <ImageWithFallback
                                  src={mediaUrl}
                                  alt={line.sourceTitle}
                                  className="h-full w-full"
                                  fit="cover"
                                  rounded="none"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-base">🧵</div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{line.sourceTitle}</p>
                              <p className="text-gray-400 text-xs">
                                Qty: 1 · {line.sourceBrandName || 'Custom order'}
                                {line.rushSelected ? ' · Rush' : ''}
                              </p>
                            </div>
                          </div>
                          <span className="font-medium flex-shrink-0">
                            {formatPrice(line.buyerPriceSummary.grandTotal)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {blockedCustomBagMessage && (
                  <div className="rounded-2xl border border-amber-300/70 bg-amber-50/80 p-3 text-xs text-amber-800 dark:border-amber-600/40 dark:bg-amber-500/10 dark:text-amber-100">
                    {blockedCustomBagMessage} These lines are excluded from this payment run.
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
            </motion.div>
          </AnimatePresence>
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
                        <div className="flex h-full w-full items-center justify-center text-xl">{BAG_IT_EMOJI}</div>
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

                {payableCustomBagItems.map((line) => {
                  const mediaUrl = normalizeCheckoutMediaUrl(line.sourcePrimaryMediaUrl);
                  return (
                    <div key={line.sessionId} className="flex items-start gap-3 rounded-[22px] border border-indigo-200/70 bg-indigo-50/70 p-3 dark:border-indigo-500/20 dark:bg-indigo-500/10">
                      <div className="h-16 w-16 overflow-hidden rounded-2xl bg-white ring-1 ring-indigo-200/70 dark:bg-white/10 dark:ring-indigo-500/30">
                        {mediaUrl ? (
                          <ImageWithFallback
                            src={mediaUrl}
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
                  );
                })}

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

              <div className="threadly-chrome-surface rounded-[22px] px-4 py-4 text-sm text-slate-700 dark:text-slate-300">
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
