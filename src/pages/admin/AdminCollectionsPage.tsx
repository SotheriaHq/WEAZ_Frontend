import React, { useCallback, useEffect, useState } from 'react';
import { adminCollectionsApi } from '@/api/AdminApi';
import type { AdminCollection } from '@/types/admin';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';

const AdminCollectionsPage: React.FC = () => {
  const [collections, setCollections] = useState<AdminCollection[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { hasPermission } = useAdminPermissions();

  const fetchCollections = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      const res = await adminCollectionsApi.list(params);
      const data = res.data as { items?: AdminCollection[] } | AdminCollection[];
      setCollections(Array.isArray(data) ? data : data.items ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load collections');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchCollections();
  }, [fetchCollections]);

  const handleVisibilityToggle = async (collection: AdminCollection) => {
    try {
      await adminCollectionsApi.moderate(collection.id, {
        visibility: collection.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC',
      });
      fetchCollections();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update collection visibility');
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
        </div>
      )}
    </div>
  );
};

export default AdminCollectionsPage;
