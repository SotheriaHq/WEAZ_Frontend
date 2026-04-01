import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  getStorePayoutStatement,
  listStorePayouts,
  type StorePayoutListResponse,
} from '@/api/StoreApi';

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
  if (normalized === 'PENDING_APPROVAL') {
    return { emoji: '🕒', label: 'Pending approval', tone: 'text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-200 dark:bg-sky-500/10 dark:border-sky-500/30' };
  }
  return { emoji: '🧾', label: normalized || 'Unknown', tone: 'text-gray-700 bg-gray-50 border-gray-200 dark:text-gray-200 dark:bg-white/5 dark:border-white/10' };
};

const BrandPayoutsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StorePayoutListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    try {
      const payload = await listStorePayouts({ page: nextPage, limit: 20 });
      setData(payload);
      setPage(payload.page);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to load payout history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  const downloadStatement = async (payoutId: string) => {
    setDownloadingId(payoutId);
    try {
      const statement = await getStorePayoutStatement(payoutId);
      const blob = new Blob([statement.contentHtml], {
        type: 'text/html;charset=utf-8',
      });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = `${statement.documentNumber}.html`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
      toast.success('Settlement statement downloaded');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to download statement');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="min-h-screen px-4 py-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Brand payout history</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Read-only payout timeline and settlement statement downloads.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/settings?tab=billing"
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
            >
              Open accounts settings
            </Link>
            <button
              type="button"
              onClick={() => void load(page)}
              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/10 dark:bg-black/20">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-white/10">
              <thead className="bg-gray-50 dark:bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Created</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Paid</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">Statement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {loading ? (
                  <tr>
                    <td className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400" colSpan={5}>
                      Loading payouts...
                    </td>
                  </tr>
                ) : data?.items?.length ? (
                  data.items.map((item) => {
                    const status = payoutStatusMeta(item.status);
                    return (
                      <tr key={item.id}>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                          {formatMoney(item.amount, item.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${status.tone}`}>
                            {status.emoji} {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDate(item.createdAt)}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{formatDate(item.paidAt)}</td>
                        <td className="px-4 py-3">
                          {item.statement ? (
                            <button
                              type="button"
                              onClick={() => void downloadStatement(item.id)}
                              disabled={downloadingId === item.id}
                              className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                            >
                              {downloadingId === item.id ? 'Downloading...' : 'Download'}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400">Not available</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400" colSpan={5}>
                      No payouts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Total payouts: {data?.total ?? 0}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load(Math.max(1, page - 1))}
              disabled={loading || page <= 1}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => void load(page + 1)}
              disabled={loading || !data?.hasNextPage}
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrandPayoutsPage;
