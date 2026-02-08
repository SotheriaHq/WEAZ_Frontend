import { useState, useEffect, useMemo, useTransition, useCallback, useRef } from 'react';
import { SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { apiClient } from '@/api/httpClient';
import { toast } from 'sonner';
import StoreProductCard, { type StoreProduct } from '@/components/designs/StoreProductCard';
import ProductCardSkeleton from '@/components/designs/ProductCardSkeleton';
import StoreEmptyState from '@/components/designs/StoreEmptyState';
import { FilterDrawer } from './FilterDrawer';
import { useNavigate } from 'react-router-dom';
import { unwrapApiResponse } from '@/types/auth';
import { brandApi } from '@/api/BrandApi';
import type { CollectionDto } from '@/types/profile';
import { useSignedFileUrl } from '@/hooks/useSignedFileUrl';
import SearchField from '@/components/SearchField';
import MediaRenderer from '@/components/media/MediaRenderer';
import InlineProductDetail from './InlineProductDetail';

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

interface ProductCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

interface CatalogShopTabProps {
  brandId: string;
  isStoreOpen?: boolean;
  isOwner?: boolean;
  ownerHasStoreProfile?: boolean;
}

export default function CatalogShopTab({
  brandId,
  isStoreOpen,
  isOwner = false,
  ownerHasStoreProfile,
}: CatalogShopTabProps) {
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
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [chipsCollapsed, setChipsCollapsed] = useState(false);
  const [searchCollapsed, setSearchCollapsed] = useState(true); // Collapsed by default
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [, startTransition] = useTransition();
  const [collections, setCollections] = useState<CollectionDto[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  
  // Inline product detail state - when set, shows product detail instead of grid
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);

  // Auto-collapse filters when entering product view, expand when leaving
  useEffect(() => {
    if (selectedProduct) {
      setFiltersCollapsed(true);
    } else {
      setFiltersCollapsed(false);
    }
  }, [selectedProduct]);



  // Fetch available categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await apiClient.get<ProductCategory[]>('/products/categories');
        const cats = unwrapApiResponse(response.data) || [];
        setCategories(cats);
      } catch (err) {
        console.error('Failed to fetch categories', err);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    let mounted = true;
    const fetchCollections = async () => {
      if (!brandId) return;
      setCollectionsLoading(true);
      try {
        const result = await brandApi.getCollections(brandId, { visibility: 'public' });
        if (mounted) {
          setCollections(Array.isArray(result) ? result : []);
        }
      } catch (err) {
        console.error('Failed to fetch collections for store tab', err);
        if (mounted) setCollections([]);
      } finally {
        if (mounted) setCollectionsLoading(false);
      }
    };
    void fetchCollections();
    return () => {
      mounted = false;
    };
  }, [brandId]);

  // Click-outside handler for search field
  useEffect(() => {
    if (searchCollapsed) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        // Only collapse if search is empty
        if (!search.trim()) {
          setSearchCollapsed(true);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchCollapsed, search]);

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
          status: 'PUBLISHED', // Only show live products in Store tab
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

  // Combine hardcoded and dynamic categories
  const displayCategories = useMemo(() => {
    const staticCats = [
      { slug: 'ALL', label: 'All Items' },
      { slug: 'NEW', label: 'New Arrivals' },
      // { slug: 'TRENDING', label: 'Trending' }, // Removed to follow improved design or keep if needed
    ];
    
    // Map dynamic categories
    const dynamicCats = categories.map(c => ({ slug: c.slug, label: c.name }));
    
    return [...staticCats, ...dynamicCats];
  }, [categories]);

  const visibleCollections = useMemo(() => {
    return collections.filter((c) => {
      const title = String(c.title || c.name || '').trim();
      const isStoreProducts = title.toLowerCase() === 'store products';
      return c.isAvailableInStore !== false && !isStoreProducts;
    });
  }, [collections]);

  const featuredCollections = useMemo(() => {
    return visibleCollections.slice(0, 3);
  }, [visibleCollections]);

  // Only show 'no-collections' empty state if both collections and products are empty
  const showCollectionsEmpty = !collectionsLoading && visibleCollections.length === 0 && !loading && products.length === 0;

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

  const isFilterActive = Boolean(
    minPrice ||
    maxPrice ||
    onSale ||
    (selectedCategory !== 'ALL' && selectedCategory !== 'NEW')
  );

  const clearFilters = () => {
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setOnSale(false);
    setSelectedCategory('ALL');
    setSortBy('newest');
  };

  const CollectionCardMini = ({ collection }: { collection: CollectionDto }) => {
    const title = collection.title || collection.name || 'Collection';
    const coverInitial = collection.coverImage || undefined;
    const { url } = useSignedFileUrl(collection.coverFileId ?? null, coverInitial ?? null);
    const cover = url || coverInitial;
    const itemCount = collection.itemCount ?? collection.postsCount ?? 0;

    return (
      <button
        type="button"
        onClick={() => navigate(`/collections/${collection.id}`)}
        className="group text-left"
      >
        <div className="relative h-56 w-full rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center">
          {cover ? (
            <MediaRenderer
              kind="image"
              src={cover}
              alt={title}
              maxHeightClassName="max-h-56"
              maxWidthClassName="max-w-full"
              className="w-full"
              mediaClassName="transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-gray-400">
              {title.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent p-4">
            <div className="text-sm font-semibold text-white">{title}</div>
            <div className="text-xs text-white/80">{itemCount} items</div>
          </div>
        </div>
      </button>
    );
  };

  // Move selectedProduct check inside the specific content area
  // instead of replacing the whole component return

  return (
    <div className="w-full">
      {/* Featured Collections - Only show if there are collections */}
      {!collectionsLoading && featuredCollections.length > 0 && (
        <section className="mb-8">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Featured Collections</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Curated highlights from this store</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/profile/${encodeURIComponent(brandId)}?tab=Content`)}
              className="text-sm font-medium text-purple-600 hover:text-purple-700"
            >
              View all
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featuredCollections.map((collection) => (
              <CollectionCardMini key={collection.id} collection={collection} />
            ))}
          </div>
        </section>
      )}
      {showCollectionsEmpty ? (
        <section className="mb-8">
          <StoreEmptyState type="no-collections" isOwner={isOwner} />
        </section>
      ) : !collectionsLoading && featuredCollections.length === 0 && products.length > 0 && (
        /* Show an exciting prompt to create collections when products exist */
        <section className="mb-8">
          <div className="relative overflow-hidden rounded-2xl border border-purple-200/50 dark:border-purple-500/20 bg-gradient-to-br from-purple-50 via-white to-fuchsia-50 dark:from-purple-950/30 dark:via-black dark:to-fuchsia-950/20 p-6">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400/20 to-transparent rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-fuchsia-400/20 to-transparent rounded-full blur-2xl" />
            
            <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                  <span className="text-2xl">✨</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    Featured Collections
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300">Coming Soon</span>
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                    {isOwner 
                      ? 'Curate your products into themed collections to boost discoverability!' 
                      : 'Check back soon for curated collections from this store.'}
                  </p>
                </div>
              </div>
              
              {isOwner && (
                <button
                  type="button"
                  onClick={() => navigate('/studio/store/collections/new')}
                  className="flex-shrink-0 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white text-sm font-semibold shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                >
                  Create Collection
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Search and Filter Row - Premium Glass Header */}
      <div className="sticky top-0 z-30 bg-white/90 dark:bg-black/90 backdrop-blur-xl py-5 -mx-4 px-6 mb-8 border-b border-gray-100/50 dark:border-white/5 shadow-sm space-y-4 transition-all duration-300">
        <div className="flex gap-3 items-center">
          {/* Search Input with click-outside detection */}
          <div 
            ref={searchContainerRef}
            className={`transition-all duration-300 ease-out ${searchCollapsed ? 'w-11' : 'flex-1 max-w-[520px]'}`}
          >
            {searchCollapsed ? (
              <button
                type="button"
                onClick={() => setSearchCollapsed(false)}
                className="h-11 w-11 rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
                aria-label="Open search"
              >
                <span className="text-base">🔎</span>
              </button>
            ) : (
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder="Search store..."
                showFilter={false}
                className="!max-w-none w-full shadow-sm border-gray-200 dark:border-white/10 animate-in fade-in slide-in-from-left-2 duration-200"
              />
            )}
          </div>

          {/* Toggle filters with emoji - Tooltip on hover */}
          <div className="relative group">
            <button
              type="button"
              onClick={() => setFiltersCollapsed((prev) => !prev)}
              className="flex-shrink-0 h-9 w-9 rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
            >
              <span className="text-sm">{filtersCollapsed ? '📁' : '📂'}</span>
            </button>
            <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              {filtersCollapsed ? 'Show filters' : 'Hide filters'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          {/* Category Chips Scroll */}
          <div className={`flex-1 transition-all duration-300 ease-out ${chipsCollapsed ? 'max-h-0 opacity-0 overflow-hidden py-0' : 'max-h-[200px] opacity-100 py-1'}`}>
            <div className="flex gap-2 overflow-x-auto no-scrollbar items-center pb-1">
              {displayCategories.map((cat) => {
                const active = selectedCategory === cat.slug;
                return (
                  <button
                    type="button"
                    key={cat.slug}
                    onClick={() => startTransition(() => {
                      setSelectedCategory(cat.slug);
                    })}
                    className={`
                      shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-200 border
                      ${active 
                        ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 text-white border-transparent shadow-lg translate-y-[-1px]' 
                        : 'bg-white/80 dark:bg-white/5 text-gray-600 dark:text-gray-300 border-gray-200/80 dark:border-white/10 hover:border-purple-300 dark:hover:border-purple-400/50 hover:text-gray-900 dark:hover:text-white hover:bg-purple-50/60 dark:hover:bg-purple-500/10'}
                    `}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Toggle filters with emoji */}
          <button
            type="button"
            onClick={() => setChipsCollapsed((prev) => !prev)}
            className="flex-shrink-0 h-9 w-9 rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/10 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
            aria-label={chipsCollapsed ? 'Show filters' : 'Hide filters'}
          >
            <span className="text-sm">{chipsCollapsed ? '📂' : '📁'}</span>
          </button>
          
          {/* Sort Dropdown */}
          <div className="flex-shrink-0 flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-white/10">
            <span className="text-xs text-gray-400 font-medium hidden sm:inline-block">
               {loading ? '...' : total} items
            </span>
            <FilterDropdown
              value={sortBy}
              onChange={setSortBy}
              options={SORT_OPTIONS}
              placeholder="Sort"
              className="border-none bg-transparent shadow-none px-0 min-w-[fit-content] text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-purple-600 dark:hover:text-purple-400"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* Desktop Filters Sidebar - Collapses horizontally to the side */}
        <aside className={`hidden lg:block flex-shrink-0 transition-all duration-300 ease-in-out ${filtersCollapsed ? 'w-12' : 'w-72'}`}>
          <div className={`sticky top-28 rounded-xl border border-gray-200/60 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] transition-all duration-300 ease-out overflow-hidden shadow-sm ${filtersCollapsed ? 'p-2' : 'p-5'}`}>
            <div className="flex items-center justify-between">
              <h4 className={`text-sm font-semibold text-gray-900 dark:text-white transition-all duration-300 whitespace-nowrap ${filtersCollapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>Filters</h4>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearFilters}
                  className={`text-xs font-medium text-purple-600 hover:text-purple-700 transition-all duration-300 whitespace-nowrap ${filtersCollapsed ? 'opacity-0 w-0 overflow-hidden pointer-events-none' : 'opacity-100'}`}
                >
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={() => setFiltersCollapsed((prev) => !prev)}
                  className="h-8 w-8 flex-shrink-0 rounded-full border border-gray-200 dark:border-white/10 bg-white/70 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-white/10 transition flex items-center justify-center"
                  aria-label={filtersCollapsed ? 'Expand filters' : 'Collapse filters'}
                >
                  {filtersCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
                </button>
              </div>
            </div>

            <div className={`transition-all duration-300 overflow-hidden ${filtersCollapsed ? 'max-h-0 opacity-0' : 'max-h-[1200px] opacity-100 mt-4'}`}>
              <div className="space-y-6">
                <div>
                  <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">Category</h5>
                  <div className="space-y-2">
                    {displayCategories.map((cat) => (
                      <label key={cat.slug} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input
                          type="radio"
                          name="category"
                          checked={selectedCategory === cat.slug}
                          onChange={() => setSelectedCategory(cat.slug)}
                          className="h-4 w-4 border-gray-300 text-purple-600 focus:ring-0"
                        />
                        <span>{cat.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-white/10 pt-4">
                  <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">Price range</h5>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={minPrice ?? ''}
                      onChange={(e) => setMinPrice(e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="Min"
                      className="threadly-search-input px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      min={0}
                      value={maxPrice ?? ''}
                      onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : undefined)}
                      placeholder="Max"
                      className="threadly-search-input px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-200 dark:border-white/10 pt-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={onSale}
                      onChange={(e) => setOnSale(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-0"
                    />
                    On sale only
                  </label>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Product Grid or Inline Detail */}
        <div className="flex-1 min-w-0">
          {selectedProduct ? (
            <div className="w-full">
              <InlineProductDetail
                product={selectedProduct}
                onBack={() => setSelectedProduct(null)}
                brandName={selectedProduct.brand?.name}
              />
            </div>
          ) : (
            <>
              {error ? (
                <div className="rounded-2xl border border-red-200 dark:border-red-500/20 bg-white/70 dark:bg-white/5 p-6">
                  <div className="text-red-600 dark:text-red-300 font-medium">{error}</div>
                </div>
              ) : null}

              {!error && !loading && products.length === 0 ? (
                <StoreEmptyState type="no-products" isOwner={isOwner} />
              ) : null}

              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
                {loading
                  ? Array.from({ length: 8 }).map((_, idx) => <ProductCardSkeleton key={idx} />)
                  : products.map((p) => (
                    <StoreProductCard 
                      key={p.id} 
                      product={p} 
                      onViewProduct={(product) => setSelectedProduct(product)}
                    />
                  ))}
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
            </>
          )}
        </div>
      </div>

      <FilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={{ minPrice, maxPrice, onSale, category: selectedCategory, sortBy }}
        onApply={(newFilters) => {
          if (newFilters.minPrice !== undefined) setMinPrice(newFilters.minPrice);
          if (newFilters.maxPrice !== undefined) setMaxPrice(newFilters.maxPrice);
          if (newFilters.onSale !== undefined) setOnSale(newFilters.onSale);
          if (newFilters.category !== undefined) setSelectedCategory(newFilters.category);
          if (newFilters.sortBy !== undefined) setSortBy(newFilters.sortBy);
        }}
        categories={categories}
      />
    </div>
  );
}
