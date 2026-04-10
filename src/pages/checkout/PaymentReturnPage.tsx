import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { paymentApi, type PaymentAttemptSummary, type PaymentAttemptStatus, type PaymentVerifyResult } from '@/api/PaymentApi';
import { customOrdersBuyerApi } from '@/api/CustomOrderApi';
import { getCheckoutStatusCopy } from '@/pages/checkout/checkoutStatusCopy';
import { cancelActivePaystackInline, openPaystackInline } from '@/lib/paystackInline';

type ViewState = 'verifying' | 'resolved' | 'missing';

const AUTO_VERIFY_INTERVAL_MS = 10000;
const AUTO_VERIFY_MAX_ATTEMPTS = 18;

const PaymentReturnPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [viewState, setViewState] = useState<ViewState>('verifying');
  const [verifyResult, setVerifyResult] = useState<PaymentVerifyResult | null>(null);
  const [attempt, setAttempt] = useState<PaymentAttemptSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [autoVerifyAttempts, setAutoVerifyAttempts] = useState(0);
  const [autoVerifying, setAutoVerifying] = useState(false);
  const [retryingPayment, setRetryingPayment] = useState(false);

  const reference = searchParams.get('reference')?.trim() || '';
  const gateway = searchParams.get('gateway')?.trim() || '';
  const statusHint = searchParams.get('status')?.trim() || undefined;

  useEffect(() => {
    return () => {
      void cancelActivePaystackInline();
    };
  }, []);

  const verifyAttempt = useCallback(async (
    summary: PaymentAttemptSummary,
    resolvedGateway: string,
    includeStatusHint: boolean,
  ): Promise<PaymentVerifyResult> => {
    const hint = includeStatusHint ? statusHint : undefined;

    if (summary.subjectType === 'CUSTOM_ORDER') {
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
      return {
        success: customResult.success,
        status: customResult.status as PaymentAttemptStatus,
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

    return paymentApi.verifyWithStatus(reference, resolvedGateway, hint);
  }, [reference, statusHint]);

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
        const summary = await paymentApi.getAttempt(reference);
        if (!active) return;
        setAttempt(summary);

        const resolvedGateway = gateway || summary.gateway;
        const result = await verifyAttempt(summary, resolvedGateway, true);

        if (!active) return;
        setVerifyResult(result);
        const refreshedSummary = await paymentApi.getAttempt(reference);
        if (!active) return;
        setAttempt(refreshedSummary);
        setViewState('resolved');

        if (result?.status === 'PAID') {
          toast.success('Your order is placed successfully, Thank you for shopping.');
          navigate(`/checkout/confirmation?reference=${encodeURIComponent(reference)}`, {
            replace: true,
          });
          return;
        }

        if (
          result?.status === 'FAILED' ||
          result?.status === 'CANCELLED' ||
          result?.status === 'EXPIRED'
        ) {
          const failureReason =
            result.failureMessage ||
            'Payment failed before completion. Please restart checkout.';
          toast.error(failureReason);
          if (refreshedSummary.subjectType === 'CUSTOM_ORDER') {
            if (refreshedSummary.customOrderId) {
              navigate(`/custom-orders/${refreshedSummary.customOrderId}`, {
                replace: true,
                state: { paymentFailureReason: failureReason, paymentReference: reference },
              });
            }
            return;
          }

          navigate('/orders', {
            replace: true,
            state: { paymentFailureReason: failureReason, paymentReference: reference },
          });
        }
      } catch (error: any) {
        if (!active) return;
        toast.error(error?.response?.data?.message || 'Unable to verify the payment attempt');
        try {
          const summary = await paymentApi.getAttempt(reference);
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
  }, [gateway, navigate, reference, verifyAttempt]);

  const handleVerifyAgain = useCallback(async (options?: { auto?: boolean }) => {
    const resolvedGateway = gateway || attempt?.gateway;
    if (!reference || !resolvedGateway) return;

    if (options?.auto) {
      setAutoVerifying(true);
    } else {
      setSubmitting(true);
    }

    try {
      const currentAttempt = attempt ?? await paymentApi.getAttempt(reference);
      if (!attempt) {
        setAttempt(currentAttempt);
      }

      const result = await verifyAttempt(currentAttempt, resolvedGateway, false);
      setVerifyResult(result);
      const summary = await paymentApi.getAttempt(reference);
      setAttempt(summary);

      if (options?.auto) {
        setAutoVerifyAttempts((current) => current + 1);
      }

      if (result.status === 'PAID') {
        toast.success('Your order is placed successfully, Thank you for shopping.');
        navigate(`/checkout/confirmation?reference=${encodeURIComponent(reference)}`);
        return;
      }

      if (
        result.status === 'FAILED' ||
        result.status === 'CANCELLED' ||
        result.status === 'EXPIRED'
      ) {
        const failureReason =
          result.failureMessage ||
          'Payment failed before completion. Please restart checkout.';
        toast.error(failureReason);
        if (summary.subjectType === 'CUSTOM_ORDER') {
          if (summary.customOrderId) {
            navigate(`/custom-orders/${summary.customOrderId}`, {
              replace: true,
              state: { paymentFailureReason: failureReason, paymentReference: reference },
            });
          }
          return;
        }

        navigate('/orders', {
          replace: true,
          state: { paymentFailureReason: failureReason, paymentReference: reference },
        });
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
  }, [attempt, gateway, navigate, reference, verifyAttempt]);

  const handleRetryCustomOrderPayment = useCallback(async () => {
    if (!attempt?.checkoutIntentId) {
      toast.error('No checkout intent is linked to this payment attempt.');
      return;
    }
    const paymentData = attempt.paymentData ?? {};
    const email = typeof paymentData.email === 'string' ? paymentData.email : '';
    if (!email) {
      toast.error('Payment email is missing. Restart checkout to continue.');
      return;
    }

    setRetryingPayment(true);
    try {
      const paymentMethod =
        (attempt.paymentMethod as 'PAYSTACK' | 'FLUTTERWAVE' | 'BANK_TRANSFER') || 'PAYSTACK';
      const init = await customOrdersBuyerApi.initializePaymentForCheckoutIntent(
        attempt.checkoutIntentId,
        {
          paymentMethod,
          email,
          callbackUrl: `${window.location.origin}/checkout/payment-return`,
          paymentData: paymentData as Record<string, unknown>,
        },
      );

      if (init.providerAccessCode) {
        await openPaystackInline(init.providerAccessCode, {
          onSuccess: (response) => {
            navigate(
              `/checkout/payment-return?reference=${encodeURIComponent(response.reference)}&gateway=${encodeURIComponent(init.gateway || 'PAYSTACK')}`,
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
      if (init.authorizationUrl) {
        const fallbackUrl = new URL(init.authorizationUrl, window.location.origin);
        if (fallbackUrl.origin === window.location.origin) {
          window.location.assign(fallbackUrl.toString());
          return;
        }
        throw new Error('Payment provider did not return an inline payment session for this attempt.');
      }
      if (init.reference) {
        navigate(
          `/checkout/payment-return?reference=${encodeURIComponent(init.reference)}&gateway=${encodeURIComponent(init.gateway || 'PAYSTACK')}`,
        );
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to retry payment');
    } finally {
      setRetryingPayment(false);
    }
  }, [attempt, navigate]);

  const resolvedStatus = verifyResult?.status ?? attempt?.status ?? 'PENDING';

  useEffect(() => {
    if (viewState !== 'resolved' || resolvedStatus !== 'PROCESSING') {
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
  }, [autoVerifyAttempts, autoVerifying, handleVerifyAgain, resolvedStatus, submitting, viewState]);

  if (viewState === 'missing') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mb-6 text-6xl">🧾</div>
        <h1 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white">Payment return data is missing</h1>
        <p className="mb-8 text-gray-500 dark:text-zinc-400">
          Threadly could not find the reference needed to resume this payment flow.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button onClick={() => navigate('/orders')}>Open my orders</Button>
          <Button variant="secondary" onClick={() => navigate('/checkout')}>Back to checkout</Button>
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
          Threadly is checking the latest payment status for reference {reference || 'unknown'}.
        </p>
      </div>
    );
  }

  const statusCopy = getCheckoutStatusCopy('return', resolvedStatus);
  const isCustomOrderAttempt = attempt?.subjectType === 'CUSTOM_ORDER';
  const shouldOfferCustomOrderRetry =
    isCustomOrderAttempt &&
    !attempt?.customOrderId &&
    Boolean(attempt?.checkoutIntentId) &&
    (resolvedStatus === 'FAILED' || resolvedStatus === 'CANCELLED' || resolvedStatus === 'EXPIRED');

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
          Subject: {attempt?.subjectType === 'CUSTOM_ORDER' ? 'Custom order' : 'Standard order'}
        </p>
        <p className="text-sm text-gray-700 dark:text-zinc-300">Status: {resolvedStatus}</p>
        {verifyResult?.failureMessage && (
          <p className="text-sm text-rose-600 dark:text-rose-300">{verifyResult.failureMessage}</p>
        )}
      </div>

      {resolvedStatus === 'PROCESSING' && autoVerifyAttempts < AUTO_VERIFY_MAX_ATTEMPTS && (
        <div className="mb-8 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-left text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <p>
            Threadly is checking automatically every 10 seconds (attempt {Math.min(autoVerifyAttempts + 1, AUTO_VERIFY_MAX_ATTEMPTS)} of {AUTO_VERIFY_MAX_ATTEMPTS}).
          </p>
          <p className="mt-1">
            You can safely leave this page — your payment is being confirmed in the background.
          </p>
        </div>
      )}

      {resolvedStatus === 'PROCESSING' && autoVerifyAttempts >= AUTO_VERIFY_MAX_ATTEMPTS && (
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

      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        {resolvedStatus === 'PAID' ? (
          <Button onClick={() => navigate(`/checkout/confirmation?reference=${encodeURIComponent(reference)}`)}>
            Open confirmation
          </Button>
        ) : (
          <Button onClick={() => void handleVerifyAgain()} loading={submitting || autoVerifying}>
            Verify again
          </Button>
        )}
        {shouldOfferCustomOrderRetry ? (
          <Button onClick={handleRetryCustomOrderPayment} loading={retryingPayment} variant="secondary">
            Retry payment
          </Button>
        ) : null}
        <Button
          variant="secondary"
          onClick={() =>
            isCustomOrderAttempt
              ? attempt?.customOrderId
                ? navigate(`/custom-orders/${attempt.customOrderId}`)
                : navigate('/custom-orders')
              : navigate('/orders')
          }
        >
          {isCustomOrderAttempt
            ? attempt?.customOrderId
              ? 'Open custom order'
              : 'Open custom orders'
            : 'Open my orders'}
        </Button>
        <Button variant="ghost" onClick={() => navigate('/checkout')}>Return to checkout</Button>
      </div>
    </div>
  );
};

export default PaymentReturnPage;
