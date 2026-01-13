import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  List,
  Grid,
  Plus,
  Archive,
  Edit,
  Trash2,
  Copy,
  ChevronLeft,
  ChevronRight,
  Box,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MediaRenderer from '@/components/media/MediaRenderer';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { apiClient } from '@/api/httpClient';
import { brandApi } from '@/api/BrandApi';
import { productApi } from '@/api/ProductApi';
import { toast } from 'sonner';

type StudioStatus = 'ACTIVE' | 'DRAFT';

interface BackendProduct {
  id: string;
  name: string;
  price: number;
  salePrice?: number | null;
  totalStock: number;
  isActive: boolean;
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

const StoreProductsPanel: React.FC = () => {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.user.profile);

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
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

  const selectAll = () => {
    const allIds = filteredProducts.map((p) => p.id);
    if (selectedProducts.length === allIds.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(allIds);
    }
  };

  const getStatusColor = (status: StudioStatus) => {
    const colors = {
      ACTIVE: 'bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30',
      DRAFT: 'bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/30',
    };
    return colors[status] || colors.DRAFT;
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

        const items = Array.isArray(productsRes.data?.items)
          ? (productsRes.data.items as BackendProduct[])
          : [];
        setProducts(items);
        setTotal(typeof productsRes.data?.total === 'number' ? productsRes.data.total : items.length);

        const nextCursor = productsRes.data?.nextCursor;
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

    const items = Array.isArray(productsRes.data?.items)
      ? (productsRes.data.items as BackendProduct[])
      : [];
    setProducts(items);
    setTotal(typeof productsRes.data?.total === 'number' ? productsRes.data.total : items.length);

    const nextCursor = productsRes.data?.nextCursor;
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
      {/* Action Bar */}
      <div className="mb-6 backdrop-blur-xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 shadow-xl">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name or ID..."
                className="w-full bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl pl-12 pr-4 py-3 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'draft')}
              className="bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
            </select>

            <select
              value={filterCollection}
              onChange={(e) => setFilterCollection(e.target.value)}
              className="bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all cursor-pointer"
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
              className="bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all cursor-pointer"
            >
              <option value="all">All Stock</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>

            <div className="flex bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-4 py-3 transition-all ${viewMode === 'list' ? 'bg-purple-600 text-white' : 'text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-4 py-3 transition-all border-l border-gray-200 dark:border-white/10 ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => navigate('/studio/store/products/new')}
              className="bg-gradient-to-r from-purple-600 to-purple-800 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/30 transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Product</span>
            </button>
          </div>
        </div>

        {showBulkActions && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10 flex flex-wrap items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <span className="text-gray-600 dark:text-gray-300">{selectedProducts.length} selected</span>
            <button
              type="button"
              onClick={handleArchiveSelected}
              disabled={saving}
              className="bg-gray-50 dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-all text-sm flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Archive className="w-4 h-4" /> Archive Selected
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={saving}
              className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg hover:bg-red-500/20 transition-all text-sm flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        )}
      </div>

      {/* Products */}
      <div className="backdrop-blur-xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden">
        {viewMode === 'list' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5">
                  <th className="text-left p-4 w-12">
                    <input
                      type="checkbox"
                      onChange={selectAll}
                      checked={filteredProducts.length > 0 && selectedProducts.length === filteredProducts.length}
                      className="w-5 h-5 rounded border-gray-300 dark:border-white/20 bg-gray-100 dark:bg-[#1a1a1a] text-purple-600 focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
                    />
                  </th>
                  <th className="text-left p-4 text-gray-500 dark:text-gray-400 font-semibold text-sm uppercase tracking-wider">Product</th>
                  <th className="text-left p-4 text-gray-500 dark:text-gray-400 font-semibold text-sm uppercase tracking-wider hidden md:table-cell">Collection</th>
                  <th className="text-left p-4 text-gray-500 dark:text-gray-400 font-semibold text-sm uppercase tracking-wider">Price</th>
                  <th className="text-left p-4 text-gray-500 dark:text-gray-400 font-semibold text-sm uppercase tracking-wider hidden lg:table-cell">Stock</th>
                  <th className="text-left p-4 text-gray-500 dark:text-gray-400 font-semibold text-sm uppercase tracking-wider">Status</th>
                  <th className="text-right p-4 text-gray-500 dark:text-gray-400 font-semibold text-sm uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const status: StudioStatus = product.isActive ? 'ACTIVE' : 'DRAFT';
                  const collectionLabel =
                    product.collection?.title ||
                    collections.find((c) => c.id === product.collectionId)?.name ||
                    '—';

                  return (
                    <tr
                      key={product.id}
                      className={`border-b border-gray-200 dark:border-white/5 hover:bg-purple-50 dark:hover:bg-purple-500/5 transition-all cursor-pointer group ${
                        selectedProducts.includes(product.id)
                          ? 'border-l-4 border-l-purple-600 bg-purple-50/50 dark:bg-purple-500/10'
                          : ''
                      }`}
                    >
                      <td className="p-4">
                        <input
                          type="checkbox"
                          checked={selectedProducts.includes(product.id)}
                          onChange={() => toggleSelect(product.id)}
                          className="w-5 h-5 rounded border-gray-300 dark:border-white/20 bg-gray-100 dark:bg-[#1a1a1a] text-purple-600 focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
                        />
                      </td>

                      <td className="p-4">
                        <div className="flex items-center gap-4">
                          {product.thumbnail || product.images?.[0] ? (
                            <MediaRenderer
                              kind="image"
                              src={(product.thumbnail || product.images?.[0]) as string}
                              alt={product.name}
                              maxHeightClassName="max-h-16"
                              maxWidthClassName="max-w-16"
                              className="rounded-lg border border-gray-200 dark:border-white/10"
                              mediaClassName="rounded-lg"
                            />
                          ) : (
                            <div className="h-16 w-16 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                              <Box className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white mb-1">{product.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{product.id}</div>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 text-gray-600 dark:text-gray-300 hidden md:table-cell">{collectionLabel}</td>

                      <td className="p-4">
                        <div className="font-semibold text-gray-900 dark:text-white">${product.price.toFixed(2)}</div>
                        {typeof product.salePrice === 'number' && product.salePrice > 0 && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">Sale ${product.salePrice.toFixed(2)}</div>
                        )}
                      </td>

                      <td className="p-4 hidden lg:table-cell">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-900 dark:text-white font-medium">{product.totalStock ?? 0}</span>
                          {(product.totalStock ?? 0) > 0 && (product.totalStock ?? 0) <= 5 && (
                            <span className="px-2 py-1 bg-orange-100 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-xs rounded-full border border-orange-200 dark:border-orange-500/30">Low</span>
                          )}
                          {(product.totalStock ?? 0) === 0 && (
                            <span className="px-2 py-1 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 text-xs rounded-full border border-red-200 dark:border-red-500/30">Out</span>
                          )}
                        </div>
                      </td>

                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border inline-block ${getStatusColor(status)}`}>
                          {status}
                        </span>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/studio/store/products/${product.id}/edit`)}
                            disabled={saving}
                            className="p-2 text-gray-500 dark:text-gray-300 hover:text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-500/10 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicate(product.id)}
                            disabled={saving}
                            className="p-2 text-gray-500 dark:text-gray-300 hover:text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-400/10 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(product.id)}
                            disabled={saving}
                            className="p-2 text-gray-500 dark:text-gray-300 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-400/10 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product) => {
                const status: StudioStatus = product.isActive ? 'ACTIVE' : 'DRAFT';
                const collectionLabel =
                  product.collection?.title ||
                  collections.find((c) => c.id === product.collectionId)?.name ||
                  '—';

                return (
                  <div
                    key={product.id}
                    className={`bg-white/60 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 shadow-sm transition-all ${
                      selectedProducts.includes(product.id)
                        ? 'ring-2 ring-purple-500/30'
                        : 'hover:bg-purple-50 dark:hover:bg-purple-500/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(product.id)}
                        onChange={() => toggleSelect(product.id)}
                        className="mt-1 w-5 h-5 rounded border-gray-300 dark:border-white/20 bg-gray-100 dark:bg-[#1a1a1a] text-purple-600 focus:ring-2 focus:ring-purple-500/20 cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          {product.thumbnail || product.images?.[0] ? (
                            <MediaRenderer
                              kind="image"
                              src={(product.thumbnail || product.images?.[0]) as string}
                              alt={product.name}
                              maxHeightClassName="max-h-16"
                              maxWidthClassName="max-w-16"
                              className="rounded-lg border border-gray-200 dark:border-white/10"
                              mediaClassName="rounded-lg"
                            />
                          ) : (
                            <div className="h-16 w-16 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                              <Box className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-white truncate">{product.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 truncate">{collectionLabel}</div>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white">${product.price.toFixed(2)}</div>
                            {typeof product.salePrice === 'number' && product.salePrice > 0 && (
                              <div className="text-sm text-gray-500 dark:text-gray-400">Sale ${product.salePrice.toFixed(2)}</div>
                            )}
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border inline-block ${getStatusColor(status)}`}>
                            {status}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Stock:{' '}
                            <span className="text-gray-900 dark:text-white font-semibold">{product.totalStock ?? 0}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/studio/store/products/${product.id}/edit`)}
                              disabled={saving}
                              className="p-2 text-gray-500 dark:text-gray-300 hover:text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-500/10 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicate(product.id)}
                              disabled={saving}
                              className="p-2 text-gray-500 dark:text-gray-300 hover:text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-400/10 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(product.id)}
                              disabled={saving}
                              className="p-2 text-gray-500 dark:text-gray-300 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-400/10 rounded-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
              <Plus className="w-4 h-4" />
              Add Your First Product
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreProductsPanel;
