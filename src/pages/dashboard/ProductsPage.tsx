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
import { Plus, Trash2, Package, Tag, Edit3 } from 'lucide-react';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/Button';

const ProductsPage: React.FC = () => {
  const user = useSelector((s: RootState) => s.user.profile);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'in-stock' | 'low-stock'>('all');
  
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
    setIsCreating(true);
    try {
      await createProduct(form);
      toast.success('Product created successfully');
      setForm({ collectionId: '', name: '', price: 0, totalStock: 0, description: '' });
      void loadProducts();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to create product');
    } finally {
      setIsCreating(false);
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
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await deleteProduct(productId);
      toast.success('Product deleted');
      void loadProducts();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Delete failed');
    }
  };

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { variant: 'error' as const, label: 'Out of Stock' };
    if (stock < 10) return { variant: 'warning' as const, label: 'Low Stock' };
    return { variant: 'success' as const, label: 'In Stock' };
  };

  const filteredProducts = products.filter(p => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'in-stock') return p.totalStock >= 10;
    if (statusFilter === 'low-stock') return p.totalStock < 10;
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-24">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-serif font-bold text-gray-900 dark:text-white tracking-tight">Products</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-base">Manage your store inventory and collections.</p>
        </div>
        <div className="flex items-center gap-3">
           <Button variant="outline" size="sm">
             Export CSV
           </Button>
           <Button variant="primary" size="sm" onClick={() => document.getElementById('create-form')?.scrollIntoView({ behavior: 'smooth' })}>
             <Plus className="w-4 h-4 mr-2" /> New Product
           </Button>
        </div>
      </div>

      {/* Creation Form Card */}
      <Card id="create-form" glass className="p-6 md:p-8" hoverEffect>
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary">
            <Tag className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add New Product</h2>
        </div>

        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <Input
              label="Product Name"
              placeholder="e.g. Summer Linen Shirt"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="bg-white/50 dark:bg-black/20"
            />
          </div>
          
          <Input
            label="Price (NGN)"
            type="number"
            min={0}
            placeholder="0.00"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            required
            className="bg-white/50 dark:bg-black/20"
          />
          
          <Input
            label="Total Stock"
            type="number"
            min={0}
            placeholder="0"
            value={form.totalStock}
            onChange={(e) => setForm({ ...form, totalStock: Number(e.target.value) })}
            required
            className="bg-white/50 dark:bg-black/20"
          />

          <Input
            label="Collection ID"
            placeholder="Collection UUID"
            value={form.collectionId}
            onChange={(e) => setForm({ ...form, collectionId: e.target.value })}
            required
            className="bg-white/50 dark:bg-black/20"
          />
          
          <div className="md:col-span-2">
            <Textarea
              label="Description"
              rows={3}
              placeholder="Describe your product..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="bg-white/50 dark:bg-black/20"
            />
          </div>

          <div className="md:col-span-2 flex justify-end mt-2">
            <Button type="submit" variant="primary" size="lg" isLoading={isCreating}>
              <Plus className="w-5 h-5 mr-2" />
              Create Product
            </Button>
          </div>
        </form>
      </Card>

      {/* Inventory Section */}
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Inventory</h2>
          <div className="flex gap-2">
             {(['all', 'in-stock', 'low-stock'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    statusFilter === filter 
                      ? 'bg-brand-primary text-white shadow-md' 
                      : 'bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/10'
                  }`}
                >
                  {filter.replace('-', ' ').toUpperCase()}
                </button>
             ))}
          </div>
        </div>

        {/* Product List */}
        <Card className="overflow-hidden border-0 shadow-lg bg-white dark:bg-[#111]">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center text-gray-500 gap-4">
              <div className="h-8 w-8 border-2 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin" />
              <p>Loading inventory...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-gray-500 gap-4">
              <div className="h-16 w-16 bg-gray-100 dark:bg-white/5 rounded-full flex items-center justify-center">
                <Package className="w-8 h-8 text-gray-400" />
              </div>
              <p>No products found in this category.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredProducts.map((p, idx) => {
                 const status = getStockStatus(p.totalStock);
                 return (
                  <div 
                    key={p.id} 
                    className="p-4 sm:p-5 group hover:bg-surface-secondary/50 dark:hover:bg-white/5 transition-colors animate-slide-in-from-bottom"
                    style={{ animationDelay: `${idx * 50}ms`, animationFillMode: 'both' }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                      
                      {/* Product Visual Mockup */}
                      <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-white/5 dark:to-white/10 flex items-center justify-center text-gray-400 shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300">
                        <Package className="w-8 h-8 opacity-50" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate">{p.name}</h3>
                          <Badge variant={status.variant} size="sm" dot>
                            {status.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                           <span className="flex items-center gap-1">
                             <Tag className="w-3 h-3" /> 
                             {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(p.price)}
                           </span>
                           <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
                           <span>{p.totalStock} units</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            const newStock = prompt('Update Stock Level:', String(p.totalStock));
                            if (newStock !== null) handleUpdate(p.id, { totalStock: Number(newStock) });
                          }}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10"
                          onClick={() => handleDelete(p.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ProductsPage;
