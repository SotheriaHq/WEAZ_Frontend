import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import UniversalSelect from '@/components/forms/UniversalSelect';
import Modal from '@/components/ui/Modal';
import PayoutSourceBreakdown from '@/components/payouts/PayoutSourceBreakdown';
import {
  getStorePayoutDetail,
  getStorePayoutStatement,
  listStorePayouts,
  type StorePayoutDetailResponse,
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
    return {
      emoji: '✅',
      label: 'Paid',
      tone: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30',
    };
  }
  if (normalized === 'PROCESSING' || normalized === 'APPROVED') {
    return {
      emoji: '🟡',
      label: 'Processing',
      tone: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30',
    };
  }
  if (normalized === 'FAILED' || normalized === 'REJECTED') {
    return {
      emoji: '⛔',
      label: 'Failed',
      tone: 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30',
    };
  }
  if (normalized === 'PENDING_APPROVAL') {
    return {
      emoji: '🕒',
      label: 'Pending approval',
      tone: 'text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-200 dark:bg-sky-500/10 dark:border-sky-500/30',
    };
  }
  return {
    emoji: '🧾',
    label: normalized || 'Unknown',
    tone: 'text-gray-700 bg-gray-50 border-gray-200 dark:text-gray-200 dark:bg-white/5 dark:border-white/10',
  };
};

const STATUS_OPTIONS = [
  { value: '', label: 'All payouts' },
  { value: 'PENDING_APPROVAL', label: 'Pending approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'PAID', label: 'Paid' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ON_HOLD', label: 'On hold' },
  { value: 'RECONCILIATION_REVIEW', label: 'Reconciliation review' },
];

const BrandPayoutsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StorePayoutListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<StorePayoutDetailResponse | null>(null);

  const selectedPayoutId = searchParams.get('payout');

  const load = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      try {
        const payload = await listStorePayouts({
          page: nextPage,
          limit: 20,
          ...(statusFilter ? { status: statusFilter } : {}),
        });
        setData(payload);
        setPage(payload.page);
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message || 'Unable to load payout history',
        );
      } finally {
        setLoading(false);
      }
    },
    [statusFilter],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const loadDetail = useCallback(async (payoutId: string) => {
    setDetailLoading(true);
    try {
      const payload = await getStorePayoutDetail(payoutId);
      setDetail(payload);
    } catch (error: any) {
      setDetail(null);
      toast.error(
        error?.response?.data?.message || 'Unable to load payout details',
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedPayoutId) {
      setDetail(null);
      setDetailLoading(false);
      return;
    }
    void loadDetail(selectedPayoutId);
  }, [loadDetail, selectedPayoutId]);

  const updatePayoutQuery = useCallback(
    (payoutId?: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (payoutId) {
        next.set('payout', payoutId);
      } else {
        next.delete('payout');
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

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
      toast.error(
        error?.response?.data?.message || 'Unable to download statement',
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const latestDetailNote =
    detail?.providerTransferFailureMessage ||
    detail?.failureReason ||
    detail?.statusReason ||
    null;

  const activeStatus = payoutStatusMeta(detail?.status);

  return (
    <div className="min-h-screen px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Brand payout history
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Read-only payout timeline with provider transfer state, transfer
              references, and settlement statement downloads.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px]">
              <UniversalSelect
                label="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={STATUS_OPTIONS}
                placeholder="Filter payouts"
              />
            </div>
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
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    Lifecycle
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    Provider transfer
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    Reference
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    Paid
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    Statement
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">
                    Detail
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                {loading ? (
                  <tr>
                    <td
                      className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400"
                      colSpan={8}
                    >
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
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${status.tone}`}
                          >
                            {status.emoji} {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {item.providerTransferStatus || 'Not started'}
                          </div>
                          {item.providerTransferFailureMessage ? (
                            <div className="mt-1 max-w-xs text-xs text-rose-600 dark:text-rose-300">
                              {item.providerTransferFailureMessage}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <div className="max-w-[220px] break-all text-xs text-gray-600 dark:text-gray-300">
                            {item.providerTransferReference || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {formatDate(item.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {formatDate(item.paidAt)}
                        </td>
                        <td className="px-4 py-3">
                          {item.statement ? (
                            <button
                              type="button"
                              onClick={() => void downloadStatement(item.id)}
                              disabled={downloadingId === item.id}
                              className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                            >
                              {downloadingId === item.id
                                ? 'Downloading...'
                                : 'Download'}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              Not available
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => updatePayoutQuery(item.id)}
                            className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400"
                      colSpan={8}
                    >
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

      <Modal
        open={Boolean(selectedPayoutId)}
        onClose={() => updatePayoutQuery(null)}
        title="Payout detail"
        size="lg"
      >
        <div className="max-h-[80vh] space-y-4 overflow-y-auto pr-1">
          {detailLoading ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-gray-300">
              Loading payout detail...
            </div>
          ) : null}

          {!detailLoading && !detail ? (
            <div className="rounded-xl border border-dashed border-gray-200 px-4 py-4 text-sm text-gray-500 dark:border-white/10 dark:text-gray-400">
              Payout details are not available right now.
            </div>
          ) : null}

          {detail ? (
            <>
              <section className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {formatMoney(detail.amount, detail.currency)}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Created {formatDate(detail.createdAt)}
                    </p>
                  </div>
                  <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${activeStatus.tone}`}>
                    {activeStatus.emoji} {activeStatus.label}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <DetailMetric label="Reference" value={detail.reference || 'Not assigned'} />
                  <DetailMetric
                    label="Provider transfer"
                    value={detail.providerTransferStatus || 'Not started'}
                  />
                  <DetailMetric
                    label="Transfer reference"
                    value={detail.providerTransferReference || 'Not available'}
                  />
                  <DetailMetric
                    label="Paid"
                    value={formatDate(detail.paidAt)}
                  />
                  <DetailMetric
                    label="Initiated"
                    value={formatDate(detail.providerTransferInitiatedAt)}
                  />
                  <DetailMetric
                    label="Finalized"
                    value={formatDate(detail.providerTransferFinalizedAt)}
                  />
                </div>

                {latestDetailNote ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                    {latestDetailNote}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {detail.statement ? (
                    <button
                      type="button"
                      onClick={() => void downloadStatement(detail.id)}
                      disabled={downloadingId === detail.id}
                      className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {downloadingId === detail.id ? 'Downloading...' : 'Download statement'}
                    </button>
                  ) : (
                    <div className="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-xs text-gray-500 dark:border-white/10 dark:text-gray-400">
                      Statement not available yet
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => selectedPayoutId && void loadDetail(selectedPayoutId)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5"
                  >
                    Refresh detail
                  </button>
                </div>
              </section>

              <PayoutSourceBreakdown breakdown={detail.sourceBreakdown} />
            </>
          ) : null}
        </div>
      </Modal>
    </div>
  );
};

const DetailMetric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl border border-gray-200 bg-white px-3 py-3 dark:border-white/10 dark:bg-black/20">
    <div className="text-[11px] uppercase tracking-[0.16em] text-gray-500 dark:text-gray-400">
      {label}
    </div>
    <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{value}</div>
  </div>
);

export default BrandPayoutsPage;
