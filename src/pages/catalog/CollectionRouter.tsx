/**
 * CollectionRouter
 *
 * Smart page component for `/collections/:id`.
 * Detects whether the ID refers to a design collection or a store collection
 * and renders the appropriate view.
 *
 * - Store collections → renders `CollectionView` (InlineCollectionViewer-based)
 * - Design collections → renders `DesignView`
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { brandApi } from '@/api/BrandApi';
import DesignView from './DesignView';
import { Layout } from '@/components/Layout';
import InlineStoreCollectionView from '@/components/catalog/InlineStoreCollectionView';
import type { StoreProduct } from '@/components/designs/StoreProductCard';
import InlineProductDetail from '@/components/catalog/InlineProductDetail';

const CollectionRouter: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [type, setType] = useState<'store' | 'design' | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);

  useEffect(() => {
    if (!id) return;
    let mounted = true;

    const detect = async () => {
      setLoading(true);
      try {
        // Use the general /collections/:id endpoint with scope=all
        // Backend will find the collection in either table
        const d = await brandApi.getCollectionDetail(id, { scope: 'all' });
        if (!mounted) return;
        if (d?.isAvailableInStore === true || d?.domain === 'STORE') {
          setType('store');
        } else {
          setType('design');
        }
      } catch {
        if (mounted) {
          // Fallback to design view — it has its own error handling (locks, 404, etc.)
          setType('design');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void detect();
    return () => { mounted = false; };
  }, [id]);

  if (!id) return null;

  if (loading) {
    return (
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
    );
  }

  // Store collections render within Layout with product drill-down
  if (type === 'store') {
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
  }

  // Design collections use the existing DesignView
  return <DesignView />;
};

export default CollectionRouter;
