import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStoreWallet, type StoreWalletResponse } from '@/api/StoreApi';

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

const payoutStatusMeta = (status?: string | null) => {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'PAID') {
    return { emoji: '✅', label: 'Paid', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30' };
  }
  if (normalized === 'PROCESSING' || normalized === 'APPROVED') {
    return { emoji: '🟡', label: 'Processing', tone: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30' };
  }
  if (normalized === 'FAILED' || normalized === 'REJECTED') {
    return { emoji: '⛔', label: 'Failed', tone: 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30' };
  }
  return { emoji: '🧾', label: normalized || 'Unknown', tone: 'text-gray-700 bg-gray-50 border-gray-200 dark:text-gray-200 dark:bg-white/5 dark:border-white/10' };
};

const cardClassName =
  'rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-black/20';

const BrandWalletPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<StoreWalletResponse | null>(null);

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
            const status = payoutStatusMeta(row.status);
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
                <div className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${status.tone}`}>
                  {status.emoji} {status.label}
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
