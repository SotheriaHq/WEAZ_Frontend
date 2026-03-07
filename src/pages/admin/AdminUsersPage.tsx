import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminUsersApi } from '@/api/AdminApi';
import type { AdminReactivationRequest, AdminUser } from '@/types/admin';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { unwrapApiResponse } from '@/types/auth';
import FilterDropdown from '@/components/ui/FilterDropdown';
import { ImageWithFallback } from '@/components/ImageWithFallback';
import Modal from '@/components/ui/Modal';
import UserManageModal from './modals/UserManageModal';
import CreateAdminModal from './modals/CreateAdminModal';

type UserRoleFilter = 'ALL' | 'User' | 'Admin' | 'SuperAdmin';
type UserStatusFilter = 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
type UserSortBy =
  | 'created_desc'
  | 'created_asc'
  | 'name_asc'
  | 'name_desc'
  | 'status';
type ViewMode = 'table' | 'cards';

const STATUS_DOT: Record<string, { color: string; label: string }> = {
  ACTIVE: { color: 'bg-emerald-500', label: 'Active' },
  SUSPENDED: { color: 'bg-amber-500', label: 'Suspended' },
  DEACTIVATED: { color: 'bg-rose-500', label: 'Inactive' },
};

const ROLE_OPTIONS: Array<{ label: string; value: UserRoleFilter }> = [
  { label: 'All roles', value: 'ALL' },
  { label: 'Users', value: 'User' },
  { label: 'Admins', value: 'Admin' },
  { label: 'SuperAdmins', value: 'SuperAdmin' },
];

const STATUS_OPTIONS: Array<{ label: string; value: UserStatusFilter }> = [
  { label: 'All statuses', value: 'ALL' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Suspended', value: 'SUSPENDED' },
  { label: 'Inactive', value: 'DEACTIVATED' },
];

const SORT_OPTIONS: Array<{ label: string; value: UserSortBy }> = [
  { label: 'Newest', value: 'created_desc' },
  { label: 'Oldest', value: 'created_asc' },
  { label: 'Name A-Z', value: 'name_asc' },
  { label: 'Name Z-A', value: 'name_desc' },
  { label: 'Status', value: 'status' },
];

function normalizeUiError(error: unknown): string {
  const err = error as any;
  const status = err?.response?.status;
  if (status === 429) {
    return 'Too many requests right now. Please wait a few seconds and try again.';
  }
  const message = err?.response?.data?.message;
  if (typeof message === 'string' && message.trim().length > 0) return message;
  return 'Request failed';
}

function sortUsers(items: AdminUser[], sortBy: UserSortBy): AdminUser[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
    const aName = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
    const bName = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
    const aCreated = new Date(a.createdAt).getTime();
    const bCreated = new Date(b.createdAt).getTime();
    const aStatus = String(a.status || '');
    const bStatus = String(b.status || '');

    switch (sortBy) {
      case 'created_asc':
        return aCreated - bCreated;
      case 'name_asc':
        return aName.localeCompare(bName);
      case 'name_desc':
        return bName.localeCompare(aName);
      case 'status':
        return aStatus.localeCompare(bStatus) || bCreated - aCreated;
      case 'created_desc':
      default:
        return bCreated - aCreated;
    }
  });
  return sorted;
}

const getUserAvatar = (user: AdminUser): string | null => {
  if (user.profileImage?.trim()) return user.profileImage;
  if (user.profileImageFile?.s3Url?.trim()) return user.profileImageFile.s3Url;
  return null;
};

const AdminUsersPage: React.FC = () => {
  const [requests, setRequests] = useState<AdminReactivationRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRoleFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>('ALL');
  const [sortBy, setSortBy] = useState<UserSortBy>('created_desc');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [reviewPrompt, setReviewPrompt] = useState<{
    request: AdminReactivationRequest;
    decision: 'APPROVE' | 'REJECT';
    note: string;
  } | null>(null);
  const { hasPermission, isSuperAdmin } = useAdminPermissions();
  const canReadUsers = hasPermission('USERS_READ');
  const reactivationFetchInFlightRef = useRef(false);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(handle);
  }, [search]);

  const fetchUsersPage = useCallback(
    async (cursor?: string, limit?: number) => {
      const params: Record<string, string> = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (roleFilter !== 'ALL') params.role = roleFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (cursor) params.cursor = cursor;
      if (limit) params.limit = String(limit);

      const res = await adminUsersApi.list(params);
      const payload = unwrapApiResponse<
        { items?: AdminUser[]; nextCursor?: string } | AdminUser[]
      >(res.data as any);
      if (Array.isArray(payload)) return { items: payload };
      return { items: payload.items ?? [], nextCursor: payload.nextCursor };
    },
    [debouncedSearch, roleFilter, statusFilter],
  );

  const {
    items: users,
    isLoading: loadingUsers,
    isLoadingMore,
    hasMore,
    error: scrollError,
    sentinelRef,
    reset: resetUsers,
  } = useInfiniteScroll<AdminUser>(fetchUsersPage, { limit: 30 });

  const sortedUsers = useMemo(() => sortUsers(users, sortBy), [users, sortBy]);

  const statusCounts = useMemo(() => {
    const counts = { ACTIVE: 0, SUSPENDED: 0, DEACTIVATED: 0 };
    for (const user of users) {
      if (user.status === 'ACTIVE') counts.ACTIVE += 1;
      if (user.status === 'SUSPENDED') counts.SUSPENDED += 1;
      if (user.status === 'DEACTIVATED') counts.DEACTIVATED += 1;
    }
    return counts;
  }, [users]);

  const fetchReactivationRequests = useCallback(async () => {
    if (!canReadUsers) {
      setRequests([]);
      setLoadingRequests(false);
      return;
    }
    if (reactivationFetchInFlightRef.current) return;

    reactivationFetchInFlightRef.current = true;
    setLoadingRequests(true);
    try {
      const res = await adminUsersApi.listReactivationRequests({
        status: 'PENDING',
        limit: '25',
      });
      const payload = unwrapApiResponse<
        { items?: AdminReactivationRequest[] } | AdminReactivationRequest[]
      >(res.data as any);
      setRequests(Array.isArray(payload) ? payload : payload.items ?? []);
    } catch (err) {
      setError(normalizeUiError(err));
    } finally {
      reactivationFetchInFlightRef.current = false;
      setLoadingRequests(false);
    }
  }, [canReadUsers]);

  useEffect(() => {
    void fetchReactivationRequests();
  }, [fetchReactivationRequests]);

  const openReviewPrompt = useCallback(
    (request: AdminReactivationRequest, decision: 'APPROVE' | 'REJECT') => {
      const defaultNote =
        decision === 'APPROVE'
          ? 'Approved after account review'
          : 'Rejected after account review';
      setReviewPrompt({ request, decision, note: defaultNote });
    },
    [],
  );

  const executeReview = useCallback(
    async () => {
      if (!reviewPrompt) return;
      const { request, decision, note } = reviewPrompt;
      setReviewPrompt(null);
      setReviewingRequestId(request.id);
      setError(null);
      try {
        await adminUsersApi.reviewReactivationRequest(request.id, {
          decision,
          adminNote: note || undefined,
        });
        await fetchReactivationRequests();
      } catch (err) {
        setError(normalizeUiError(err));
      } finally {
        setReviewingRequestId(null);
      }
    },
    [reviewPrompt, fetchReactivationRequests],
  );

  const mergedError = error || scrollError;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">👤 Users</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage roles, status, permissions, and account lifecycle.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setError(null);
              resetUsers();
              void fetchReactivationRequests();
            }}
            className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
          >
            🔄 Refresh
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
            >
              ➕ Create Admin
            </button>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">
              Search
            </label>
            <input
              type="text"
              placeholder="Name, username, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-black/20 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">
              Role
            </label>
            <FilterDropdown
              value={roleFilter}
              options={ROLE_OPTIONS}
              onChange={(v) => setRoleFilter(v as UserRoleFilter)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">
              Status
            </label>
            <FilterDropdown
              value={statusFilter}
              options={STATUS_OPTIONS}
              onChange={(v) => setStatusFilter(v as UserStatusFilter)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">
              Sort
            </label>
            <FilterDropdown
              value={sortBy}
              options={SORT_OPTIONS}
              onChange={(v) => setSortBy(v as UserSortBy)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">
              View
            </label>
            <div className="flex overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`flex-1 px-3 py-2 text-xs font-semibold ${
                  viewMode === 'table'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-black/20 dark:text-gray-200 dark:hover:bg-white/10'
                }`}
              >
                📋 Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`flex-1 px-3 py-2 text-xs font-semibold ${
                  viewMode === 'cards'
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-black/20 dark:text-gray-200 dark:hover:bg-white/10'
                }`}
              >
                🧩 Cards
              </button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
            🟢 {statusCounts.ACTIVE} active
          </span>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
            🟡 {statusCounts.SUSPENDED} suspended
          </span>
          <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-500/20 dark:text-rose-200">
            🔴 {statusCounts.DEACTIVATED} inactive
          </span>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-300">
            👥 {users.length} loaded
          </span>
        </div>
      </section>

      {mergedError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
          {mergedError}
        </div>
      )}

      <section className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">📋 User Directory</h2>
        {loadingUsers ? (
          <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
            Loading users...
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-white/10 dark:text-gray-400">
                  <th className="px-2 py-3 w-8"></th>
                  <th className="px-2 py-3"></th>
                  <th className="px-2 py-3">Name</th>
                  <th className="px-2 py-3">Username</th>
                  <th className="px-2 py-3">Role</th>
                  <th className="px-2 py-3">Type</th>
                  <th className="px-2 py-3">Created</th>
                  {hasPermission('USERS_DEACTIVATE') && <th className="px-2 py-3">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((user) => {
                  const dot = STATUS_DOT[user.status] ?? STATUS_DOT.ACTIVE;
                  const avatar = getUserAvatar(user);
                  return (
                    <tr
                      key={user.id}
                      className="border-b border-gray-100 hover:bg-gray-50/70 dark:border-white/5 dark:hover:bg-white/5"
                    >
                      <td className="px-2 py-2.5">
                        <span
                          className={`inline-block h-2.5 w-2.5 rounded-full ${dot.color}`}
                          title={dot.label}
                        />
                      </td>
                      <td className="px-2 py-2.5">
                        {avatar ? (
                          <button
                            type="button"
                            onClick={() => setPhotoPreview(avatar)}
                            className="block h-8 w-8 overflow-hidden rounded-xl ring-1 ring-gray-200 dark:ring-white/10 hover:ring-purple-400 transition-shadow"
                          >
                            <ImageWithFallback
                              src={avatar}
                              alt={`${user.firstName} ${user.lastName}`}
                              fit="cover"
                              rounded="xl"
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-600 text-[10px] font-bold text-white">
                            {`${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || 'U'}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2.5 font-semibold text-gray-900 dark:text-white">
                        {user.firstName} {user.lastName}
                      </td>
                      <td className="px-2 py-2.5 text-gray-600 dark:text-gray-300">
                        @{user.username}
                      </td>
                      <td className="px-2 py-2.5">{user.role}</td>
                      <td className="px-2 py-2.5">
                        {user.role === 'SuperAdmin' || user.role === 'Admin'
                          ? user.role
                          : user.type || 'REGULAR'}
                      </td>
                      <td className="px-2 py-2.5 text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      {hasPermission('USERS_DEACTIVATE') && (
                        <td className="px-2 py-2.5">
                          <button
                            onClick={() => setSelectedUser(user)}
                            className="rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1.5 text-xs font-semibold text-purple-700 hover:bg-purple-100 dark:border-purple-500/40 dark:bg-purple-500/10 dark:text-purple-200 dark:hover:bg-purple-500/20"
                          >
                            ⚙️ Manage User
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {sortedUsers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-2 py-10 text-center text-gray-500 dark:text-gray-400">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortedUsers.map((user) => {
              const dot = STATUS_DOT[user.status] ?? STATUS_DOT.ACTIVE;
              const avatar = getUserAvatar(user);
              const initials = `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`
                .toUpperCase()
                .slice(0, 2);
              return (
                <article
                  key={user.id}
                  className="rounded-2xl border border-gray-200/80 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-black/20"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {avatar ? (
                        <button
                          type="button"
                          onClick={() => setPhotoPreview(avatar)}
                          className="block h-9 w-9 flex-shrink-0 overflow-hidden rounded-xl ring-1 ring-gray-200 dark:ring-white/10 hover:ring-purple-400 transition-shadow"
                        >
                          <ImageWithFallback
                            src={avatar}
                            alt={`${user.firstName} ${user.lastName}`}
                            fit="cover"
                            rounded="xl"
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ) : (
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-purple-600 text-xs font-bold text-white">
                          {initials || 'U'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                          @{user.username}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`mt-1 inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${dot.color}`}
                      title={dot.label}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                    <span>{user.role}</span>
                    <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                  </div>
                  {hasPermission('USERS_DEACTIVATE') && (
                    <button
                      onClick={() => setSelectedUser(user)}
                      className="mt-3 w-full rounded-lg bg-purple-600 px-3 py-2 text-xs font-semibold text-white hover:bg-purple-700"
                    >
                      ⚙️ Manage User
                    </button>
                  )}
                </article>
              );
            })}
            {sortedUsers.length === 0 && (
              <div className="col-span-full py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                No users found.
              </div>
            )}
          </div>
        )}

        {isLoadingMore && (
          <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            Loading more...
          </div>
        )}
        {hasMore && <div ref={sentinelRef} className="h-px w-full" aria-hidden="true" />}
        {!hasMore && sortedUsers.length > 0 && (
          <div className="py-3 text-center text-xs text-gray-400">End of list</div>
        )}
      </section>

      {hasPermission('USERS_DEACTIVATE') && (
        <section className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              📨 Reactivation Requests
            </h2>
            <button
              type="button"
              onClick={() => void fetchReactivationRequests()}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
            >
              🔄 Refresh
            </button>
          </div>
          {loadingRequests ? (
            <div className="py-6 text-sm text-gray-500 dark:text-gray-400">
              Loading reactivation requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="py-6 text-sm text-gray-500 dark:text-gray-400">
              No pending reactivation requests.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500 dark:border-white/10 dark:text-gray-400">
                    <th className="px-2 py-3">Email</th>
                    <th className="px-2 py-3">Reason</th>
                    <th className="px-2 py-3">Requested</th>
                    <th className="px-2 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((request) => (
                    <tr key={request.id} className="border-b border-gray-100 dark:border-white/5">
                      <td className="px-2 py-2.5 text-gray-700 dark:text-gray-200">
                        {request.emailSnapshot}
                      </td>
                      <td className="px-2 py-2.5 text-gray-600 dark:text-gray-300">
                        <p className="line-clamp-2 max-w-[460px]">{request.reason}</p>
                      </td>
                      <td className="px-2 py-2.5 text-gray-500">
                        {new Date(request.createdAt).toLocaleString()}
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openReviewPrompt(request, 'APPROVE')}
                            disabled={reviewingRequestId === request.id}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            ✅ Approve
                          </button>
                          <button
                            onClick={() => openReviewPrompt(request, 'REJECT')}
                            disabled={reviewingRequestId === request.id}
                            className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                          >
                            ❌ Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {photoPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setPhotoPreview(null)}
        >
          <div className="relative max-h-[80vh] max-w-md overflow-hidden rounded-2xl shadow-2xl">
            <img
              src={photoPreview}
              alt="User photo"
              className="max-h-[80vh] w-auto rounded-2xl object-contain"
            />
            <button
              type="button"
              onClick={() => setPhotoPreview(null)}
              className="absolute right-2 top-2 rounded-full bg-black/50 px-2.5 py-1 text-xs font-semibold text-white hover:bg-black/70"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <UserManageModal
        user={selectedUser}
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        onUpdated={() => {
          void fetchReactivationRequests();
          resetUsers();
        }}
      />
      <CreateAdminModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={() => {
          void fetchReactivationRequests();
          resetUsers();
        }}
      />

      {/* Review reactivation request modal */}
      <Modal
        open={!!reviewPrompt}
        onClose={() => setReviewPrompt(null)}
        title={reviewPrompt?.decision === 'APPROVE' ? '✅ Approve Request' : '❌ Reject Request'}
        size="sm"
      >
        {reviewPrompt && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {reviewPrompt.decision === 'APPROVE'
                ? `Approve reactivation for ${reviewPrompt.request.emailSnapshot}?`
                : `Reject reactivation for ${reviewPrompt.request.emailSnapshot}?`}
            </p>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-500 dark:text-gray-400">
                Admin Note (optional)
              </label>
              <textarea
                value={reviewPrompt.note}
                onChange={(e) =>
                  setReviewPrompt((prev) => (prev ? { ...prev, note: e.target.value } : null))
                }
                rows={3}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-black/20 dark:text-white"
                placeholder="Add a note for this decision..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewPrompt(null)}
                className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void executeReview()}
                className={`rounded-xl px-4 py-2 text-xs font-semibold text-white ${
                  reviewPrompt.decision === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {reviewPrompt.decision === 'APPROVE' ? '✅ Approve' : '❌ Reject'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminUsersPage;
