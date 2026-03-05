import React, { useCallback, useEffect, useState } from 'react';
import { adminTaxonomyApi } from '@/api/AdminApi';
import type { AdminCategory } from '@/types/admin';

const AdminTaxonomyPage: React.FC = () => {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminTaxonomyApi.listCategories();
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load taxonomy data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🧬 Taxonomy</h1>
      {error && <div className="text-red-500 text-sm">{error}</div>}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Slug</th>
                <th className="py-3 px-3">Active</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-white">{category.name}</td>
                  <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">{category.slug ?? '—'}</td>
                  <td className="py-2.5 px-3">{category.isActive === false ? '🔴 No' : '🟢 Yes'}</td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-gray-500">No categories found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminTaxonomyPage;
