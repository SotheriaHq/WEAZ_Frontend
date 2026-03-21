import React, { useCallback, useState } from 'react';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import { adminTagsApi } from '@/api/AdminApi';
import type { AdminTagItem } from '@/types/admin';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { unwrapApiResponse } from '@/types/auth';
import useDebounce from '@/hooks/useDebounce';

const AdminTagsPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query.trim(), 350);

  const fetchPage = useCallback(
    async (cursor?: string, limit?: number) => {
      if (debouncedQuery.length > 0) {
        const res = await adminTagsApi.search(debouncedQuery, limit ?? 50);
        const data = unwrapApiResponse<{ items?: AdminTagItem[] }>(res.data as any);
        return { items: data?.items ?? [] };
      }
      const params: Record<string, string | number> = {};
      if (cursor) params.cursor = cursor;
      if (limit) params.limit = limit;
      const res = await adminTagsApi.list(params);
      const data = unwrapApiResponse<
        { items?: AdminTagItem[]; nextCursor?: string } | AdminTagItem[]
      >(res.data as any);
      if (Array.isArray(data)) return { items: data };
      return { items: data.items ?? [], nextCursor: data.nextCursor };
    },
    [debouncedQuery],
  );

  const { items: tags, isLoading: loading, isLoadingMore, hasMore, error, sentinelRef } =
    useInfiniteScroll<AdminTagItem>(fetchPage, { limit: 50 });

  return (
    <div className="space-y-6">
      <AdminBreadcrumb segments={[{ label: 'Tags' }]} />
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🏷️ Tags</h1>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search tags..."
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
                <th className="py-3 px-3">Tag</th>
                <th className="py-3 px-3">Usage Count</th>
              </tr>
            </thead>
            <tbody>
              {tags.map((tag) => (
                <tr key={tag.name} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2.5 px-3 font-mono text-sm text-gray-900 dark:text-white">#{tag.name}</td>
                  <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">{tag.usageCount}</td>
                </tr>
              ))}
              {tags.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-8 text-center text-gray-500">No tags found</td>
                </tr>
              )}
            </tbody>
          </table>
          {isLoadingMore && <div className="text-center text-gray-500 text-sm py-4">Loading more...</div>}
          {hasMore && <div ref={sentinelRef} />}
          {!hasMore && tags.length > 0 && <div className="text-center text-gray-400 text-xs py-4">End of list</div>}
        </div>
      )}
    </div>
  );
};

export default AdminTagsPage;
