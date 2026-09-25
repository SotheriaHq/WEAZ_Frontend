import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { publicLinkApi } from '@/api/PublicLinkApi';
import { ProfileRouteProvider } from '@/context/ProfileRouteContext';
import { ProfileLayout } from '@/components/catalog/ProfileLayout';

const BrandCanonicalPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!slug) {
        setError('Storefront not found.');
        return;
      }

      try {
        const store = await publicLinkApi.resolveStorefrontBySlug(slug);
        if (!active) return;
        setOwnerId(store.ownerId);
        if (!searchParams.get('tab')) {
          const next = new URLSearchParams(searchParams);
          next.set('tab', 'Store');
          setSearchParams(next, { replace: true });
        }
      } catch {
        if (active) setError('Storefront not found.');
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [slug, searchParams, setSearchParams]);

  if (error) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-xl items-center justify-center px-4 text-center">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{error}</p>
      </div>
    );
  }

  if (!ownerId) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-xl items-center justify-center px-4 text-center">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Opening storefront...</p>
      </div>
    );
  }

  return (
    <ProfileRouteProvider profileId={ownerId} defaultTab="Store">
      <ProfileLayout />
    </ProfileRouteProvider>
  );
};

export default BrandCanonicalPage;