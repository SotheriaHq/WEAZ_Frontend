import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { apiClient } from '@/api/httpClient';
import { toast } from 'sonner';
import StoreProductCard, { type StoreProduct } from '@/components/designs/StoreProductCard';
import ProductCardSkeleton from '@/components/designs/ProductCardSkeleton';
import StoreEmptyState from '@/components/designs/StoreEmptyState';
import { useNavigate } from 'react-router-dom';
import { unwrapApiResponse } from '@/types/auth';

interface ProductsResponse {
  items: StoreProduct[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  nextCursor?: string | null;
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'popular', label: 'Most Popular' },
];

export default function CatalogShopTab({
  brandId,
  isStoreOpen,
  isOwner = false,
  ownerHasStoreProfile,
}: {
  brandId: string;
  isStoreOpen?: boolean;
  isOwner?: boolean;
  ownerHasStoreProfile?: boolean;
}) {
  const navigate = useNavigate();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [onSale, setOnSale] = useState(false);
  const [minPrice, setMinPrice] = useState<number | undefined>(undefined);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(undefined);

  const normalizedMinPrice = useMemo(() => {
    if (minPrice === undefined) return undefined;
    return Number.isFinite(minPrice) ? minPrice : undefined;
  }, [minPrice]);

  const normalizedMaxPrice = useMemo(() => {
    if (maxPrice === undefined) return undefined;
    return Number.isFinite(maxPrice) ? maxPrice : undefined;
  }, [maxPrice]);

  const fetchProducts = useCallback(
    async (opts?: { resetPage?: boolean; page?: number }) => {
      if (!brandId) return;
      if (isStoreOpen === false) return;
      const resetPage = Boolean(opts?.resetPage);
      const currentPage = resetPage ? 1 : opts?.page ?? page;
      const cursor = resetPage ? undefined : nextCursor ?? undefined;

      setLoading(true);
      try {
        const params: any = {
          page: currentPage,
          limit: 20,
          sortBy,
        };
        if (cursor) params.cursor = cursor;
        if (search) params.search = search;
        if (normalizedMinPrice !== undefined) params.minPrice = normalizedMinPrice;
        if (normalizedMaxPrice !== undefined) params.maxPrice = normalizedMaxPrice;
        if (onSale) params.onSale = 'true';

        const response = await apiClient.get<Partial<ProductsResponse>>(`/brands/${brandId}/products`, { params });
        const payload = unwrapApiResponse<Partial<ProductsResponse>>(response.data);
        const items = Array.isArray(payload?.items) ? payload.items : [];
        const totalCount = typeof payload?.total === 'number' ? payload.total : items.length;
        const hasNextPage = Boolean(payload?.hasNextPage);
        const responseNextCursor = payload?.nextCursor;

        setProducts((prev) => (resetPage || currentPage === 1 ? items : [...prev, ...items]));
        setTotal(totalCount);
        setHasMore(hasNextPage);
        setNextCursor(typeof responseNextCursor === 'string' && responseNextCursor.length > 0 ? responseNextCursor : null);
        setError(null);
        if (resetPage) {
          setPage(1);
        }
      } catch (e) {
        const message = (e as any)?.response?.data?.message ?? 'Failed to load products';
        setProducts([]);
        setTotal(0);
        setHasMore(false);
        setError(typeof message === 'string' ? message : 'Failed to load products');
        toast.error(typeof message === 'string' ? message : 'Failed to load products');
        setNextCursor(null);
      } finally {
        setLoading(false);
      }
    },
    [brandId, isStoreOpen, nextCursor, normalizedMaxPrice, normalizedMinPrice, onSale, page, search, sortBy]
  );

  useEffect(() => {
    if (isStoreOpen === false) {
      setLoading(false);
      setProducts([]);
      setTotal(0);
      setHasMore(false);
      setError(null);
      setNextCursor(null);
      return;
    }
    void fetchProducts({ resetPage: true, page: 1 });
  }, [fetchProducts, isStoreOpen]);

  const handleLoadMore = () => {
    setPage((prev) => {
      const next = prev + 1;
      void fetchProducts({ page: next });
      return next;
    });
  };

  const storeClosedPlaceholder = useMemo(() => {
    if (isStoreOpen !== false) return null;
    if (isOwner) {
      if (ownerHasStoreProfile === false) {
        return (
          <StoreEmptyState
            type="store-not-setup"
            isOwner
            onAction={() => navigate('/studio/store')}
          />
        );
      }
      return <StoreEmptyState type="store-not-setup" isOwner />;
    }
    return <StoreEmptyState type="store-not-open-yet" isOwner={false} />;
  }, [isOwner, isStoreOpen, navigate, ownerHasStoreProfile]);

  if (storeClosedPlaceholder) {
    return <div className="w-full">{storeClosedPlaceholder}</div>;
  }

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl pl-12 pr-4 py-3 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={onSale}
              onChange={(e) => setOnSale(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 dark:border-white/20"
            />
            On sale
          </label>

          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl pl-4 pr-10 py-3 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={minPrice ?? ''}
              onChange={(e) => setMinPrice(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="Min"
              className="w-24 bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
            />
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={maxPrice ?? ''}
              onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="Max"
              className="w-24 bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
            />
          </div>
        </div>
      </div>

      <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
        {loading ? 'Loading…' : `${total} product${total === 1 ? '' : 's'}`}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 dark:border-red-500/20 bg-white/70 dark:bg-white/5 p-6">
          <div className="text-red-600 dark:text-red-300 font-medium">{error}</div>
        </div>
      ) : null}

      {!error && !loading && products.length === 0 ? (
        <StoreEmptyState type="no-products" isOwner={isOwner} />
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 8 }).map((_, idx) => <ProductCardSkeleton key={idx} />)
          : products.map((p) => <StoreProductCard key={p.id} product={p} />)}
      </div>

      {!loading && hasMore ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={handleLoadMore}
            className="px-6 py-3 rounded-full text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors"
          >
            Load more
          </button>
        </div>
      ) : null}
    </div>
  );
}
