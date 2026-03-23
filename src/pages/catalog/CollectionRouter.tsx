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
import { useParams, useNavigate } from 'react-router-dom';
import { brandApi } from '@/api/BrandApi';
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
          // Design collections open in the modal on the market page
          navigate(`/market?openDesign=${id}`, { replace: true });
          return;
        }
      } catch {
        if (mounted) {
          // Fallback: open as design modal on market page
          navigate(`/market?openDesign=${id}`, { replace: true });
          return;
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

  // If we somehow reach here without a type, redirect to market
  return null;
};

export default CollectionRouter;
