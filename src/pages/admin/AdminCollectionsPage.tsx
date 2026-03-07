import React, { useCallback, useEffect, useState } from 'react';
import { adminCollectionsApi } from '@/api/AdminApi';
import type { AdminCollection } from '@/types/admin';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from 'sonner';
import { unwrapApiResponse } from '@/types/auth';

const AdminCollectionsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const { hasPermission } = useAdminPermissions();
  const [confirmAction, setConfirmAction] = useState<{
    title: string; message: string; isDestructive: boolean; action: () => Promise<void>;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(handle);
  }, [search]);

  const fetchPage = useCallback(
    async (cursor?: string, limit?: number) => {
      const params: Record<string, string> = {};
      if (debouncedSearch) params.search = debouncedSearch;
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
    setConfirmAction({
      title: `Set collection to ${newVis}?`,
      message: `"${collection.title ?? 'Untitled'}" will be ${newVis === 'PUBLIC' ? 'visible to everyone' : 'hidden from the public'}.`,
      isDestructive: newVis === 'PRIVATE',
      action: async () => {
        await adminCollectionsApi.moderate(collection.id, { visibility: newVis });
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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🗂️ Collections</h1>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search collections by title..."
        className="w-full max-w-md px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
      />

      {error && <div className="text-red-500 text-sm">{error}</div>}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                <th className="py-3 px-3">Title</th>
                <th className="py-3 px-3">Owner</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Visibility</th>
                {hasPermission('COLLECTIONS_MODERATE') && <th className="py-3 px-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {collections.map((collection) => (
                <tr key={collection.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-white">{collection.title ?? 'Untitled'}</td>
                  <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">{collection.owner?.email ?? collection.ownerId}</td>
                  <td className="py-2.5 px-3">{collection.status}</td>
                  <td className="py-2.5 px-3">{collection.visibility === 'PUBLIC' ? '🟢 Public' : '🟡 Private'}</td>
                  {hasPermission('COLLECTIONS_MODERATE') && (
                    <td className="py-2.5 px-3">
                      <button onClick={() => handleVisibilityToggle(collection)} className="text-xs text-primary hover:underline">
                        Toggle Visibility
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {collections.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">No collections found</td>
                </tr>
              )}
            </tbody>
          </table>
          {isLoadingMore && <div className="text-center text-gray-500 text-sm py-4">Loading more...</div>}
          {hasMore && <div ref={sentinelRef} />}
          {!hasMore && collections.length > 0 && <div className="text-center text-gray-400 text-xs py-4">End of list</div>}
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
