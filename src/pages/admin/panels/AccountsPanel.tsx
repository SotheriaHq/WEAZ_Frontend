import React, { useCallback, useMemo, useState } from 'react';
import { adminUsersApi } from '@/api/AdminApi';
import type { AdminUser } from '@/types/admin';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { unwrapApiResponse } from '@/types/auth';
import { ImageWithFallback } from '@/components/ImageWithFallback';
import MediaRenderer from '@/components/media/MediaRenderer';
import useDebounce from '@/hooks/useDebounce';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import AccountManageModal from '../modals/AccountManageModal';

/**
 * Account directory for the unified admin Users console.
 *
 * `mode="shoppers"` lists regular buyers (role=User, type=REGULAR);
 * `mode="team"` lists admins (role=Admin). Both open the shared
 * AccountManageModal for the full account lifecycle. Extracted from the old
 * AdminUsersPage directory so Shoppers and Team share one implementation.
 */

type AccountsPanelMode = 'shoppers' | 'team';
type StatusFilter = 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
type SortBy = 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc' | 'status';
type ViewMode = 'table' | 'cards';

const STATUS_DOT: Record<string, { color: string; label: string }> = {
  ACTIVE: { color: 'bg-emerald-500', label: 'Active' },
  SUSPENDED: { color: 'bg-amber-500', label: 'Suspended' },
  DEACTIVATED: { color: 'bg-rose-500', label: 'Inactive' },
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  SUSPENDED: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  DEACTIVATED: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
};

const SELECT_CLASS =
  'h-9 w-full rounded-xl border border-gray-200 bg-white px-3 py-0 text-sm text-gray-800 outline-none ring-0 transition focus:border-purple-400 dark:border-white/10 dark:bg-black/30 dark:text-gray-200 appearance-none cursor-pointer';

function sortUsers(items: AdminUser[], sortBy: SortBy): AdminUser[] {
  if (sortBy === 'created_desc' || sortBy === 'created_asc') return items;
  const copy = [...items];
  copy.sort((a, b) => {
    const aName = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
    const bName = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();
    if (sortBy === 'name_asc') return aName.localeCompare(bName);
    if (sortBy === 'name_desc') return bName.localeCompare(aName);
    if (sortBy === 'status') return String(a.status || '').localeCompare(String(b.status || ''));
    return 0;
  });
  return copy;
}

const getUserAvatar = (user: AdminUser): string | null => {
  if (user.profileImage?.trim()) return user.profileImage;
  if (user.profileImageFile?.s3Url?.trim()) return user.profileImageFile.s3Url;
  return null;
};

const getUserInitials = (user: AdminUser) =>
  `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase().slice(0, 2) || 'U';

interface InlineSelectProps<T extends string> {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}
function InlineSelect<T extends string>({ label, value, onChange, options }: InlineSelectProps<T>) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{label}</label>
      <div className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value as T)} className={SELECT_CLASS}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">⌄</span>
      </div>
    </div>
  );
}

const UserAvatar: React.FC<{ user: AdminUser; size?: 'sm' | 'md'; onClick?: () => void }> = ({ user, size = 'md', onClick }) => {
  const avatar = getUserAvatar(user);
  const initials = getUserInitials(user);
  const dim = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const text = size === 'sm' ? 'text-[9px]' : 'text-[10px]';
  if (avatar) {
    return (
      <button type="button" onClick={onClick} className={`block ${dim} flex-shrink-0 overflow-hidden rounded-xl ring-1 ring-gray-200 transition-shadow hover:ring-purple-400 dark:ring-white/10`}>
        <ImageWithFallback src={avatar} alt={`${user.firstName} ${user.lastName}`} fit="cover" rounded="xl" className="h-full w-full object-cover" />
      </button>
    );
  }
  return (
    <div className={`flex ${dim} flex-shrink-0 items-center justify-center rounded-xl bg-purple-600 ${text} font-bold text-white`}>{initials}</div>
  );
};

interface AccountsPanelProps {
  mode: AccountsPanelMode;
}

const AccountsPanel: React.FC<AccountsPanelProps> = ({ mode }) => {
  const { hasPermission } = useAdminPermissions();
  const canManage = hasPermission('USERS_DEACTIVATE');

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 300);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortBy>('created_desc');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const apiSort = sortBy === 'created_asc' ? 'created_asc' : sortBy === 'created_desc' ? 'created_desc' : undefined;

  const fetchUsersPage = useCallback(
    async (cursor?: string, limit?: number) => {
      const params: Record<string, string> = {};
      if (mode === 'shoppers') {
        params.role = 'User';
        params.type = 'REGULAR';
      } else {
        params.role = 'Admin';
      }
      if (debouncedSearch) params.q = debouncedSearch;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (apiSort) params.sort = apiSort;
      if (cursor) params.cursor = cursor;
      if (limit) params.limit = String(limit);

      const res = await adminUsersApi.list(params);
      const payload = unwrapApiResponse<{ items?: AdminUser[]; nextCursor?: string } | AdminUser[]>(res.data as any);
      if (Array.isArray(payload)) return { items: payload };
      return { items: payload.items ?? [], nextCursor: payload.nextCursor };
    },
    [mode, debouncedSearch, statusFilter, apiSort],
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

  const uniqueUsers = useMemo(() => {
    const seen = new Set<string>();
    const deduped: AdminUser[] = [];
    for (const user of users) {
      if (seen.has(user.id)) continue;
      // Defensive filter: Shoppers tab strictly lists regular buyers (excludes brand accounts)
      if (mode === 'shoppers' && user.type === 'BRAND') continue;
      seen.add(user.id);
      deduped.push(user);
    }
    return deduped;
  }, [users, mode]);

  const sortedUsers = useMemo(() => sortUsers(uniqueUsers, sortBy), [uniqueUsers, sortBy]);

  const statusCounts = useMemo(() => {
    const counts = { ACTIVE: 0, SUSPENDED: 0, DEACTIVATED: 0 };
    for (const u of uniqueUsers) {
      if (u.status === 'ACTIVE') counts.ACTIVE += 1;
      if (u.status === 'SUSPENDED') counts.SUSPENDED += 1;
      if (u.status === 'DEACTIVATED') counts.DEACTIVATED += 1;
    }
    return counts;
  }, [uniqueUsers]);

  const isFiltered = Boolean(debouncedSearch) || statusFilter !== 'ALL';
  const directoryLabel = mode === 'shoppers' ? 'Shopper directory' : 'Team directory';

  return (
    <div className="space-y-5">
      {scrollError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {scrollError}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-4 py-3 dark:border-white/5 dark:bg-white/[0.01]">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{directoryLabel}</h2>
          {loadingUsers && <span className="text-xs text-gray-400 dark:text-gray-500">Loading...</span>}
        </div>

        <div className="border-b border-gray-100 bg-white p-4 dark:border-white/5 dark:bg-transparent">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="col-span-2 flex flex-col gap-1 sm:col-span-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Search</label>
              <input
                type="text"
                placeholder="Name, username, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-purple-400 dark:border-white/10 dark:bg-black/30 dark:text-white"
              />
            </div>

            <InlineSelect
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'ALL', label: 'All statuses' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'SUSPENDED', label: 'Suspended' },
                { value: 'DEACTIVATED', label: 'Inactive' },
              ]}
            />

            <InlineSelect
              label="Sort"
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: 'created_desc', label: 'Newest' },
                { value: 'created_asc', label: 'Oldest' },
                { value: 'name_asc', label: 'Name A–Z' },
                { value: 'name_desc', label: 'Name Z–A' },
                { value: 'status', label: 'Status' },
              ]}
            />

            <div className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">View</span>
              <div className="flex h-9 overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
                {(['table', 'cards'] as ViewMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setViewMode(m)}
                    className={`flex-1 px-2 py-1 text-xs font-semibold transition ${viewMode === m ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-black/20 dark:text-gray-300 dark:hover:bg-white/10'}`}
                  >
                    {m === 'table' ? '📋' : '⊞'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">{statusCounts.ACTIVE} active</span>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{statusCounts.SUSPENDED} suspended</span>
            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{statusCounts.DEACTIVATED} inactive</span>
            <span className="ml-auto text-[11px] text-gray-400 dark:text-gray-500">
              {uniqueUsers.length} loaded{isFiltered ? ' (filtered)' : ''}
              {['name_asc', 'name_desc', 'status'].includes(sortBy) && <span className="ml-1 text-amber-500">· sorted locally</span>}
            </span>
          </div>
        </div>

        <div className="p-4">
          {loadingUsers ? (
            <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">Loading accounts...</div>
          ) : viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left dark:border-white/5">
                    <th className="w-5 pb-2.5 pr-2" />
                    <th className="w-8 pb-2.5 pr-3" />
                    <th className="pb-2.5 pr-3 text-xs font-semibold text-gray-400 dark:text-gray-500">Name</th>
                    <th className="pb-2.5 pr-3 text-xs font-semibold text-gray-400 dark:text-gray-500">Username</th>
                    <th className="pb-2.5 pr-3 text-xs font-semibold text-gray-400 dark:text-gray-500">{mode === 'team' ? 'Role' : 'Type'}</th>
                    <th className="pb-2.5 pr-3 text-xs font-semibold text-gray-400 dark:text-gray-500">Joined</th>
                    {canManage && <th className="pb-2.5 text-xs font-semibold text-gray-400 dark:text-gray-500" />}
                  </tr>
                </thead>
                <tbody>
                  {sortedUsers.map((user) => {
                    const dot = STATUS_DOT[user.status] ?? STATUS_DOT.ACTIVE;
                    return (
                      <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50/60 dark:border-white/5 dark:hover:bg-white/[0.02]">
                        <td className="py-2.5 pr-2"><span className={`inline-block h-2 w-2 rounded-full ${dot.color}`} title={dot.label} /></td>
                        <td className="py-2.5 pr-3">
                          <UserAvatar user={user} size="sm" onClick={() => { const av = getUserAvatar(user); if (av) setPhotoPreview(av); }} />
                        </td>
                        <td className="py-2.5 pr-3 font-medium text-gray-900 dark:text-white">{user.firstName} {user.lastName}</td>
                        <td className="py-2.5 pr-3 text-gray-500 dark:text-gray-400">@{user.username}</td>
                        <td className="py-2.5 pr-3">
                          {mode === 'team' ? (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${user.role === 'SuperAdmin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'}`}>{user.role}</span>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400">{user.type || 'Regular'}</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-xs text-gray-400 dark:text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                        {canManage && (
                          <td className="py-2.5">
                            <button onClick={() => setSelectedUser(user)} className="rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-700 hover:bg-purple-100 dark:border-purple-500/30 dark:bg-purple-500/10 dark:text-purple-300 dark:hover:bg-purple-500/15">⚙ Manage</button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {sortedUsers.length === 0 && (
                    <tr><td colSpan={7} className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">No accounts found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {sortedUsers.map((user) => {
                const dot = STATUS_DOT[user.status] ?? STATUS_DOT.ACTIVE;
                const statusBadge = STATUS_BADGE[user.status] ?? STATUS_BADGE.ACTIVE;
                return (
                  <article key={user.id} className="flex flex-col gap-2 rounded-xl border border-gray-200/80 bg-white p-2.5 shadow-sm dark:border-white/10 dark:bg-black/20">
                    <div className="flex items-center gap-1.5">
                      <UserAvatar user={user} size="sm" onClick={() => { const av = getUserAvatar(user); if (av) setPhotoPreview(av); }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold leading-tight text-gray-900 dark:text-white">{user.firstName} {user.lastName}</p>
                        <p className="truncate text-[10px] text-gray-400 dark:text-gray-500">@{user.username}</p>
                      </div>
                      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${dot.color}`} title={dot.label} />
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-400">{mode === 'team' ? user.role : user.type || 'Regular'}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${statusBadge}`}>{dot.label}</span>
                    </div>
                    {canManage && (
                      <button onClick={() => setSelectedUser(user)} className="mt-auto w-full rounded-lg bg-purple-600 py-1 text-[10px] font-semibold text-white hover:bg-purple-700">Manage</button>
                    )}
                  </article>
                );
              })}
              {sortedUsers.length === 0 && (
                <div className="col-span-full py-12 text-center text-sm text-gray-400 dark:text-gray-500">No accounts found.</div>
              )}
            </div>
          )}

          {isLoadingMore && <div className="py-4 text-center text-xs text-gray-400 dark:text-gray-500">Loading more...</div>}
          {hasMore && <div ref={sentinelRef} className="h-px w-full" aria-hidden="true" />}
          {!hasMore && sortedUsers.length > 0 && <p className="mt-3 text-center text-[11px] text-gray-300 dark:text-gray-600">End of results</p>}
        </div>
      </section>

      {photoPreview && (
        <div className="fixed inset-0 z-layer-modal flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setPhotoPreview(null)}>
          <div className="relative max-h-[80vh] max-w-md overflow-hidden rounded-2xl shadow-2xl">
            <MediaRenderer kind="image" src={photoPreview} alt="Account photo" className="rounded-2xl" mediaClassName="w-auto rounded-2xl" maxHeightClassName="max-h-[80vh]" />
            <button type="button" onClick={() => setPhotoPreview(null)} className="absolute right-2 top-2 rounded-full bg-black/50 px-2.5 py-1 text-xs font-semibold text-white hover:bg-black/70">✕</button>
          </div>
        </div>
      )}

      <AccountManageModal
        open={!!selectedUser}
        seedUser={selectedUser}
        onClose={() => setSelectedUser(null)}
        onUpdated={() => { resetUsers(); }}
      />
    </div>
  );
};

export default AccountsPanel;
