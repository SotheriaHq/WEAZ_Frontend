import React, { useCallback, useEffect, useState } from 'react';
import { adminTagsApi } from '@/api/AdminApi';
import type { AdminTagItem } from '@/types/admin';

const AdminTagsPage: React.FC = () => {
  const [tags, setTags] = useState<AdminTagItem[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (query.trim().length > 0) {
        const res = await adminTagsApi.search(query, 50);
        setTags(res.data?.items ?? []);
      } else {
        const res = await adminTagsApi.list(100);
        setTags(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  return (
    <div className="space-y-6">
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
        </div>
      )}
    </div>
  );
};

export default AdminTagsPage;
