import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { apiClient } from '@/api/httpClient';
import { brandApi } from '@/api/BrandApi';
import { productApi } from '@/api/ProductApi';
import { toast } from 'sonner';
import Input from '@/components/ui/Input';
import { unwrapApiResponse } from '@/types/auth';
import { useDropdownManager } from '@/context/DropdownManagerContext';
import {
  DeleteProductModal,
  ArchiveProductModal,
  ComingSoonModal,
  ProductActionsMenu,
  getDefaultProductActions,
  RestoreDeletedProductModal,
  PermanentDeleteProductModal,
} from './modals';
import ImageWithFallback from '@/components/ImageWithFallback';

type StudioStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED' | 'DELETED';

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
  media?: Array<{ id: string; url: string; type: string; isPrimary?: boolean }>;
  mediaIds?: string[];
  collectionId?: string;
  collection?: { id: string; title: string };
  archivedAt?: string | null;
  archiveExpiresAt?: string | null;
  deletedAt?: string | null;
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
  const dropdownManager = useDropdownManager();

  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'draft' | 'archived' | 'deleted'>('all');
  const [filterCollection, setFilterCollection] = useState<'all' | string>('all');
  const [filterStock, setFilterStock] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const [products, setProducts] = useState<BackendProduct[]>([]);
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);

  const [cursorByPage, setCursorByPage] = useState<Record<number, string | null | undefined>>({});

  // Modal state
  const [deleteModalProduct, setDeleteModalProduct] = useState<BackendProduct | null>(null);
  const [archiveModalProduct, setArchiveModalProduct] = useState<BackendProduct | null>(null);
  const [archiveMode, setArchiveMode] = useState<'archive' | 'unarchive'>('archive');
  const [comingSoonModal, setComingSoonModal] = useState<{ open: boolean; feature?: string; description?: string }>({ open: false });
  const [restoreModalProduct, setRestoreModalProduct] = useState<BackendProduct | null>(null);
  const [permanentDeleteProduct, setPermanentDeleteProduct] = useState<BackendProduct | null>(null);
  const [draftReminderProduct, setDraftReminderProduct] = useState<BackendProduct | null>(null);
  
  const listRef = useRef<HTMLDivElement | null>(null);
  const [listMinHeight, setListMinHeight] = useState<number | undefined>(undefined);

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
      if (filterStatus === 'archived') {
        items = items.filter((p) => !!p.archivedAt && !p.deletedAt);
      } else if (filterStatus === 'deleted') {
        items = items.filter((p) => !!p.deletedAt);
      } else if (filterStatus === 'active') {
        items = items.filter((p) => p.isActive && !p.archivedAt && !p.deletedAt);
      } else if (filterStatus === 'draft') {
        items = items.filter((p) => !p.isActive && !p.archivedAt && !p.deletedAt);
      }
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
        setCollections([]);
        setCollectionsLoading(false);
        return;
      }

      try {
        setCollectionsLoading(true);
        const collectionsRes = await brandApi.getCollections(user.id, { visibility: 'all' });
        if (!mounted) return;
        const mappedCollections: CollectionOption[] = (collectionsRes || []).map((c: any) => ({
          id: String(c.id),
          name: String(c.title || c.name || 'Untitled collection'),
        }));
        setCollections(mappedCollections);
      } catch (e) {
        if (!mounted) return;
        setCollections([]);
      } finally {
        if (mounted) setCollectionsLoading(false);
      }
    };

    void run();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

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
            includeDeleted: filterStatus === 'deleted' ? true : undefined,
            onlyDeleted: filterStatus === 'deleted' ? true : undefined,
          },
        });

        if (!mounted) return;

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

  useEffect(() => {
    if (!listRef.current) return;
    const height = listRef.current.getBoundingClientRect().height;
    if (height > 0) setListMinHeight(height);
  }, [filteredProducts.length, loading]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (loading || products.length === 0) return;

    const draft = products.find((p) => !p.isActive && !p.archivedAt && !p.deletedAt);
    if (!draft) return;

    const key = `draft-reminder:${draft.id}`;
    const lastRaw = localStorage.getItem(key);
    const lastShown = lastRaw ? Number(lastRaw) : 0;
    const now = Date.now();
    const intervalMs = 48 * 60 * 60 * 1000;

    if (!lastShown || now - lastShown >= intervalMs) {
      setDraftReminderProduct(draft);
    }
  }, [loading, products]);

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
        includeDeleted: filterStatus === 'deleted' ? true : undefined,
        onlyDeleted: filterStatus === 'deleted' ? true : undefined,
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

  const handleDuplicate = async (productId: string) => {
    try {
      const duplicated = await productApi.duplicateProduct(productId);
      toast.success('Product duplicated');
      navigate(`/studio/store/products/${duplicated.id}/edit`);
    } catch (e) {
      const message = (e as any)?.response?.data?.message ?? 'Failed to duplicate product';
      toast.error(typeof message === 'string' ? message : 'Failed to duplicate product');
    }
  };

  // Handle product action from menu
  const handleProductAction = async (actionId: string, product: BackendProduct) => {
    switch (actionId) {
      case 'feature':
        try {
          await productApi.toggleFeatured(product.id);
          toast.success(product.isFeatured ? 'Removed from featured' : 'Added to featured');
          await refresh();
        } catch (e) {
          toast.error('Failed to update featured status');
        }
        break;
        
      case 'duplicate':
        await handleDuplicate(product.id);
        break;
        
      case 'archive':
        setArchiveMode('archive');
        setArchiveModalProduct(product);
        break;
        
      case 'unarchive':
        setArchiveMode('unarchive');
        setArchiveModalProduct(product);
        break;
        
      case 'delete':
        setDeleteModalProduct(product);
        break;
      case 'restore':
        setRestoreModalProduct(product);
        break;
      case 'edit':
        navigate(`/studio/store/products/${product.id}/edit?includeDeleted=true`);
        break;
      case 'permanent-delete':
        setPermanentDeleteProduct(product);
        break;
    }
  };

  // Show coming soon for bulk operations
  const handleBulkAction = (action: string) => {
    setComingSoonModal({
      open: true,
      feature: `Bulk ${action}`,
      description: `We're working on powerful bulk ${action.toLowerCase()} tools to help you manage multiple products at once.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="mb-6 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-white/5 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Products</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Manage your catalog and draft inventory.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Search products..."
              inputSize="sm"
              className="w-64"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl overflow-hidden border border-gray-200 dark:border-white/10">
            {(
              [
                { value: 'all', label: 'All' },
                { value: 'active', label: 'Published' },
                { value: 'draft', label: 'Draft' },
                { value: 'archived', label: 'Archived' },
                { value: 'deleted', label: 'Deleted' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilterStatus(opt.value)}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  filterStatus === opt.value
                    ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 text-white'
                    : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            value={filterCollection}
            onChange={(e) => setFilterCollection(e.target.value)}
            disabled={collectionsLoading}
            className="rounded-lg border border-gray-200 dark:border-white/10 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm disabled:opacity-60"
          >
            <option value="all">All Content</option>
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
          <div
            ref={listRef}
            style={listMinHeight ? { minHeight: listMinHeight } : undefined}
            className={`transition-opacity duration-200 ${loading ? 'opacity-60' : 'opacity-100'}`}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => {
              const collectionLabel =
                product.collection?.title ||
                collections.find((c) => c.id === product.collectionId)?.name ||
                '—';
              
              // Determine status for badge
              const getProductStatus = (): StudioStatus => {
                if (product.deletedAt) return 'DELETED';
                if (product.archivedAt) return 'ARCHIVED';
                return product.isActive ? 'ACTIVE' : 'DRAFT';
              };
              const productStatus = getProductStatus();

              return (
                <div
                  key={product.id}
                  className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white dark:bg-zinc-900/80 shadow-sm transition-all duration-300 ease-out ${
                    selectedProducts.includes(product.id)
                      ? 'ring-2 ring-purple-500 border-purple-300 dark:border-purple-500/30'
                      : 'border-gray-100 dark:border-white/[0.08] hover:shadow-xl hover:shadow-black/[0.08] dark:hover:shadow-black/30 hover:border-gray-200 dark:hover:border-white/[0.12]'
                  } ${layoutMode ? 'cursor-move' : 'cursor-pointer'}`}
                  onClick={() => {
                    if (layoutMode) return;
                    const suffix = product.deletedAt ? '?includeDeleted=true' : '';
                    navigate(`/studio/store/products/${product.id}/edit${suffix}`);
                  }}
                >
                  {/* Selection checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedProducts.includes(product.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleSelect(product.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute left-3 top-3 z-20 h-4 w-4 rounded border-gray-300 dark:border-zinc-600 bg-white/90 dark:bg-zinc-800/90 text-purple-600 focus:ring-purple-500/30 cursor-pointer"
                  />
                  
                  {/* Actions menu button (replaces star) */}
                  <div className="absolute right-3 top-3 z-20">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const menuId = `product-menu-${product.id}`;
                        dropdownManager.setOpenId(
                          dropdownManager.openId === menuId ? null : menuId,
                        );
                      }}
                      className={`flex h-7 w-7 items-center justify-center transition-all duration-200 ${
                        dropdownManager.openId === `product-menu-${product.id}`
                          ? 'text-purple-600'
                          : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
                      }`}
                      title="Actions"
                    >
                      <span className="text-lg">⋯</span>
                    </button>
                    
                    {/* Actions dropdown menu */}
                    {dropdownManager.openId === `product-menu-${product.id}` && (
                      <ProductActionsMenu
                        isOpen={true}
                        onClose={() => dropdownManager.setOpenId(null)}
                        onAction={(actionId) => handleProductAction(actionId, product)}
                        actions={getDefaultProductActions(product)}
                      />
                    )}
                    
                    {/* Featured indicator (small badge) */}
                    {product.isFeatured && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center shadow-md" title="Featured product">
                        <span className="text-xs">⭐</span>
                      </div>
                    )}
                  </div>

                  {/* Quick action icons on hover */}
                  {!product.deletedAt && (
                    <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleProductAction('duplicate', product);
                        }}
                        title="Duplicate product"
                        className="h-8 w-8 rounded-full bg-white/90 dark:bg-zinc-800/90 shadow-lg flex items-center justify-center text-sm"
                      >
                        📋
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleProductAction('delete', product);
                        }}
                        title="Delete product"
                        className="h-8 w-8 rounded-full bg-white/90 dark:bg-zinc-800/90 shadow-lg flex items-center justify-center text-sm"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                  
                  {/* Layout mode drag handle */}
                  {layoutMode && (
                    <div className="absolute bottom-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 dark:bg-zinc-800/90 text-gray-500 dark:text-zinc-400 shadow-lg">
                      <span className="text-base">⠿</span>
                    </div>
                  )}

                  {/* Image Container - 4:5 aspect ratio */}
                  <div className="relative aspect-[4/5] overflow-hidden bg-gray-50 dark:bg-zinc-800/50">
                    {(() => {
                      const primaryMedia = product.media?.find((m) => m.isPrimary) ?? product.media?.[0];
                      const fallbackUrl = product.thumbnail || product.images?.[0] || null;
                      const fileId = typeof primaryMedia?.id === 'string' && !primaryMedia.id.startsWith('http')
                        ? primaryMedia.id
                        : undefined;
                      return primaryMedia || fallbackUrl ? (
                        <ImageWithFallback
                          src={primaryMedia?.url ?? fallbackUrl}
                          fileId={fileId}
                          alt={product.name}
                          fit="cover"
                          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                          containerClassName="h-full w-full"
                          rounded="none"
                        />
                      ) : null;
                    })()}
                    
                    {/* Fallback for missing images */}
                    {!product.thumbnail && !product.images?.[0] && (!product.media || product.media.length === 0) && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-4xl mb-2">📦</span>
                        <span className="text-xs text-gray-400 dark:text-zinc-500">No image</span>
                      </div>
                    )}
                    
                    {/* Gradient overlay for readability */}
                    <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/20 to-transparent pointer-events-none" />
                    
                    {/* Hover overlay with edit button */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm opacity-0 transition-all duration-300 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const suffix = product.deletedAt ? '?includeDeleted=true' : '';
                          navigate(`/studio/store/products/${product.id}/edit${suffix}`);
                        }}
                        className="px-5 py-2.5 bg-white text-gray-900 rounded-xl font-semibold text-sm shadow-xl hover:bg-gray-100 transition-all active:scale-95"
                      >
                        ✏️ Edit Product
                      </button>
                    </div>
                    
                    {/* Status badge inside image area */}
                    <div className="absolute bottom-3 left-3 z-10">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold shadow-lg ${
                        productStatus === 'DELETED'
                          ? 'bg-rose-500/90 text-white'
                          : productStatus === 'ARCHIVED'
                            ? 'bg-gray-500/90 text-white'
                            : productStatus === 'DRAFT' 
                              ? 'bg-amber-500/90 text-white' 
                              : 'bg-emerald-500/90 text-white'
                      }`}>
                        {productStatus === 'DELETED'
                          ? '🗑️ Deleted'
                          : productStatus === 'ARCHIVED'
                            ? '📦 Archived'
                            : productStatus === 'DRAFT'
                              ? '📝 Draft'
                              : '✅ Published'}
                      </span>
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="flex flex-col gap-2.5 p-4">
                    {/* Name and Collection */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">{product.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">{collectionLabel}</p>
                    </div>
                    
                    {/* Price Section */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">
                        ₦{product.price.toLocaleString()}
                      </span>
                      {typeof product.salePrice === 'number' && product.salePrice > 0 && (
                        <span className="text-xs text-rose-500 font-medium">
                          🏷️ ₦{product.salePrice.toLocaleString()}
                        </span>
                      )}
                    </div>
                    
                    {/* Stock info with tooltip */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-white/5">
                      <span 
                        className={`text-xs font-medium cursor-help ${
                          (product.totalStock ?? 0) === 0 
                            ? 'text-rose-500' 
                            : (product.totalStock ?? 0) <= 5 
                              ? 'text-amber-500' 
                              : 'text-emerald-500'
                        }`}
                        title={
                          (product.totalStock ?? 0) === 0 
                            ? 'This product is out of stock and cannot be purchased' 
                            : (product.totalStock ?? 0) <= 5 
                              ? 'Low stock warning: Consider restocking soon' 
                              : 'Stock is healthy'
                        }
                      >
                        {(product.totalStock ?? 0) === 0 
                          ? '🔴 Out of stock' 
                          : (product.totalStock ?? 0) <= 5 
                            ? `🟡 ${product.totalStock} in stock` 
                            : `🟢 ${product.totalStock} in stock`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {!loading && filteredProducts.length === 0 && products.length > 0 && (
              <div className="col-span-full py-16 text-center text-gray-500 dark:text-gray-400">
                No products match this filter.
              </div>
            )}
            </div>
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
                ←
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
                →
              </button>
            </div>
          </div>
        </div>
      </div>

      {!loading && products.length === 0 && (
        <div className="backdrop-blur-xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl shadow-xl p-12 text-center mt-6">
          <div className="max-w-md mx-auto">
            <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-purple-500/20 to-purple-700/20 rounded-full flex items-center justify-center border border-purple-500/30">
              <span className="text-5xl">📦</span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">No products yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Add your first product to your store.</p>
            <button
              type="button"
              onClick={() => navigate('/studio/store/products/new')}
              className="bg-gradient-to-r from-purple-600 to-purple-800 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/30 transition-all inline-flex items-center gap-2"
            >
              ➕ Add Your First Product
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
            onClick={() => handleBulkAction('Edit')}
            className="hover:text-purple-200"
          >
            ✏️ Edit
          </button>
          <button type="button" onClick={() => handleBulkAction('Delete')} className="hover:text-purple-200">
            🗑️ Delete
          </button>
          <button type="button" onClick={() => handleBulkAction('Archive')} className="hover:text-purple-200">
            📦 Archive
          </button>
          <button type="button" onClick={() => handleBulkAction('Unpublish')} className="hover:text-purple-200">
            📥 Unpublish
          </button>
          <button
            type="button"
            onClick={() => setSelectedProducts([])}
            className="ml-2 hover:text-purple-200"
          >
            ✕ Clear
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      {/* MODALS */}
      {/* ═══════════════════════════════════════════════════════════════════════════ */}
      
      <DeleteProductModal
        isOpen={!!deleteModalProduct}
        onClose={() => setDeleteModalProduct(null)}
        onDeleted={() => {
          refresh();
          setSelectedProducts([]);
        }}
        product={deleteModalProduct}
      />

      <ArchiveProductModal
        isOpen={!!archiveModalProduct}
        onClose={() => setArchiveModalProduct(null)}
        onArchived={() => {
          refresh();
          setSelectedProducts([]);
        }}
        product={archiveModalProduct}
        mode={archiveMode}
      />

      <RestoreDeletedProductModal
        isOpen={!!restoreModalProduct}
        onClose={() => setRestoreModalProduct(null)}
        onRestored={() => {
          refresh();
          setSelectedProducts([]);
        }}
        product={restoreModalProduct}
      />

      <PermanentDeleteProductModal
        isOpen={!!permanentDeleteProduct}
        onClose={() => setPermanentDeleteProduct(null)}
        onDeleted={() => {
          refresh();
          setSelectedProducts([]);
        }}
        product={permanentDeleteProduct}
      />

      <ComingSoonModal
        isOpen={comingSoonModal.open}
        onClose={() => setComingSoonModal({ open: false })}
        feature={comingSoonModal.feature}
        description={comingSoonModal.description}
      />

      {draftReminderProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              if (typeof window !== 'undefined') {
                localStorage.setItem(`draft-reminder:${draftReminderProduct.id}`, String(Date.now()));
              }
              setDraftReminderProduct(null);
            }}
          />
          <div className="relative w-full max-w-md mx-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-white/10">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Continue your draft?</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                You have a saved draft that will be removed after 90 days.
              </p>
            </div>
            <div className="p-6 space-y-2">
              <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4">
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {draftReminderProduct.name || 'Untitled Draft'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Saved as draft
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-zinc-800/30 flex gap-3">
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    localStorage.setItem(`draft-reminder:${draftReminderProduct.id}`, String(Date.now()));
                  }
                  setDraftReminderProduct(null);
                }}
                className="flex-1 px-4 py-3 bg-white dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-zinc-600 transition-colors"
              >
                Later
              </button>
              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    localStorage.setItem(`draft-reminder:${draftReminderProduct.id}`, String(Date.now()));
                  }
                  setDraftReminderProduct(null);
                  navigate(`/studio/store/products/${draftReminderProduct.id}/edit`);
                }}
                className="flex-1 px-4 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 bg-purple-600 text-white hover:bg-purple-700"
              >
                ✏️ Continue Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoreProductsPanel;