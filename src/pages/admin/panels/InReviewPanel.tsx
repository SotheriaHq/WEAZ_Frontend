import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { adminBrandsApi } from '@/api/AdminApi';
import type { VerificationQueueItem } from '@/types/verification';
import { unwrapApiResponse } from '@/types/auth';
import ImageWithFallback from '@/components/ImageWithFallback';
import { generateUserUid } from '@/utils/userUid';
import FilterDropdown from '@/components/ui/FilterDropdown';
import useDebounce from '@/hooks/useDebounce';

/**
 * Store Verifications panel for the unified admin Users console (Store Verifications tab).
 *
 * Displays brand store verification requests waiting for admin review, with metrics,
 * search/filter controls, brand logos, copyable UID links, and links to the review workflow.
 */

const RETURN_TO = '/admin/users?tab=in-review';

type StatusFilter = 'ALL' | 'IN_REVIEW' | 'ADDITIONAL_INFO_REQUESTED';
type SortBy = 'oldest' | 'newest' | 'name' | 'attempt';
type ViewMode = 'table' | 'cards';

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'All review statuses' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'ADDITIONAL_INFO_REQUESTED', label: 'Info Requested' },
];

const SORT_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: 'oldest', label: 'Oldest submitted' },
  { value: 'newest', label: 'Newest submitted' },
  { value: 'name', label: 'Brand name' },
  { value: 'attempt', label: 'Attempt count' },
];

const verificationStatusTone = (status: string) => {
  const upper = String(status || '').toUpperCase();
  if (upper === 'IN_REVIEW') {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200 border-blue-200 dark:border-blue-500/30';
  }
  if (upper === 'ADDITIONAL_INFO_REQUESTED') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200 border-amber-200 dark:border-amber-500/30';
  }
  return 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200 border-purple-200 dark:border-purple-500/30';
};

const formatStatusLabel = (status: string) => {
  const upper = String(status || '').toUpperCase();
  if (upper === 'IN_REVIEW') return 'In Review';
  if (upper === 'ADDITIONAL_INFO_REQUESTED') return 'Info Requested';
  return upper.replace(/_/g, ' ') || 'Pending';
};

/**
 * The column used to render a bare "#1", which reads like an ID rather than a
 * count of how many times this brand has submitted. Spell it out: a first
 * submission and a fourth are very different signals for a reviewer.
 */
const formatAttemptLabel = (attempt: number) => {
  if (attempt <= 1) return '1st submission';
  if (attempt === 2) return '2nd submission';
  if (attempt === 3) return '3rd submission';
  return `${attempt}th submission`;
};

const attemptTone = (attempt: number) =>
  attempt >= 3
    ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'
    : 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300';

/**
 * Whether the brand currently carries a public verified badge.
 *
 * Deliberately NOT the same thing as "verification approved": the badge also
 * requires the store to be open and the owner active
 * (`getBrandVerificationTruth` on the backend). Admins kept approving a brand
 * and then finding no badge on the storefront, with nothing on screen saying
 * why — so the queue names the state instead of leaving it to be inferred.
 */
const verifiedStateLabel = (status: string) => {
  const upper = String(status || '').toUpperCase();
  if (upper === 'APPROVED') return { label: 'Verified', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200' };
  if (upper === 'REJECTED') return { label: 'Rejected', tone: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200' };
  if (upper === 'IN_REVIEW') return { label: 'Under review', tone: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200' };
  if (upper === 'ADDITIONAL_INFO_REQUESTED') return { label: 'Awaiting brand', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200' };
  if (upper === 'CANCELLED') return { label: 'Cancelled', tone: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300' };
  return { label: 'Not verified', tone: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300' };
};

const InReviewPanel: React.FC = () => {
  const [queue, setQueue] = useState<VerificationQueueItem[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortBy>('oldest');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const loadFirst = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await adminBrandsApi.getVerificationQueue({ limit: '30' });
      const data = unwrapApiResponse<{ items?: VerificationQueueItem[]; nextCursor?: string; totalPending?: number }>(
        response.data as any,
      );
      setQueue(data.items ?? []);
      setCursor(data.nextCursor ?? null);
      setPendingCount(data.totalPending ?? (data.items?.length || 0));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to load the verification queue');
      setQueue([]);
      setPendingCount(0);
      setCursor(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    try {
      setLoadingMore(true);
      const response = await adminBrandsApi.getVerificationQueue({ limit: '30', cursor });
      const data = unwrapApiResponse<{ items?: VerificationQueueItem[]; nextCursor?: string; totalPending?: number }>(
        response.data as any,
      );
      setQueue((current) => [...current, ...(data.items ?? [])]);
      setCursor(data.nextCursor ?? null);
      if (typeof data.totalPending === 'number') setPendingCount(data.totalPending);
    } catch {
      // Keep existing items on failure
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  const filteredQueue = useMemo(() => {
    let result = queue;

    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((item) => {
        const nameMatch = String(item.name || '').toLowerCase().includes(q);
        const ownerNameMatch = `${item.owner?.firstName || ''} ${item.owner?.lastName || ''}`.toLowerCase().includes(q);
        const emailMatch = String(item.owner?.email || '').toLowerCase().includes(q);
        return nameMatch || ownerNameMatch || emailMatch;
      });
    }

    if (statusFilter !== 'ALL') {
      result = result.filter((item) => String(item.verificationStatus || '').toUpperCase() === statusFilter);
    }

    result = [...result].sort((a, b) => {
      const aTime = new Date(a.verificationSubmittedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.verificationSubmittedAt || b.createdAt || 0).getTime();
      const aName = String(a.name || '').toLowerCase();
      const bName = String(b.name || '').toLowerCase();
      const aAttempt = a.verificationAttemptNumber ?? 0;
      const bAttempt = b.verificationAttemptNumber ?? 0;

      if (sortBy === 'newest') return bTime - aTime;
      if (sortBy === 'oldest') return aTime - bTime;
      if (sortBy === 'name') return aName.localeCompare(bName);
      if (sortBy === 'attempt') return bAttempt - aAttempt || aTime - bTime;
      return aTime - bTime;
    });

    return result;
  }, [queue, debouncedSearch, statusFilter, sortBy]);

  const metrics = useMemo(() => {
    const total = pendingCount || queue.length;
    const inReview = queue.filter((item) => String(item.verificationStatus || '').toUpperCase() === 'IN_REVIEW').length;
    const infoRequested = queue.filter(
      (item) => String(item.verificationStatus || '').toUpperCase() === 'ADDITIONAL_INFO_REQUESTED',
    ).length;
    const claimed = queue.filter((item) => Boolean(item.verificationReviewedById)).length;
    return { total, inReview, infoRequested, claimed };
  }, [queue, pendingCount]);

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setSortBy('oldest');
  };

  const getOwnerName = (item: VerificationQueueItem) =>
    `${item.owner?.firstName ?? ''} ${item.owner?.lastName ?? ''}`.trim() || 'Unknown Owner';

  return (
    <div className="space-y-5">
      {/* Metrics Section */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-purple-200/70 bg-purple-50/80 p-4 shadow-sm dark:border-purple-500/30 dark:bg-purple-500/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">Pending Review</p>
          <p className="mt-2 text-2xl font-black text-purple-900 dark:text-purple-100">{metrics.total}</p>
        </div>
        <div className="rounded-2xl border border-blue-200/70 bg-blue-50/80 p-4 shadow-sm dark:border-blue-500/30 dark:bg-blue-500/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">In Review</p>
          <p className="mt-2 text-2xl font-black text-blue-900 dark:text-blue-100">{metrics.inReview}</p>
        </div>
        <div className="rounded-2xl border border-amber-200/70 bg-amber-50/80 p-4 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Info Requested</p>
          <p className="mt-2 text-2xl font-black text-amber-900 dark:text-amber-100">{metrics.infoRequested}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 p-4 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Claimed Items</p>
          <p className="mt-2 text-2xl font-black text-emerald-900 dark:text-emerald-100">{metrics.claimed}</p>
        </div>
      </section>

      {/* Main Table Container */}
      <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white/90 shadow-md shadow-gray-200/40 dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
        {/* Toolbar */}
        <div className="border-b border-gray-150/70 bg-gray-50/50 p-4 dark:border-white/5 dark:bg-white/[0.02]">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-5">
            <input
              type="text"
              placeholder="Search brand, owner, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="col-span-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-purple-400 md:col-span-2 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
            <FilterDropdown
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as StatusFilter)}
              options={STATUS_OPTIONS}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
            <FilterDropdown
              value={sortBy}
              onChange={(v) => setSortBy(v as SortBy)}
              options={SORT_OPTIONS}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetFilters}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/20 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
              >
                Reset
              </button>
              <div className="inline-flex items-center rounded-xl border border-gray-200/80 bg-white p-1 text-xs font-semibold dark:border-white/10 dark:bg-white/5">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`rounded-lg px-2 py-1 transition ${viewMode === 'table' ? 'bg-purple-600 text-white' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  📋
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`rounded-lg px-2 py-1 transition ${viewMode === 'cards' ? 'bg-purple-600 text-white' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  ⊞
                </button>
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="p-8 text-center">
            <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>
            <button
              type="button"
              onClick={() => void loadFirst()}
              className="mt-3 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300"
            >
              🔄 Retry Loading Queue
            </button>
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="h-32 animate-pulse rounded-2xl bg-gray-200/70 dark:bg-white/10" />
            ))}
          </div>
        ) : filteredQueue.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-4xl">✅</p>
            <h3 className="mt-3 text-lg font-bold text-gray-900 dark:text-white">Nothing waiting for review</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {queue.length === 0
                ? 'No store verification requests are currently pending review.'
                : 'No review requests match your search and filter criteria.'}
            </p>
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b-2 border-purple-100/80 bg-gray-50/60 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-gray-400">
                  <th className="px-4 py-3">Brand</th>
                  <th className="px-4 py-3">UID</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Verification</th>
                  <th className="px-4 py-3">Attempt</th>
                  <th className="px-4 py-3">Submitted</th>
                  <th className="px-4 py-3">Assignment</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueue.map((item) => {
                  const brandUid = item.owner?.id ? generateUserUid(item.owner.id, item.owner.firstName) : '—';
                  const isClaimed = Boolean(item.verificationReviewedById);
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-gray-100/90 transition-colors even:bg-gray-50/40 hover:bg-purple-50/50 dark:border-white/5 dark:even:bg-white/[0.02] dark:hover:bg-white/5"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-gray-200/70 bg-purple-100 dark:border-white/10 dark:bg-purple-500/20">
                            {item.owner?.profileImage ? (
                              <ImageWithFallback
                                src={item.owner.profileImage}
                                alt={item.name ?? 'Brand'}
                                fallbackName={item.name ?? 'Brand'}
                                fit="cover"
                                className="h-10 w-10"
                                rounded="xl"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs font-bold text-purple-700 dark:text-purple-300">
                                {String(item.name || 'BR').slice(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{item.name || 'Unnamed brand'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {item.owner?.username ? (
                          <div className="flex items-center gap-1.5 font-mono text-xs">
                            <Link
                              to={`/u/${item.owner.username}`}
                              className="font-semibold text-purple-600 hover:underline dark:text-purple-400"
                            >
                              {brandUid}
                            </Link>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                void navigator.clipboard.writeText(brandUid);
                                toast.success('UID copied to clipboard!');
                              }}
                              title="Copy UID"
                              className="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
                            >
                              📋
                            </button>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${verificationStatusTone(
                            String(item.verificationStatus),
                          )}`}
                        >
                          {formatStatusLabel(String(item.verificationStatus))}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            verifiedStateLabel(String(item.verificationStatus)).tone
                          }`}
                        >
                          {verifiedStateLabel(String(item.verificationStatus)).label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${attemptTone(
                            item.verificationAttemptNumber ?? 1,
                          )}`}
                          title="How many times this brand has submitted for verification"
                        >
                          {formatAttemptLabel(item.verificationAttemptNumber ?? 1)}
                        </span>
                        {item.hasUnreviewedInfoResponse ? (
                          <span
                            className="ml-1.5 whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200"
                            title="This brand has answered the information request and is waiting on a decision"
                          >
                            ↩︎ Responded
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
                        {item.verificationSubmittedAt
                          ? new Date(item.verificationSubmittedAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'Not available'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            isClaimed
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                              : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300'
                          }`}
                        >
                          {isClaimed ? 'Claimed' : 'Unclaimed'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/admin/brands/${item.id}/verification-review`}
                          state={{ returnTo: RETURN_TO }}
                          className="inline-flex items-center rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-purple-700 active:scale-95"
                        >
                          🔍 Review Store
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredQueue.map((item) => {
              const brandUid = item.owner?.id ? generateUserUid(item.owner.id, item.owner.firstName) : '—';
              const isClaimed = Boolean(item.verificationReviewedById);
              return (
                <article
                  key={item.id}
                  className="flex flex-col gap-3 rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-white/10 dark:bg-black/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-purple-100 dark:border-white/10 dark:bg-purple-500/20">
                        {item.owner?.profileImage ? (
                          <ImageWithFallback
                            src={item.owner.profileImage}
                            alt={item.name ?? 'Brand'}
                            fallbackName={item.name ?? 'Brand'}
                            fit="cover"
                            className="h-11 w-11"
                            rounded="xl"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-purple-700 dark:text-purple-300">
                            {String(item.name || 'BR').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">{item.name || 'Unnamed brand'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{getOwnerName(item)}</p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${verificationStatusTone(
                        String(item.verificationStatus),
                      )}`}
                    >
                      {formatStatusLabel(String(item.verificationStatus))}
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-t border-b border-gray-100 py-2 text-xs text-gray-500 dark:border-white/5 dark:text-gray-400">
                    <span>
                      {formatAttemptLabel(item.verificationAttemptNumber ?? 1)}
                      {item.hasUnreviewedInfoResponse ? (
                        <span className="ml-1 font-semibold text-emerald-700 dark:text-emerald-300">
                          · responded
                        </span>
                      ) : null}
                    </span>
                    <span className="font-mono text-purple-600 dark:text-purple-400">{brandUid}</span>
                    <span>{isClaimed ? 'Claimed' : 'Unclaimed'}</span>
                  </div>

                  <Link
                    to={`/admin/brands/${item.id}/verification-review`}
                    state={{ returnTo: RETURN_TO }}
                    className="mt-auto w-full rounded-xl bg-purple-600 py-2 text-center text-xs font-semibold text-white shadow-sm transition hover:bg-purple-700"
                  >
                    🔍 Review Store Application
                  </Link>
                </article>
              );
            })}
          </div>
        )}

        {/* Footer pagination */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-gray-50/50 p-4 text-xs text-gray-500 dark:border-white/5 dark:bg-white/[0.01] dark:text-gray-400">
          <span>
            Showing {filteredQueue.length} of {pendingCount} store verification application{pendingCount === 1 ? '' : 's'}
          </span>
          <div className="flex items-center gap-2">
            {loadingMore && <span>Loading more...</span>}
            {cursor ? (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="rounded-xl border border-gray-300 bg-white px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
              >
                Load more
              </button>
            ) : (
              <span>End of verification queue</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InReviewPanel;
