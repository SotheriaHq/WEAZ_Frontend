import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminBreadcrumb from '@/components/admin/AdminBreadcrumb';
import ImageWithFallback from '@/components/ImageWithFallback';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { adminCollectionsApi, adminDesignsApi, adminProductsApi } from '@/api/AdminApi';
import type { AdminCollection, AdminDesign, AdminProduct } from '@/types/admin';
import { useAdminPermissions } from '@/hooks/useAdminPermissions';
import { unwrapApiResponse } from '@/types/auth';
import { toast } from 'sonner';
import useDebounce from '@/hooks/useDebounce';

type ContentTab = 'products' | 'designs' | 'collections';

const TABS: Array<{ key: ContentTab; label: string; emoji: string }> = [
  { key: 'products', label: 'Products', emoji: '📦' },
  { key: 'designs', label: 'Designs', emoji: '🧵' },
  { key: 'collections', label: 'Collections', emoji: '🗂️' },
];

const AdminContentManagementPage: React.FC = () => {
  const { hasPermission } = useAdminPermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const canReadProducts = hasPermission('PRODUCTS_READ');
  const canReadCollections = hasPermission('COLLECTIONS_READ');
  const visibleTabs = useMemo(() => {
    return TABS.filter((entry) => {
      if (entry.key === 'products') return canReadProducts;
      return canReadCollections;
    });
  }, [canReadCollections, canReadProducts]);

  const resolveAllowedTab = useCallback(
    (raw: string | null): ContentTab => {
      const value = (raw || '').toLowerCase();
      const candidate: ContentTab =
        value === 'designs' || value === 'collections' ? (value as ContentTab) : 'products';
      if (visibleTabs.some((entry) => entry.key === candidate)) {
        return candidate;
      }
      return visibleTabs[0]?.key ?? 'products';
    },
    [visibleTabs],
  );

  const [tab, setTab] = useState<ContentTab>(() => resolveAllowedTab(searchParams.get('tab')));
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search.trim(), 350);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);

  // Designs-specific filters
  const [designVisibility, setDesignVisibility] = useState<'' | 'PUBLIC' | 'PRIVATE'>('');
  const [designStatus, setDesignStatus] = useState<'' | 'PUBLISHED' | 'ARCHIVED' | 'DRAFT'>('');
  const [designSortBy, setDesignSortBy] = useState<'' | 'recent' | 'oldest' | 'views' | 'orders'>('');
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [designs, setDesigns] = useState<AdminDesign[]>([]);
  const [collections, setCollections] = useState<AdminCollection[]>([]);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    isDestructive: boolean;
    action: () => Promise<void>;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [reasonDialog, setReasonDialog] = useState<{
    title: string;
    entityName: string;
    onConfirm: (reason: string) => void;
  } | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const reasonInputRef = useRef<HTMLTextAreaElement | null>(null);

  const canModerateProducts = hasPermission('PRODUCTS_MODERATE');
  const canModerateCollections = hasPermission('COLLECTIONS_MODERATE');

  useEffect(() => {
    if (visibleTabs.length === 0) return;
    if (!visibleTabs.some((entry) => entry.key === tab)) {
      setTab(visibleTabs[0].key);
    }
  }, [tab, visibleTabs]);

  const resetCurrentTabItems = useCallback(() => {
    if (tab === 'products') setProducts([]);
    if (tab === 'designs') setDesigns([]);
    if (tab === 'collections') setCollections([]);
    setNextCursor(undefined);
  }, [tab]);

  const updateUrlTab = useCallback(
    (nextTab: ContentTab) => {
      const next = new URLSearchParams(searchParams);
      next.set('tab', nextTab);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const parsePage = <T,>(payload: unknown): { items: T[]; nextCursor?: string } => {
    const data = unwrapApiResponse<{ items?: T[]; nextCursor?: string } | T[]>(payload as any);
    if (Array.isArray(data)) {
      return { items: data };
    }
    return {
      items: data?.items ?? [],
      nextCursor: data?.nextCursor,
    };
  };

  const fetchTabPage = useCallback(
    async (cursor?: string) => {
      const params: Record<string, string> = {};
      if (debouncedSearch) params.q = debouncedSearch;
      if (cursor) params.cursor = cursor;
      params.limit = '30';

      if (tab === 'products') {
        const res = await adminProductsApi.list(params);
        return parsePage<AdminProduct>(res.data);
      }
      if (tab === 'designs') {
        if (designVisibility) params.visibility = designVisibility;
        if (designStatus) params.status = designStatus;
        if (designSortBy) params.sortBy = designSortBy;
        const res = await adminDesignsApi.list(params);
        return parsePage<AdminDesign>(res.data);
      }
      const res = await adminCollectionsApi.list(params);
      return parsePage<AdminCollection>(res.data);
    },
    [debouncedSearch, designSortBy, designStatus, designVisibility, tab],
  );

  const loadPage = useCallback(
    async (isLoadMore = false, cursor?: string) => {
      if (visibleTabs.length === 0) {
        return;
      }
      try {
        setError(null);
        if (isLoadMore) {
          if (!cursor) return;
          setLoadingMore(true);
        } else {
          setLoading(true);
          resetCurrentTabItems();
        }

        const page = await fetchTabPage(isLoadMore ? cursor : undefined);
        setNextCursor(page.nextCursor);

        if (tab === 'products') {
          setProducts((prev) => (isLoadMore ? [...prev, ...(page.items as AdminProduct[])] : (page.items as AdminProduct[])));
        } else if (tab === 'designs') {
          setDesigns((prev) => (isLoadMore ? [...prev, ...(page.items as AdminDesign[])] : (page.items as AdminDesign[])));
        } else {
          setCollections((prev) => (isLoadMore ? [...prev, ...(page.items as AdminCollection[])] : (page.items as AdminCollection[])));
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to load content');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [fetchTabPage, resetCurrentTabItems, tab, visibleTabs.length],
  );

  useEffect(() => {
    if (visibleTabs.length === 0) return;
    updateUrlTab(tab);
    void loadPage(false);
  }, [loadPage, tab, updateUrlTab, visibleTabs.length]);

  const currentItemsCount = useMemo(() => {
    if (tab === 'products') return products.length;
    if (tab === 'designs') return designs.length;
    return collections.length;
  }, [collections.length, designs.length, products.length, tab]);

  const handleProductAction = (
    product: AdminProduct,
    action: 'UNPUBLISH' | 'REPUBLISH' | 'HARD_DELETE',
  ) => {
    if (!canModerateProducts) return;
    const label = action === 'UNPUBLISH' ? 'unpublish' : action === 'REPUBLISH' ? 'republish' : 'hard delete';
    const pastTense = action === 'UNPUBLISH' ? 'unpublished' : action === 'REPUBLISH' ? 'republished' : 'deleted';

    const buildConfirm = (reason: string) => {
      setConfirmAction({
        title: `${label[0].toUpperCase()}${label.slice(1)} product?`,
        message:
          action === 'HARD_DELETE'
            ? `"${product.name}" will be permanently deleted.`
            : action === 'UNPUBLISH'
              ? `"${product.name}" will be unpublished from the store.`
              : `"${product.name}" will be republished to the store.`,
        isDestructive: action !== 'REPUBLISH',
        action: async () => {
          await adminProductsApi.moderate(product.id, { action, reason: reason || undefined });
          toast.success(`Product ${pastTense}`);
          await loadPage(false);
        },
      });
    };

    if (action === 'REPUBLISH') {
      buildConfirm('');
      return;
    }

    setReasonInput('');
    setReasonDialog({ title: label, entityName: product.name, onConfirm: buildConfirm });
  };

  const handleContentAction = (
    entity: AdminDesign | AdminCollection,
    entityType: 'design' | 'collection',
    action: 'UNPUBLISH' | 'REPUBLISH' | 'HARD_DELETE',
  ) => {
    if (!canModerateCollections) return;
    const title = entity.title?.trim() || 'Untitled';
    const label = action === 'UNPUBLISH' ? 'unpublish' : action === 'REPUBLISH' ? 'republish' : 'hard delete';
    const pastTense = action === 'UNPUBLISH' ? 'unpublished' : action === 'REPUBLISH' ? 'republished' : 'deleted';

    const buildConfirm = (reason: string) => {
      setConfirmAction({
        title: `${label[0].toUpperCase()}${label.slice(1)} ${entityType}?`,
        message:
          action === 'HARD_DELETE'
            ? `"${title}" will be permanently deleted.`
            : action === 'UNPUBLISH'
              ? `"${title}" will be unpublished.`
              : `"${title}" will be republished.`,
        isDestructive: action !== 'REPUBLISH',
        action: async () => {
          if (entityType === 'design') {
            await adminDesignsApi.moderate(entity.id, { action, reason: reason || undefined });
          } else {
            await adminCollectionsApi.moderate(entity.id, { action, reason: reason || undefined });
          }
          toast.success(`${entityType === 'design' ? 'Design' : 'Collection'} ${pastTense}`);
          await loadPage(false);
        },
      });
    };

    if (action === 'REPUBLISH') {
      buildConfirm('');
      return;
    }

    setReasonInput('');
    setReasonDialog({ title: label, entityName: title, onConfirm: buildConfirm });
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

  const productImage = (product: AdminProduct): { src: string | null; fileId: string | null } => {
    if (product.primaryMediaUrl?.trim()) return { src: product.primaryMediaUrl, fileId: null };
    if (product.thumbnail?.trim()) return { src: product.thumbnail, fileId: null };
    if (Array.isArray(product.images)) {
      const hit = product.images.find((image) => typeof image === 'string' && image.trim());
      if (hit) return { src: hit, fileId: null };
    }
    return { src: null, fileId: null };
  };

  return (
    <div className="space-y-6">
      <AdminBreadcrumb segments={[{ label: 'Content Management' }]} />
      <section className="rounded-3xl border border-purple-200/40 bg-gradient-to-br from-white/95 via-[#f8f3ff] to-[#efe6ff] p-5 shadow-md shadow-purple-500/10 dark:border-white/10 dark:from-white/10 dark:via-[#140c1d] dark:to-[#1a1026]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-gray-900 dark:text-white">Content Management</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Moderate and review products, designs, and store collections in one workspace.
            </p>
          </div>
          <div className="inline-flex items-center rounded-full border border-gray-200/80 bg-white p-1 text-xs font-semibold dark:border-white/10 dark:bg-white/5">
            {visibleTabs.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => setTab(entry.key)}
                className={`rounded-full px-3 py-1.5 transition ${tab === entry.key ? 'bg-purple-600 text-white' : 'text-gray-600 dark:text-gray-300'}`}
              >
                {entry.emoji} {entry.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {visibleTabs.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
          You do not currently have permissions to view products, designs, or collections.
        </div>
      )}

      <section className="rounded-2xl border border-gray-200/80 bg-white/85 p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${tab}...`}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-purple-400 dark:border-white/10 dark:bg-black/20 dark:text-white"
          />
          <div className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700 dark:bg-purple-500/20 dark:text-purple-300">
            {currentItemsCount} loaded
          </div>
        </div>

        {/* Designs-specific filters */}
        {tab === 'designs' && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={designVisibility}
              onChange={(event) => setDesignVisibility(event.target.value as '' | 'PUBLIC' | 'PRIVATE')}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 outline-none focus:border-purple-400 dark:border-white/10 dark:bg-black/20 dark:text-gray-300"
            >
              <option value="">All visibility</option>
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </select>
            <select
              value={designStatus}
              onChange={(event) => setDesignStatus(event.target.value as '' | 'PUBLISHED' | 'ARCHIVED' | 'DRAFT')}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 outline-none focus:border-purple-400 dark:border-white/10 dark:bg-black/20 dark:text-gray-300"
            >
              <option value="">All statuses</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
              <option value="DRAFT">Draft</option>
            </select>
            <select
              value={designSortBy}
              onChange={(event) => setDesignSortBy(event.target.value as '' | 'recent' | 'oldest' | 'views' | 'orders')}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 outline-none focus:border-purple-400 dark:border-white/10 dark:bg-black/20 dark:text-gray-300"
            >
              <option value="">Sort: Newest</option>
              <option value="recent">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="views">Most viewed</option>
              <option value="orders">Most ordered</option>
            </select>
            {(designVisibility || designStatus || designSortBy) && (
              <button
                type="button"
                onClick={() => {
                  setDesignVisibility('');
                  setDesignStatus('');
                  setDesignSortBy('');
                }}
                className="rounded-lg px-2 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50 dark:text-purple-400 dark:hover:bg-purple-500/10"
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </section>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* min-h prevents layout height jump when switching between skeleton and table (Fix 8) */}
      <div className="min-h-[460px]">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-2xl bg-gray-200/70 dark:bg-white/10" />
            ))}
          </div>
        ) : (
          /* max-h + overflow keeps tables scrolling inline rather than extending the page (Fix 6) */
          <div className="max-h-[62vh] overflow-x-auto overflow-y-auto rounded-2xl border border-gray-200/80 bg-white/80 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
            {tab === 'products' && (
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200/80 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Brand</th>
                    <th className="px-4 py-3">Orders</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Status</th>
                    {canModerateProducts && <th className="px-4 py-3">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-b border-gray-100/90 transition-colors hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ImageWithFallback
                            src={productImage(product).src}
                            fileId={productImage(product).fileId}
                            alt={product.name}
                            fit="cover"
                            rounded="lg"
                            className="h-12 w-12 object-cover"
                            containerClassName="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-white/10"
                            maxHeightClassName="max-h-12"
                            fallbackName={product.name}
                          />
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{product.name}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{product.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{product.brand?.name || 'Unknown brand'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{product.orderCount ?? 0}</td>
                      <td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                        {new Intl.NumberFormat('en-NG', {
                          style: 'currency',
                          currency: product.currency || 'NGN',
                          maximumFractionDigits: 0,
                        }).format(Number(product.salePrice ?? product.price ?? 0) || 0)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            product.isActive
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                          }`}
                        >
                          {product.isActive ? '🟢 Active' : '🔴 Inactive'}
                        </span>
                      </td>
                      {canModerateProducts && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {product.isActive ? (
                              <button
                                type="button"
                                onClick={() => handleProductAction(product, 'UNPUBLISH')}
                                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/35"
                              >
                                Unpublish
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleProductAction(product, 'REPUBLISH')}
                                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/35"
                              >
                                Republish
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleProductAction(product, 'HARD_DELETE')}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-700/40 dark:bg-rose-900/20 dark:text-rose-300 dark:hover:bg-rose-900/35"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'designs' && (
              <table className="w-full min-w-[960px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200/80 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
                    <th className="px-4 py-3">Design</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Visibility</th>
                    <th className="px-4 py-3">Views</th>
                    <th className="px-4 py-3">Orders</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Uploaded</th>
                    {canModerateCollections && <th className="px-4 py-3">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {designs.map((design) => (
                    <tr key={design.id} className="border-b border-gray-100/90 transition-colors hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ImageWithFallback
                            src={design.coverImage || null}
                            fileId={design.coverImageFileId || null}
                            alt={design.title || 'Design'}
                            fit="cover"
                            rounded="lg"
                            className="h-12 w-12 object-cover"
                            containerClassName="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-white/10"
                            maxHeightClassName="max-h-12"
                            fallbackName={design.title || 'Design'}
                          />
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{design.title || 'Untitled'}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{design.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{design.owner?.email || design.ownerId}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            design.visibility === 'PUBLIC'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                              : 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400'
                          }`}
                        >
                          {design.visibility === 'PUBLIC' ? 'Public' : 'Private'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{design.viewCount ?? 0}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{design.orderCount ?? 0}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            design.status === 'PUBLISHED'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                              : design.status === 'ARCHIVED'
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400'
                          }`}
                        >
                          {design.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(design.createdAt).toLocaleDateString()}
                      </td>
                      {canModerateCollections && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {design.status === 'ARCHIVED' ? (
                              <button
                                type="button"
                                onClick={() => handleContentAction(design, 'design', 'REPUBLISH')}
                                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/35"
                              >
                                Republish
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleContentAction(design, 'design', 'UNPUBLISH')}
                                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/35"
                              >
                                Unpublish
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleContentAction(design, 'design', 'HARD_DELETE')}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-700/40 dark:bg-rose-900/20 dark:text-rose-300 dark:hover:bg-rose-900/35"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'collections' && (
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200/80 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-white/10 dark:text-gray-400">
                    <th className="px-4 py-3">Collection</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Orders</th>
                    <th className="px-4 py-3">Status</th>
                    {canModerateCollections && <th className="px-4 py-3">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {collections.map((collection) => (
                    <tr key={collection.id} className="border-b border-gray-100/90 transition-colors hover:bg-gray-50/80 dark:border-white/5 dark:hover:bg-white/5">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <ImageWithFallback
                            src={collection.coverImage || null}
                            alt={collection.title || 'Collection'}
                            fit="cover"
                            rounded="lg"
                            className="h-12 w-12 object-cover"
                            containerClassName="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-white/10"
                            maxHeightClassName="max-h-12"
                            fallbackName={collection.title || 'Collection'}
                          />
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{collection.title || 'Untitled'}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{collection.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{collection.owner?.email || collection.ownerId}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{collection.orderCount ?? 0}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                          {collection.status}
                        </span>
                      </td>
                      {canModerateCollections && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {collection.status === 'ARCHIVED' ? (
                              <button
                                type="button"
                                onClick={() => handleContentAction(collection, 'collection', 'REPUBLISH')}
                                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/35"
                              >
                                Republish
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleContentAction(collection, 'collection', 'UNPUBLISH')}
                                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/35"
                              >
                                Unpublish
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleContentAction(collection, 'collection', 'HARD_DELETE')}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-700/40 dark:bg-rose-900/20 dark:text-rose-300 dark:hover:bg-rose-900/35"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {!loading && currentItemsCount === 0 && (
              <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">No {tab} found.</div>
            )}
          </div>
        )}
      </div>

      {nextCursor && !loading && currentItemsCount > 0 && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void loadPage(true, nextCursor)}
            disabled={loadingMore}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
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

      {reasonDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-gray-200/80 bg-white p-6 shadow-xl dark:border-white/10 dark:bg-[#1a1026]">
            <h2 className="capitalize text-lg font-bold text-gray-900 dark:text-white">
              {reasonDialog.title} — Provide a Reason
            </h2>
            <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
              &ldquo;{reasonDialog.entityName}&rdquo;
            </p>
            <textarea
              ref={reasonInputRef}
              rows={4}
              placeholder="Enter reason (optional)..."
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              autoFocus
              className="mt-4 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-purple-400 dark:border-white/10 dark:bg-black/30 dark:text-white"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setReasonDialog(null);
                  setReasonInput('');
                }}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const cb = reasonDialog.onConfirm;
                  const val = reasonInput.trim();
                  setReasonDialog(null);
                  setReasonInput('');
                  cb(val);
                }}
                className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminContentManagementPage;
