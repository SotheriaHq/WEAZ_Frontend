import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { paymentApi, type PaymentAttemptSummary, type PaymentAttemptStatus, type PaymentVerifyResult } from '@/api/PaymentApi';
import { customOrdersBuyerApi } from '@/api/CustomOrderApi';
import { getCheckoutStatusCopy } from '@/pages/checkout/checkoutStatusCopy';

type ViewState = 'verifying' | 'resolved' | 'missing';

const AUTO_VERIFY_INTERVAL_MS = 10000;
const AUTO_VERIFY_MAX_ATTEMPTS = 6;

const PaymentReturnPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [viewState, setViewState] = useState<ViewState>('verifying');
  const [verifyResult, setVerifyResult] = useState<PaymentVerifyResult | null>(null);
  const [attempt, setAttempt] = useState<PaymentAttemptSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [autoVerifyAttempts, setAutoVerifyAttempts] = useState(0);
  const [autoVerifying, setAutoVerifying] = useState(false);

  const reference = searchParams.get('reference')?.trim() || '';
  const gateway = searchParams.get('gateway')?.trim() || '';
  const statusHint = searchParams.get('status')?.trim() || undefined;

  const verifyAttempt = useCallback(async (
    summary: PaymentAttemptSummary,
    resolvedGateway: string,
    includeStatusHint: boolean,
  ): Promise<PaymentVerifyResult> => {
    const hint = includeStatusHint ? statusHint : undefined;

    if (summary.subjectType === 'CUSTOM_ORDER' && summary.customOrderId) {
      const customResult = await customOrdersBuyerApi.verifyPayment(summary.customOrderId, {
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
          navigate(`/checkout/confirmation?reference=${encodeURIComponent(reference)}`, {
            replace: true,
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
        navigate(`/checkout/confirmation?reference=${encodeURIComponent(reference)}`);
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

      {resolvedStatus === 'PROCESSING' && (
        <div className="mb-8 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-left text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <p>
            Threadly will keep checking automatically every 10 seconds (attempt {Math.min(autoVerifyAttempts + 1, AUTO_VERIFY_MAX_ATTEMPTS)} of {AUTO_VERIFY_MAX_ATTEMPTS}).
          </p>
          <p className="mt-1">
            If it still shows processing, you can leave this page and check your order later while provider confirmation continues in the background.
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
        <Button
          variant="secondary"
          onClick={() =>
            attempt?.subjectType === 'CUSTOM_ORDER' && attempt.customOrderId
              ? navigate(`/custom-orders/${attempt.customOrderId}`)
              : navigate('/orders')
          }
        >
          {attempt?.subjectType === 'CUSTOM_ORDER' ? 'Open custom order' : 'Open my orders'}
        </Button>
        <Button variant="ghost" onClick={() => navigate('/checkout')}>Return to checkout</Button>
      </div>
    </div>
  );
};

export default PaymentReturnPage;
