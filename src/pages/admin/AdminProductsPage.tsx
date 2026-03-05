import React, { useCallback, useEffect, useState } from 'react';
import { adminProductsApi } from '@/api/AdminApi';
import type { AdminProduct } from '@/types/admin';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';

const AdminProductsPage: React.FC = () => {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { hasPermission } = useAdminPermissions();

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      const res = await adminProductsApi.list(params);
      const data = res.data as { items?: AdminProduct[] } | AdminProduct[];
      setProducts(Array.isArray(data) ? data : data.items ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleToggleActive = async (product: AdminProduct) => {
    try {
      await adminProductsApi.moderate(product.id, { isActive: !product.isActive });
      fetchProducts();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update product status');
    }
  };

  const handleToggleFeatured = async (product: AdminProduct) => {
    try {
      await adminProductsApi.moderate(product.id, { isFeatured: !product.isFeatured });
      fetchProducts();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to update product feature flag');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">📦 Products</h1>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search products by name..."
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
                <th className="py-3 px-3">Product</th>
                <th className="py-3 px-3">Brand</th>
                <th className="py-3 px-3">Price</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Featured</th>
                {hasPermission('PRODUCTS_MODERATE') && <th className="py-3 px-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="py-2.5 px-3 font-medium text-gray-900 dark:text-white">{product.name}</td>
                  <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">{product.brand?.name ?? product.brandId}</td>
                  <td className="py-2.5 px-3">{product.currency} {product.salePrice ?? product.price}</td>
                  <td className="py-2.5 px-3">{product.isActive ? '🟢 Active' : '🔴 Inactive'}</td>
                  <td className="py-2.5 px-3">{product.isFeatured ? '⭐ Yes' : '—'}</td>
                  {hasPermission('PRODUCTS_MODERATE') && (
                    <td className="py-2.5 px-3 flex gap-2">
                      <button onClick={() => handleToggleActive(product)} className="text-xs text-primary hover:underline">
                        {product.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => handleToggleFeatured(product)} className="text-xs text-primary hover:underline">
                        {product.isFeatured ? 'Unfeature' : 'Feature'}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">No products found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminProductsPage;
