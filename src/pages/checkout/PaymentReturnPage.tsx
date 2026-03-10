import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { paymentApi, type PaymentAttemptSummary, type PaymentAttemptStatus, type PaymentVerifyResult } from '@/api/PaymentApi';

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
    const run = async () => {
      if (!reference || !gateway) {
        setViewState('missing');
        return;
      }

      setViewState('verifying');
      try {
        const result = await paymentApi.verifyWithStatus(reference, gateway, statusHint);
        setVerifyResult(result);
        const summary = await paymentApi.getAttempt(reference);
        setAttempt(summary);
        setViewState('resolved');

        if (result.status === 'PAID') {
          navigate(`/checkout/confirmation?reference=${encodeURIComponent(reference)}`, {
            replace: true,
          });
        }
      } catch (error: any) {
        toast.error(error?.response?.data?.message || 'Unable to verify the payment attempt');
        try {
          const summary = await paymentApi.getAttempt(reference);
          setAttempt(summary);
          setViewState('resolved');
        } catch {
          setViewState('missing');
        }
      }
    };

    void run();
  }, [gateway, navigate, reference, statusHint]);

  const handleVerifyAgain = async () => {
    if (!reference || !gateway) return;
    setSubmitting(true);
    try {
      const result = await paymentApi.verifyWithStatus(reference, gateway, statusHint);
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
        <Button variant="secondary" onClick={() => navigate('/orders')}>Open my orders</Button>
        <Button variant="ghost" onClick={() => navigate('/checkout')}>Return to checkout</Button>
      </div>
    </div>
  );
};

export default PaymentReturnPage;