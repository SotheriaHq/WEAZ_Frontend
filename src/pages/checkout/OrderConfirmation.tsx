import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
// import LazyOrderQrCard from '@/components/qr/LazyOrderQrCard'; // disabled — order QR codes off
import {
  paymentApi,
  type PaymentAttemptStatus,
  type PaymentAttemptSummary,
  type PaymentNextAction,
} from '@/api/PaymentApi';
import type { CheckoutPaymentMethod, PaymentData } from '@/api/StoreApi';
import { formatPrice } from '@/utils/helpers';
import { getPaymentSummaryLines } from '@/pages/checkout/paymentFlow';
import {
  getCheckoutStatusCopy,
  isCheckoutPaymentMethod,
} from '@/pages/checkout/checkoutStatusCopy';

interface ConfirmationState {
  orderIds: string[];
  paymentMethod: CheckoutPaymentMethod;
  reference?: string;
  gateway?: string;
  authorizationUrl?: string;
  paymentData?: PaymentData;
  nextAction?: PaymentNextAction;
  bankAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    expiresAt: string;
    amount?: number;
    narration?: string;
  };
  summary?: {
    items: Array<{ name: string; quantity: number; price: number }>;
    subtotal: number;
    shippingCost: number;
    discount: number;
    grandTotal: number;
    shippingName: string;
    shippingCity: string;
    shippingState: string;
  };
}

const OrderConfirmation: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const locationState = (location.state as ConfirmationState | null) ?? null;
  const [attempt, setAttempt] = useState<PaymentAttemptSummary | null>(null);
  const [loading, setLoading] = useState(Boolean(searchParams.get('reference')) && !locationState?.summary);
  const [simulating, setSimulating] = useState<PaymentAttemptStatus | null>(null);

  const reference = searchParams.get('reference')?.trim() || locationState?.reference || '';

  useEffect(() => {
    let active = true;

    const loadAttempt = async () => {
      if (!reference) return;
      setLoading(true);
      try {
        const result = await paymentApi.getAttempt(reference);
        if (!active) return;
        setAttempt(result);
      } catch (error: any) {
        if (!active) return;
        toast.error(error?.response?.data?.message || 'Unable to load payment confirmation');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    if (reference) {
      void loadAttempt();
    }
    return () => {
      active = false;
    };
  }, [reference]);

  const orderIds = locationState?.orderIds ?? attempt?.orderIds ?? [];
  const paymentMethod = locationState?.paymentMethod ?? attempt?.paymentMethod;
  const paymentData = (locationState?.paymentData ?? attempt?.paymentData ?? null) as PaymentData | null;
  const nextAction = locationState?.nextAction ?? attempt?.nextAction;
  const bankAccount = locationState?.bankAccount ?? attempt?.bankAccount;
  const authorizationUrl = locationState?.authorizationUrl ?? attempt?.authorizationUrl;
  const summary = locationState?.summary ?? attempt?.summary;
  const status = attempt?.status ?? (nextAction?.type ? 'PENDING' : 'PAID');
  const statusCopy = getCheckoutStatusCopy('confirmation', status, nextAction);

  const paymentSummaryLines = useMemo(() => {
    if (!paymentMethod || !paymentData || !isCheckoutPaymentMethod(paymentMethod)) return [];
    return getPaymentSummaryLines(paymentMethod, paymentData);
  }, [paymentData, paymentMethod]);

  const handleSimulate = async (outcome: PaymentAttemptStatus) => {
    if (!reference) return;
    setSimulating(outcome);
    try {
      const result = await paymentApi.simulate(reference, outcome);
      setAttempt(result);
      toast.success(`Payment marked as ${outcome.toLowerCase()}`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to simulate payment outcome');
    } finally {
      setSimulating(null);
    }
  };

  if (!reference && !locationState?.orderIds?.length) {
    return <Navigate to="/" replace />;
  }

  if (loading && !summary) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mb-6 text-6xl">🧾</div>
        <h1 className="mb-3 text-2xl font-bold text-gray-900 dark:text-white">Loading payment confirmation</h1>
        <p className="text-gray-500 dark:text-zinc-400">Threadly is loading the latest payment and order state.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="mb-6 text-6xl">{statusCopy.emoji}</div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
        {statusCopy.headline}
      </h1>
      <p className="mb-6 text-gray-500 dark:text-zinc-400">
        {statusCopy.description}
      </p>

      <div className="mb-6 space-y-4 rounded-xl border border-gray-200/70 bg-gray-50 p-4 text-left dark:border-zinc-700/60 dark:bg-zinc-800/50">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
          {attempt?.subjectType === 'CUSTOM_ORDER' ? 'Custom order' : `Order ${orderIds.length > 1 ? 'IDs' : 'ID'}`}
        </p>
        {(attempt?.subjectType === 'CUSTOM_ORDER' && attempt.customOrderId
          ? [attempt.customOrderId]
          : orderIds
        ).map((id) => (
          <div key={id} className="space-y-3 border-t border-gray-200/70 pt-4 first:border-t-0 first:pt-0 dark:border-zinc-700/60">
            <p className="font-mono text-sm text-gray-900 dark:text-white">{id}</p>
            {/* Order QR code disabled — only brand profile QR codes active for now */}
          </div>
        ))}
      </div>

      {summary && (
        <div className="mb-6 space-y-3 rounded-xl border border-gray-200/70 bg-gray-50 p-5 text-left dark:border-zinc-700/60 dark:bg-zinc-800/50">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
            Order Summary
          </p>
          <div className="divide-y divide-gray-200 text-sm dark:divide-zinc-700">
            {summary.items.map((item, index) => (
              <div key={`${item.name}-${index}`} className="flex justify-between py-2">
                <span className="text-gray-700 dark:text-zinc-300">
                  {item.name} <span className="text-gray-400">×{item.quantity}</span>
                </span>
                <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1 border-t border-gray-200 pt-3 text-sm dark:border-zinc-700">
            <div className="flex justify-between text-gray-500 dark:text-zinc-400">
              <span>Subtotal</span>
              <span>{formatPrice(summary.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-500 dark:text-zinc-400">
              <span>Shipping</span>
              <span>{formatPrice(summary.shippingCost)}</span>
            </div>
            {summary.discount > 0 && (
              <div className="flex justify-between text-green-600 dark:text-green-400">
                <span>Discount</span>
                <span>-{formatPrice(summary.discount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold dark:border-zinc-700">
              <span>Total</span>
              <span>{formatPrice(summary.grandTotal)}</span>
            </div>
          </div>
          {summary.shippingName && (
            <p className="pt-1 text-xs text-gray-400 dark:text-zinc-500">
              📍 Shipping to {summary.shippingName}, {summary.shippingCity}, {summary.shippingState}
            </p>
          )}
        </div>
      )}

      {paymentSummaryLines.length > 0 && (
        <div className="mb-6 space-y-2 rounded-xl border border-gray-200/70 bg-gray-50 p-5 text-left dark:border-zinc-700/60 dark:bg-zinc-800/50">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
            Payment Profile
          </p>
          {paymentSummaryLines.map((line) => (
            <p key={line} className="text-sm text-gray-700 dark:text-zinc-300">{line}</p>
          ))}
        </div>
      )}

      {nextAction && (
        <div className="mb-6 space-y-3 rounded-xl border border-gray-200/70 bg-gray-50 p-5 text-left dark:border-zinc-700/60 dark:bg-zinc-800/50">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
            Next Step
          </p>
          <p className="text-sm text-gray-700 dark:text-zinc-300">{nextAction.description}</p>
          <div className="space-y-2 text-sm text-gray-700 dark:text-zinc-300">
            {nextAction.instructions.map((instruction) => (
              <p key={instruction}>• {instruction}</p>
            ))}
          </div>
          {nextAction.ussdCode && (
            <div className="rounded-lg border border-purple-200/70 bg-purple-50 px-4 py-3 font-mono text-sm text-purple-900 dark:border-purple-700/40 dark:bg-purple-900/20 dark:text-purple-100">
              {nextAction.ussdCode}
            </div>
          )}
          {reference && (
            <p className="text-xs text-gray-500 dark:text-zinc-500">Reference: {reference}</p>
          )}
        </div>
      )}

      {bankAccount && (
        <div className="mb-6 space-y-2 rounded-xl border border-purple-200/70 bg-purple-50 p-5 text-left dark:border-purple-700/40 dark:bg-purple-900/20">
          <p className="text-sm font-semibold text-purple-900 dark:text-purple-200">
            Transfer Details
          </p>
          <div className="space-y-1 text-sm text-gray-700 dark:text-zinc-300">
            <p><span className="text-gray-500">Bank:</span> {bankAccount.bankName}</p>
            <p><span className="text-gray-500">Account:</span> <span className="font-mono font-bold">{bankAccount.accountNumber}</span></p>
            <p><span className="text-gray-500">Name:</span> {bankAccount.accountName}</p>
            {bankAccount.amount != null && (
              <p><span className="text-gray-500">Amount:</span> {formatPrice(bankAccount.amount)}</p>
            )}
            {bankAccount.narration && (
              <p><span className="text-gray-500">Narration:</span> <span className="font-mono">{bankAccount.narration}</span></p>
            )}
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              ⏰ This account expires at {new Date(bankAccount.expiresAt).toLocaleString('en-NG')}
            </p>
          </div>
        </div>
      )}

      {attempt?.canSimulate && status !== 'PAID' && (
        <div className="mb-6 space-y-3 rounded-xl border border-dashed border-gray-300/80 bg-white/70 p-5 text-left dark:border-zinc-700/60 dark:bg-zinc-900/40">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
            Mock Payment Controls
          </p>
          <p className="text-sm text-gray-600 dark:text-zinc-300">
            Dummy payments are enabled. Use these controls to move this attempt through realistic mock outcomes without live gateway credentials.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="sm" onClick={() => handleSimulate('PAID')} loading={simulating === 'PAID'}>Mark paid</Button>
            <Button size="sm" variant="secondary" onClick={() => handleSimulate('PROCESSING')} loading={simulating === 'PROCESSING'}>Mark processing</Button>
            <Button size="sm" variant="ghost" onClick={() => handleSimulate('FAILED')} loading={simulating === 'FAILED'}>Mark failed</Button>
            <Button size="sm" variant="ghost" onClick={() => handleSimulate('CANCELLED')} loading={simulating === 'CANCELLED'}>Mark cancelled</Button>
            <Button size="sm" variant="ghost" onClick={() => handleSimulate('EXPIRED')} loading={simulating === 'EXPIRED'}>Mark expired</Button>
          </div>
        </div>
      )}

      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        {authorizationUrl && status !== 'PAID' && (
          <Button onClick={() => window.location.assign(authorizationUrl)} size="lg">
            {nextAction?.ctaLabel || 'Continue Payment'}
          </Button>
        )}
        <Button
          onClick={() =>
            attempt?.subjectType === 'CUSTOM_ORDER' && attempt.customOrderId
              ? navigate(`/custom-orders/${attempt.customOrderId}`)
              : navigate('/profile?tab=orders')
          }
          size="lg"
        >
          {attempt?.subjectType === 'CUSTOM_ORDER' ? 'Open Custom Order' : 'View My Orders'}
        </Button>
        <Button variant="secondary" onClick={() => navigate('/')} size="lg">
          Continue Shopping
        </Button>
      </div>
    </div>
  );
};

export default OrderConfirmation;
