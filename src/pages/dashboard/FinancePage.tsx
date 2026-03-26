import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import { brandApi } from '@/api/BrandApi';
import VLoader from '@/components/loaders/VLoader';
import type { RootState } from '@/store';

const STATUS_THEME: Record<string, string> = {
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200',
  APPROVED: 'bg-sky-100 text-sky-800 dark:bg-sky-500/10 dark:text-sky-200',
  PROCESSING: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200',
  PAID: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200',
  FAILED: 'bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200',
  REJECTED: 'bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200',
  ON_HOLD: 'bg-orange-100 text-orange-800 dark:bg-orange-500/10 dark:text-orange-200',
  RECONCILIATION_REVIEW:
    'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-500/10 dark:text-fuchsia-200',
};

const STATUS_EMOJI: Record<string, string> = {
  PENDING_APPROVAL: '⏳',
  APPROVED: '🧾',
  PROCESSING: '🏦',
  PAID: '✅',
  FAILED: '⚠️',
  REJECTED: '⛔',
  ON_HOLD: '🧊',
  RECONCILIATION_REVIEW: '🧮',
};

const INCOMING_STAGE_THEME: Record<string, string> = {
  SHIPPED_RELEASE: 'bg-sky-100 text-sky-800 dark:bg-sky-500/10 dark:text-sky-200',
  DELIVERED_RELEASE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200',
  ACCEPTED_RELEASE: 'bg-violet-100 text-violet-800 dark:bg-violet-500/10 dark:text-violet-200',
  RELEASE: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200',
  PAYMENT: 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200',
};

const INCOMING_STAGE_EMOJI: Record<string, string> = {
  SHIPPED_RELEASE: '🚚',
  DELIVERED_RELEASE: '✅',
  ACCEPTED_RELEASE: '🤝',
  RELEASE: '💸',
  PAYMENT: '💳',
};

type FinanceOverview = {
  currency: string;
  availableBalance: number;
  releasedBalance: number;
  reservedPayoutBalance: number;
  paidOutBalance: number;
  negativeBalance: boolean;
};

type IncomingTransaction = {
  id: string;
  amount: number | string;
  currency: string;
  createdAt: string;
  title?: string | null;
  counterparty?: string | null;
  description?: string | null;
  stage?: string | null;
};

const FinancePage: React.FC = () => {
  const user = useSelector((state: RootState) => state.user.profile);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [incomingTransactions, setIncomingTransactions] = useState<IncomingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [overview, setOverview] = useState<FinanceOverview | null>(null);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const [overviewData, payoutsData, incomingData] = await Promise.all([
        brandApi.getPayoutOverview(user.id),
        brandApi.getPayouts(user.id),
        brandApi.getIncomingTransactions(user.id, { page: 1, limit: 20 }),
      ]);

      setOverview(
        overviewData
          ? {
              currency: overviewData.currency || 'NGN',
              availableBalance: Number(overviewData.availableBalance || 0),
              releasedBalance: Number(overviewData.releasedBalance || 0),
              reservedPayoutBalance: Number(overviewData.reservedPayoutBalance || 0),
              paidOutBalance: Number(overviewData.paidOutBalance || 0),
              negativeBalance: Boolean(overviewData.negativeBalance),
            }
          : null,
      );

      setPayouts(
        Array.isArray(payoutsData?.items)
          ? payoutsData.items
          : Array.isArray(payoutsData)
            ? payoutsData
            : [],
      );

      setIncomingTransactions(
        Array.isArray(incomingData?.items)
          ? incomingData.items
          : Array.isArray(incomingData)
            ? incomingData
            : [],
      );
    } catch (error) {
      console.error('Failed to fetch finance data', error);
      toast.error('Failed to load finance data');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const availableBalance = overview?.availableBalance ?? 0;
  const currency = overview?.currency || 'NGN';
  const totalIncomingAmount = useMemo(
    () => incomingTransactions.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    [incomingTransactions],
  );

  const canRequestPayout = useMemo(
    () => !loading && !requesting && availableBalance >= 5000,
    [availableBalance, loading, requesting],
  );

  const handleRequestPayout = async () => {
    if (!user?.id) return;
    if (availableBalance < 5000) {
      toast.error('Minimum payout amount is ₦5,000');
      return;
    }

    setRequesting(true);
    try {
      await brandApi.requestPayout(user.id, availableBalance);
      toast.success('Payout requested successfully');
      void fetchData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to request payout');
    } finally {
      setRequesting(false);
    }
  };

  const formatCurrency = useCallback(
    (value: number, activeCurrency = currency) =>
      new Intl.NumberFormat('en-NG', { style: 'currency', currency: activeCurrency }).format(value),
    [currency],
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Released balances, incoming credits, and payout history.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_1fr]">
        <section className="rounded-3xl bg-black px-7 py-8 text-white shadow-lg dark:bg-white dark:text-black">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.25em] opacity-70">
                Available Balance
              </div>
              <div className="mt-3 text-4xl font-bold tracking-tight">
                {loading ? '...' : formatCurrency(availableBalance)}
              </div>
              <div className="mt-3 text-sm opacity-75">
                {overview?.negativeBalance
                  ? 'Balance is negative. New releases will offset recovery automatically.'
                  : 'Only released funds that are not already reserved for payout are withdrawable.'}
              </div>
            </div>
            <div className="text-4xl" aria-hidden="true">
              {overview?.negativeBalance ? '📉' : '💰'}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <button
              type="button"
              onClick={handleRequestPayout}
              disabled={!canRequestPayout}
              className="rounded-full bg-white px-5 py-3 font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-black dark:text-white"
            >
              {requesting ? 'Submitting...' : 'Request Payout'}
            </button>
            <div className="rounded-full border border-white/20 px-4 py-3 text-white/80 dark:border-black/20 dark:text-black/75">
              Minimum payout: ₦5,000
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <MetricCard
            label="Released Earnings"
            value={loading ? '...' : formatCurrency(overview?.releasedBalance ?? 0)}
            description="Funds unlocked by shipment and delivery milestones."
          />
          <MetricCard
            label="Reserved For Payout"
            value={loading ? '...' : formatCurrency(overview?.reservedPayoutBalance ?? 0)}
            description="Requests already in approval or transfer flow."
          />
          <MetricCard
            label="Paid Out"
            value={loading ? '...' : formatCurrency(overview?.paidOutBalance ?? 0)}
            description="Completed transfers already settled to your bank account."
          />
          <MetricCard
            label="Incoming Credits"
            value={loading ? '...' : formatCurrency(totalIncomingAmount)}
            description="Shipment and delivery releases already credited into your wallet history."
          />
        </section>
      </div>

      <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
        <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800">
          <h2 className="text-lg font-semibold">Incoming Transactions</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Credits released into your brand wallet after shipment, delivery, or custom-order milestones.
          </p>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[620px] text-left text-sm sm:min-w-[700px] lg:min-w-[760px]">
            <thead className="bg-gray-50 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
              <tr>
                <th className="px-6 py-4 font-medium">Transaction</th>
                <th className="px-6 py-4 font-medium">Counterparty</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Amount</th>
                <th className="px-6 py-4 font-medium">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <VLoader size={32} phase="loading" showLabel={false} />
                  </td>
                </tr>
              ) : incomingTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No incoming transactions recorded yet.
                  </td>
                </tr>
              ) : (
                incomingTransactions.map((transaction) => {
                  const stage = String(transaction.stage || 'RELEASE').toUpperCase();
                  return (
                    <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {transaction.title || transaction.description || 'Incoming transaction'}
                        </div>
                        {transaction.description && transaction.description !== transaction.title ? (
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {transaction.description}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                        {transaction.counterparty || 'Buyer'}
                      </td>
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                        {new Date(transaction.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 font-medium text-emerald-600 dark:text-emerald-300">
                        +{formatCurrency(Number(transaction.amount || 0), transaction.currency || currency)}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                            INCOMING_STAGE_THEME[stage] ||
                            'bg-slate-100 text-slate-800 dark:bg-slate-500/10 dark:text-slate-200'
                          }`}
                        >
                          <span aria-hidden="true">{INCOMING_STAGE_EMOJI[stage] || '💸'}</span>
                          {stage.replaceAll('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900/50">
        <div className="border-b border-gray-100 px-6 py-5 dark:border-gray-800">
          <h2 className="text-lg font-semibold">Payout History</h2>
        </div>
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full min-w-[560px] text-left text-sm sm:min-w-[620px] lg:min-w-[680px]">
            <thead className="bg-gray-50 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
              <tr>
                <th className="px-6 py-4 font-medium">Reference</th>
                <th className="px-6 py-4 font-medium">Date</th>
                <th className="px-6 py-4 font-medium">Amount</th>
                <th className="px-6 py-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <VLoader size={32} phase="loading" showLabel={false} />
                  </td>
                </tr>
              ) : payouts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No payout history found.
                  </td>
                </tr>
              ) : (
                payouts.map((payout) => (
                  <tr key={payout.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {payout.reference || `#${String(payout.id).slice(0, 8)}`}
                    </td>
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                      {new Date(payout.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      {formatCurrency(Number(payout.amount || 0))}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                          STATUS_THEME[payout.status] ||
                          'bg-slate-100 text-slate-800 dark:bg-slate-500/10 dark:text-slate-200'
                        }`}
                      >
                        <span aria-hidden="true">{STATUS_EMOJI[payout.status] || '📄'}</span>
                        {String(payout.status || 'UNKNOWN').replaceAll('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

const MetricCard: React.FC<{
  label: string;
  value: string;
  description: string;
}> = ({ label, value, description }) => (
  <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900/60">
    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
      {label}
    </div>
    <div className="mt-3 text-2xl font-semibold">{value}</div>
    <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">{description}</div>
  </div>
);

export default FinancePage;
