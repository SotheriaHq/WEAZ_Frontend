import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { publicLinkApi } from '@/api/PublicLinkApi';
import ProductDetailsPage from '@/pages/catalog/ProductDetailsPage';

const ProductCanonicalPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [productId, setProductId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!slug) {
        setError('Product not found.');
        return;
      }

      try {
        const product = await publicLinkApi.resolveProductBySlug(slug);
        if (!active) return;
        setProductId(product.id);
      } catch {
        if (active) setError('Product not found.');
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [slug]);

  if (error) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-xl items-center justify-center px-4 text-center">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{error}</p>
      </div>
    );
  }

  if (!productId) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-xl items-center justify-center px-4 text-center">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Opening product...</p>
      </div>
    );
  }

  return <ProductDetailsPage resolvedProductId={productId} />;
};

export default ProductCanonicalPage;