import React, { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { publicLinkApi } from '@/api/PublicLinkApi';

const AliasRedirectShell: React.FC<{ label: string }> = ({ label }) => {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-xl items-center justify-center px-4 text-center">
      <div>
        <div className="text-4xl">🧭</div>
        <p className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-300">{label}</p>
      </div>
    </div>
  );
};

const AliasRedirectError: React.FC<{ message: string }> = ({ message }) => {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-xl items-center justify-center px-4 text-center">
      <div>
        <div className="text-4xl">⚠️</div>
        <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">{message}</p>
      </div>
    </div>
  );
};

export const ProfileAliasRedirect: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!username) {
        setError('Profile not found.');
        return;
      }

      try {
        const profile = await publicLinkApi.resolveProfileByUsername(username);
        if (!active) return;
        setTarget(`/profile/${encodeURIComponent(profile.id)}`);
      } catch {
        if (active) setError('Profile not found.');
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [username]);

  if (target) return <Navigate to={target} replace />;
  if (error) return <AliasRedirectError message={error} />;
  return <AliasRedirectShell label="Opening profile..." />;
};

export const StorefrontAliasRedirect: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [target, setTarget] = useState<string | null>(null);
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
        setTarget(`/profile/${encodeURIComponent(store.ownerId)}?tab=Store`);
      } catch {
        if (active) setError('Storefront not found.');
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [slug]);

  if (target) return <Navigate to={target} replace />;
  if (error) return <AliasRedirectError message={error} />;
  return <AliasRedirectShell label="Opening storefront..." />;
};

export const ProductAliasRedirect: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [target, setTarget] = useState<string | null>(null);
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
        setTarget(`/products/${encodeURIComponent(product.id)}`);
      } catch {
        if (active) setError('Product not found.');
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [slug]);

  if (target) return <Navigate to={target} replace />;
  if (error) return <AliasRedirectError message={error} />;
  return <AliasRedirectShell label="Opening product..." />;
};
