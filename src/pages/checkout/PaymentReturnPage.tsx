import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import {
  paymentApi,
  type PaymentAttemptSummary,
  type PaymentAttemptStatus,
  type PaymentVerifyResult,
} from '@/api/PaymentApi';
import { customOrdersBuyerApi } from '@/api/CustomOrderApi';
import { getCheckoutStatusCopy } from '@/pages/checkout/checkoutStatusCopy';
import { setRuntimeCardholderNameMatchMode } from '@/pages/checkout/paymentFlow';
import { canOfferCustomOrderCardRetry } from '@/pages/checkout/paymentRetryFlow';
import { fetchCart, openCartDrawer } from '@/features/cartSlice';
import type { AppDispatch } from '@/store';

type ViewState = 'verifying' | 'resolved' | 'missing';

const AUTO_VERIFY_INTERVAL_MS = 10000;
const AUTO_VERIFY_MAX_ATTEMPTS = 18;
const CUSTOM_ORDER_REFERENCE_PREFIX = 'TH-CO-';

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
  const [preparingUnifiedRetry, setPreparingUnifiedRetry] = useState(false);

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
    if (status === 'PAID') {
      await dispatch(fetchCart({ force: true }));
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
    let active = true;

    const run = async () => {
      if (!reference) {
        setViewState('missing');
        return;
      }

      setAutoVerifyAttempts(0);
      setAutoVerifying(false);
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
    if (!attempt?.customOrderId) {
      toast.error('Unable to locate the custom order for unified checkout retry.');
      return;
    }

    setPreparingUnifiedRetry(true);
    try {
      await customOrdersBuyerApi.prepareForUnifiedCheckout(attempt.customOrderId);
      await dispatch(fetchCart({ force: true }));
      dispatch(openCartDrawer());
      toast.success('Custom order is ready in your bag. Continue payment from unified checkout.');
      navigate('/bag');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to prepare custom order for checkout');
    } finally {
      setPreparingUnifiedRetry(false);
    }
  }, [attempt, dispatch, navigate]);

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
          WIEZ could not find the reference needed to resume this payment flow.
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
          Stage 1/2 - WIEZ is checking the latest payment status for reference {reference || 'unknown'}.
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
            WIEZ is checking automatically every 10 seconds (attempt {Math.min(autoVerifyAttempts + 1, AUTO_VERIFY_MAX_ATTEMPTS)} of {AUTO_VERIFY_MAX_ATTEMPTS}).
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

      {shouldOfferCustomOrderRetry ? (
        <section className="mb-8 rounded-3xl border border-fuchsia-200/80 bg-fuchsia-50/70 p-5 text-left shadow-sm dark:border-fuchsia-500/25 dark:bg-fuchsia-500/10">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-fuchsia-700 dark:text-fuchsia-200">
              Unified checkout retry
            </p>
            <h2 className="text-lg font-bold text-slate-950 dark:text-white">
              Retry this payment from your bag checkout
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              WIEZ now uses one payment initialization path. Prepare this custom order in your bag, then complete payment in checkout.
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              onClick={() => { void handleRetryCustomOrderPayment(); }}
              loading={preparingUnifiedRetry}
              disabled={preparingUnifiedRetry}
            >
              Prepare in bag checkout
            </Button>
          </div>
        </section>
      ) : null}

      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        {resolvedStatus === 'PAID' ? (
          <Button onClick={() => navigate(`/bag/confirmation?reference=${encodeURIComponent(reference)}`)}>
            Open confirmation
          </Button>
        ) : (
          <Button
            onClick={() => void handleVerifyAgain()}
            loading={submitting || autoVerifying || preparingUnifiedRetry}
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
