import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import { adminTagsApi } from '@/api/AdminApi';
import type {
  AdminTagItem,
  AdminTagLifecycleDetails,
  AdminTagStatus,
} from '@/types/admin';
import { unwrapApiResponse } from '@/types/auth';
import useDebounce from '@/hooks/useDebounce';
import { toast } from 'sonner';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import Modal from '@/components/ui/Modal';
import UniversalSelect from '@/components/forms/UniversalSelect';

type TagSortMode = 'recent' | 'popular' | 'last-used' | 'name-asc';
type TagStateFilter = 'all' | 'pending' | 'approved' | 'rejected';

const TAG_SORT_OPTIONS = [
  { value: 'recent', label: 'Sort: Newest first' },
  { value: 'popular', label: 'Sort: Most used' },
  { value: 'last-used', label: 'Sort: Last used' },
  { value: 'name-asc', label: 'Sort: Name A-Z' },
];

const TAG_STATE_OPTIONS = [
  { value: 'all', label: 'Status: All' },
  { value: 'pending', label: 'Status: Pending' },
  { value: 'approved', label: 'Status: Approved' },
  { value: 'rejected', label: 'Status: Rejected' },
];
const TAGS_PAGE_SIZE = 20;

type LoadedTagPage = {
  items: AdminTagItem[];
  nextCursor: string | null;
};

const getTagStatus = (tag: Pick<AdminTagItem, 'status' | 'isBanned'>): AdminTagStatus => {
  if (tag.status === 'PENDING' || tag.status === 'REJECTED') {
    return tag.status;
  }
  if (tag.isBanned) {
    return 'REJECTED';
  }
  return 'APPROVED';
};

const tagStatusLabel = (status: AdminTagStatus) => {
  if (status === 'PENDING') return '⏳ Pending';
  if (status === 'REJECTED') return '❌ Rejected';
  return '✅ Approved';
};

const tagStatusClass = (status: AdminTagStatus) => {
  if (status === 'PENDING') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200';
  }
  if (status === 'REJECTED') {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-200';
  }
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200';
};

const AdminTagsPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query.trim(), 350);
  const [sortMode, setSortMode] = useState<TagSortMode>('recent');
  const [stateFilter, setStateFilter] = useState<TagStateFilter>('all');
  const { isSuperAdmin } = useAdminPermissions();
  const [updatingTag, setUpdatingTag] = useState<string | null>(null);
  const [localTagOverrides, setLocalTagOverrides] = useState<
    Record<string, Partial<AdminTagItem>>
  >({});
  const [selectedTagName, setSelectedTagName] = useState<string | null>(null);
  const [selectedTagLifecycle, setSelectedTagLifecycle] =
    useState<AdminTagLifecycleDetails | null>(null);
  const [selectedTagLoading, setSelectedTagLoading] = useState(false);
  const [selectedTagBusy, setSelectedTagBusy] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<AdminTagItem[]>([]);
  const [cursorPages, setCursorPages] = useState<LoadedTagPage[]>([]);
  const isSearchMode = debouncedQuery.length > 0;

  const fetchCursorPage = useCallback(
    async (cursor?: string) => {
      const params: Record<string, string | number> = {
        sort: sortMode,
        state: stateFilter,
        includeBanned: 'true',
        limit: TAGS_PAGE_SIZE,
      };
      if (cursor) {
        params.cursor = cursor;
      }
      const res = await adminTagsApi.list(params);
      const data = unwrapApiResponse<
        { items?: AdminTagItem[]; nextCursor?: string | null } | AdminTagItem[]
      >(res.data as any);
      if (Array.isArray(data)) {
        return { items: data, nextCursor: null as string | null };
      }
      return {
        items: data?.items ?? [],
        nextCursor: data?.nextCursor ?? null,
      };
    },
    [sortMode, stateFilter],
  );

  const applyLocalTagUpdate = useCallback((tagName: string, patch: Partial<AdminTagItem>) => {
    setLocalTagOverrides((current) => ({
      ...current,
      [tagName]: {
        ...current[tagName],
        ...patch,
      },
    }));
  }, []);

  const mergeAndFilterTags = useCallback((rows: AdminTagItem[]) => {
    const merged = rows.map((tag) => {
      const override = localTagOverrides[tag.name] ?? null;
      return override ? { ...tag, ...override } : tag;
    });

    if (stateFilter === 'all') {
      return merged;
    }

    return merged.filter((tag) => getTagStatus(tag).toLowerCase() === stateFilter);
  }, [localTagOverrides, stateFilter]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLocalTagOverrides({});
      setCurrentPage(1);
      setError(null);

      if (isSearchMode) {
        setLoading(true);
        setCursorPages([]);
        try {
          const res = await adminTagsApi.search(debouncedQuery, 200, {
            includeBanned: 'true',
            sort: sortMode,
            state: stateFilter,
          });
          const data = unwrapApiResponse<{ items?: AdminTagItem[] }>(res.data as any);
          if (!cancelled) {
            setSearchResults(data?.items ?? []);
          }
        } catch (loadError: any) {
          if (!cancelled) {
            setSearchResults([]);
            setError(loadError?.response?.data?.message || 'Failed to load tags');
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
        return;
      }

      setSearchResults([]);
      setLoading(true);
      try {
        const firstPage = await fetchCursorPage();
        if (!cancelled) {
          setCursorPages([firstPage]);
        }
      } catch (loadError: any) {
        if (!cancelled) {
          setCursorPages([]);
          setError(loadError?.response?.data?.message || 'Failed to load tags');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, fetchCursorPage, isSearchMode, sortMode, stateFilter]);

  const mergedSearchTags = useMemo(
    () => mergeAndFilterTags(searchResults),
    [mergeAndFilterTags, searchResults],
  );
  const searchTotalPages = useMemo(
    () => Math.max(1, Math.ceil(mergedSearchTags.length / TAGS_PAGE_SIZE)),
    [mergedSearchTags.length],
  );
  const pagedSearchTags = useMemo(() => {
    const start = (currentPage - 1) * TAGS_PAGE_SIZE;
    return mergedSearchTags.slice(start, start + TAGS_PAGE_SIZE);
  }, [currentPage, mergedSearchTags]);
  const currentCursorPage = cursorPages[currentPage - 1] ?? null;
  const mergedCursorTags = useMemo(
    () => mergeAndFilterTags(currentCursorPage?.items ?? []),
    [currentCursorPage?.items, mergeAndFilterTags],
  );
  const visibleTags = isSearchMode ? pagedSearchTags : mergedCursorTags;
  const canGoPrevious = currentPage > 1;
  const canGoNext = isSearchMode
    ? currentPage < searchTotalPages
    : Boolean(currentCursorPage?.nextCursor) || currentPage < cursorPages.length;
  const totalPagesLabel = isSearchMode
    ? `${searchTotalPages}`
    : currentCursorPage?.nextCursor
      ? `${Math.max(cursorPages.length, currentPage + 1)}+`
      : `${Math.max(cursorPages.length, 1)}`;

  useEffect(() => {
    if (!isSearchMode) return;
    setCurrentPage((page) => Math.min(page, searchTotalPages));
  }, [isSearchMode, searchTotalPages]);

  const goToPreviousPage = useCallback(() => {
    setCurrentPage((page) => Math.max(1, page - 1));
  }, []);

  const goToNextPage = useCallback(async () => {
    if (!canGoNext || isLoadingMore) return;

    if (isSearchMode) {
      setCurrentPage((page) => Math.min(searchTotalPages, page + 1));
      return;
    }

    if (currentPage < cursorPages.length) {
      setCurrentPage((page) => page + 1);
      return;
    }

    const nextCursor = currentCursorPage?.nextCursor;
    if (!nextCursor) return;

    setIsLoadingMore(true);
    try {
      const nextPage = await fetchCursorPage(nextCursor);
      setCursorPages((existing) => [...existing, nextPage]);
      setCurrentPage((page) => page + 1);
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || 'Failed to load more tags');
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    canGoNext,
    currentCursorPage?.nextCursor,
    currentPage,
    cursorPages.length,
    fetchCursorPage,
    isLoadingMore,
    isSearchMode,
    searchTotalPages,
  ]);

  const formatDate = useCallback((value?: string | null) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  const formatDateTime = useCallback((value?: string | null) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  const loadTagLifecycle = useCallback(async (tagName: string) => {
    setSelectedTagLoading(true);
    try {
      const response = await adminTagsApi.getLifecycle(tagName);
      const payload = unwrapApiResponse<AdminTagLifecycleDetails>(response.data as any);
      setSelectedTagLifecycle(payload);
      setDisplayNameDraft(payload?.displayName ?? '');
    } catch (error: any) {
      setSelectedTagLifecycle(null);
      toast.error(error?.response?.data?.message || 'Failed to load tag lifecycle');
    } finally {
      setSelectedTagLoading(false);
    }
  }, []);

  const openTagLifecycle = useCallback(
    (tagName: string) => {
      setSelectedTagName(tagName);
      void loadTagLifecycle(tagName);
    },
    [loadTagLifecycle],
  );

  const closeTagLifecycle = useCallback(() => {
    setSelectedTagName(null);
    setSelectedTagLifecycle(null);
    setDisplayNameDraft('');
    setSelectedTagLoading(false);
    setSelectedTagBusy(false);
  }, []);

  const handleSetTagStatus = useCallback(
    async (tagName: string, nextStatus: AdminTagStatus) => {
      if (!isSuperAdmin || updatingTag) return;

      const actionKey = `${tagName}:${nextStatus}`;
      setUpdatingTag(actionKey);
      try {
        const response = await adminTagsApi.updateStatus(tagName, nextStatus);
        const updated = unwrapApiResponse<AdminTagItem>(response.data as any);

        const patch: Partial<AdminTagItem> = {
          status: updated?.status ?? nextStatus,
          isBanned: updated?.isBanned ?? nextStatus === 'REJECTED',
          updatedAt: updated?.updatedAt ?? new Date().toISOString(),
        };
        if (typeof updated?.displayName === 'string') {
          patch.displayName = updated.displayName;
        }
        if ('aliasOfTagName' in (updated || {})) {
          patch.aliasOfTagName = updated.aliasOfTagName ?? null;
        }

        applyLocalTagUpdate(tagName, patch);
        toast.success(`#${tagName} marked ${nextStatus.toLowerCase()}.`);

        if (selectedTagLifecycle?.name === tagName) {
          await loadTagLifecycle(tagName);
        }
      } catch (error: any) {
        toast.error(error?.response?.data?.message || 'Failed to update tag status');
      } finally {
        setUpdatingTag(null);
      }
    },
    [
      applyLocalTagUpdate,
      isSuperAdmin,
      loadTagLifecycle,
      selectedTagLifecycle?.name,
      updatingTag,
    ],
  );

  const handleSaveDisplayName = useCallback(async () => {
    if (!isSuperAdmin || !selectedTagName) return;
    setSelectedTagBusy(true);
    try {
      const response = await adminTagsApi.updateMetadata(selectedTagName, {
        displayName: displayNameDraft,
      });
      const updated = unwrapApiResponse<AdminTagItem>(response.data as any);
      applyLocalTagUpdate(selectedTagName, {
        displayName:
          typeof updated?.displayName === 'string'
            ? updated.displayName
            : displayNameDraft,
        updatedAt: updated?.updatedAt ?? new Date().toISOString(),
      });
      toast.success('Tag display name saved.');
      await loadTagLifecycle(selectedTagName);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save display name');
    } finally {
      setSelectedTagBusy(false);
    }
  }, [
    applyLocalTagUpdate,
    displayNameDraft,
    isSuperAdmin,
    loadTagLifecycle,
    selectedTagName,
  ]);

  const handleLifecycleStatusChange = useCallback(async (nextStatus: AdminTagStatus) => {
    if (!isSuperAdmin || !selectedTagLifecycle) return;
    setSelectedTagBusy(true);
    try {
      await handleSetTagStatus(selectedTagLifecycle.name, nextStatus);
    } finally {
      setSelectedTagBusy(false);
    }
  }, [handleSetTagStatus, isSuperAdmin, selectedTagLifecycle]);

  const canModerate = isSuperAdmin;

  const selectedLifecycleStatus = selectedTagLifecycle
    ? getTagStatus(selectedTagLifecycle)
    : 'APPROVED';

  const lifecycleSummary = useMemo(() => {
    if (!selectedTagLifecycle) return null;
    const entityTotal = Object.values(selectedTagLifecycle.entityCounts ?? {}).reduce(
      (sum, count) => sum + Number(count || 0),
      0,
    );
    return {
      entityTotal,
      users: selectedTagLifecycle.usage?.distinctUsersCount ?? 0,
      collections: Number(selectedTagLifecycle.entityCounts?.COLLECTION ?? 0),
      products: Number(selectedTagLifecycle.entityCounts?.PRODUCT ?? 0),
      brands:
        Number(selectedTagLifecycle.entityCounts?.BRAND ?? 0) +
        Number(selectedTagLifecycle.entityCounts?.USER_BRAND ?? 0),
    };
  }, [selectedTagLifecycle]);

  return (
    <div className="space-y-6">
      <AdminBreadcrumb segments={[{ label: 'Hashtag moderation' }]} />
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Hashtag moderation</h1>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Hashtag review queue</p>
            <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
              Hashtags are social/search terms. They do not create garment categories, discovery dimensions, or filter values.
            </p>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {debouncedQuery
              ? 'Filtered search results'
              : `Sorted by ${sortMode.replace('-', ' ')}`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px_260px]">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search hashtags..."
          className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
        <UniversalSelect
          value={sortMode}
          onChange={(value) => setSortMode(value as TagSortMode)}
          options={TAG_SORT_OPTIONS}
        />
        <UniversalSelect
          value={stateFilter}
          onChange={(value) => setStateFilter(value as TagStateFilter)}
          options={TAG_STATE_OPTIONS}
        />
      </div>

      {error && <div className="text-red-500 text-sm">{error}</div>}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                <th className="w-[24%] px-2 py-2.5">Tag</th>
                <th className="w-[17%] px-2 py-2.5">Status</th>
                <th className="w-[10%] px-2 py-2.5">Usage</th>
                <th className="w-[13%] px-2 py-2.5">Last Used</th>
                <th className="w-[13%] px-2 py-2.5">Created</th>
                <th className="w-[23%] px-2 py-2.5">Manage</th>
              </tr>
            </thead>
            <tbody>
              {visibleTags.map((tag) => {
                const status = getTagStatus(tag);
                const creatorLabel =
                  tag.createdBy?.brandFullName || tag.createdBy?.username || null;

                return (
                  <tr key={tag.name} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-2 py-2 align-top">
                      <button
                        type="button"
                        onClick={() => openTagLifecycle(tag.name)}
                        className="block truncate font-mono text-sm font-semibold text-indigo-700 hover:text-indigo-600 dark:text-indigo-300 dark:hover:text-indigo-200"
                        title={`#${tag.name}`}
                      >
                        #{tag.name}
                      </button>
                      {tag.displayName && tag.displayName !== tag.name ? (
                        <div
                          className="mt-0.5 truncate text-[11px] leading-4 text-gray-500 dark:text-gray-400"
                          title={`Display: ${tag.displayName}`}
                        >
                          Display: {tag.displayName}
                        </div>
                      ) : null}
                      <div className="mt-0.5 truncate text-[11px] leading-4 text-gray-500 dark:text-gray-400">
                        Created by {creatorLabel ? creatorLabel : 'Unknown creator'}
                      </div>
                    </td>
                    <td className="px-2 py-2 align-top">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${tagStatusClass(status)}`}
                      >
                        {tagStatusLabel(status)}
                      </span>
                      {tag.aliasOfTagName ? (
                        <div
                          className="mt-1 truncate text-[11px] leading-4 text-gray-500 dark:text-gray-400"
                          title={`Alias of #${tag.aliasOfTagName}`}
                        >
                          Alias of #{tag.aliasOfTagName}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 align-top text-gray-600 dark:text-gray-400">
                      {tag.usageCount}
                    </td>
                    <td className="px-2 py-2 align-top text-[11px] text-gray-600 dark:text-gray-400 sm:text-xs">
                      <span className="whitespace-nowrap">{formatDate(tag.lastUsedAt)}</span>
                    </td>
                    <td className="px-2 py-2 align-top text-[11px] text-gray-600 dark:text-gray-400 sm:text-xs">
                      <span className="whitespace-nowrap">{formatDate(tag.createdAt)}</span>
                    </td>
                    <td className="px-2 py-2 align-top">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openTagLifecycle(tag.name)}
                          className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15"
                        >
                          Open lifecycle
                        </button>
                        {canModerate && status !== 'APPROVED' ? (
                          <button
                            type="button"
                            onClick={() => void handleSetTagStatus(tag.name, 'APPROVED')}
                            disabled={Boolean(updatingTag)}
                            className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {updatingTag === `${tag.name}:APPROVED` ? 'Working...' : '✅ Approve'}
                          </button>
                        ) : null}
                        {canModerate && status !== 'PENDING' ? (
                          <button
                            type="button"
                            onClick={() => void handleSetTagStatus(tag.name, 'PENDING')}
                            disabled={Boolean(updatingTag)}
                            className="rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {updatingTag === `${tag.name}:PENDING` ? 'Working...' : '⏳ Pending'}
                          </button>
                        ) : null}
                        {canModerate && status !== 'REJECTED' ? (
                          <button
                            type="button"
                            onClick={() => void handleSetTagStatus(tag.name, 'REJECTED')}
                            disabled={Boolean(updatingTag)}
                            className="rounded-md bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {updatingTag === `${tag.name}:REJECTED` ? 'Working...' : '❌ Reject'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visibleTags.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">No tags found</td>
                </tr>
              )}
            </tbody>
          </table>
          {isLoadingMore ? (
            <div className="py-3 text-center text-sm text-gray-500">Loading next page...</div>
          ) : null}
          <div className="mt-3 flex items-center justify-between border-t border-gray-200 pt-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
            <button
              type="button"
              onClick={goToPreviousPage}
              disabled={!canGoPrevious || loading}
              className="rounded-md border border-gray-200 bg-white px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Previous
            </button>
            <span>
              Page {currentPage} of {totalPagesLabel}
            </span>
            <button
              type="button"
              onClick={() => {
                void goToNextPage();
              }}
              disabled={!canGoNext || loading || isLoadingMore}
              className="rounded-md border border-gray-200 bg-white px-3 py-1.5 font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <Modal
        open={Boolean(selectedTagName)}
        onClose={closeTagLifecycle}
        title={selectedTagName ? `Tag lifecycle • #${selectedTagName}` : 'Tag lifecycle'}
        size="lg"
        backdropStyle="light"
      >
        {selectedTagLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-12 animate-pulse rounded-xl bg-slate-200/70 dark:bg-white/10"
              />
            ))}
          </div>
        ) : !selectedTagLifecycle ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200">
            Unable to load lifecycle details for this tag.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Canonical tag
                  </div>
                  <div className="font-mono text-lg font-bold text-slate-900 dark:text-white">
                    #{selectedTagLifecycle.name}
                  </div>
                </div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tagStatusClass(selectedLifecycleStatus)}`}
                >
                  {tagStatusLabel(selectedLifecycleStatus)}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Display name
                  </label>
                  <input
                    value={displayNameDraft}
                    onChange={(event) => setDisplayNameDraft(event.target.value)}
                    disabled={!canModerate || selectedTagBusy}
                    placeholder="Optional display label"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-400 disabled:opacity-60 dark:border-white/10 dark:bg-black/20 dark:text-white"
                  />
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <div>
                    Created: {formatDateTime(selectedTagLifecycle.createdAt)}
                  </div>
                  <div className="mt-1">
                    Creator:{' '}
                    {selectedTagLifecycle.createdBy?.brandFullName ||
                      selectedTagLifecycle.createdBy?.username ||
                      selectedTagLifecycle.createdById ||
                      'Unknown'}
                  </div>
                  <div className="mt-1">
                    Last used: {formatDateTime(selectedTagLifecycle.lastUsedAt)}
                  </div>
                  <div className="mt-1">
                    Updated: {formatDateTime(selectedTagLifecycle.updatedAt)}
                  </div>
                </div>
              </div>

              {canModerate ? (
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveDisplayName()}
                    disabled={selectedTagBusy}
                    className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    Save label
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLifecycleStatusChange('PENDING')}
                    disabled={selectedTagBusy}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 ${selectedLifecycleStatus === 'PENDING' ? 'bg-amber-700' : 'bg-amber-600 hover:bg-amber-500'}`}
                  >
                    Set pending
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLifecycleStatusChange('APPROVED')}
                    disabled={selectedTagBusy}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 ${selectedLifecycleStatus === 'APPROVED' ? 'bg-emerald-700' : 'bg-emerald-600 hover:bg-emerald-500'}`}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLifecycleStatusChange('REJECTED')}
                    disabled={selectedTagBusy}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 ${selectedLifecycleStatus === 'REJECTED' ? 'bg-rose-700' : 'bg-rose-600 hover:bg-rose-500'}`}
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </div>

            {lifecycleSummary ? (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 text-xs dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="text-slate-500 dark:text-slate-400">Usage count</div>
                  <div className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                    {selectedTagLifecycle.usageCount}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 text-xs dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="text-slate-500 dark:text-slate-400">Users</div>
                  <div className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                    {lifecycleSummary.users}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 text-xs dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="text-slate-500 dark:text-slate-400">Collections</div>
                  <div className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                    {lifecycleSummary.collections}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 text-xs dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="text-slate-500 dark:text-slate-400">Products</div>
                  <div className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                    {lifecycleSummary.products}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 text-xs dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="text-slate-500 dark:text-slate-400">Entities</div>
                  <div className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                    {lifecycleSummary.entityTotal}
                  </div>
                </div>
              </div>
            ) : null}

            {selectedTagLifecycle.aliasOf ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                This tag is currently aliased to #{selectedTagLifecycle.aliasOf.name}.
              </div>
            ) : null}

            {selectedTagLifecycle.aliases.length > 0 ? (
              <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Aliases pointing here
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedTagLifecycle.aliases.map((alias) => (
                    <span
                      key={alias.name}
                      className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-mono text-slate-700 dark:bg-white/10 dark:text-slate-200"
                    >
                      #{alias.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Top usage actors
                </div>
                <div className="mt-2 max-h-52 overflow-y-auto space-y-1 pr-1">
                  {selectedTagLifecycle.usage.users.length === 0 ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400">No usage actors yet.</div>
                  ) : (
                    selectedTagLifecycle.usage.users.slice(0, 25).map((actor) => (
                      <div
                        key={actor.userId}
                        className="rounded-lg border border-slate-100 bg-white px-2.5 py-2 text-xs dark:border-white/10 dark:bg-black/20"
                      >
                        <div className="font-semibold text-slate-800 dark:text-slate-100">
                          {actor.brandFullName || actor.username || actor.userId}
                        </div>
                        <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                          Used {actor.usageCount} times · Last tagged {formatDate(actor.latestTaggedAt)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Lifecycle timeline
                </div>
                <div className="mt-2 max-h-52 overflow-y-auto space-y-1 pr-1">
                  {selectedTagLifecycle.timeline.length === 0 ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400">No lifecycle events.</div>
                  ) : (
                    selectedTagLifecycle.timeline.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-lg border border-slate-100 bg-white px-2.5 py-2 text-xs dark:border-white/10 dark:bg-black/20"
                      >
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{event.summary}</div>
                        <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                          {formatDateTime(event.at)} · {event.type}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Usage entities
              </div>
              {selectedTagLifecycle.usage.entities.length === 0 ? (
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  No entities found for this tag.
                </div>
              ) : (
                <div className="mt-2 max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200/80 text-left text-slate-500 dark:border-white/10 dark:text-slate-400">
                        <th className="py-2 pr-2">Entity</th>
                        <th className="py-2 pr-2">Type</th>
                        <th className="py-2 pr-2">Usage</th>
                        <th className="py-2">Last tagged</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTagLifecycle.usage.entities.slice(0, 60).map((entity) => (
                        <tr key={`${entity.entityType}:${entity.entityId}`} className="border-b border-slate-100/80 dark:border-white/5">
                          <td className="py-2 pr-2 text-slate-800 dark:text-slate-100">{entity.label}</td>
                          <td className="py-2 pr-2 text-slate-500 dark:text-slate-400">{entity.entityType}</td>
                          <td className="py-2 pr-2 text-slate-700 dark:text-slate-200">{entity.usageCount}</td>
                          <td className="py-2 text-slate-500 dark:text-slate-400">{formatDate(entity.latestTaggedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminTagsPage;
