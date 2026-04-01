import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { paymentApi, type PaymentAttemptSummary, type PaymentAttemptStatus, type PaymentVerifyResult } from '@/api/PaymentApi';
import { customOrdersBuyerApi } from '@/api/CustomOrderApi';

type ViewState = 'verifying' | 'resolved' | 'missing';

function getStatusTitle(status: PaymentAttemptStatus): string {
  switch (status) {
    case 'PAID':
      return 'Payment confirmed';
    case 'FAILED':
      return 'Payment failed';
    case 'CANCELLED':
      return 'Payment cancelled';
    case 'EXPIRED':
      return 'Payment expired';
    case 'PROCESSING':
      return 'Payment still processing';
    case 'REQUIRES_ACTION':
      return 'More action required';
    default:
      return 'Payment pending';
  }
}

function getStatusDescription(status: PaymentAttemptStatus): string {
  switch (status) {
    case 'PAID':
      return 'Threadly has confirmed the payment attempt. You can move into the final confirmation screen.';
    case 'FAILED':
      return 'The payment attempt ended in a failed state. You can retry from your order or switch methods.';
    case 'CANCELLED':
      return 'The payment attempt was cancelled before completion.';
    case 'EXPIRED':
      return 'The payment window expired before the payment was completed.';
    case 'PROCESSING':
      return 'The payment is still being processed. You can wait and verify again, or continue from your order later.';
    case 'REQUIRES_ACTION':
      return 'The provider still expects a customer action before the payment can settle.';
    default:
      return 'The payment is still pending confirmation.';
  }
}

function getStatusEmoji(status: PaymentAttemptStatus): string {
  switch (status) {
    case 'PAID':
      return '✅';
    case 'FAILED':
      return '⚠️';
    case 'CANCELLED':
      return '🛑';
    case 'EXPIRED':
      return '⏰';
    case 'PROCESSING':
      return '🌀';
    case 'REQUIRES_ACTION':
      return '👉';
    default:
      return '⌛';
  }
}

const PaymentReturnPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [viewState, setViewState] = useState<ViewState>('verifying');
  const [verifyResult, setVerifyResult] = useState<PaymentVerifyResult | null>(null);
  const [attempt, setAttempt] = useState<PaymentAttemptSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reference = searchParams.get('reference')?.trim() || '';
  const gateway = searchParams.get('gateway')?.trim() || '';
  const statusHint = searchParams.get('status')?.trim() || undefined;

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!reference) {
        setViewState('missing');
        return;
      }

      setViewState('verifying');
      try {
        const summary = await paymentApi.getAttempt(reference);
        if (!active) return;
        setAttempt(summary);

        const resolvedGateway = gateway || summary.gateway;
        let result: PaymentVerifyResult | null = null;

        if (summary.subjectType === 'CUSTOM_ORDER' && summary.customOrderId) {
          const customResult = await customOrdersBuyerApi.verifyPayment(summary.customOrderId, {
            reference,
            gateway: resolvedGateway,
            statusHint,
          });
          result = {
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
        } else {
          result = await paymentApi.verifyWithStatus(reference, resolvedGateway, statusHint);
        }

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
  }, [gateway, navigate, reference, statusHint]);

  const handleVerifyAgain = async () => {
    const resolvedGateway = gateway || attempt?.gateway;
    if (!reference || !resolvedGateway) return;
    setSubmitting(true);
    try {
      const result =
        attempt?.subjectType === 'CUSTOM_ORDER' && attempt.customOrderId
          ? await customOrdersBuyerApi.verifyPayment(attempt.customOrderId, {
              reference,
              gateway: resolvedGateway,
              statusHint,
            }).then((customResult) => ({
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
            }))
          : await paymentApi.verifyWithStatus(reference, resolvedGateway, statusHint);
      setVerifyResult(result);
      const summary = await paymentApi.getAttempt(reference);
      setAttempt(summary);
      if (result.status === 'PAID') {
        navigate(`/checkout/confirmation?reference=${encodeURIComponent(reference)}`);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Verification failed');
    } finally {
      setSubmitting(false);
    }
  };

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

  const resolvedStatus = verifyResult?.status ?? attempt?.status ?? 'PENDING';

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="mb-6 text-6xl">{getStatusEmoji(resolvedStatus)}</div>
      <h1 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white">{getStatusTitle(resolvedStatus)}</h1>
      <p className="mb-8 text-gray-500 dark:text-zinc-400">{getStatusDescription(resolvedStatus)}</p>

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

      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        {resolvedStatus === 'PAID' ? (
          <Button onClick={() => navigate(`/checkout/confirmation?reference=${encodeURIComponent(reference)}`)}>
            Open confirmation
          </Button>
        ) : (
          <Button onClick={handleVerifyAgain} loading={submitting}>
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
