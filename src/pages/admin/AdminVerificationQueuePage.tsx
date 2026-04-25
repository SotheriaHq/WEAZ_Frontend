import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import { toast } from 'sonner';
import { adminBrandsApi } from '@/api/AdminApi';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { unwrapApiResponse } from '@/types/auth';
import type { VerificationQueueItem } from '@/types/verification';
import useDebounce from '@/hooks/useDebounce';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

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
  const [totalPending, setTotalPending] = useState(0);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 250);
  const [status, setStatus] = useState('');

  const fetchPage = useCallback(
    async (cursor?: string, limit?: number) => {
      try {
        const response = await adminBrandsApi.getVerificationQueue({
          limit: String(limit ?? 50),
          ...(cursor ? { cursor } : {}),
          ...(debouncedSearch ? { q: debouncedSearch } : {}),
          ...(status ? { status } : {}),
        });

        const data = unwrapApiResponse<{
          items?: VerificationQueueItem[];
          nextCursor?: string;
          totalPending?: number;
        }>(response.data as never);

        if (typeof data.totalPending === 'number') {
          setTotalPending(data.totalPending);
        }

        return {
          items: data.items ?? [],
          nextCursor: data.nextCursor,
        };
      } catch (error: any) {
        toast.error(
          error?.response?.data?.message ||
            'Unable to load the verification queue',
        );
        return { items: [], nextCursor: undefined };
      }
    },
    [debouncedSearch, status],
  );

  const {
    items,
    isLoading: loading,
    isLoadingMore,
    hasMore,
    sentinelRef,
  } = useInfiniteScroll<VerificationQueueItem>(fetchPage, { limit: 50 });

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
      <AdminBreadcrumb segments={[{ label: 'Verification Queue' }]} />
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
          <p className="mt-1 text-xs text-gray-500">Loaded in this view</p>
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
        <>
          <section className="space-y-3 md:hidden">
            {items.map((item) => (
              <article key={item.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{item.name || 'Unnamed brand'}</p>
                    <p className="text-xs text-gray-500">{item.owner?.firstName} {item.owner?.lastName}</p>
                    <p className="text-xs text-gray-500">{item.owner?.email ?? 'No owner email'}</p>
                  </div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusTone(item.verificationStatus)}`}>
                    {item.verificationStatus.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <p><span className="font-semibold text-gray-800">Attempt:</span> {item.verificationAttemptNumber ?? 0}</p>
                  <p><span className="font-semibold text-gray-800">Assigned:</span> {item.verificationReviewedById ? 'Claimed' : 'Unclaimed'}</p>
                  <p className="col-span-2">
                    <span className="font-semibold text-gray-800">Submitted:</span>{' '}
                    {item.verificationSubmittedAt
                      ? new Date(item.verificationSubmittedAt).toLocaleString()
                      : 'Not available'}
                  </p>
                </div>
                <div className="mt-3">
                  <Link
                    to={`/admin/brands/${item.id}/verification-review`}
                    state={{ returnTo: '/admin/verification' }}
                    className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-sky-800 transition hover:border-sky-300 hover:bg-sky-100"
                  >
                    Open
                  </Link>
                </div>
              </article>
            ))}
          </section>

          <section className="hidden overflow-x-auto rounded-[1.75rem] border border-gray-200 bg-white shadow-sm md:block">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-[0.2em] text-gray-500">
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Attempt</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Assigned</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50/70">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900">{item.name || 'Unnamed brand'}</p>
                    <p className="text-xs text-gray-500">{item.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <p>{item.owner?.firstName} {item.owner?.lastName}</p>
                    <p className="text-xs text-gray-500">{item.owner?.email ?? 'No owner email'}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusTone(item.verificationStatus)}`}>
                      {item.verificationStatus.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{item.verificationAttemptNumber ?? 0}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {item.verificationSubmittedAt
                      ? new Date(item.verificationSubmittedAt).toLocaleString()
                      : 'Not available'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {item.verificationReviewedById ? 'Claimed' : 'Unclaimed'}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/brands/${item.id}/verification-review`}
                      state={{ returnTo: '/admin/verification' }}
                      className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-sky-800 transition hover:border-sky-300 hover:bg-sky-100"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </section>
        </>
      )}

      {isLoadingMore ? (
        <div className="py-3 text-center text-sm text-gray-500">Loading more queue items...</div>
      ) : null}
      {hasMore ? <div ref={sentinelRef} className="h-px w-full" /> : null}
      {!hasMore && items.length > 0 ? (
        <div className="py-2 text-center text-xs text-gray-400">End of queue list</div>
      ) : null}
    </div>
  );
}
