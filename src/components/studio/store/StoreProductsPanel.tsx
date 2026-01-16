import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  ChevronLeft,
  ChevronRight,
  Copy,
  GripVertical,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MediaRenderer from '@/components/media/MediaRenderer';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { apiClient } from '@/api/httpClient';
import { brandApi } from '@/api/BrandApi';
import { productApi } from '@/api/ProductApi';
import { toast } from 'sonner';
import Input from '@/components/ui/Input';
import { unwrapApiResponse } from '@/types/auth';

type StudioStatus = 'ACTIVE' | 'DRAFT';

interface BackendProduct {
  id: string;
  name: string;
  price: number;
  salePrice?: number | null;
  totalStock: number;
  isActive: boolean;
  isFeatured?: boolean;
  thumbnail?: string | null;
  images?: string[];
  collectionId?: string;
  collection?: { id: string; title: string };
}

interface ProductsResponse {
  items: BackendProduct[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  nextCursor?: string | null;
}

interface CollectionOption {
  id: string;
  name: string;
}

interface StoreProductsPanelProps {
  layoutMode?: boolean;
}

const StoreProductsPanel: React.FC<StoreProductsPanelProps> = ({ layoutMode = false }) => {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.user.profile);

  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'draft'>('all');
  const [filterCollection, setFilterCollection] = useState<'all' | string>('all');
  const [filterStock, setFilterStock] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const [products, setProducts] = useState<BackendProduct[]>([]);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);

  const [cursorByPage, setCursorByPage] = useState<Record<number, string | null | undefined>>({});

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const toggleSelect = (id: string) => {
    if (selectedProducts.includes(id)) {
      setSelectedProducts(selectedProducts.filter((p) => p !== id));
    } else {
      setSelectedProducts([...selectedProducts, id]);
    }
  };

  const showBulkActions = selectedProducts.length > 0;

  const filteredProducts = useMemo(() => {
    let items = products;

    if (filterStatus !== 'all') {
      items = items.filter((p) => (filterStatus === 'active' ? p.isActive : !p.isActive));
    }

    if (filterCollection !== 'all') {
      items = items.filter((p) => p.collectionId === filterCollection);
    }

    if (filterStock === 'in_stock') items = items.filter((p) => (p.totalStock ?? 0) > 0);
    if (filterStock === 'out_of_stock') items = items.filter((p) => (p.totalStock ?? 0) === 0);
    if (filterStock === 'low_stock') items = items.filter((p) => (p.totalStock ?? 0) > 0 && (p.totalStock ?? 0) <= 5);

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter(
        (p) => (p.name || '').toLowerCase().includes(q) || p.id.toLowerCase().includes(q),
      );
    }

    return items;
  }, [filterCollection, filterStatus, filterStock, products, searchQuery]);

  useEffect(() => {
    setCursorByPage({});
    setPage(1);
  }, [filterCollection, filterStatus, limit, searchQuery, user?.id]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        const cursor = page > 1 ? cursorByPage[page] : undefined;

        const [collectionsRes, productsRes] = await Promise.all([
          brandApi.getCollections(user.id, { visibility: 'all' }),
          apiClient.get<Partial<ProductsResponse>>(`/brands/${user.id}/products`, {
            params: {
              page,
              limit,
              sortBy: 'newest',
              cursor: cursor ?? undefined,
              search: searchQuery.trim() ? searchQuery.trim() : undefined,
              collectionId: filterCollection !== 'all' ? filterCollection : undefined,
              isActive:
                filterStatus === 'active'
                  ? true
                  : filterStatus === 'draft'
                    ? false
                    : undefined,
            },
          }),
        ]);

        if (!mounted) return;

        const mappedCollections: CollectionOption[] = (collectionsRes || []).map((c: any) => ({
          id: String(c.id),
          name: String(c.title || c.name || 'Untitled collection'),
        }));
        setCollections(mappedCollections);

        const productsPayload = unwrapApiResponse<Partial<ProductsResponse>>(productsRes.data);
        const items = Array.isArray(productsPayload?.items)
          ? (productsPayload.items as BackendProduct[])
          : [];
        setProducts(items);
        setTotal(typeof productsPayload?.total === 'number' ? productsPayload.total : items.length);

        const nextCursor = productsPayload?.nextCursor;
        if (typeof nextCursor === 'string' && nextCursor.length > 0) {
          setCursorByPage((prev) => ({ ...prev, [page + 1]: nextCursor }));
        }
      } catch (e) {
        const message = (e as any)?.response?.data?.message ?? 'Failed to load products';
        toast.error(typeof message === 'string' ? message : 'Failed to load products');
        if (!mounted) return;
        setProducts([]);
        setTotal(0);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [filterCollection, filterStatus, limit, page, searchQuery, user?.id]);

  const refresh = async () => {
    if (!user?.id) return;
    const cursor = page > 1 ? cursorByPage[page] : undefined;
    const productsRes = await apiClient.get<Partial<ProductsResponse>>(`/brands/${user.id}/products`, {
      params: {
        page,
        limit,
        sortBy: 'newest',
        cursor: cursor ?? undefined,
        search: searchQuery.trim() ? searchQuery.trim() : undefined,
        collectionId: filterCollection !== 'all' ? filterCollection : undefined,
        isActive:
          filterStatus === 'active'
            ? true
            : filterStatus === 'draft'
              ? false
              : undefined,
      },
    });

    const productsPayload = unwrapApiResponse<Partial<ProductsResponse>>(productsRes.data);
    const items = Array.isArray(productsPayload?.items)
      ? (productsPayload.items as BackendProduct[])
      : [];
    setProducts(items);
    setTotal(typeof productsPayload?.total === 'number' ? productsPayload.total : items.length);

    const nextCursor = productsPayload?.nextCursor;
    if (typeof nextCursor === 'string' && nextCursor.length > 0) {
      setCursorByPage((prev) => ({ ...prev, [page + 1]: nextCursor }));
    }
  };

  const handleDelete = async (productId: string) => {
    if (!window.confirm('Delete this product? This cannot be undone.')) return;
    setSaving(true);
    try {
      await productApi.deleteProduct(productId);
      toast.success('Product deleted');
      await refresh();
      setSelectedProducts([]);
    } catch (e) {
      const message = (e as any)?.response?.data?.message ?? 'Failed to delete product';
      toast.error(typeof message === 'string' ? message : 'Failed to delete product');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (productId: string) => {
    setSaving(true);
    try {
      const duplicated = await productApi.duplicateProduct(productId);
      toast.success('Product duplicated');
      navigate(`/studio/store/products/${duplicated.id}/edit`);
    } catch (e) {
      const message = (e as any)?.response?.data?.message ?? 'Failed to duplicate product';
      toast.error(typeof message === 'string' ? message : 'Failed to duplicate product');
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveSelected = async () => {
    if (!selectedProducts.length) return;
    setSaving(true);
    try {
      await Promise.all(selectedProducts.map((id) => productApi.updateProduct(id, { status: 'ARCHIVED' as any })));
      toast.success('Products archived');
      await refresh();
      setSelectedProducts([]);
    } catch {
      toast.error('Failed to archive selected products');
    } finally {
      setSaving(false);
    }
  };

  const handleUnpublishSelected = async () => {
    if (!selectedProducts.length) return;
    setSaving(true);
    try {
      await Promise.all(selectedProducts.map((id) => productApi.updateProduct(id, { status: 'DRAFT' as any })));
      toast.success('Products unpublished');
      await refresh();
      setSelectedProducts([]);
    } catch {
      toast.error('Failed to unpublish selected products');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedProducts.length) return;
    if (!window.confirm('Delete selected products? This cannot be undone.')) return;
    setSaving(true);
    try {
      await Promise.all(selectedProducts.map((id) => productApi.deleteProduct(id)));
      toast.success('Products deleted');
      await refresh();
      setSelectedProducts([]);
    } catch {
      toast.error('Failed to delete selected products');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-6 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-white/5 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Products</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage your catalog and draft inventory.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'draft')}
              className="rounded-lg border border-gray-200 dark:border-white/10 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm"
            >
              <option value="all">All Products</option>
              <option value="active">Published</option>
              <option value="draft">Draft</option>
            </select>
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              inputSize="sm"
              startIcon={<Search className="h-4 w-4" />}
              className="w-64"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            value={filterCollection}
            onChange={(e) => setFilterCollection(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-white/10 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm"
          >
            <option value="all">All Collections</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={filterStock}
            onChange={(e) => setFilterStock(e.target.value)}
            className="rounded-lg border border-gray-200 dark:border-white/10 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm"
          >
            <option value="all">All Stock</option>
            <option value="in_stock">In Stock</option>
            <option value="low_stock">Low Stock</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>
        </div>
      </div>

      {/* Products */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-white/5 shadow-lg overflow-hidden">
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => {
              const status: StudioStatus = product.isActive ? 'ACTIVE' : 'DRAFT';
              const collectionLabel =
                product.collection?.title ||
                collections.find((c) => c.id === product.collectionId)?.name ||
                '—';

              return (
                <div
                  key={product.id}
                  className={`group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white shadow-sm transition-all ${
                    selectedProducts.includes(product.id)
                      ? 'ring-2 ring-purple-500/30'
                      : 'hover:shadow-lg'
                  } ${layoutMode ? 'cursor-move' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={selectedProducts.includes(product.id)}
                    onChange={() => toggleSelect(product.id)}
                    className="absolute left-4 top-4 z-10 h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500/30"
                  />
                  <button
                    type="button"
                    className={`absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-white shadow ${product.isFeatured ? 'bg-yellow-400' : 'bg-gray-300'}`}
                    aria-label="Featured"
                  >
                    <Star className="h-4 w-4" />
                  </button>
                  {layoutMode && (
                    <div className="absolute bottom-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow">
                      <GripVertical className="h-4 w-4" />
                    </div>
                  )}

                  <div className="relative">
                    {product.thumbnail || product.images?.[0] ? (
                      <MediaRenderer
                        kind="image"
                        src={(product.thumbnail || product.images?.[0]) as string}
                        alt={product.name}
                        className="h-full w-full"
                        mediaClassName="h-72 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-72 w-full items-center justify-center bg-gray-100">
                        <Box className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => navigate(`/studio/store/products/${product.id}/edit`)}
                        className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-purple-700"
                      >
                        ✏️ Edit Product
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    <div className="flex items-center justify-between">
                      {product.isFeatured ? (
                        <span className="rounded-full bg-purple-50 px-2 py-1 text-xs font-semibold text-purple-700">Featured</span>
                      ) : (
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${status === 'DRAFT' ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-700'}`}>
                          {status === 'DRAFT' ? 'Draft' : 'Published'}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">Stock: {product.totalStock ?? 0}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{product.name}</h3>
                      <p className="text-xs text-gray-500 line-clamp-1">{collectionLabel}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-base font-bold text-gray-900">₦{product.price.toFixed(2)}</div>
                        {typeof product.salePrice === 'number' && product.salePrice > 0 && (
                          <div className="text-xs text-gray-500">Sale ₦{product.salePrice.toFixed(2)}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDuplicate(product.id)}
                          disabled={saving}
                          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-blue-600 disabled:opacity-60"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(product.id)}
                          disabled={saving}
                          className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pagination */}
        <div className="border-t border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-gray-500 dark:text-gray-400 text-sm">Items per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  const next = parseInt(e.target.value, 10);
                  setPage(1);
                  setLimit(Number.isFinite(next) ? next : 25);
                }}
                className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="text-gray-500 dark:text-gray-400 text-sm">
              Showing{' '}
              <span className="text-gray-900 dark:text-white font-semibold">
                {total === 0 ? 0 : (page - 1) * limit + 1}-{Math.min(page * limit, total)}
              </span>{' '}
              of <span className="text-gray-900 dark:text-white font-semibold">{total}</span> products
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="p-2 px-3 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((pnum) => {
                  if (totalPages <= 5) return true;
                  return Math.abs(pnum - page) <= 2;
                })
                .slice(0, 5)
                .map((pnum) => (
                  <button
                    type="button"
                    key={pnum}
                    onClick={() => setPage(pnum)}
                    disabled={loading}
                    className={
                      pnum === page
                        ? 'p-2 px-4 bg-purple-600 text-white rounded-lg font-semibold shadow-md shadow-purple-500/20'
                        : 'p-2 px-4 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-all'
                    }
                  >
                    {pnum}
                  </button>
                ))}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || loading}
                className="p-2 px-3 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {!loading && products.length === 0 && (
        <div className="backdrop-blur-xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl p-12 text-center mt-6">
          <div className="max-w-md mx-auto">
            <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-purple-500/20 to-purple-700/20 rounded-full flex items-center justify-center border border-purple-500/30">
              <Box className="w-12 h-12 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">No products yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Add your first product to your store.</p>
            <button
              type="button"
              onClick={() => navigate('/studio/store/products/new')}
              className="bg-gradient-to-r from-purple-600 to-purple-800 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/30 transition-all inline-flex items-center gap-2"
            >
              Add Your First Product
            </button>
          </div>
        </div>
      )}

      {showBulkActions && (
        <div className="fixed bottom-8 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full bg-purple-600 px-6 py-3 text-sm font-semibold text-white shadow-2xl">
          <span>{selectedProducts.length} selected</span>
          <div className="h-5 w-px bg-white/30" />
          <button
            type="button"
            onClick={() => {
              if (selectedProducts[0]) navigate(`/studio/store/products/${selectedProducts[0]}/edit`);
            }}
            className="hover:text-purple-200"
          >
            ✏️ Edit selected
          </button>
          <button type="button" onClick={handleDeleteSelected} className="hover:text-purple-200">
            🗑️ Delete
          </button>
          <button type="button" onClick={handleArchiveSelected} className="hover:text-purple-200">
            📦 Archive
          </button>
          <button type="button" onClick={handleUnpublishSelected} className="hover:text-purple-200">
            📥 Unpublish
          </button>
        </div>
      )}
    </div>
  );
};

export default StoreProductsPanel;
