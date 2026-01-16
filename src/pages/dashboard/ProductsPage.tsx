import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import {
  getBrandProductsForOwner,
  createProduct,
  updateProduct,
  deleteProduct,
  type Product,
  type CreateProductPayload,
} from '@/api/StoreApi';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';

const ProductsPage: React.FC = () => {
  const user = useSelector((s: RootState) => s.user.profile);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<CreateProductPayload>({
    collectionId: '',
    name: '',
    price: 0,
    totalStock: 0,
    description: '',
  });

  const loadProducts = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await getBrandProductsForOwner(user.id, 100);
      const items = (res as any)?.items || (res as any)?.data || [];
      setProducts(items);
    } catch {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createProduct(form);
      toast.success('Product created');
      setForm({ collectionId: '', name: '', price: 0, totalStock: 0, description: '' });
      void loadProducts();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to create product');
    }
  };

  const handleUpdate = async (productId: string, changes: Partial<CreateProductPayload>) => {
    try {
      await updateProduct(productId, changes);
      toast.success('Product updated');
      void loadProducts();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Update failed');
    }
  };

  const handleDelete = async (productId: string) => {
    if (!confirm('Delete this product?')) return;
    try {
      await deleteProduct(productId);
      toast.success('Product deleted');
      void loadProducts();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Create and manage the items in your store.</p>
        </div>
      </div>

      <form onSubmit={handleCreate} className="bg-transparent border border-gray-200/70 dark:border-white/10 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Collection ID"
          value={form.collectionId}
          onChange={(e) => setForm({ ...form, collectionId: e.target.value })}
          required
        />
        <Input
          label="Product name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <Input
          label="Price (NGN)"
          type="number"
          min={0}
          value={form.price}
          onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
          required
        />
        <Input
          label="Total stock"
          type="number"
          min={0}
          value={form.totalStock}
          onChange={(e) => setForm({ ...form, totalStock: Number(e.target.value) })}
          required
        />
        <Textarea
          label="Description"
          className="md:col-span-2"
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <button
          type="submit"
          className="md:col-span-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white"
        >
          <Plus className="w-4 h-4" />
          Add product
        </button>
      </form>

      <div className="bg-transparent rounded-xl border border-gray-200/70 dark:border-white/10 overflow-hidden">
        <div className="p-4 border-b border-gray-200/70 dark:border-white/10 font-medium">Inventory</div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {loading ? (
            <div className="p-6 text-center text-gray-500">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No products yet. Create your first item above.</div>
          ) : (
            products.map((p) => (
              <div key={p.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-sm text-gray-500">Stock: {p.totalStock}</div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm"
                    onClick={() => {
                      const price = Number(prompt('New price', String(p.price)) || p.price);
                      const totalStock = Number(prompt('New stock', String(p.totalStock)) || p.totalStock);
                      handleUpdate(p.id, { price, totalStock });
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 text-red-600"
                    onClick={() => handleDelete(p.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductsPage;
