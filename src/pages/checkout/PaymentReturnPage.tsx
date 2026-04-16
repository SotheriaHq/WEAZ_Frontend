import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import PaymentDetailsSection from '@/pages/checkout/PaymentDetailsSection';
import { paymentApi, type PaymentAttemptSummary, type PaymentAttemptStatus, type PaymentVerifyResult, type SavedPaymentCardSummary } from '@/api/PaymentApi';
import { customOrdersBuyerApi } from '@/api/CustomOrderApi';
import { getCheckoutStatusCopy } from '@/pages/checkout/checkoutStatusCopy';
import {
  buildPaymentSubmissionData,
  setRuntimeCardholderNameMatchMode,
  type PaymentFormErrors,
  validatePaymentData,
} from '@/pages/checkout/paymentFlow';
import {
  canOfferCustomOrderCardRetry,
  createCustomOrderRetryPaymentData,
  createRetryShippingAddress,
} from '@/pages/checkout/paymentRetryFlow';
import { cancelActivePaystackInline, openPaystackInline } from '@/lib/paystackInline';
import { fetchCart, openCartDrawer } from '@/features/cartSlice';
import type { PaystackPaymentData } from '@/api/StoreApi';
import type { AppDispatch } from '@/store';

type ViewState = 'verifying' | 'resolved' | 'missing';

type BlockedInlineSession = {
  accessCode: string;
  reference: string;
  gateway: string;
};

const AUTO_VERIFY_INTERVAL_MS = 10000;
const AUTO_VERIFY_MAX_ATTEMPTS = 18;
const CUSTOM_ORDER_REFERENCE_PREFIX = 'TH-CO-';
const POPUP_BLOCKED_RETURN_MESSAGE =
  'Secure payment window was blocked by your browser. Retry opening it to continue.';

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

const normalizePaymentStatus = (status: unknown): PaymentAttemptStatus | undefined => {
  const normalized = String(status ?? '').trim().toLowerCase();
  switch (normalized) {
    case 'paid':
    case 'success':
      return 'PAID';
    case 'failed':
    case 'fail':
      return 'FAILED';
    case 'cancelled':
    case 'cancel':
      return 'CANCELLED';
    case 'expired':
    case 'expire':
      return 'EXPIRED';
    case 'requires_action':
    case 'requires-action':
      return 'REQUIRES_ACTION';
    case 'processing':
    case 'pending':
      return 'PROCESSING';
    default:
      return undefined;
  }
};

const normalizeAttemptSummary = (
  summary: PaymentAttemptSummary,
  reference: string,
): PaymentAttemptSummary => {
  const normalizedStatus = normalizePaymentStatus(summary.status) ?? 'PENDING';
  const referenceLooksCustom = reference
    .trim()
    .toUpperCase()
    .startsWith(CUSTOM_ORDER_REFERENCE_PREFIX);
  return {
    ...summary,
    status: normalizedStatus,
    subjectType:
      summary.subjectType === 'CUSTOM_ORDER' || referenceLooksCustom
        ? 'CUSTOM_ORDER'
        : summary.subjectType,
  };
};

const PaymentReturnPage: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const [searchParams] = useSearchParams();
  const [viewState, setViewState] = useState<ViewState>('verifying');
  const [verifyResult, setVerifyResult] = useState<PaymentVerifyResult | null>(null);
  const [attempt, setAttempt] = useState<PaymentAttemptSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [autoVerifyAttempts, setAutoVerifyAttempts] = useState(0);
  const [autoVerifying, setAutoVerifying] = useState(false);
  const [retryingPayment, setRetryingPayment] = useState(false);
  const [retryPaymentData, setRetryPaymentData] = useState<PaystackPaymentData | null>(null);
  const [retryPaymentErrors, setRetryPaymentErrors] = useState<PaymentFormErrors>({});
  const [retrySavedCards, setRetrySavedCards] = useState<SavedPaymentCardSummary[]>([]);
  const [retrySavedCardsLoading, setRetrySavedCardsLoading] = useState(false);
  const [retrySavedCardsError, setRetrySavedCardsError] = useState<string | null>(null);
  const [blockedInlineSession, setBlockedInlineSession] =
    useState<BlockedInlineSession | null>(null);
  const [retryingBlockedInlineSession, setRetryingBlockedInlineSession] = useState(false);
  const retryPaymentSeedReferenceRef = useRef<string | null>(null);
  const retrySavedCardsSeedReferenceRef = useRef<string | null>(null);

  const reference = searchParams.get('reference')?.trim() || '';
  const gateway = searchParams.get('gateway')?.trim() || '';
  const statusHint = searchParams.get('status')?.trim() || undefined;
  const referenceLooksCustom = reference.toUpperCase().startsWith(CUSTOM_ORDER_REFERENCE_PREFIX);
  const shouldOfferCustomOrderRetry = canOfferCustomOrderCardRetry(attempt);

  const openBag = useCallback((replace?: boolean) => {
    dispatch(openCartDrawer());
    navigate('/', { replace });
  }, [dispatch, navigate]);

  useEffect(() => {
    return () => {
      void cancelActivePaystackInline();
    };
  }, []);

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

  const verifyAttempt = useCallback(async (
    summary: PaymentAttemptSummary,
    resolvedGateway: string,
    includeStatusHint: boolean,
  ): Promise<PaymentVerifyResult> => {
    const hint = includeStatusHint ? statusHint : undefined;
    const shouldUseCustomVerify =
      summary.subjectType === 'CUSTOM_ORDER' ||
      referenceLooksCustom;

    if (shouldUseCustomVerify) {
      const customResult = summary.customOrderId
        ? await customOrdersBuyerApi.verifyPayment(summary.customOrderId, {
            reference,
            gateway: resolvedGateway,
            statusHint: hint,
          })
        : await customOrdersBuyerApi.verifyPaymentByReference({
            reference,
            gateway: resolvedGateway,
            statusHint: hint,
          });
      const normalizedStatus = normalizePaymentStatus(customResult.status) ?? 'PROCESSING';
      return {
        success: customResult.success,
        status: normalizedStatus,
        paymentAttemptId: customResult.paymentAttemptId,
        reference: customResult.reference,
        amount: customResult.amount,
        currency: customResult.currency,
        settlementCurrency: customResult.currency,
        settlementAmount: customResult.amount,
        paidAt: customResult.paidAt,
        channel: customResult.channel,
        failureMessage: customResult.failureMessage,
        gatewayResponse: customResult.recoveryMessage,
        orderIds: customResult.customOrderId ? [customResult.customOrderId] : [],
      };
    }

    const standardResult = await paymentApi.verifyWithStatus(reference, resolvedGateway, hint);
    return {
      ...standardResult,
      status: normalizePaymentStatus(standardResult.status) ?? 'PROCESSING',
    };
  }, [reference, referenceLooksCustom, statusHint]);

  const resolveTerminalStatus = useCallback(async (
    status: PaymentAttemptStatus,
    summary: PaymentAttemptSummary,
    failureReason?: string,
    options?: { replace?: boolean },
  ) => {
    setBlockedInlineSession(null);

    if (status === 'PAID') {
      await dispatch(fetchCart());
      toast.success('Your order is placed successfully, Thank you for shopping.');
      navigate(`/bag/confirmation?reference=${encodeURIComponent(reference)}`, {
        replace: options?.replace,
        state: summary.summary ? { reference, summary: summary.summary } : undefined,
      });
      return;
    }

    const resolvedFailureReason =
      failureReason ||
      'Payment failed before completion. Please restart checkout.';
    toast.error(resolvedFailureReason);
    // Keep user on the return page for FAILED/CANCELLED/EXPIRED so they can see
    // the exact gateway response and retry explicitly.
    return;
  }, [dispatch, navigate, reference]);

  useEffect(() => {
    if (!shouldOfferCustomOrderRetry || !attempt) {
      retryPaymentSeedReferenceRef.current = null;
      retrySavedCardsSeedReferenceRef.current = null;
      setRetryPaymentData(null);
      setRetryPaymentErrors({});
      setRetrySavedCards([]);
      setRetrySavedCardsLoading(false);
      setRetrySavedCardsError(null);
      return;
    }

    if (retryPaymentSeedReferenceRef.current === attempt.reference) {
      return;
    }

    retryPaymentSeedReferenceRef.current = attempt.reference;
    retrySavedCardsSeedReferenceRef.current = null;
    setRetryPaymentData(createCustomOrderRetryPaymentData(attempt));
    setRetryPaymentErrors({});
    setRetrySavedCards([]);
    setRetrySavedCardsLoading(false);
    setRetrySavedCardsError(null);
  }, [attempt, shouldOfferCustomOrderRetry]);

  useEffect(() => {
    if (!shouldOfferCustomOrderRetry || !attempt || !retryPaymentData) {
      return;
    }

    if (retrySavedCardsSeedReferenceRef.current === attempt.reference) {
      return;
    }

    retrySavedCardsSeedReferenceRef.current = attempt.reference;
    let active = true;

    setRetrySavedCardsLoading(true);
    setRetrySavedCardsError(null);

    void paymentApi
      .listSavedCards()
      .then((cards) => {
        if (!active) {
          return;
        }

        setRetrySavedCards(cards);
      })
      .catch((error: any) => {
        if (!active) {
          return;
        }

        setRetrySavedCards([]);
        setRetrySavedCardsError(
          error?.response?.data?.message || 'Unable to load saved cards right now.',
        );
      })
      .finally(() => {
        if (active) {
          setRetrySavedCardsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [attempt, retryPaymentData, shouldOfferCustomOrderRetry]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!reference) {
        setViewState('missing');
        return;
      }

      setAutoVerifyAttempts(0);
      setAutoVerifying(false);
      setBlockedInlineSession(null);
      setViewState('verifying');
      try {
        const summary = normalizeAttemptSummary(await paymentApi.getAttempt(reference), reference);
        if (!active) return;
        setAttempt(summary);

        const resolvedGateway = gateway || summary.gateway;
        const result = await verifyAttempt(summary, resolvedGateway, true);

        if (!active) return;
        setVerifyResult(result);
        const refreshedSummary = normalizeAttemptSummary(await paymentApi.getAttempt(reference), reference);
        if (!active) return;
        setAttempt(refreshedSummary);
        setViewState('resolved');

        if (
          result?.status === 'PAID' ||
          result?.status === 'FAILED' ||
          result?.status === 'CANCELLED' ||
          result?.status === 'EXPIRED'
        ) {
          await resolveTerminalStatus(
            result.status,
            refreshedSummary,
            result.failureMessage || result.gatewayResponse,
            { replace: true },
          );
        }
      } catch (error: any) {
        if (!active) return;
        toast.error(error?.response?.data?.message || 'Unable to verify the payment attempt');
        try {
          const summary = normalizeAttemptSummary(await paymentApi.getAttempt(reference), reference);
          if (!active) return;
          setAttempt(summary);
          setViewState('resolved');
        } catch {
          if (!active) return;
          setViewState('missing');
        }
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [gateway, reference, resolveTerminalStatus, verifyAttempt]);

  const handleVerifyAgain = useCallback(async (options?: { auto?: boolean }) => {
    const resolvedGateway = gateway || attempt?.gateway;
    if (!reference || !resolvedGateway) return;

    if (options?.auto) {
      setAutoVerifying(true);
    } else {
      setBlockedInlineSession(null);
      setSubmitting(true);
    }

    try {
      const currentAttempt = normalizeAttemptSummary(
        attempt ?? await paymentApi.getAttempt(reference),
        reference,
      );
      if (!attempt) {
        setAttempt(currentAttempt);
      }

      const result = await verifyAttempt(currentAttempt, resolvedGateway, false);
      setVerifyResult(result);
      const summary = normalizeAttemptSummary(await paymentApi.getAttempt(reference), reference);
      setAttempt(summary);

      if (options?.auto) {
        setAutoVerifyAttempts((current) => current + 1);
      }

      if (
        result.status === 'PAID' ||
        result.status === 'FAILED' ||
        result.status === 'CANCELLED' ||
        result.status === 'EXPIRED'
      ) {
        await resolveTerminalStatus(result.status, summary, result.failureMessage || result.gatewayResponse);
        return;
      }
    } catch (error: any) {
      if (!options?.auto) {
        toast.error(error?.response?.data?.message || 'Verification failed');
      }
    } finally {
      if (options?.auto) {
        setAutoVerifying(false);
      } else {
        setSubmitting(false);
      }
    }
  }, [attempt, gateway, reference, resolveTerminalStatus, verifyAttempt]);

  const handleRetryCustomOrderPayment = useCallback(async () => {
    if (!attempt?.checkoutIntentId) {
      toast.error('No checkout intent is linked to this payment attempt.');
      return;
    }
    if (!retryPaymentData) {
      toast.error('Retry payment details are still loading. Please try again in a moment.');
      return;
    }

    const shippingAddress = createRetryShippingAddress(retryPaymentData);
    const validationErrors = validatePaymentData('PAYSTACK', retryPaymentData, shippingAddress);
    setRetryPaymentErrors(validationErrors);

    if (Object.keys(validationErrors).length > 0) {
      toast.error('Complete the payment details before retrying.');
      return;
    }

    setRetryingPayment(true);
    try {
      const paymentSubmissionData = buildPaymentSubmissionData(retryPaymentData, shippingAddress);
      const paymentSubmissionPayload = paymentSubmissionData as unknown as Record<string, unknown>;
      let validationSessionId: string | undefined;

      if (paymentSubmissionData.channel === 'CARD') {
        const validated = await paymentApi.validateCard({
          paymentMethod: 'PAYSTACK',
          paymentData: paymentSubmissionData,
        });
        validationSessionId = validated.sessionId;
      }

      const init = await customOrdersBuyerApi.initializePaymentForCheckoutIntent(
        attempt.checkoutIntentId,
        {
          paymentMethod: 'PAYSTACK',
          email: paymentSubmissionData.email,
          callbackUrl: `${window.location.origin}/bag/payment-return`,
          paymentData: paymentSubmissionPayload,
          validationSessionId,
        },
      );

      if (init.providerAccessCode) {
        setBlockedInlineSession(null);
        await openPaystackInline(init.providerAccessCode, {
          onSuccess: () => {
            setBlockedInlineSession(null);
            navigate(
              `/bag/payment-return?reference=${encodeURIComponent(init.reference)}&gateway=${encodeURIComponent(init.gateway || 'PAYSTACK')}`,
            );
          },
          onCancel: () => {
            setBlockedInlineSession(null);
            toast.error('Payment was cancelled before completion.');
          },
          onError: (inlineError) => {
            if (isPopupBlockedInlineError(inlineError)) {
              setBlockedInlineSession({
                accessCode: init.providerAccessCode as string,
                reference: init.reference,
                gateway: init.gateway || 'PAYSTACK',
              });
              toast.error(POPUP_BLOCKED_RETURN_MESSAGE);
              return;
            }

            setBlockedInlineSession(null);
            toast.error(inlineError.message || 'Unable to open the payment window.');
          },
        });
        return;
      }
      throw new Error('Payment provider did not return an inline payment session for this attempt.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to retry payment');
    } finally {
      setRetryingPayment(false);
    }
  }, [attempt, navigate, retryPaymentData]);

  const handleRetryBlockedInlineSession = useCallback(async () => {
    if (!blockedInlineSession) {
      return;
    }

    const retrySession = blockedInlineSession;
    setRetryingBlockedInlineSession(true);
    setBlockedInlineSession(null);

    try {
      await openPaystackInline(retrySession.accessCode, {
        onSuccess: () => {
          navigate(
            `/bag/payment-return?reference=${encodeURIComponent(retrySession.reference)}&gateway=${encodeURIComponent(retrySession.gateway)}`,
          );
        },
        onCancel: () => {
          toast.error('Payment was cancelled before completion.');
        },
        onError: (inlineError) => {
          if (isPopupBlockedInlineError(inlineError)) {
            setBlockedInlineSession(retrySession);
            toast.error(POPUP_BLOCKED_RETURN_MESSAGE);
            return;
          }

          toast.error(inlineError.message || 'Unable to open the payment window.');
        },
      });
    } catch (error: any) {
      setBlockedInlineSession(retrySession);
      toast.error(error?.message || 'Unable to retry the secure payment window.');
    } finally {
      setRetryingBlockedInlineSession(false);
    }
  }, [blockedInlineSession, navigate]);

  const resolvedStatus =
    normalizePaymentStatus(verifyResult?.status) ??
    normalizePaymentStatus(attempt?.status) ??
    'PENDING';
  const shouldAutoVerify =
    resolvedStatus === 'PROCESSING' || resolvedStatus === 'REQUIRES_ACTION';

  useEffect(() => {
    if (viewState !== 'resolved' || !shouldAutoVerify) {
      return;
    }
    if (autoVerifyAttempts >= AUTO_VERIFY_MAX_ATTEMPTS || autoVerifying || submitting) {
      return;
    }

    const timer = window.setTimeout(() => {
      void handleVerifyAgain({ auto: true });
    }, AUTO_VERIFY_INTERVAL_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoVerifyAttempts, autoVerifying, handleVerifyAgain, shouldAutoVerify, submitting, viewState]);

  if (viewState === 'missing') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mb-6 text-6xl">🧾</div>
        <h1 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white">Payment return data is missing</h1>
        <p className="mb-8 text-gray-500 dark:text-zinc-400">
          Threadly could not find the reference needed to resume this payment flow.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={() => navigate('/profile?tab=orders')}>Open my orders</Button>
          <Button variant="secondary" onClick={() => navigate('/custom-orders/new')}>Start new custom order</Button>
          <Button variant="ghost" onClick={() => navigate('/')}>Browse designs</Button>
        </div>
      </div>
    );
  }

  if (viewState === 'verifying') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mb-6 text-6xl">🌀</div>
        <h1 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white">Verifying payment</h1>
        <p className="text-gray-500 dark:text-zinc-400">
          Stage 1/2 - Threadly is checking the latest payment status for reference {reference || 'unknown'}.
        </p>
      </div>
    );
  }

  const statusCopy = getCheckoutStatusCopy('return', resolvedStatus);
  const isUnifiedCheckoutAttempt = attempt?.subjectType === 'UNIFIED_CHECKOUT';
  const isCustomOrderAttempt =
    attempt?.subjectType === 'CUSTOM_ORDER' ||
    referenceLooksCustom;
  const isFailureStatus =
    resolvedStatus === 'FAILED' ||
    resolvedStatus === 'CANCELLED' ||
    resolvedStatus === 'EXPIRED';
  const resolvedFailureReason =
    verifyResult?.failureMessage ||
    verifyResult?.gatewayResponse ||
    (isFailureStatus ? 'Payment was not completed successfully.' : null);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="mb-6 text-6xl">{statusCopy.emoji}</div>
      <h1 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white">{statusCopy.headline}</h1>
      <p className="mb-8 text-gray-500 dark:text-zinc-400">{statusCopy.description}</p>

      <div className="mb-8 space-y-3 rounded-xl border border-gray-200/70 bg-gray-50 p-5 text-left dark:border-zinc-700/60 dark:bg-zinc-800/50">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">Payment attempt</p>
        <p className="text-sm text-gray-700 dark:text-zinc-300">Reference: {reference}</p>
        <p className="text-sm text-gray-700 dark:text-zinc-300">Gateway: {attempt?.gateway || gateway}</p>
        <p className="text-sm text-gray-700 dark:text-zinc-300">
          Subject: {isUnifiedCheckoutAttempt ? 'Unified checkout' : isCustomOrderAttempt ? 'Custom order' : 'Standard order'}
        </p>
        <p className="text-sm text-gray-700 dark:text-zinc-300">Status: {resolvedStatus}</p>
        {resolvedFailureReason && (
          <p className="text-sm text-rose-600 dark:text-rose-300">
            Failure reason: {resolvedFailureReason}
          </p>
        )}
        {verifyResult?.gatewayResponse && verifyResult.gatewayResponse !== resolvedFailureReason && (
          <p className="text-xs text-rose-500 dark:text-rose-300/90">
            Gateway response: {verifyResult.gatewayResponse}
          </p>
        )}
      </div>

      {(submitting || autoVerifying) && (
        <div className="mb-8 rounded-xl border border-indigo-200/80 bg-indigo-50/80 px-4 py-3 text-left text-sm text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em]">Stage - Verification in progress</p>
          <p className="mt-1">Verifying with payment gateway... please wait.</p>
        </div>
      )}

      {shouldAutoVerify && autoVerifyAttempts < AUTO_VERIFY_MAX_ATTEMPTS && (
        <div className="mb-8 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-left text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <p>
            Threadly is checking automatically every 10 seconds (attempt {Math.min(autoVerifyAttempts + 1, AUTO_VERIFY_MAX_ATTEMPTS)} of {AUTO_VERIFY_MAX_ATTEMPTS}).
          </p>
          <p className="mt-1">
            You can safely leave this page — your payment is being confirmed in the background.
          </p>
        </div>
      )}

      {shouldAutoVerify && autoVerifyAttempts >= AUTO_VERIFY_MAX_ATTEMPTS && (
        <div className="mb-8 rounded-xl border border-blue-200/80 bg-blue-50/80 px-4 py-3 text-left text-sm text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
          <p className="font-semibold">Still waiting on your bank or payment provider.</p>
          <p className="mt-1">
            Your payment is still being processed — this can take a few minutes when bank confirmation is delayed.
            We will send you a notification the moment it is confirmed. You can safely close this page now.
          </p>
          <p className="mt-1">
            If you believe payment was charged, tap <strong>Verify again</strong> in a few minutes or contact support with reference <strong>{reference}</strong>.
          </p>
        </div>
      )}

      {blockedInlineSession && (
        <div className="mb-8 rounded-xl border border-amber-200/80 bg-amber-50/85 px-4 py-3 text-left text-sm text-amber-900 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em]">Secure window blocked</p>
          <p className="mt-1">{POPUP_BLOCKED_RETURN_MESSAGE}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              onClick={() => { void handleRetryBlockedInlineSession(); }}
              loading={retryingBlockedInlineSession}
              disabled={retryingBlockedInlineSession}
            >
              Retry secure payment window
            </Button>
            <p className="text-xs">
              Allow popups for this site if the secure window keeps getting blocked.
            </p>
          </div>
        </div>
      )}

      {shouldOfferCustomOrderRetry && retryPaymentData ? (
        <section className="mb-8 rounded-3xl border border-fuchsia-200/80 bg-fuchsia-50/70 p-5 text-left shadow-sm dark:border-fuchsia-500/25 dark:bg-fuchsia-500/10">
          <div className="mb-4 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-fuchsia-700 dark:text-fuchsia-200">
              Fresh card retry
            </p>
            <h2 className="text-lg font-bold text-slate-950 dark:text-white">
              Retry this custom order with a new card
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              The failed card snapshot is not reused here. Enter a fresh card or choose one of your saved cards, then submit again.
            </p>
          </div>

          {retrySavedCardsError ? (
            <div className="mb-4 rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              {retrySavedCardsError}
            </div>
          ) : null}

          <PaymentDetailsSection
            paymentData={retryPaymentData}
            shippingAddress={createRetryShippingAddress(retryPaymentData)}
            errors={retryPaymentErrors}
            onChange={(updater) => {
              setRetryPaymentData((current) => (current ? updater(current) : current));
              setRetryPaymentErrors({});
            }}
            savedCards={retrySavedCards}
            savedCardsLoading={retrySavedCardsLoading}
            savedCardsError={retrySavedCardsError}
            cardValidationLoading={retryingPayment}
            compact
          />

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              onClick={() => { void handleRetryCustomOrderPayment(); }}
              loading={retryingPayment}
              disabled={retryingPayment}
            >
              Retry payment
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (!attempt) {
                  return;
                }

                setRetryPaymentData(createCustomOrderRetryPaymentData(attempt));
                setRetryPaymentErrors({});
              }}
              disabled={retryingPayment}
            >
              Reset retry form
            </Button>
          </div>
        </section>
      ) : shouldOfferCustomOrderRetry ? (
        <div className="mb-8 rounded-3xl border border-fuchsia-200/80 bg-fuchsia-50/70 px-4 py-3 text-left text-sm text-fuchsia-900 dark:border-fuchsia-500/25 dark:bg-fuchsia-500/10 dark:text-fuchsia-100">
          Preparing a fresh retry form for this custom order...
        </div>
      ) : null}

      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        {resolvedStatus === 'PAID' ? (
          <Button onClick={() => navigate(`/bag/confirmation?reference=${encodeURIComponent(reference)}`)}>
            Open confirmation
          </Button>
        ) : (
          <Button
            onClick={() => void handleVerifyAgain()}
            loading={submitting || autoVerifying || retryingPayment}
          >
            Verify again
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() =>
            isCustomOrderAttempt
              ? attempt?.customOrderId
                ? navigate(`/profile?tab=orders&kind=custom&orderId=${encodeURIComponent(attempt.customOrderId)}`)
                : navigate('/profile?tab=orders')
              : navigate('/profile?tab=orders')
          }
        >
          {isCustomOrderAttempt
            ? attempt?.customOrderId
              ? 'Open custom order'
              : 'Open custom orders'
            : 'Open my orders'}
        </Button>
        {!isCustomOrderAttempt && (
          <Button variant="ghost" onClick={() => openBag()}>Return to bag</Button>
        )}
      </div>
    </div>
  );
};

export default PaymentReturnPage;
