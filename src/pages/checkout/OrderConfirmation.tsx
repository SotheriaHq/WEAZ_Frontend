import React from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import { formatPrice } from '@/utils/helpers';
import type { PaymentMethodType } from '@/api/StoreApi';

interface OrderSummaryItem {
  name: string;
  quantity: number;
  price: number;
}

interface ConfirmationState {
  orderIds: string[];
  paymentMethod: PaymentMethodType;
  reference?: string;
  gateway?: string;
  bankAccount?: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    expiresAt: string;
  };
  summary?: {
    items: OrderSummaryItem[];
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
  const state = location.state as ConfirmationState | null;

  if (!state?.orderIds?.length) {
    return <Navigate to="/" replace />;
  }

  const { orderIds, paymentMethod, bankAccount, summary } = state;
  const isPod = paymentMethod === 'PAY_ON_DELIVERY';
  const isBankTransfer = paymentMethod === 'BANK_TRANSFER';

  return (
    <div className="max-w-lg mx-auto py-16 px-4 text-center">
      {/* Success icon */}
      <div className="text-6xl mb-6">
        {isPod ? '📦' : isBankTransfer ? '🏦' : '✅'}
      </div>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {isPod
          ? 'Order Confirmed!'
          : isBankTransfer
            ? 'Complete Your Transfer'
            : 'Payment Successful!'}
      </h1>

      <p className="text-gray-500 dark:text-zinc-400 mb-6">
        {isPod && 'Your order has been placed. Pay when it arrives.'}
        {isBankTransfer && 'Transfer the total amount to the account below to complete your order.'}
        {!isPod && !isBankTransfer && 'Your payment was processed and your order is being prepared.'}
      </p>

      {/* Order IDs */}
      <div className="bg-gray-50 dark:bg-zinc-800/50 border border-gray-200/70 dark:border-zinc-700/60 rounded-xl p-4 mb-6 text-left">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400 mb-2">
          Order {orderIds.length > 1 ? 'IDs' : 'ID'}
        </p>
        {orderIds.map((id) => (
          <p key={id} className="font-mono text-sm text-gray-900 dark:text-white">{id}</p>
        ))}
      </div>

      {/* Order summary */}
      {summary && (
        <div className="bg-gray-50 dark:bg-zinc-800/50 border border-gray-200/70 dark:border-zinc-700/60 rounded-xl p-5 mb-6 text-left space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
            Order Summary
          </p>
          <div className="divide-y divide-gray-200 dark:divide-zinc-700 text-sm">
            {summary.items.map((item, i) => (
              <div key={i} className="flex justify-between py-2">
                <span className="text-gray-700 dark:text-zinc-300">
                  {item.name} <span className="text-gray-400">×{item.quantity}</span>
                </span>
                <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-200 dark:border-zinc-700 pt-3 space-y-1 text-sm">
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
                <span>−{formatPrice(summary.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200 dark:border-zinc-700">
              <span>Total</span>
              <span>{formatPrice(summary.grandTotal)}</span>
            </div>
          </div>
          {summary.shippingName && (
            <p className="text-xs text-gray-400 dark:text-zinc-500 pt-1">
              📍 Shipping to {summary.shippingName}, {summary.shippingCity}, {summary.shippingState}
            </p>
          )}
        </div>
      )}

      {/* Bank transfer details */}
      {isBankTransfer && bankAccount && (
        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200/70 dark:border-purple-700/40 rounded-xl p-5 mb-6 text-left space-y-2">
          <p className="text-sm font-semibold text-purple-900 dark:text-purple-200">Transfer Details</p>
          <div className="text-sm space-y-1 text-gray-700 dark:text-zinc-300">
            <p><span className="text-gray-500">Bank:</span> {bankAccount.bankName}</p>
            <p><span className="text-gray-500">Account:</span> <span className="font-mono font-bold">{bankAccount.accountNumber}</span></p>
            <p><span className="text-gray-500">Name:</span> {bankAccount.accountName}</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              ⏰ This account expires at {new Date(bankAccount.expiresAt).toLocaleString('en-NG')}
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button onClick={() => navigate('/orders')} size="lg">
          View My Orders
        </Button>
        <Button variant="secondary" onClick={() => navigate('/')} size="lg">
          Continue Shopping
        </Button>
      </div>
    </div>
  );
};

export default OrderConfirmation;
