import React, { useEffect, useState, useCallback } from 'react';
import { adminBrandsApi } from '@/api/AdminApi';
import type { AdminBrand } from '@/types/admin';

const AdminBrandsPage: React.FC = () => {
  const [brands, setBrands] = useState<AdminBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      const res = await adminBrandsApi.list(params);
      const data = res.data as { items?: AdminBrand[] } | AdminBrand[];
      setBrands(Array.isArray(data) ? data : data.items ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load brands');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🏷️ Brands</h1>

      <input
        type="text"
        placeholder="Search brands..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
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
                <th className="py-3 px-3">Brand</th>
                <th className="py-3 px-3">Email</th>
                <th className="py-3 px-3">Store</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((brand) => (
                <tr key={brand.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-white">{brand.name || '—'}</td>
                  <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">{brand.owner?.email ?? '—'}</td>
                  <td className="py-2.5 px-3">
                    {brand.isStoreOpen ? '🟢 Open' : '🔴 Closed'}
                  </td>
                  <td className="py-2.5 px-3">{brand.owner?.status ?? '—'}</td>
                  <td className="py-2.5 px-3">
                    <button className="text-primary hover:underline text-xs">View</button>
                  </td>
                </tr>
              ))}
              {brands.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">No brands found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminBrandsPage;
