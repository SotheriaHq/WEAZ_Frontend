import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  MapPin,
  Users,
  Package,
  Star,
  ShoppingBag,
  Instagram,
  Globe,
  Twitter,
  MessageCircle,
  Search,
  Filter,
  Grid3X3,
  List,
  ChevronDown,
  X,
  Settings,
} from 'lucide-react';
import type { RootState } from '@/store';
import { apiClient } from '@/api/httpClient';
import { toast } from 'sonner';
import StoreProductCard, { type StoreProduct } from '@/components/designs/StoreProductCard';
import ProductCardSkeleton from '@/components/designs/ProductCardSkeleton';
import StoreEmptyState from '@/components/designs/StoreEmptyState';
import { FrostedButton } from '@/components/ui/FrostedButton';
import ImageWithFallback from '@/components/ImageWithFallback';
import { Tag } from '@/components/ui/Tag';

interface BrandProfile {
  id: string;
  username: string;
  brandFullName: string;
  brandDescription?: string;
  brandCountry?: string;
  brandState?: string;
  brandCity?: string;
  brandTags: string[];
  profileImage?: string;
  bannerImage?: string;
  socialInstagram?: string;
  socialTwitter?: string;
  socialWebsite?: string;
  followersCount: number;
  collectionsCount: number;
  ordersCount?: number;
  rating?: number;
  reviewsCount?: number;
}

interface ProductsResponse {
  items: StoreProduct[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'popular', label: 'Most Popular' },
];

const GENDER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'EVERYBODY', label: 'Unisex' },
];

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const COLOR_OPTIONS = [
  { name: 'Black', hex: '#000000' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Navy', hex: '#1E3A5F' },
  { name: 'Red', hex: '#DC2626' },
  { name: 'Green', hex: '#16A34A' },
  { name: 'Yellow', hex: '#EAB308' },
  { name: 'Purple', hex: '#9333EA' },
  { name: 'Orange', hex: '#EA580C' },
];

const BrandStore: React.FC = () => {
  const { brandId } = useParams<{ brandId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isAuth = useSelector((s: RootState) => s.user.isAuthenticated);
  const currentUser = useSelector((s: RootState) => s.user.profile);

  // Brand data
  const [brand, setBrand] = useState<BrandProfile | null>(null);
  const [brandLoading, setBrandLoading] = useState(true);
  const [bannerError, setBannerError] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [brandError, setBrandError] = useState(false);
  const [productsError, setProductsError] = useState<string | null>(null);
  const previewBrand = (location.state as { brandPreview?: Partial<BrandProfile> } | undefined)?.brandPreview;

  const buildBrandFromPreview = useCallback(
    (preview: Partial<BrandProfile>): BrandProfile => ({
      id: preview.id ?? brandId ?? 'brand',
      username:
        preview.username ??
        (preview.brandFullName ? preview.brandFullName.replace(/\s+/g, '').toLowerCase() : 'brand'),
      brandFullName: preview.brandFullName ?? preview.username ?? 'Brand',
      brandDescription: preview.brandDescription ?? '',
      brandCountry: preview.brandCountry,
      brandState: preview.brandState,
      brandCity: preview.brandCity,
      brandTags: preview.brandTags ?? [],
      profileImage: preview.profileImage,
      bannerImage: preview.bannerImage,
      socialInstagram: preview.socialInstagram,
      socialTwitter: preview.socialTwitter,
      socialWebsite: preview.socialWebsite,
      followersCount: preview.followersCount ?? 0,
      collectionsCount: preview.collectionsCount ?? 0,
      ordersCount: preview.ordersCount ?? 0,
      rating: preview.rating,
      reviewsCount: preview.reviewsCount,
    }),
    [brandId]
  );

  // Products data
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [gender, setGender] = useState('');
  const [minPrice, setMinPrice] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [onSale, setOnSale] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Active tab
  const [activeTab, setActiveTab] = useState('all');

  // Check if any filters are active
  const hasActiveFilters = Boolean(
    search ||
    gender ||
    minPrice !== undefined ||
    maxPrice !== undefined ||
    selectedSizes.length > 0 ||
    selectedColors.length > 0 ||
    onSale
  );

  // Clear all filters
  const clearFilters = () => {
    setSearch('');
    setGender('');
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setSelectedSizes([]);
    setSelectedColors([]);
    setOnSale(false);
    setActiveTab('all');
  };

  useEffect(() => {
    setBannerError(false);
  }, [brand?.bannerImage]);

  useEffect(() => {
    if (previewBrand && !brand) {
      setBrand(buildBrandFromPreview(previewBrand));
      setBrandLoading(false);
    }
  }, [previewBrand, brand, buildBrandFromPreview]);

  // Fetch brand profile
  useEffect(() => {
    if (!brandId) return;

    const fetchBrand = async () => {
      setBrandLoading(true);
      try {
        const response = await apiClient.get(`/brands/${brandId}`);
        setBrand(response.data);
        // Check follow status
        if (isAuth) {
          try {
            const followRes = await apiClient.get(`/follows/check/${brandId}`);
            setIsFollowing(followRes.data.isFollowing);
          } catch (followErr) {
            // Non-blocking: log and continue rendering the brand
            console.warn('Follow status unavailable', followErr);
          }
        }
        setBrandError(false);
      } catch (error) {
        setBrandError(true);
        toast.error('Failed to load brand profile. Showing preview instead.');
        if (!brand && previewBrand) {
          setBrand(buildBrandFromPreview(previewBrand));
        }
      } finally {
        setBrandLoading(false);
      }
    };

    fetchBrand();
  }, [brandId, isAuth, navigate, buildBrandFromPreview, previewBrand, brand]);

  // Fetch products
  const fetchProducts = useCallback(async (resetPage = false) => {
    if (!brandId) return;

    const currentPage = resetPage ? 1 : page;
    setProductsLoading(true);

    try {
      const params: any = {
        page: currentPage,
        limit: 20,
        sortBy,
      };

      if (search) params.search = search;
      if (gender) params.gender = gender;
      if (minPrice !== undefined) params.minPrice = minPrice;
      if (maxPrice !== undefined) params.maxPrice = maxPrice;
      if (selectedSizes.length) params.sizes = selectedSizes.join(',');
      if (selectedColors.length) params.colors = selectedColors.join(',');
      if (onSale) params.onSale = 'true';
      if (activeTab === 'sale') params.onSale = 'true';

      const response = await apiClient.get<ProductsResponse>(`/brands/${brandId}/products`, { params });

      if (resetPage) {
        setProducts(response.data.items);
        setPage(1);
      } else {
        setProducts((prev) => (currentPage === 1 ? response.data.items : [...prev, ...response.data.items]));
      }

      setTotal(response.data.total);
      setHasMore(response.data.hasNextPage);
      setProductsError(null);
    } catch (error) {
      const message = (error as any)?.response?.data?.message ?? 'Failed to load products';
      setProductsError(message);
      toast.error(message);
    } finally {
      setProductsLoading(false);
    }
  }, [brandId, page, search, sortBy, gender, minPrice, maxPrice, selectedSizes, selectedColors, onSale, activeTab]);

  useEffect(() => {
    fetchProducts(true);
  }, [sortBy, gender, minPrice, maxPrice, selectedSizes, selectedColors, onSale, activeTab, search]);

  const handleFollow = async () => {
    if (!isAuth) {
      toast.info('Please sign in to follow brands');
      return;
    }

    try {
      if (isFollowing) {
        await apiClient.delete(`/follows/${brandId}`);
        setIsFollowing(false);
        toast.success('Unfollowed');
      } else {
        await apiClient.post(`/follows/${brandId}`);
        setIsFollowing(true);
        toast.success('Following');
      }
    } catch (error) {
      toast.error('Failed to update follow status');
    }
  };

  const handleLoadMore = () => {
    setPage((prev) => prev + 1);
    fetchProducts();
  };

  const toggleSize = (size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  const toggleColor = (color: string) => {
    setSelectedColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    );
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (brandLoading && !brand) {
    return (
      <div className="min-h-screen bg-white dark:bg-black">
        {/* Skeleton loader */}
        <div className="animate-pulse">
          <div className="h-64 bg-gray-200 dark:bg-gray-800" />
          <div className="max-w-7xl mx-auto px-4 -mt-16">
            <div className="flex items-end gap-6">
              <div className="w-32 h-32 rounded-xl bg-gray-300 dark:bg-gray-700" />
              <div className="flex-1 pb-4">
                <div className="h-8 w-48 bg-gray-300 dark:bg-gray-700 rounded mb-2" />
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-600 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!brand) return null;

  const isOwnStore = currentUser?.id === brandId;
  const hasBannerImage = Boolean(brand.bannerImage) && !bannerError;

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      {brandError && (
        <div className="mx-4 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 shadow-sm">
          We had a problem loading the full brand profile. Showing available preview information.
        </div>
      )}
      {/* Banner */}
      <div className="relative h-48 md:h-64 lg:h-72 overflow-hidden">
        {hasBannerImage ? (
          <img
            src={brand.bannerImage}
            alt={`${brand.brandFullName} banner`}
            className="w-full h-full object-cover"
            onError={() => setBannerError(true)}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-900 via-purple-700 to-purple-500" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      </div>

      {/* Brand Info Card */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-20 md:-mt-24 mb-6">
          <div className="glass-panel bg-white/90 dark:bg-gray-950/90 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/20 dark:border-white/10">
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <ImageWithFallback
                  src={brand.profileImage ?? null}
                  alt={brand.brandFullName}
                  fallbackName={brand.brandFullName}
                  className="w-24 h-24 md:w-32 md:h-32"
                  containerClassName="w-24 h-24 md:w-32 md:h-32 rounded-xl border-4 border-white dark:border-gray-900 shadow-lg"
                  rounded="lg"
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white font-serif">
                      {brand.brandFullName}
                    </h1>
                    {(brand.brandCity || brand.brandCountry) && (
                      <p className="flex items-center gap-1.5 mt-1 text-gray-600 dark:text-gray-400">
                        <MapPin size={16} />
                        {[brand.brandCity, brand.brandState, brand.brandCountry].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-3">
                    {isOwnStore ? (
                      <>
                        <FrostedButton
                          variant="primary"
                          onClick={() => navigate('/profile/settings')}
                        >
                          <Settings size={18} />
                          Manage Store
                        </FrostedButton>
                        <FrostedButton
                          variant="ghost"
                          onClick={() => navigate('/profile/collections/create')}
                        >
                          <Package size={18} />
                          Add Product
                        </FrostedButton>
                      </>
                    ) : (
                      <>
                        <FrostedButton
                          variant={isFollowing ? 'ghost' : 'primary'}
                          onClick={handleFollow}
                        >
                          {isFollowing ? 'Following' : 'Follow'}
                        </FrostedButton>
                        <FrostedButton variant="ghost">
                          <MessageCircle size={18} />
                          Message
                        </FrostedButton>
                      </>
                    )}
                  </div>
                </div>

                {/* Tags */}
                {(brand.brandTags?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {brand.brandTags!.slice(0, 5).map((tag) => (
                      <Tag key={tag} label={tag} size="sm" />
                    ))}
                  </div>
                )}

                {/* Stats */}
                <div className="flex flex-wrap items-center gap-6 mt-4 text-sm text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1.5">
                    <Users size={16} />
                    <strong className="text-gray-900 dark:text-white">{formatNumber(brand.followersCount)}</strong> Followers
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Package size={16} />
                    <strong className="text-gray-900 dark:text-white">{total}</strong> Products
                  </span>
                  {brand.rating && (
                    <span className="flex items-center gap-1.5">
                      <Star size={16} className="text-yellow-500" />
                      <strong className="text-gray-900 dark:text-white">{brand.rating.toFixed(1)}</strong>
                      {brand.reviewsCount && <span>({formatNumber(brand.reviewsCount)} reviews)</span>}
                    </span>
                  )}
                  {brand.ordersCount && (
                    <span className="flex items-center gap-1.5">
                      <ShoppingBag size={16} />
                      <strong className="text-gray-900 dark:text-white">{formatNumber(brand.ordersCount)}</strong> Orders
                    </span>
                  )}
                </div>

                {/* Social Links */}
                <div className="flex items-center gap-3 mt-4">
                  {brand.socialInstagram && (
                    <a
                      href={`https://instagram.com/${brand.socialInstagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                    >
                      <Instagram size={18} />
                    </a>
                  )}
                  {brand.socialTwitter && (
                    <a
                      href={`https://twitter.com/${brand.socialTwitter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                    >
                      <Twitter size={18} />
                    </a>
                  )}
                  {brand.socialWebsite && (
                    <a
                      href={brand.socialWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                    >
                      <Globe size={18} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs & Controls */}
        <div className="sticky top-16 z-30 -mx-4 px-4 py-3 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
              {['all', 'collections', 'new', 'sale'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                    activeTab === tab
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  {tab === 'all' ? 'All Products' : tab === 'new' ? 'New Arrivals' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 pr-4 py-2 w-48 lg:w-64 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  showFilters
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-purple-500'
                }`}
              >
                <Filter size={16} />
                Filters
              </button>

              {/* View Toggle */}
              <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                >
                  <Grid3X3 size={18} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                >
                  <List size={18} />
                </button>
              </div>

              {/* Sort */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none pl-4 pr-10 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex gap-6 py-6">
          {/* Filter Sidebar */}
          {showFilters && (
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-36 glass-panel bg-white/80 dark:bg-gray-950/80 backdrop-blur-xl rounded-xl p-5 border border-white/20 dark:border-white/10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Filters</h3>
                  <button
                    onClick={clearFilters}
                    className="text-sm text-purple-600 hover:text-purple-700"
                  >
                    Clear All
                  </button>
                </div>

                {/* Gender */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Gender</h4>
                  <div className="space-y-2">
                    {GENDER_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="gender"
                          value={opt.value}
                          checked={gender === opt.value}
                          onChange={(e) => setGender(e.target.value)}
                          className="w-4 h-4 text-purple-600"
                        />
                        <span className="text-sm text-gray-600 dark:text-gray-400">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Price Range */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Price Range</h4>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="₦0"
                      value={minPrice || ''}
                      onChange={(e) => setMinPrice(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      type="number"
                      placeholder="₦500,000"
                      value={maxPrice || ''}
                      onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm"
                    />
                  </div>
                </div>

                {/* Sizes */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Size</h4>
                  <div className="flex flex-wrap gap-2">
                    {SIZE_OPTIONS.map((size) => (
                      <button
                        key={size}
                        onClick={() => toggleSize(size)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                          selectedSizes.includes(size)
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-purple-500'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Colors */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Color</h4>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_OPTIONS.map((color) => (
                      <button
                        key={color.name}
                        onClick={() => toggleColor(color.name)}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          selectedColors.includes(color.name)
                            ? 'border-purple-600 scale-110'
                            : 'border-gray-300 dark:border-gray-600 hover:scale-105'
                        }`}
                        style={{ backgroundColor: color.hex }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>

                {/* On Sale */}
                <div className="mb-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onSale}
                      onChange={(e) => setOnSale(e.target.checked)}
                      className="w-5 h-5 rounded text-purple-600"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">On Sale</span>
                  </label>
                </div>

                <FrostedButton variant="primary" className="w-full" onClick={() => fetchProducts(true)}>
                  Apply Filters
                </FrostedButton>
              </div>
            </aside>
          )}

          {/* Product Grid */}
          <main className="flex-1 min-w-0">
            {productsError && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 shadow-sm">
                {productsError}
              </div>
            )}
            {/* Results count */}
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Showing <strong className="text-gray-900 dark:text-white">{products.length}</strong> of{' '}
              <strong className="text-gray-900 dark:text-white">{total}</strong> products
            </p>

            {productsLoading && products.length === 0 ? (
              <ProductCardSkeleton count={8} viewMode={viewMode} />
            ) : products.length === 0 ? (
              <StoreEmptyState
                type={hasActiveFilters ? 'no-results' : 'no-products'}
                brandName={brand?.brandFullName}
                isOwner={isOwnStore}
                onClearFilters={clearFilters}
                onAction={hasActiveFilters ? clearFilters : undefined}
              />
            ) : (
              <>
                <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1'}`}>
                  {products.map((product) => (
                    <StoreProductCard
                      key={product.id}
                      product={product}
                      onViewProduct={(p) => navigate(`/products/${p.id}`)}
                    />
                  ))}
                </div>

                {/* Load More */}
                {hasMore && (
                  <div className="flex justify-center mt-8">
                    <FrostedButton
                      variant="ghost"
                      onClick={handleLoadMore}
                      disabled={productsLoading}
                    >
                      {productsLoading ? 'Loading...' : 'Load More Products'}
                    </FrostedButton>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {showFilters && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowFilters(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-80 bg-white dark:bg-gray-950 overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
              <h3 className="font-semibold">Filters</h3>
              <button onClick={() => setShowFilters(false)}>
                <X size={24} />
              </button>
            </div>
            {/* Same filter content as sidebar */}
            <div className="p-4">
              {/* Gender */}
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-3">Gender</h4>
                <div className="space-y-2">
                  {GENDER_OPTIONS.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="gender-mobile"
                        value={opt.value}
                        checked={gender === opt.value}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-4 h-4 text-purple-600"
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Price */}
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-3">Price Range</h4>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Min"
                    value={minPrice || ''}
                    onChange={(e) => setMinPrice(e.target.value ? Number(e.target.value) : undefined)}
                    className="flex-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={maxPrice || ''}
                    onChange={(e) => setMaxPrice(e.target.value ? Number(e.target.value) : undefined)}
                    className="flex-1 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm"
                  />
                </div>
              </div>

              {/* Sizes */}
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-3">Size</h4>
                <div className="flex flex-wrap gap-2">
                  {SIZE_OPTIONS.map((size) => (
                    <button
                      key={size}
                      onClick={() => toggleSize(size)}
                      className={`px-3 py-1.5 rounded-lg text-sm border ${
                        selectedSizes.includes(size)
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Colors */}
              <div className="mb-6">
                <h4 className="text-sm font-medium mb-3">Color</h4>
                <div className="flex flex-wrap gap-2">
                  {COLOR_OPTIONS.map((color) => (
                    <button
                      key={color.name}
                      onClick={() => toggleColor(color.name)}
                      className={`w-8 h-8 rounded-full border-2 ${
                        selectedColors.includes(color.name) ? 'border-purple-600' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color.hex }}
                    />
                  ))}
                </div>
              </div>

              {/* On Sale */}
              <div className="mb-6">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={onSale}
                    onChange={(e) => setOnSale(e.target.checked)}
                    className="w-5 h-5 rounded text-purple-600"
                  />
                  <span className="text-sm font-medium">On Sale Only</span>
                </label>
              </div>

              <div className="flex gap-3">
                <FrostedButton variant="ghost" className="flex-1" onClick={clearFilters}>
                  Clear
                </FrostedButton>
                <FrostedButton variant="primary" className="flex-1" onClick={() => { fetchProducts(true); setShowFilters(false); }}>
                  Apply
                </FrostedButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BrandStore;
