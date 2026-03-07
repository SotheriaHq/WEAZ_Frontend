import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import marketApi from '@/api/MarketApi';
import { apiClient } from '@/api/httpClient';
import { unwrapApiResponse } from '@/types/auth';
import type { AppDispatch, RootState } from '@/store';
import ImageWithFallback from '@/components/ImageWithFallback';
import StoreProductCard, { type StoreProduct } from '@/components/designs/StoreProductCard';
import ProductCardSkeleton from '@/components/designs/ProductCardSkeleton';
import InlineProductDetail from '@/components/catalog/InlineProductDetail';
import { fetchWishlist } from '@/features/wishlistSlice';
import FeaturedSection from '@/components/FeaturedSection';
import FeaturedGalleryModal from '@/components/FeaturedGalleryModal';

interface RawProductsPayload {
  items?: any[];
  total?: number;
  hasNextPage?: boolean;
}

const BASE_FILTERS = ['FOR_YOU', 'MENSWEAR', 'WOMENSWEAR', 'EVERYBODY', 'ON_SALE'] as const;

const ProductRail: React.FC<{
  title: string;
  subtitle: string;
  products: StoreProduct[];
  onViewProduct: (product: StoreProduct) => void;
}> = ({ title, subtitle, products, onViewProduct }) => {
  const railRef = useRef<HTMLDivElement | null>(null);

  const scrollRail = useCallback((direction: 'left' | 'right') => {
    if (!railRef.current) return;
    const amount = Math.round(railRef.current.clientWidth * 0.8);
    railRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  }, []);

  if (products.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollRail('left')}
            className="rounded-full border border-gray-300 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
            aria-label="Scroll fresh drops left"
          >
            ⬅️
          </button>
          <button
            type="button"
            onClick={() => scrollRail('right')}
            className="rounded-full border border-gray-300 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
            aria-label="Scroll fresh drops right"
          >
            ➡️
          </button>
        </div>
      </div>

      <div
        ref={railRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((product) => (
          <motion.div
            key={product.id}
            className="min-w-[260px] max-w-[260px] snap-start"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <StoreProductCard product={product} onViewProduct={onViewProduct} />
          </motion.div>
        ))}
      </div>
    </section>
  );
};

const normalizeProduct = (raw: any): StoreProduct | null => {
  const id = String(raw?.id ?? '').trim();
  if (!id) return null;

  const brand = raw?.brand ?? raw?.collection?.brand ?? {};
  const price = Number(raw?.price ?? 0);
  const salePrice = raw?.salePrice != null ? Number(raw.salePrice) : null;
  const totalStock = Number(raw?.totalStock ?? 0);
  const now = Date.now();
  const saleStartAt = raw?.saleStartAt ? new Date(raw.saleStartAt).getTime() : null;
  const saleEndAt = raw?.saleEndAt ? new Date(raw.saleEndAt).getTime() : null;
  const saleWindowValid = (!saleStartAt || saleStartAt <= now) && (!saleEndAt || saleEndAt >= now);
  const isOnSale = Boolean(salePrice != null && salePrice > 0 && salePrice < price && saleWindowValid);
  const effectivePrice = isOnSale ? Number(salePrice) : price;
  const discountPercent = isOnSale ? Math.round(((price - Number(salePrice)) / price) * 100) : null;

  const media = Array.isArray(raw?.media)
    ? raw.media
      .map((m: any) => {
        const mediaId = m?.id ? String(m.id) : null;
        const mediaUrl = m?.url ? String(m.url) : null;
        if (!mediaId || !mediaUrl) return null;
        return {
          id: mediaId,
          url: mediaUrl,
          type: String(m?.type ?? 'image'),
          isPrimary: Boolean(m?.isPrimary),
        };
      })
      .filter(Boolean) as Array<{ id: string; url: string; type: string; isPrimary?: boolean }>
    : [];

  const sizeAvailability = Array.isArray(raw?.sizes)
    ? raw.sizes.map((size: any) => ({
      size: String(size),
      inStock: totalStock > 0,
      quantity: totalStock,
    }))
    : [];

  return {
    id,
    collectionId: String(raw?.collectionId ?? raw?.collection?.id ?? ''),
    brandId: String(raw?.brandId ?? brand?.id ?? ''),
    name: String(raw?.name ?? 'Product'),
    description: raw?.description ? String(raw.description) : undefined,
    price,
    salePrice,
    effectivePrice,
    isOnSale,
    discountPercent,
    thumbnail: raw?.thumbnail ? String(raw.thumbnail) : undefined,
    images: Array.isArray(raw?.images) ? raw.images.map((img: any) => String(img)) : [],
    media,
    sizes: Array.isArray(raw?.sizes) ? raw.sizes.map((size: any) => String(size)) : [],
    sizingMode:
      raw?.sizingMode === 'RTW' ||
      raw?.sizingMode === 'CUSTOM' ||
      raw?.sizingMode === 'RTW_PLUS_CUSTOM'
        ? raw.sizingMode
        : 'NONE',
    customMeasurementKeys: Array.isArray(raw?.customMeasurementKeys)
      ? raw.customMeasurementKeys.map((k: any) => String(k))
      : [],
    customAvailable: Boolean(raw?.customAvailable),
    sizeAvailability,
    colors: Array.isArray(raw?.colors) ? raw.colors.map((c: any) => String(c)) : [],
    totalStock,
    isLowStock: totalStock > 0 && totalStock <= 5,
    isOutOfStock: totalStock <= 0,
    isFeatured: Boolean(raw?.isFeatured),
    threadsCount: Number(raw?.threadsCount ?? 0),
    viewsCount: Number(raw?.viewsCount ?? 0),
    brand: {
      id: String(brand?.id ?? raw?.brandId ?? ''),
      name: String(brand?.brandName ?? brand?.name ?? 'Brand'),
      logo: brand?.logoUrl ? String(brand.logoUrl) : undefined,
      currency: String(brand?.currency ?? 'NGN'),
    },
  };
};

const MarketPlace: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const isAuth = useSelector((state: RootState) => state.user.isAuthenticated);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<string>('FOR_YOU');
  const [visibleCount, setVisibleCount] = useState(16);
  const [heroIndex, setHeroIndex] = useState(0);


  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const feed = await marketApi.getFeed({ limit: 48 });
      const uniqueBrandIds = Array.from(
        new Set((feed.items ?? []).map((item) => item.brandId).filter(Boolean)),
      ).slice(0, 12);



      const productResults = await Promise.allSettled(
        uniqueBrandIds.map(async (brandId) => {
          const response = await apiClient.get(`/brands/${brandId}/products`, {
            params: {
              limit: 8,
              sortBy: 'newest',
              status: 'PUBLISHED',
            },
          });

          const payload = unwrapApiResponse<RawProductsPayload>(response.data);
          const rows = Array.isArray(payload?.items) ? payload.items : [];
          return rows.map((row) => ({ ...row, __brandId: brandId }));
        }),
      );

      const mapped = productResults
        .filter((entry): entry is PromiseFulfilledResult<any[]> => entry.status === 'fulfilled')
        .flatMap((entry) => entry.value)
        .map((row) => normalizeProduct(row))
        .filter((p): p is StoreProduct => Boolean(p));

      const dedupedById = new Map<string, StoreProduct>();
      for (const product of mapped) {
        if (!dedupedById.has(product.id)) {
          dedupedById.set(product.id, product);
        }
      }

      const sorted = Array.from(dedupedById.values()).sort((a, b) => {
        const aTs = Number(new Date((a as any)?.createdAt ?? 0));
        const bTs = Number(new Date((b as any)?.createdAt ?? 0));
        return (Number.isFinite(bTs) ? bTs : 0) - (Number.isFinite(aTs) ? aTs : 0);
      });

      setProducts(sorted);
    } catch (err: any) {
      const message =
        err?.response?.data?.message ||
        err?.message ||
        'Unable to load the general market right now.';
      setError(message);
      toast.error(typeof message === 'string' ? message : 'Failed to load market.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (!isAuth) return;
    void dispatch(fetchWishlist({ page: 1, limit: 100 }));
  }, [dispatch, isAuth]);

  useEffect(() => {
    if (products.length === 0) return;
    const interval = window.setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % Math.min(products.length, 3));
    }, 4500);
    return () => window.clearInterval(interval);
  }, [products.length]);

  const availableFilters = useMemo(() => {
    const fromProducts = new Set<string>(BASE_FILTERS);
    if (products.some((p) => p.sizingMode === 'CUSTOM' || p.sizingMode === 'RTW_PLUS_CUSTOM')) {
      fromProducts.add('CUSTOM_FIT');
    }
    return Array.from(fromProducts);
  }, [products]);

  const freshDrops = useMemo(() => products.slice(0, 10), [products]);
  const heroProducts = useMemo(() => products.slice(0, 3), [products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      if (selectedFilter === 'MENSWEAR' && product.sizingMode === 'CUSTOM') return false;
      if (selectedFilter === 'WOMENSWEAR' && product.sizingMode === 'CUSTOM') return false;
      if (selectedFilter === 'ON_SALE' && !product.isOnSale) return false;
      if (
        selectedFilter === 'CUSTOM_FIT' &&
        !(product.sizingMode === 'CUSTOM' || product.sizingMode === 'RTW_PLUS_CUSTOM')
      ) {
        return false;
      }

      if (!query) return true;

      const haystack = [
        product.name,
        product.description || '',
        product.brand?.name || '',
        ...(product.colors || []),
        ...(product.sizes || []),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [products, search, selectedFilter]);

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount],
  );

  useEffect(() => {
    setVisibleCount(16);
  }, [selectedFilter, search]);

  const activeHero = heroProducts[heroIndex] ?? null;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-10">
        <section className="rounded-3xl border border-gray-200/70 bg-white/40 p-4 backdrop-blur-[2px] dark:border-white/10 dark:bg-white/[0.03] sm:p-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeHero?.id ?? 'hero-empty'}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25 }}
                  className="relative overflow-hidden rounded-2xl"
                >
                  {activeHero ? (
                    <>
                      <div className="absolute inset-0">
                        <ImageWithFallback
                          src={activeHero.thumbnail || activeHero.images[0] || null}
                          alt={activeHero.name}
                          fit="cover"
                          rounded="none"
                          containerClassName="h-full w-full"
                          className="h-full w-full"
                          maxHeightClassName="max-h-full"
                          fallbackName={activeHero.name}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      </div>
                      <div className="relative flex min-h-[330px] flex-col justify-end p-6 text-white sm:min-h-[420px]">
                        <span className="mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
                          🔥 Trending now
                        </span>
                        <h1 className="max-w-xl text-2xl font-black leading-tight sm:text-4xl">
                          {activeHero.name}
                        </h1>
                        <p className="mt-2 text-sm text-white/80 sm:text-base">
                          {activeHero.brand?.name || 'Threadly Brand'} · Smooth picks from recent brand drops.
                        </p>
                        <div className="mt-5 flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedProduct(activeHero)}
                            className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-gray-900 transition-transform hover:scale-[1.02]"
                          >
                            👀 View product
                          </button>
                          <span className="rounded-full bg-black/40 px-4 py-2 text-sm font-semibold">
                            {new Intl.NumberFormat('en-NG', {
                              style: 'currency',
                              currency: 'NGN',
                              maximumFractionDigits: 0,
                            }).format(activeHero.effectivePrice || activeHero.price || 0)}
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex min-h-[330px] items-center justify-center rounded-2xl bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300">
                      No featured products yet.
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {heroProducts.slice(0, 2).map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => setSelectedProduct(product)}
                  className="group relative min-h-[155px] overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 text-left dark:border-white/10 dark:bg-white/5"
                >
                  <ImageWithFallback
                    src={product.thumbnail || product.images[0] || null}
                    alt={product.name}
                    fit="cover"
                    rounded="none"
                    containerClassName="absolute inset-0 h-full w-full"
                    className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                    maxHeightClassName="max-h-full"
                    fallbackName={product.name}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="relative p-4 text-white">
                    <p className="text-xs font-semibold uppercase tracking-wide text-white/70">{product.brand?.name}</p>
                    <p className="mt-1 line-clamp-2 text-sm font-bold">{product.name}</p>
                    <p className="mt-3 text-xs font-semibold text-white/80">✨ Tap to preview</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <FeaturedSection
          filterType="PRODUCT"
          onViewProduct={(productId) => {
            const p = products.find((pr) => pr.id === productId);
            if (p) setSelectedProduct(p);
          }}
          onSeeAll={() => setGalleryOpen(true)}
        />

        {loading ? (
          <section>
            <div className="mb-4 h-8 w-52 animate-pulse rounded-lg bg-gray-200/80 dark:bg-white/10" />
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              {Array.from({ length: 10 }).map((_, index) => (
                <ProductCardSkeleton key={index} />
              ))}
            </div>
          </section>
        ) : (
          <ProductRail
            title="Fresh Drops"
            subtitle="Recently posted by brands, sorted by newest products."
            products={freshDrops}
            onViewProduct={setSelectedProduct}
          />
        )}



        <section className="space-y-5">
          <div className="sticky top-16 z-20 rounded-2xl border border-gray-200/70 bg-white/55 p-4 backdrop-blur-[4px] dark:border-white/10 dark:bg-[#0f0b13]/55">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-2xl font-black text-gray-900 dark:text-white">Explore the Market</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">Tap any product to preview, wishlist, or add to bag.</p>
              </div>
              <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[520px] lg:flex-row">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search products, brands, colors..."
                  className="w-full rounded-full border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 outline-none transition focus:border-purple-500 dark:border-white/15 dark:bg-white/10 dark:text-white"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {availableFilters.map((filter) => {
                const active = selectedFilter === filter;
                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setSelectedFilter(filter)}
                    className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? 'border-purple-500 bg-purple-600 text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10'
                    }`}
                  >
                    {filter === 'FOR_YOU' && '✨ For You'}
                    {filter === 'MENSWEAR' && '🧥 Menswear'}
                    {filter === 'WOMENSWEAR' && '👗 Womenswear'}
                    {filter === 'EVERYBODY' && '🌍 Everybody'}
                    {filter === 'ON_SALE' && '🏷️ On Sale'}
                    {filter === 'CUSTOM_FIT' && '✂️ Custom Fit'}
                  </button>
                );
              })}
            </div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 12 }).map((_, index) => (
                <ProductCardSkeleton key={index} />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-white/70 p-10 text-center dark:border-white/10 dark:bg-white/5">
              <p className="text-3xl">🧭</p>
              <h3 className="mt-3 text-xl font-bold text-gray-900 dark:text-white">No products matched this view</h3>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Try another filter or clear your search to keep exploring.</p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSelectedFilter('FOR_YOU');
                }}
                className="mt-5 rounded-full border border-gray-300 px-5 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-100 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
              >
                Reset view
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {visibleProducts.map((product) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <StoreProductCard product={product} onViewProduct={setSelectedProduct} />
                  </motion.div>
                ))}
              </div>

              {visibleCount < filteredProducts.length && (
                <div className="flex justify-center pt-4">
                  <button
                    type="button"
                    onClick={() => setVisibleCount((prev) => prev + 16)}
                    className="rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-100 dark:border-white/15 dark:bg-white/5 dark:text-gray-100 dark:hover:bg-white/10"
                  >
                    Load more items
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-black/60 p-3 backdrop-blur-sm sm:p-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              className="mx-auto h-full w-full max-w-6xl overflow-y-auto rounded-3xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-[#120d18] sm:p-6"
            >
              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-white/20 dark:text-gray-200 dark:hover:bg-white/10"
                >
                  ✖ Close
                </button>
              </div>
              <InlineProductDetail
                product={selectedProduct}
                onBack={() => setSelectedProduct(null)}
                brandName={selectedProduct.brand?.name}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <FeaturedGalleryModal open={galleryOpen} onClose={() => setGalleryOpen(false)} />
    </div>
  );
};

export default MarketPlace;
