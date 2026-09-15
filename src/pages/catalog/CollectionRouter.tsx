/**
 * CollectionRouter
 *
 * Smart page component for `/collections/:id`.
 * Detects whether the ID refers to a design collection or a store collection
 * and renders the appropriate view.
 *
 * - Store collections → renders `InlineStoreCollectionView` with product drill-down
 * - Design collections → redirects to `/market?openDesign=<id>` (modal view)
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { brandApi } from '@/api/BrandApi';
import DesignApi from '@/api/DesignApi';
import { Layout } from '@/components/Layout';
import InlineStoreCollectionView from '@/components/catalog/InlineStoreCollectionView';
import type { StoreProduct } from '@/components/designs/StoreProductCard';
import InlineProductDetail from '@/components/catalog/InlineProductDetail';
import useCachedResource from '@/hooks/useCachedResource';

type CollectionRouteKind = 'store' | 'design-page' | 'design-modal';

const CollectionRouter: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);

  const { data: routeKind, loading } = useCachedResource<CollectionRouteKind | null>({
    queryKey: ['collection', 'router', id],
    queryFn: async () => {
      if (!id) return null;

      try {
        const design = await DesignApi.getDesignDetail(id);
        if (design) return 'design-page';
      } catch {
        // Not an explicit design; continue with collection detection.
      }

      try {
        const d = await brandApi.getCollectionDetail(id, { scope: 'all' });
        if (d?.isAvailableInStore === true || d?.domain === 'STORE') {
          return 'store';
        }
        return 'design-modal';
      } catch {
        return 'design-modal';
      }
    },
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (!id || loading || !routeKind || routeKind === 'store') return;

    if (routeKind === 'design-page') {
      navigate(`/designs/${encodeURIComponent(id)}${location.search}${location.hash}`, {
        replace: true,
      });
      return;
    }

    const params = new URLSearchParams(location.search);
    params.set('openDesign', id);
    const query = params.toString();
    navigate(`/market${query ? `?${query}` : ''}${location.hash}`, { replace: true });
  }, [id, loading, location.hash, location.search, navigate, routeKind]);

  if (!id) return null;

  if (loading || routeKind !== 'store') {
    return (
      <Layout>
        <div className="min-h-screen w-full bg-gray-50 dark:bg-black flex items-center justify-center">
          <div className="animate-pulse space-y-4 w-full max-w-4xl px-6 pt-24">
            <div className="h-6 w-40 bg-gray-200 dark:bg-gray-800 rounded-lg" />
            <div className="h-10 w-72 bg-gray-200 dark:bg-gray-800 rounded-lg" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] bg-gray-200 dark:bg-gray-800 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen w-full bg-gray-50 dark:bg-black pt-20 pb-10">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          {selectedProduct ? (
            <InlineProductDetail
              product={selectedProduct}
              onBack={() => setSelectedProduct(null)}
              brandName={selectedProduct.brand?.name}
            />
          ) : (
            <InlineStoreCollectionView
              collectionId={id}
              onBack={() => navigate(-1)}
              onViewProduct={(product) => setSelectedProduct(product)}
            />
          )}
        </div>
      </div>
    </Layout>
  );
};

export default CollectionRouter;