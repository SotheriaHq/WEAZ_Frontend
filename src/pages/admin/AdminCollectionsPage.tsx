import React, { useCallback, useState } from 'react';
import { adminCollectionsApi } from '@/api/AdminApi';
import type { AdminCollection } from '@/types/admin';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import VLoader from '@/components/loaders/VLoader';
import { unwrapApiResponse } from '@/types/auth';
import useDebounce from '@/hooks/useDebounce';

const AdminCollectionsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 350);
  const { hasPermission } = useAdminPermissions();
  const [confirmAction, setConfirmAction] = useState<{
    title: string; message: string; isDestructive: boolean; action: () => Promise<void>;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const fetchPage = useCallback(
    async (cursor?: string, limit?: number) => {
      const params: Record<string, string> = {};
      if (debouncedSearch) params.q = debouncedSearch;
      if (cursor) params.cursor = cursor;
      if (limit) params.limit = String(limit);
      const res = await adminCollectionsApi.list(params);
      const data = unwrapApiResponse<
        { items?: AdminCollection[]; nextCursor?: string } | AdminCollection[]
      >(res.data as any);
      if (Array.isArray(data)) return { items: data };
      return { items: data.items ?? [], nextCursor: data.nextCursor };
    },
    [debouncedSearch],
  );

  const { items: collections, isLoading: loading, isLoadingMore, hasMore, error, sentinelRef, reset } =
    useInfiniteScroll<AdminCollection>(fetchPage, { limit: 30 });

  const handleVisibilityToggle = (collection: AdminCollection) => {
    const newVis = collection.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC';
    const action = newVis === 'PUBLIC' ? 'REPUBLISH' : 'UNPUBLISH';
    setConfirmAction({
      title: `Set collection to ${newVis}?`,
      message: `"${collection.title ?? 'Untitled'}" will be ${newVis === 'PUBLIC' ? 'visible to everyone' : 'hidden from the public'}.`,
      isDestructive: newVis === 'PRIVATE',
      action: async () => {
        await adminCollectionsApi.moderate(collection.id, { action });
        toast.success(`Collection set to ${newVis.toLowerCase()}`);
        reset();
      },
    });
  };

  const executeConfirm = async () => {
    if (!confirmAction) return;
    setConfirmLoading(true);
    try {
      await confirmAction.action();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Action failed');
    } finally {
      setConfirmLoading(false);
      setConfirmAction(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-purple-200/40 bg-gradient-to-br from-white/95 via-[#f8f3ff] to-[#efe6ff] p-5 shadow-md shadow-purple-500/10 dark:border-white/10 dark:from-white/10 dark:via-[#140c1d] dark:to-[#1a1026]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">🗂️ Collections</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage store collections across all brands
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 dark:bg-purple-500/20 px-3 py-1 text-xs font-semibold text-purple-700 dark:text-purple-300">
              {collections.length} loaded
            </span>
          </div>
        </div>
      </section>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search collections by title..."
            className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 dark:border-white/10 dark:bg-black/20 dark:text-white"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-28 animate-pulse rounded-2xl bg-gray-200/70 dark:bg-white/10" />
          ))}
        </div>
      ) : collections.length === 0 ? (
        <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-10 text-center dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-3xl">🗂️</p>
          <h3 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">No collections found</h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Try adjusting your search query.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200/80 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-gray-200/80 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Visibility</th>
                {hasPermission('COLLECTIONS_MODERATE') && <th className="px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {collections.map((collection) => (
                <tr key={collection.id} className="border-b border-gray-100/90 transition-colors hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-gray-900 dark:text-white">{collection.title ?? 'Untitled'}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{collection.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{collection.owner?.email ?? collection.ownerId}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      collection.status === 'PUBLISHED'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                    }`}>
                      {collection.status === 'PUBLISHED' ? '✅' : '📝'} {collection.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      collection.visibility === 'PUBLIC'
                        ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
                        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-300'
                    }`}>
                      {collection.visibility === 'PUBLIC' ? '🟢 Public' : '🟡 Private'}
                    </span>
                  </td>
                  {hasPermission('COLLECTIONS_MODERATE') && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleVisibilityToggle(collection)}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 transition-colors"
                      >
                        Toggle Visibility
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {isLoadingMore && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500">
              <VLoader size={16} phase="loading" showLabel={false} />
              Loading more...
            </div>
          )}
          {hasMore && <div ref={sentinelRef} className="h-4" />}
          {!hasMore && collections.length > 0 && (
            <p className="py-3 text-center text-xs text-gray-400 dark:text-gray-500">End of list</p>
          )}
        </div>
      )}
      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title}
        message={confirmAction?.message}
        isDestructive={confirmAction?.isDestructive}
        isLoading={confirmLoading}
        onConfirm={executeConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};

export default AdminCollectionsPage;
