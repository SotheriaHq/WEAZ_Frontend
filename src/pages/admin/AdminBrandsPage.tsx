import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import { toast } from 'sonner';
import { adminBrandsApi } from '@/api/AdminApi';
import type { AdminBrand } from '@/types/admin';
import type { VerificationQueueItem } from '@/types/verification';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { unwrapApiResponse } from '@/types/auth';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import FilterDropdown from '@/components/ui/FilterDropdown';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import BrandDetailModal from './modals/BrandDetailModal';
import useDebounce from '@/hooks/useDebounce';
import ImageWithFallback from '@/components/ImageWithFallback';

type StoreFilter = 'ALL' | 'OPEN' | 'CLOSED';
type StatusFilter = 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
type SortBy = 'newest' | 'oldest' | 'name' | 'store' | 'status';
type ViewMode = 'table' | 'cards';

const STORE_OPTIONS: Array<{ value: StoreFilter; label: string }> = [
  { value: 'ALL', label: 'All stores' },
  { value: 'OPEN', label: 'Open stores' },
  { value: 'CLOSED', label: 'Closed stores' },
];

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: 'All account states' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'DEACTIVATED', label: 'Inactive' },
];

const SORT_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name', label: 'Name' },
  { value: 'store', label: 'Store state' },
  { value: 'status', label: 'Account state' },
];

const normalizeStatus = (status: string | undefined | null): StatusFilter | 'UNKNOWN' => {
  const value = String(status ?? '').toUpperCase();
  if (value === 'ACTIVE') return 'ACTIVE';
  if (value === 'SUSPENDED') return 'SUSPENDED';
  if (value === 'DEACTIVATED') return 'DEACTIVATED';
  return 'UNKNOWN';
};

const verificationStatusTone = (status: string) => {
  if (status === 'IN_REVIEW') {
    return 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200';
  }
  if (status === 'ADDITIONAL_INFO_REQUESTED') {
    return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200';
  }
  return 'border-gray-200 bg-gray-50 text-gray-700 dark:border-white/20 dark:bg-white/10 dark:text-gray-200';
};

const AdminBrandsPage: React.FC = () => {
  const { hasPermission } = useAdminPermissions();
  const canStoreOverride = hasPermission('BRANDS_STORE_OVERRIDE');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 350);
  const [storeFilter, setStoreFilter] = useState<StoreFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [actionLoadingBrandId, setActionLoadingBrandId] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<AdminBrand | null>(null);
  const [confirmStore, setConfirmStore] = useState<{ brand: AdminBrand; nextOpen: boolean } | null>(null);
  const [verificationQueue, setVerificationQueue] = useState<VerificationQueueItem[]>([]);
  const [pendingVerificationCount, setPendingVerificationCount] = useState(0);
  const [queueCursor, setQueueCursor] = useState<string | null>(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueLoadingMore, setQueueLoadingMore] = useState(false);

  useEffect(() => {
    let active = true;
    const loadQueue = async () => {
      try {
        setQueueLoading(true);

        const response = await adminBrandsApi.getVerificationQueue({
          limit: '8',
        });
        const data = unwrapApiResponse<{ items?: VerificationQueueItem[]; nextCursor?: string; totalPending?: number }>(response.data as any);
        if (!active) return;

        setVerificationQueue(data.items ?? []);
        setQueueCursor(data.nextCursor ?? null);
        setPendingVerificationCount(data.totalPending ?? 0);
      } catch {
        if (!active) return;
        setVerificationQueue([]);
        setPendingVerificationCount(0);
        setQueueCursor(null);
      } finally {
        if (active) {
          setQueueLoading(false);
        }
      }
    };

    void loadQueue();
    return () => {
      active = false;
    };
  }, []);

  const loadMoreQueue = useCallback(async () => {
    if (!queueCursor || queueLoadingMore) return;

    try {
      setQueueLoadingMore(true);
      const response = await adminBrandsApi.getVerificationQueue({ limit: '8', cursor: queueCursor });
      const data = unwrapApiResponse<{ items?: VerificationQueueItem[]; nextCursor?: string; totalPending?: number }>(response.data as any);
      setVerificationQueue((current) => [...current, ...(data.items ?? [])]);
      setQueueCursor(data.nextCursor ?? null);
      if (typeof data.totalPending === 'number') {
        setPendingVerificationCount(data.totalPending);
      }
    } catch {
      // Keep the existing preview intact when load-more fails.
    } finally {
      setQueueLoadingMore(false);
    }
  }, [queueCursor, queueLoadingMore]);

  const fetchPage = useCallback(
    async (cursor?: string, limit?: number) => {
      const params: Record<string, string> = {};
      if (debouncedSearch) params.q = debouncedSearch;
      if (storeFilter === 'OPEN') params.isStoreOpen = 'true';
      if (storeFilter === 'CLOSED') params.isStoreOpen = 'false';
      if (cursor) params.cursor = cursor;
      if (limit) params.limit = String(limit);

      const res = await adminBrandsApi.list(params);
      const data = unwrapApiResponse<{ items?: AdminBrand[]; nextCursor?: string } | AdminBrand[]>(
        res.data as any,
      );
      if (Array.isArray(data)) return { items: data };
      return { items: data.items ?? [], nextCursor: data.nextCursor };
    },
    [debouncedSearch, storeFilter],
  );

  const {
    items: brands,
    isLoading: loading,
    isLoadingMore,
    hasMore,
    error,
    sentinelRef,
    reset,
  } = useInfiniteScroll<AdminBrand>(fetchPage, { limit: 30 });

  const uniqueBrands = useMemo(() => {
    const seen = new Set<string>();
    return brands.filter((brand) => {
      if (!brand.id || seen.has(brand.id)) return false;
      seen.add(brand.id);
      return true;
    });
  }, [brands]);

  const filteredBrands = useMemo(() => {
    let next = uniqueBrands;

    if (statusFilter !== 'ALL') {
      next = next.filter((brand) => normalizeStatus(brand.owner?.status) === statusFilter);
    }

    next = [...next].sort((a, b) => {
      const aName = String(a.name ?? '').toLowerCase();
      const bName = String(b.name ?? '').toLowerCase();
      const aStore = a.isStoreOpen ? 1 : 0;
      const bStore = b.isStoreOpen ? 1 : 0;
      const aStatus = String(a.owner?.status ?? '').toLowerCase();
      const bStatus = String(b.owner?.status ?? '').toLowerCase();
      const aTs = new Date(a.createdAt ?? 0).getTime();
      const bTs = new Date(b.createdAt ?? 0).getTime();

      if (sortBy === 'oldest') return aTs - bTs;
      if (sortBy === 'name') return aName.localeCompare(bName);
      if (sortBy === 'store') return bStore - aStore || bTs - aTs;
      if (sortBy === 'status') return aStatus.localeCompare(bStatus) || bTs - aTs;
      return bTs - aTs;
    });

    return next;
  }, [sortBy, statusFilter, uniqueBrands]);

  const metrics = useMemo(() => {
    const total = uniqueBrands.length;
    const open = uniqueBrands.filter((brand) => brand.isStoreOpen).length;
    const closed = total - open;
    const suspended = uniqueBrands.filter((brand) => normalizeStatus(brand.owner?.status) === 'SUSPENDED').length;
    return { total, open, closed, suspended };
  }, [uniqueBrands]);

  const getBrandVisual = (brand: AdminBrand) => {
    if (brand.logo && brand.logo.trim()) return brand.logo;
    if (brand.owner?.profileImage && brand.owner.profileImage.trim()) return brand.owner.profileImage;
    return null;
  };

  const getOwnerName = (brand: AdminBrand) => {
    const fullName = `${brand.owner?.firstName ?? ''} ${brand.owner?.lastName ?? ''}`.trim();
    return fullName || 'Unknown owner';
  };

  const resetFilters = () => {
    setSearch('');
    setStoreFilter('ALL');
    setStatusFilter('ALL');
    setSortBy('newest');
  };

  const requestToggleStore = (brand: AdminBrand) => {
    if (!canStoreOverride) return;
    setConfirmStore({ brand, nextOpen: !brand.isStoreOpen });
  };

  const executeToggleStore = async () => {
    if (!confirmStore) return;
    const { brand, nextOpen } = confirmStore;
    setConfirmStore(null);
    setActionLoadingBrandId(brand.id);
    try {
      await adminBrandsApi.overrideStoreOpen(brand.id, nextOpen);
      toast.success(`Store ${nextOpen ? 'opened' : 'closed'}`);
      reset();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Unable to update store state');
    } finally {
      setActionLoadingBrandId(null);
    }
  };

  return (
    <div className="space-y-6">
      <AdminBreadcrumb segments={[{ label: 'Brands' }]} />
      <section className="rounded-3xl border border-indigo-200/40 bg-gradient-to-br from-white/95 via-[#f7f4ff] to-[#efe8ff] p-5 shadow-md shadow-indigo-500/10 dark:border-white/10 dark:from-white/10 dark:via-[#120d1d] dark:to-[#1a1327]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">Brands Console</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Manage brand accounts, monitor store state, and moderate storefront availability.
            </p>
          </div>
          <div className="inline-flex items-center rounded-full border border-gray-200/80 bg-white p-1 text-xs font-semibold dark:border-white/10 dark:bg-white/5">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`rounded-full px-3 py-1.5 transition ${viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300'}`}
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`rounded-full px-3 py-1.5 transition ${viewMode === 'cards' ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-300'}`}
            >
              Cards
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-gray-200/70 bg-white/80 p-4 shadow-sm transition-transform hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Total brands</p>
          <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">{metrics.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 p-4 shadow-sm transition-transform hover:-translate-y-0.5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Open stores</p>
          <p className="mt-2 text-2xl font-black text-emerald-800 dark:text-emerald-200">{metrics.open}</p>
        </div>
        <div className="rounded-2xl border border-rose-200/70 bg-rose-50/80 p-4 shadow-sm transition-transform hover:-translate-y-0.5 dark:border-rose-500/30 dark:bg-rose-500/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">Closed stores</p>
          <p className="mt-2 text-2xl font-black text-rose-800 dark:text-rose-200">{metrics.closed}</p>
        </div>
        <div className="rounded-2xl border border-amber-200/70 bg-amber-50/80 p-4 shadow-sm transition-transform hover:-translate-y-0.5 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Suspended</p>
          <p className="mt-2 text-2xl font-black text-amber-800 dark:text-amber-200">{metrics.suspended}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-sky-200/80 bg-sky-50/70 p-5 shadow-sm dark:border-sky-500/20 dark:bg-sky-500/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Verification queue</p>
            <h2 className="mt-2 text-xl font-black text-gray-900 dark:text-white">{pendingVerificationCount} active review item{pendingVerificationCount === 1 ? '' : 's'}</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Jump directly into the verification reviews that still need action.</p>
          </div>
          <Link
            to="/admin/verification"
            className="inline-flex items-center rounded-full border border-sky-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-100 dark:border-sky-500/30 dark:bg-white/5 dark:text-sky-200"
          >
            Open full queue
          </Link>
        </div>
        <div className="mt-4 rounded-2xl border border-sky-200/70 bg-white/70 dark:border-sky-500/20 dark:bg-white/5">
          {queueLoading ? (
            <div className="px-4 py-5 text-sm text-gray-500 dark:text-gray-300">Loading verification preview...</div>
          ) : verificationQueue.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-sky-200 bg-white/70 px-4 py-5 text-sm text-gray-500 dark:border-sky-500/20 dark:bg-white/5 dark:text-gray-300">
              No verification items are waiting right now.
            </div>
          ) : (
            <>
              <div className="space-y-2 p-3 md:hidden">
                {verificationQueue.map((item) => (
                  <article key={item.id} className="rounded-xl border border-sky-200/70 bg-white px-3 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{item.name || 'Unnamed brand'}</p>
                        <p className="text-xs text-gray-500">{item.owner?.firstName} {item.owner?.lastName}</p>
                        <p className="text-xs text-gray-500">{item.owner?.email ?? 'No owner email'}</p>
                      </div>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${verificationStatusTone(String(item.verificationStatus))}`}>
                        {String(item.verificationStatus).replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <p><span className="font-semibold text-gray-800">Attempt:</span> {item.verificationAttemptNumber ?? 0}</p>
                      <p><span className="font-semibold text-gray-800">Assigned:</span> {item.verificationReviewedById ? 'Claimed' : 'Unclaimed'}</p>
                      <p className="col-span-2">
                        <span className="font-semibold text-gray-800">Submitted:</span>{' '}
                        {item.verificationSubmittedAt
                          ? new Date(item.verificationSubmittedAt).toLocaleString()
                          : 'Not available'}
                      </p>
                    </div>
                    <div className="mt-2">
                      <Link
                        to={`/admin/brands/${item.id}/verification-review`}
                        state={{ returnTo: '/admin/brands' }}
                        className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-800"
                      >
                        Open
                      </Link>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-sky-100/80 bg-sky-50/60 text-left text-[11px] uppercase tracking-[0.16em] text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300">
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
                    {verificationQueue.map((item) => (
                      <tr key={item.id} className="border-b border-sky-100/80 hover:bg-sky-50/40 dark:border-sky-500/10 dark:hover:bg-sky-500/10">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900 dark:text-white">{item.name || 'Unnamed brand'}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{item.id.slice(0, 8)}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                          <p>{item.owner?.firstName} {item.owner?.lastName}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{item.owner?.email ?? 'No owner email'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${verificationStatusTone(String(item.verificationStatus))}`}>
                            {String(item.verificationStatus).replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-200">{item.verificationAttemptNumber ?? 0}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                          {item.verificationSubmittedAt
                            ? new Date(item.verificationSubmittedAt).toLocaleString()
                            : 'Not available'}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                          {item.verificationReviewedById ? 'Claimed' : 'Unclaimed'}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            to={`/admin/brands/${item.id}/verification-review`}
                            state={{ returnTo: '/admin/brands' }}
                            className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-800 transition hover:border-sky-300 hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-sky-100/80 px-4 py-3 text-xs text-gray-500 dark:border-sky-500/20 dark:text-gray-300">
                <span>
                  Showing {verificationQueue.length} of {pendingVerificationCount} active item{pendingVerificationCount === 1 ? '' : 's'}
                </span>
                <div className="flex items-center gap-2">
                  {queueLoadingMore ? (
                    <span>Loading more...</span>
                  ) : null}
                  {queueCursor ? (
                    <button
                      type="button"
                      onClick={() => void loadMoreQueue()}
                      disabled={queueLoadingMore}
                      className="rounded-full border border-sky-200 bg-white px-3 py-1.5 font-semibold uppercase tracking-[0.16em] text-sky-700 transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-500/30 dark:bg-white/5 dark:text-sky-200"
                    >
                      Load more
                    </button>
                  ) : (
                    <span>Preview complete</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200/80 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <input
            type="text"
            placeholder="Search brand, owner, or email..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="col-span-2 md:col-span-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
          />
          <FilterDropdown
            value={storeFilter}
            onChange={(value) => setStoreFilter(value as StoreFilter)}
            options={STORE_OPTIONS}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-black/20 dark:text-white"
          />
          <FilterDropdown
            value={statusFilter}
            onChange={(value) => setStatusFilter(value as StatusFilter)}
            options={STATUS_OPTIONS}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-black/20 dark:text-white"
          />
          <div className="flex gap-2">
            <FilterDropdown
              value={sortBy}
              onChange={(value) => setSortBy(value as SortBy)}
              options={SORT_OPTIONS}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/20 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
            >
              Reset
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-36 animate-pulse rounded-2xl bg-gray-200/70 dark:bg-white/10" />
          ))}
        </div>
      ) : filteredBrands.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-10 text-center dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-3xl">🏷️</p>
          <h3 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">No brands match this view</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Adjust your filters or reset the search.</p>
        </div>
      ) : viewMode === 'table' ? (
        <div className="overflow-x-auto rounded-2xl border border-gray-200/80 bg-white/90 shadow-md shadow-gray-200/40 dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b-2 border-indigo-100/80 bg-gray-50/60 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-gray-400">
                <th className="px-3 py-3">Brand</th>
                <th className="px-3 py-3">Owner</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Store</th>
                <th className="px-3 py-3">Account</th>
                <th className="px-3 py-3">Joined</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBrands.map((brand) => {
                const ownerStatus = normalizeStatus(brand.owner?.status);
                const visual = getBrandVisual(brand);
                return (
                  <tr key={brand.id} className="border-b border-gray-100/90 transition-colors even:bg-gray-50/40 hover:bg-indigo-50/50 dark:border-white/5 dark:even:bg-white/[0.02] dark:hover:bg-white/5">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-gray-200/70 bg-gray-100 dark:border-white/10 dark:bg-white/10">
                          {visual ? (
                            <ImageWithFallback src={visual} alt={brand.name ?? 'Brand'} fallbackName={brand.name ?? 'Brand'} fit="cover" className="h-11 w-11" rounded="xl" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-gray-500 dark:text-gray-300">
                              {String(brand.name ?? 'BR').slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{brand.name || 'Unnamed brand'}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{brand.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-700 dark:text-gray-200">{getOwnerName(brand)}</td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{brand.owner?.email ?? '—'}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        brand.isStoreOpen
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200'
                      }`}>
                        <span>{brand.isStoreOpen ? '🟢' : '🔴'}</span>
                        {brand.isStoreOpen ? 'Open' : 'Closed'}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        ownerStatus === 'ACTIVE'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                          : ownerStatus === 'SUSPENDED'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200'
                            : ownerStatus === 'DEACTIVATED'
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200'
                              : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300'
                      }`}>
                        {ownerStatus === 'UNKNOWN' ? 'Unknown' : ownerStatus}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {brand.createdAt ? new Date(brand.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedBrand(brand)}
                          className="rounded-lg bg-indigo-100 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-200 dark:hover:bg-indigo-500/30"
                        >
                          View
                        </button>
                        {canStoreOverride && (
                          <button
                            type="button"
                            disabled={actionLoadingBrandId === brand.id}
                            onClick={() => requestToggleStore(brand)}
                            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                              brand.isStoreOpen
                                ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-200 dark:hover:bg-rose-500/30'
                                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:hover:bg-emerald-500/30'
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            {actionLoadingBrandId === brand.id
                              ? 'Saving...'
                              : brand.isStoreOpen
                                ? 'Close store'
                                : 'Open store'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredBrands.map((brand) => {
            const visual = getBrandVisual(brand);
            const ownerStatus = normalizeStatus(brand.owner?.status);
            return (
              <article
                key={brand.id}
                className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white/85 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.03]"
              >
                <div className="h-36 w-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-500/20 dark:to-purple-500/20">
                  {visual ? (
                    <ImageWithFallback src={visual} alt={brand.name ?? 'Brand'} fallbackName={brand.name ?? 'Brand'} fit="cover" className="h-36 w-full" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl text-gray-500 dark:text-gray-300">🏷️</div>
                  )}
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-bold text-gray-900 dark:text-white">{brand.name || 'Unnamed brand'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{getOwnerName(brand)}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                      brand.isStoreOpen
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200'
                    }`}>
                      {brand.isStoreOpen ? 'Open' : 'Closed'}
                    </span>
                  </div>
                  <p className="line-clamp-2 min-h-[40px] text-sm text-gray-600 dark:text-gray-300">
                    {brand.description?.trim() || 'No brand description provided.'}
                  </p>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{brand.owner?.email ?? 'No email'}</span>
                    <span>{ownerStatus === 'UNKNOWN' ? 'Unknown' : ownerStatus}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedBrand(brand)}
                      className="flex-1 rounded-lg bg-indigo-100 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-200 dark:hover:bg-indigo-500/30"
                    >
                      View details
                    </button>
                    {canStoreOverride && (
                      <button
                        type="button"
                        disabled={actionLoadingBrandId === brand.id}
                        onClick={() => requestToggleStore(brand)}
                        className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${
                          brand.isStoreOpen
                            ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-200 dark:hover:bg-rose-500/30'
                            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:hover:bg-emerald-500/30'
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {actionLoadingBrandId === brand.id
                          ? 'Saving...'
                          : brand.isStoreOpen
                            ? 'Close store'
                            : 'Open store'}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {isLoadingMore && <div className="py-3 text-center text-sm text-gray-500 dark:text-gray-400">Loading more...</div>}
      {hasMore && <div ref={sentinelRef} className="h-px w-full" />}
      {!hasMore && filteredBrands.length > 0 && <div className="py-2 text-center text-xs text-gray-400">End of list</div>}

      <ConfirmDialog
        open={!!confirmStore}
        title={confirmStore ? `${confirmStore.nextOpen ? 'Open' : 'Close'} store?` : ''}
        message={confirmStore ? `${confirmStore.nextOpen ? 'Open' : 'Close'} store for "${confirmStore.brand.name ?? 'this brand'}"? This will ${confirmStore.nextOpen ? 'make products visible to customers' : 'hide all products from customers'}.` : ''}
        isDestructive={!!confirmStore && !confirmStore.nextOpen}
        isLoading={!!actionLoadingBrandId}
        onConfirm={executeToggleStore}
        onCancel={() => setConfirmStore(null)}
      />

      <BrandDetailModal
        brand={selectedBrand}
        open={!!selectedBrand}
        onClose={() => setSelectedBrand(null)}
        onUpdated={() => {
          reset();
        }}
      />
    </div>
  );
};

export default AdminBrandsPage;
