import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminProductsApi, adminFeaturedApi } from '@/api/AdminApi';
import type { AdminProduct, FeaturedItem, FeaturedSlotsSummary } from '@/types/admin';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import FilterDropdown from '@/components/ui/FilterDropdown';
import { toast } from 'sonner';
import { unwrapApiResponse } from '@/types/auth';
import FeatureItemModal from './modals/FeatureItemModal';
import ImageWithFallback from '@/components/ImageWithFallback';
import useDebounce from '@/hooks/useDebounce';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type SortBy = 'newest' | 'oldest' | 'name' | 'price_high' | 'price_low';
type ViewMode = 'table' | 'cards';
type PageTab = 'products' | 'featured';
type FeaturedStatusFilter = 'all' | 'active' | 'scheduled' | 'expired';

const SORT_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name', label: 'Name' },
  { value: 'price_high', label: 'Price high' },
  { value: 'price_low', label: 'Price low' },
];

const FEATURED_STATUS_OPTIONS: Array<{ value: FeaturedStatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'expired', label: 'Expired' },
];

const AdminProductsPage: React.FC = () => {
  const { hasPermission, isSuperAdmin } = useAdminPermissions();
  const canModerate = hasPermission('PRODUCTS_MODERATE');
  const canFeatured = hasPermission('FEATURED_MANAGE');

  const [activeTab, setActiveTab] = useState<PageTab>('products');

  // ── Products tab state ──
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 350);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    isDestructive: boolean;
    action: () => Promise<void>;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // ── Featured tab state ──
  const [slots, setSlots] = useState<FeaturedSlotsSummary | null>(null);
  const [featuredStatusFilter, setFeaturedStatusFilter] = useState<FeaturedStatusFilter>('all');
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [featuredView, setFeaturedView] = useState<'active' | 'history'>('active');

  // Fetch slots when Featured tab is active
  useEffect(() => {
    if (activeTab !== 'featured') return;
    adminFeaturedApi.getSlots().then((res) => {
      const data = unwrapApiResponse<FeaturedSlotsSummary>(res.data as any);
      setSlots(data);
    }).catch(() => {});
  }, [activeTab]);

  // ── Products fetch ──
  const fetchProductsPage = useCallback(
    async (cursor?: string, limit?: number) => {
      const params: Record<string, string> = {};
      if (debouncedSearch) params.q = debouncedSearch;
      if (statusFilter === 'ACTIVE') params.isActive = 'true';
      if (statusFilter === 'INACTIVE') params.isActive = 'false';
      if (cursor) params.cursor = cursor;
      if (limit) params.limit = String(limit);

      const res = await adminProductsApi.list(params);
      const data = unwrapApiResponse<
        { items?: AdminProduct[]; nextCursor?: string } | AdminProduct[]
      >(res.data as any);
      if (Array.isArray(data)) return { items: data };
      return { items: data.items ?? [], nextCursor: data.nextCursor };
    },
    [debouncedSearch, statusFilter],
  );

  const {
    items: products,
    isLoading: productsLoading,
    isLoadingMore: productsLoadingMore,
    hasMore: productsHasMore,
    error: productsError,
    sentinelRef: productsSentinelRef,
    reset: productsReset,
  } = useInfiniteScroll<AdminProduct>(fetchProductsPage, { limit: 30 });

  // ── Featured fetch ──
  const fetchFeaturedPage = useCallback(
    async (cursor?: string, limit?: number) => {
      const params: Record<string, string> = {};
      if (featuredStatusFilter !== 'all') params.status = featuredStatusFilter;
      if (cursor) params.cursor = cursor;
      if (limit) params.limit = String(limit);

      const res = await adminFeaturedApi.list(params);
      const data = unwrapApiResponse<
        { items?: FeaturedItem[]; nextCursor?: string } | FeaturedItem[]
      >(res.data as any);
      if (Array.isArray(data)) return { items: data };
      return { items: data.items ?? [], nextCursor: data.nextCursor };
    },
    [featuredStatusFilter],
  );

  const {
    items: featuredItems,
    isLoading: featuredLoading,
    isLoadingMore: featuredLoadingMore,
    hasMore: featuredHasMore,
    error: featuredError,
    sentinelRef: featuredSentinelRef,
    reset: featuredReset,
  } = useInfiniteScroll<FeaturedItem>(fetchFeaturedPage, { limit: 30 });

  // ── History fetch (SuperAdmin) ──
  const fetchHistoryPage = useCallback(
    async (cursor?: string, limit?: number) => {
      const params: Record<string, string> = {};
      if (cursor) params.cursor = cursor;
      if (limit) params.limit = String(limit);
      const res = await adminFeaturedApi.history(params);
      const data = unwrapApiResponse<
        { items?: FeaturedItem[]; nextCursor?: string } | FeaturedItem[]
      >(res.data as any);
      if (Array.isArray(data)) return { items: data };
      return { items: data.items ?? [], nextCursor: data.nextCursor };
    },
    [],
  );

  const {
    items: historyItems,
    isLoading: historyLoading,
    isLoadingMore: historyLoadingMore,
    hasMore: historyHasMore,
    sentinelRef: historySentinelRef,
  } = useInfiniteScroll<FeaturedItem>(fetchHistoryPage, { limit: 30 });

  const uniqueProducts = useMemo(() => {
    const seen = new Set<string>();
    return products.filter((product) => {
      if (seen.has(product.id)) return false;
      seen.add(product.id);
      return true;
    });
  }, [products]);

  const sortedProducts = useMemo(() => {
    const toNumber = (value: string | null | undefined) => {
      const parsed = Number(value ?? 0);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return [...uniqueProducts].sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'price_high') return toNumber(b.salePrice ?? b.price) - toNumber(a.salePrice ?? a.price);
      if (sortBy === 'price_low') return toNumber(a.salePrice ?? a.price) - toNumber(b.salePrice ?? b.price);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [sortBy, uniqueProducts]);

  const metrics = useMemo(() => {
    const active = uniqueProducts.filter((item) => item.isActive).length;
    const inactive = uniqueProducts.length - active;
    return { total: uniqueProducts.length, active, inactive };
  }, [uniqueProducts]);

  const resetProductFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setSortBy('newest');
  };

  const formatCurrency = (product: AdminProduct) => {
    const raw = Number(product.salePrice ?? product.price ?? 0);
    const amount = Number.isFinite(raw) ? raw : 0;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: product.currency || 'NGN',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getCoverImage = (product: AdminProduct) => {
    if (product.thumbnail && product.thumbnail.trim()) return product.thumbnail;
    if (Array.isArray(product.images)) {
      const firstImage = product.images.find((image) => typeof image === 'string' && image.trim().length > 0);
      if (firstImage) return firstImage;
    }
    return null;
  };

  const handleToggleActive = (product: AdminProduct) => {
    const newActive = !product.isActive;
    setConfirmAction({
      title: `${newActive ? 'Activate' : 'Deactivate'} product?`,
      message: `"${product.name}" will be ${newActive ? 'made visible' : 'hidden from the store'}.`,
      isDestructive: !newActive,
      action: async () => {
        await adminProductsApi.moderate(product.id, { isActive: newActive });
        toast.success(`Product ${newActive ? 'activated' : 'deactivated'}`);
        productsReset();
      },
    });
  };

  const handleRemoveFeatured = (item: FeaturedItem) => {
    setConfirmAction({
      title: 'Remove from featured?',
      message: `"${item.entityName ?? item.entityId}" will be removed from the featured section.`,
      isDestructive: true,
      action: async () => {
        await adminFeaturedApi.remove(item.id);
        toast.success('Item removed from featured');
        featuredReset();
        adminFeaturedApi.getSlots().then((res) => {
          const data = unwrapApiResponse<FeaturedSlotsSummary>(res.data as any);
          setSlots(data);
        }).catch(() => {});
      },
    });
  };

  const executeConfirm = async () => {
    if (!confirmAction) return;
    setConfirmLoading(true);
    try {
      await confirmAction.action();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Action failed');
    } finally {
      setConfirmLoading(false);
      setConfirmAction(null);
    }
  };

  const getFeaturedStatusBadge = (item: FeaturedItem) => {
    const now = new Date();
    const starts = new Date(item.startsAt);
    const expires = new Date(item.expiresAt);
    if (item.removedAt) return { label: '🗑️ Removed', cls: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300' };
    if (!item.isActive || now > expires) return { label: '⏱️ Expired', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200' };
    if (now < starts) return { label: '📅 Scheduled', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200' };
    return { label: '⭐ Active', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-purple-200/40 bg-gradient-to-br from-white/95 via-[#f8f3ff] to-[#efe6ff] p-5 shadow-md shadow-purple-500/10 dark:border-white/10 dark:from-white/10 dark:via-[#140c1d] dark:to-[#1a1026]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">Products Console</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Review, filter, and moderate product inventory with a smoother admin flow.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Tab switcher */}
            <div className="inline-flex items-center rounded-full border border-gray-200/80 bg-white p-1 text-xs font-semibold dark:border-white/10 dark:bg-white/5">
              <button
                type="button"
                onClick={() => setActiveTab('products')}
                className={`rounded-full px-3 py-1.5 transition ${activeTab === 'products' ? 'bg-purple-600 text-white' : 'text-gray-600 dark:text-gray-300'}`}
              >
                📦 Products
              </button>
              {canFeatured && (
                <button
                  type="button"
                  onClick={() => setActiveTab('featured')}
                  className={`rounded-full px-3 py-1.5 transition ${activeTab === 'featured' ? 'bg-purple-600 text-white' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  ⭐ Featured
                </button>
              )}
            </div>
            {activeTab === 'products' && (
              <div className="inline-flex items-center rounded-full border border-gray-200/80 bg-white p-1 text-xs font-semibold dark:border-white/10 dark:bg-white/5">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`rounded-full px-3 py-1.5 transition ${viewMode === 'table' ? 'bg-purple-600 text-white' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  Table
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`rounded-full px-3 py-1.5 transition ${viewMode === 'cards' ? 'bg-purple-600 text-white' : 'text-gray-600 dark:text-gray-300'}`}
                >
                  Cards
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── Products Tab ─── */}
      {activeTab === 'products' && (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-gray-200/70 bg-white/80 p-4 shadow-sm transition-transform hover:-translate-y-0.5 dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Total</p>
              <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">{metrics.total}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 p-4 shadow-sm transition-transform hover:-translate-y-0.5 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Active</p>
              <p className="mt-2 text-2xl font-black text-emerald-800 dark:text-emerald-200">{metrics.active}</p>
            </div>
            <div className="rounded-2xl border border-rose-200/70 bg-rose-50/80 p-4 shadow-sm transition-transform hover:-translate-y-0.5 dark:border-rose-500/30 dark:bg-rose-500/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">Inactive</p>
              <p className="mt-2 text-2xl font-black text-rose-800 dark:text-rose-200">{metrics.inactive}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200/80 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products by name..."
                className="col-span-2 md:col-span-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-purple-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
              />
              <div className="inline-flex overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
                {(['ALL', 'ACTIVE', 'INACTIVE'] as StatusFilter[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setStatusFilter(option)}
                    className={`flex-1 px-3 py-2 text-xs font-semibold transition ${
                      statusFilter === option
                        ? 'bg-purple-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-black/20 dark:text-gray-300 dark:hover:bg-white/10'
                    }`}
                  >
                    {option === 'ALL' ? 'All' : option === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <FilterDropdown
                  value={sortBy}
                  onChange={(value) => setSortBy(value as SortBy)}
                  options={SORT_OPTIONS}
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-black/20 dark:text-white"
                />
                <button
                  type="button"
                  onClick={resetProductFilters}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/20 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                >
                  Reset
                </button>
              </div>
            </div>
          </section>

          {productsError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
              {productsError}
            </div>
          )}

          {productsLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-36 animate-pulse rounded-2xl bg-gray-200/70 dark:bg-white/10" />
              ))}
            </div>
          ) : sortedProducts.length === 0 ? (
            <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-10 text-center dark:border-white/10 dark:bg-white/[0.03]">
              <p className="text-3xl">📦</p>
              <h3 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">No products match this view</h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Try a different filter or reset your search.</p>
            </div>
          ) : viewMode === 'table' ? (
            <div className="overflow-x-auto rounded-2xl border border-gray-200/80 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200/80 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
                    <th className="px-3 py-3">Product</th>
                    <th className="px-3 py-3">Brand</th>
                    <th className="px-3 py-3">Price</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Created</th>
                    {canModerate && <th className="px-3 py-3">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {sortedProducts.map((product) => (
                    <tr key={product.id} className="border-b border-gray-100/90 transition-colors hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-gray-200/70 bg-gray-100 dark:border-white/10 dark:bg-white/10">
                            {getCoverImage(product) ? (
                              <ImageWithFallback src={getCoverImage(product)} alt={product.name} fit="cover" className="h-12 w-12" rounded="lg" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">📦</div>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{product.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{product.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-gray-700 dark:text-gray-200">{product.brand?.name ?? product.brandId}</td>
                      <td className="px-3 py-3 font-semibold text-gray-800 dark:text-gray-100">{formatCurrency(product)}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          product.isActive
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200'
                        }`}>
                          <span>{product.isActive ? '🟢' : '🔴'}</span>
                          {product.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(product.createdAt).toLocaleDateString()}
                      </td>
                      {canModerate && (
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(product)}
                            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                              product.isActive
                                ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-200 dark:hover:bg-rose-500/30'
                                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:hover:bg-emerald-500/30'
                            }`}
                          >
                            {product.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sortedProducts.map((product) => (
                <article
                  key={product.id}
                  className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white/85 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.03]"
                >
                  <div className="h-40 w-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-white/5 dark:to-white/10">
                    {getCoverImage(product) ? (
                      <ImageWithFallback src={getCoverImage(product)} alt={product.name} fit="cover" className="h-40 w-full" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl text-gray-400">📦</div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-bold text-gray-900 dark:text-white">{product.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{product.brand?.name ?? product.brandId}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                        product.isActive
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200'
                      }`}>
                        {product.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="mt-4 text-xl font-black text-gray-900 dark:text-white">{formatCurrency(product)}</p>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{new Date(product.createdAt).toLocaleDateString()}</span>
                    </div>
                    {canModerate && (
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(product)}
                          className={`w-full rounded-lg px-3 py-2 text-xs font-semibold ${
                            product.isActive
                              ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-200 dark:hover:bg-rose-500/30'
                              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:hover:bg-emerald-500/30'
                          }`}
                        >
                          {product.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {productsLoadingMore && <div className="py-3 text-center text-sm text-gray-500 dark:text-gray-400">Loading more...</div>}
          {productsHasMore && <div ref={productsSentinelRef} className="h-px w-full" />}
          {!productsHasMore && sortedProducts.length > 0 && <div className="py-2 text-center text-xs text-gray-400">End of list</div>}
        </>
      )}

      {/* ─── Featured Tab ─── */}
      {activeTab === 'featured' && canFeatured && (
        <>
          {/* Slots summary */}
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-amber-200/70 bg-amber-50/80 p-4 shadow-sm dark:border-amber-500/30 dark:bg-amber-500/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Active</p>
              <p className="mt-2 text-2xl font-black text-amber-800 dark:text-amber-200">{slots?.active ?? '—'}</p>
            </div>
            <div className="rounded-2xl border border-blue-200/70 bg-blue-50/80 p-4 shadow-sm dark:border-blue-500/30 dark:bg-blue-500/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Scheduled</p>
              <p className="mt-2 text-2xl font-black text-blue-800 dark:text-blue-200">{slots?.scheduled ?? '—'}</p>
            </div>
            <div className="rounded-2xl border border-gray-200/70 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Total used</p>
              <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">{slots?.total ?? '—'}</p>
            </div>
            <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/80 p-4 shadow-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Remaining</p>
              <p className="mt-2 text-2xl font-black text-emerald-800 dark:text-emerald-200">{slots?.remaining ?? '—'}</p>
            </div>
          </section>

          {/* Toolbar */}
          <section className="rounded-2xl border border-gray-200/80 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="inline-flex overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setFeaturedView('active')}
                    className={`px-3 py-2 text-xs font-semibold transition ${
                      featuredView === 'active'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-black/20 dark:text-gray-300 dark:hover:bg-white/10'
                    }`}
                  >
                    ⭐ Active
                  </button>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      onClick={() => setFeaturedView('history')}
                      className={`px-3 py-2 text-xs font-semibold transition ${
                        featuredView === 'history'
                          ? 'bg-purple-600 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-black/20 dark:text-gray-300 dark:hover:bg-white/10'
                      }`}
                    >
                      📜 History
                    </button>
                  )}
                </div>
                {featuredView === 'active' && (
                  <div className="inline-flex overflow-hidden rounded-xl border border-gray-200 dark:border-white/10">
                    {FEATURED_STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFeaturedStatusFilter(opt.value)}
                        className={`px-3 py-2 text-xs font-semibold transition ${
                          featuredStatusFilter === opt.value
                            ? 'bg-purple-600 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-black/20 dark:text-gray-300 dark:hover:bg-white/10'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {featuredView === 'active' && (
                <button
                  type="button"
                  onClick={() => setShowFeatureModal(true)}
                  disabled={slots !== null && slots.remaining <= 0}
                  className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ⭐ Feature an item
                </button>
              )}
            </div>
          </section>

          {/* Active view */}
          {featuredView === 'active' && (
            <>
              {featuredError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
                  {featuredError}
                </div>
              )}

              {featuredLoading ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} className="h-36 animate-pulse rounded-2xl bg-gray-200/70 dark:bg-white/10" />
                  ))}
                </div>
              ) : featuredItems.length === 0 ? (
                <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-10 text-center dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-3xl">⭐</p>
                  <h3 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">No featured items</h3>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Feature products or designs to highlight them across the marketplace.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {featuredItems.map((item) => {
                    const badge = getFeaturedStatusBadge(item);
                    return (
                      <article
                        key={item.id}
                        className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white/85 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.03]"
                      >
                        <div className="h-36 w-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-white/5 dark:to-white/10">
                          {item.entityThumbnail ? (
                            <img src={item.entityThumbnail} alt={item.entityName ?? ''} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-3xl text-gray-400">⭐</div>
                          )}
                        </div>
                        <div className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-base font-bold text-gray-900 dark:text-white">{item.entityName ?? item.entityId.slice(0, 8)}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{item.entityType} · {item.brandName}</p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="rounded-lg bg-gray-50 p-2 dark:bg-white/5">
                              <p className="font-bold text-gray-900 dark:text-white">{item.viewsDelta}</p>
                              <p className="text-gray-500 dark:text-gray-400">Views</p>
                            </div>
                            <div className="rounded-lg bg-gray-50 p-2 dark:bg-white/5">
                              <p className="font-bold text-gray-900 dark:text-white">{item.threadsDelta}</p>
                              <p className="text-gray-500 dark:text-gray-400">Threads</p>
                            </div>
                            <div className="rounded-lg bg-gray-50 p-2 dark:bg-white/5">
                              <p className="font-bold text-gray-900 dark:text-white">{item.clicksDelta}</p>
                              <p className="text-gray-500 dark:text-gray-400">Clicks</p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>Expires {new Date(item.expiresAt).toLocaleDateString()}</span>
                            {item.featuredBy && <span>by {item.featuredBy.email.split('@')[0]}</span>}
                          </div>
                          {item.isActive && !item.removedAt && (
                            <button
                              type="button"
                              onClick={() => handleRemoveFeatured(item)}
                              className="w-full rounded-lg bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-200 dark:bg-rose-500/20 dark:text-rose-200 dark:hover:bg-rose-500/30"
                            >
                              🗑️ Remove
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {featuredLoadingMore && <div className="py-3 text-center text-sm text-gray-500 dark:text-gray-400">Loading more...</div>}
              {featuredHasMore && <div ref={featuredSentinelRef} className="h-px w-full" />}
              {!featuredHasMore && featuredItems.length > 0 && <div className="py-2 text-center text-xs text-gray-400">End of list</div>}
            </>
          )}

          {/* History view (SuperAdmin) */}
          {featuredView === 'history' && isSuperAdmin && (
            <>
              {historyLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, idx) => (
                    <div key={idx} className="h-16 animate-pulse rounded-xl bg-gray-200/70 dark:bg-white/10" />
                  ))}
                </div>
              ) : historyItems.length === 0 ? (
                <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-10 text-center dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-3xl">📜</p>
                  <h3 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">No history yet</h3>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-gray-200/80 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
                  <table className="w-full min-w-[800px] text-sm">
                    <thead>
                      <tr className="border-b border-gray-200/80 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
                        <th className="px-3 py-3">Item</th>
                        <th className="px-3 py-3">Type</th>
                        <th className="px-3 py-3">Brand</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="px-3 py-3">Featured by</th>
                        <th className="px-3 py-3">Started</th>
                        <th className="px-3 py-3">Ended</th>
                        <th className="px-3 py-3">Metrics</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyItems.map((item) => {
                        const badge = getFeaturedStatusBadge(item);
                        return (
                          <tr key={item.id} className="border-b border-gray-100/90 transition-colors hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5">
                            <td className="px-3 py-3 font-semibold text-gray-900 dark:text-white">{item.entityName ?? item.entityId.slice(0, 8)}</td>
                            <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{item.entityType}</td>
                            <td className="px-3 py-3 text-gray-600 dark:text-gray-300">{item.brandName}</td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
                            </td>
                            <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">{item.featuredBy?.email?.split('@')[0] ?? '—'}</td>
                            <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">{new Date(item.startsAt).toLocaleDateString()}</td>
                            <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                              {item.removedAt ? new Date(item.removedAt).toLocaleDateString() : item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-3 py-3 text-xs text-gray-600 dark:text-gray-300">
                              {item.viewsDelta}v · {item.threadsDelta}t · {item.clicksDelta}c
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {historyLoadingMore && <div className="py-3 text-center text-sm text-gray-500 dark:text-gray-400">Loading more...</div>}
              {historyHasMore && <div ref={historySentinelRef} className="h-px w-full" />}
              {!historyHasMore && historyItems.length > 0 && <div className="py-2 text-center text-xs text-gray-400">End of history</div>}
            </>
          )}

          {/* Feature Item Modal */}
          {showFeatureModal && (
            <FeatureItemModal
              onClose={() => setShowFeatureModal(false)}
              onSuccess={() => {
                setShowFeatureModal(false);
                featuredReset();
                adminFeaturedApi.getSlots().then((res) => {
                  const data = unwrapApiResponse<FeaturedSlotsSummary>(res.data as any);
                  setSlots(data);
                }).catch(() => {});
              }}
            />
          )}
        </>
      )}

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title}
        message={confirmAction?.message}
        isDestructive={confirmAction?.isDestructive}
        isLoading={confirmLoading}
        onConfirm={executeConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
};

export default AdminProductsPage;
