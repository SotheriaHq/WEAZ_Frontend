import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  StoreHeader,
  StoreStatsBar,
  StoreHeroBanner,
  StoreEmptyState,
  StoreProductGrid,
} from '@/components/store/storefront';
import { getStoreStatus, type StoreStatusResponse } from '@/api/StoreApi';

interface StoreData {
  name: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  isVerified: boolean;
  isOpen: boolean;
  followerCount: number;
  reviewCount: number;
  productCount: number;
  rating: number;
  categories: string[];
  instagram?: string;
  twitter?: string;
  website?: string;
  products: Array<{
    id: string;
    name: string;
    price: number;
    originalPrice?: number;
    image: string;
    rating?: number;
    reviewCount?: number;
    sizes?: string[];
    isNew?: boolean;
    isSale?: boolean;
  }>;
}

/**
 * MyStore Page - Owner's view of their store
 * Shows store preview with ability to add products, edit settings, etc.
 */
const MyStore: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStoreData = async () => {
      try {
        setIsLoading(true);
        const response: StoreStatusResponse = await getStoreStatus();
        
        if (!response?.profile) {
          // No store exists - redirect to setup
          navigate('/store/create');
          return;
        }

        // Transform API response to StoreData
        // Note: API uses logo/banner not logoUrl/bannerUrl
        setStoreData({
          name: response.profile.name || 'My Store',
          tagline: response.profile.tagline || undefined,
          description: response.profile.description || undefined,
          logoUrl: response.profile.logo || undefined,
          bannerUrl: response.profile.banner || undefined,
          isVerified: false, // Not in API response, default false
          isOpen: response.isStoreOpen || false,
          followerCount: 0, // Not in API response
          reviewCount: 0, // Not in API response
          productCount: 0, // Not in API response, TODO: fetch from products API
          rating: 0, // Not in API response
          categories: response.profile.tags || [],
          instagram: response.profile.socialInstagram || undefined,
          twitter: response.profile.socialTwitter || undefined,
          website: response.profile.socialWebsite || undefined,
          products: [], // TODO: Fetch products from product API
        });
      } catch (err) {
        const status = (err as any)?.response?.status;
        if (status === 404) {
          // No store exists yet for this brand
          navigate('/store/create', { replace: true });
          return;
        }
        console.error('Failed to load store data:', err);
        setError('Failed to load store data');
        toast.error('Failed to load store data');
      } finally {
        setIsLoading(false);
      }
    };

    loadStoreData();
  }, [navigate]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f]">
        <div className="animate-pulse">
          {/* Header skeleton */}
          <div className="bg-white dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-800 p-8">
            <div className="max-w-7xl mx-auto flex items-center gap-6">
              <div className="h-20 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
              <div className="flex-1">
                <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          </div>
          {/* Banner skeleton */}
          <div className="h-64 bg-gray-200 dark:bg-gray-800" />
          {/* Content skeleton */}
          <div className="max-w-7xl mx-auto px-4 py-8">
            <div className="grid grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !storeData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
            Something went wrong
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error || 'Could not load your store'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-full text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f0f0f]">
      {/* Store Header */}
      <StoreHeader
        storeName={storeData.name}
        tagline={storeData.tagline}
        logoUrl={storeData.logoUrl}
        isVerified={storeData.isVerified}
        followerCount={storeData.followerCount}
        reviewCount={storeData.reviewCount}
        productCount={storeData.productCount}
        rating={storeData.rating}
        categories={storeData.categories}
        instagram={storeData.instagram}
        twitter={storeData.twitter}
        website={storeData.website}
        isOwner={true}
      />

      {/* Stats Bar */}
      <StoreStatsBar
        shipsFrom="Nigeria"
        responseTime="Within 24 hours"
        returnPolicy="30-day returns"
      />

      {/* Hero Banner */}
      <StoreHeroBanner
        bannerUrl={storeData.bannerUrl}
        title={storeData.name}
        subtitle={storeData.tagline || storeData.description}
        badge={storeData.isOpen ? '🎉 Store Live' : '⚙️ Setting Up'}
        isOwner={true}
        onEditBanner={() => navigate('/settings/store')}
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Products Section */}
        <section>
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-serif text-gray-900 dark:text-white">
              Your Products
            </h3>
            <a
              href="/studio/products/create"
              className="px-4 py-2 rounded-full text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center gap-2"
            >
              ➕ Add Product
            </a>
          </div>

          {storeData.products.length > 0 ? (
            <StoreProductGrid
              products={storeData.products}
              storeName={storeData.name}
              isOwner={true}
            />
          ) : (
            <StoreEmptyState type="products" isOwner={true} />
          )}
        </section>

        {/* Collections Section (placeholder for future) */}
        <section className="mt-16">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-2xl font-serif text-gray-900 dark:text-white">
              Collections
            </h3>
            <a
              href="/profile/collections/create"
              className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
            >
              Create Collection →
            </a>
          </div>
          <StoreEmptyState type="collections" isOwner={true} />
        </section>
      </div>
    </div>
  );
};

export default MyStore;
