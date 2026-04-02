import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { brandApi } from '@/api/BrandApi';
import { getStoreWallet, type StoreWalletResponse } from '@/api/StoreApi';
import { getPayoutStatusMeta } from '@/components/payouts/payoutStatus';

const formatMoney = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency || 'NGN',
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
};

const cardClassName =
  'rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-black/20';

const BrandWalletPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<StoreWalletResponse | null>(null);
  const [requesting, setRequesting] = useState(false);

  const loadWallet = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await getStoreWallet();
      setWallet(payload);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to load wallet data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  const availableForPayout = Number(wallet?.summary.availableForPayout || 0);
  const canRequestPayout =
    !loading &&
    !requesting &&
    !!wallet?.brandId &&
    availableForPayout >= 5000;

  const handleRequestPayout = useCallback(async () => {
    if (!wallet?.brandId) {
      toast.error('Brand wallet is not ready yet');
      return;
    }
    if (availableForPayout < 5000) {
      toast.error('Minimum payout amount is NGN 5,000');
      return;
    }

    setRequesting(true);
    try {
      await brandApi.requestPayout(wallet.brandId, availableForPayout);
      toast.success('Payout requested successfully');
      await loadWallet();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Unable to request payout');
    } finally {
      setRequesting(false);
    }
  }, [availableForPayout, loadWallet, wallet?.brandId]);

  const metrics = useMemo(() => {
    const currency = wallet?.currency || 'NGN';
    const summary = wallet?.summary;
    return [
      {
        label: '💰 Available for payout',
        value: formatMoney(summary?.availableForPayout || 0, currency),
      },
      {
        label: '🔒 Held in escrow',
        value: formatMoney(summary?.heldInEscrow || 0, currency),
      },
      {
        label: '📈 Total earnings',
        value: formatMoney(summary?.totalEarnings || 0, currency),
      },
      {
        label: '🏦 Total paid out',
        value: formatMoney(summary?.totalPaidOut || 0, currency),
      },
    ];
  }, [wallet]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Brand wallet</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Track available balance, escrow holds, and recent payout outcomes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadWallet()}
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
            disabled={loading}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void handleRequestPayout()}
            disabled={!canRequestPayout}
            className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            {requesting ? 'Requesting...' : 'Request payout'}
          </button>
          <Link
            to="/store/payouts"
            className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90"
          >
            View payout history
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className={cardClassName}>
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{metric.label}</div>
            <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{loading ? '…' : metric.value}</div>
          </div>
        ))}
      </div>

      <div className={cardClassName}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent payouts</h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Pending: {wallet?.summary.pendingPayoutCount ?? 0}
          </span>
        </div>

        <div className="mt-3 space-y-2">
          {!loading && (!wallet?.recentPayouts || wallet.recentPayouts.length === 0) ? (
            <div className="rounded-lg border border-dashed border-gray-200 px-3 py-3 text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
              No payouts yet.
            </div>
          ) : null}

          {(wallet?.recentPayouts || []).map((row) => {
            const status = getPayoutStatusMeta(row.status);
            return (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 dark:border-white/10"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatMoney(row.amount, row.currency)}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Created: {formatDate(row.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    to={`/store/payouts/${row.id}`}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    View details
                  </Link>
                  <div className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${status.tone}`}>
                    {status.emoji} {status.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default BrandWalletPanel;
