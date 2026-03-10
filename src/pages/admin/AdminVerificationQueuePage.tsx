import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { adminBrandsApi } from '@/api/AdminApi';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { unwrapApiResponse } from '@/types/auth';
import type { VerificationQueueItem } from '@/types/verification';
import useDebounce from '@/hooks/useDebounce';

const STATUS_OPTIONS = [
  { value: '', label: 'All active states' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_REVIEW', label: 'In review' },
  { value: 'ADDITIONAL_INFO_REQUESTED', label: 'Additional info requested' },
] as const;

const statusTone = (status: string) => {
  if (status === 'IN_REVIEW') {
    return 'border-sky-200 bg-sky-50 text-sky-800';
  }
  if (status === 'ADDITIONAL_INFO_REQUESTED') {
    return 'border-amber-200 bg-amber-50 text-amber-800';
  }
  return 'border-gray-200 bg-gray-50 text-gray-700';
};

export default function AdminVerificationQueuePage() {
  const [items, setItems] = useState<VerificationQueueItem[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 250);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const response = await adminBrandsApi.getVerificationQueue({
          limit: '100',
          ...(debouncedSearch ? { q: debouncedSearch } : {}),
          ...(status ? { status } : {}),
        });
        const data = unwrapApiResponse<{
          items?: VerificationQueueItem[];
          totalPending?: number;
        }>(response.data as never);
        if (!active) return;
        setItems(data.items ?? []);
        setTotalPending(data.totalPending ?? 0);
      } catch (error: any) {
        if (!active) return;
        toast.error(
          error?.response?.data?.message ||
            'Unable to load the verification queue',
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [debouncedSearch, status]);

  const metrics = useMemo(() => {
    const inReview = items.filter(
      (item) => item.verificationStatus === 'IN_REVIEW',
    ).length;
    const needsInfo = items.filter(
      (item) => item.verificationStatus === 'ADDITIONAL_INFO_REQUESTED',
    ).length;
    return {
      active: items.length,
      pending: totalPending,
      inReview,
      needsInfo,
    };
  }, [items, totalPending]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(135deg,_#f9fcff,_#ffffff_48%,_#f7f7ff)] p-6 shadow-[0_30px_80px_-40px_rgba(14,165,233,0.35)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-600">
              Admin review
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-gray-900">
              Verification queue
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-gray-600">
              Review all active seller verification records from one place,
              filtered by state and searchable by brand or owner.
            </p>
          </div>
          <Link
            to="/admin/brands"
            className="inline-flex items-center rounded-full border border-sky-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50"
          >
            Back to brands
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[1.5rem] border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
            Visible items
          </p>
          <p className="mt-3 text-3xl font-black text-gray-900">{metrics.active}</p>
        </div>
        <div className="rounded-[1.5rem] border border-sky-200 bg-sky-50 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
            Pending
          </p>
          <p className="mt-3 text-3xl font-black text-sky-900">{metrics.pending}</p>
        </div>
        <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
            In review
          </p>
          <p className="mt-3 text-3xl font-black text-amber-900">{metrics.inReview}</p>
        </div>
        <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
            Needs info
          </p>
          <p className="mt-3 text-3xl font-black text-emerald-900">{metrics.needsInfo}</p>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
          <Input
            label="Search queue"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Brand name, owner name, or owner email"
          />
          <Select
            label="Status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </section>

      {loading ? (
        <div className="rounded-[1.75rem] border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
          Loading verification queue...
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[1.75rem] border border-gray-200 bg-white p-10 text-center shadow-sm">
          <p className="text-3xl">🗂️</p>
          <p className="mt-3 text-lg font-bold text-gray-900">
            No active verification items
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Adjust the filters or come back when new submissions arrive.
          </p>
        </div>
      ) : (
        <section className="grid gap-4 xl:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-[1.75rem] border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                    {item.owner?.email ?? 'No owner email'}
                  </p>
                  <h2 className="mt-2 text-xl font-black text-gray-900">
                    {item.name || 'Unnamed brand'}
                  </h2>
                  <p className="mt-2 text-sm text-gray-600">
                    {item.owner?.firstName} {item.owner?.lastName}
                  </p>
                </div>
                <div
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusTone(item.verificationStatus)}`}
                >
                  {item.verificationStatus.replace(/_/g, ' ')}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                    Attempt
                  </p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">
                    {item.verificationAttemptNumber ?? 0}
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                    Submitted
                  </p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">
                    {item.verificationSubmittedAt
                      ? new Date(item.verificationSubmittedAt).toLocaleDateString()
                      : 'Not available'}
                  </p>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                    Assigned
                  </p>
                  <p className="mt-2 text-sm font-semibold text-gray-900">
                    {item.verificationReviewedById ? 'Claimed' : 'Unclaimed'}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <p className="text-xs text-gray-500">
                  Updated{' '}
                  {item.updatedAt
                    ? new Date(item.updatedAt).toLocaleString()
                    : 'recently'}
                </p>
                <Link
                  to={`/admin/brands/${item.id}/verification-review`}
                  className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-800 transition hover:border-sky-300 hover:bg-sky-100"
                >
                  Open review
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
