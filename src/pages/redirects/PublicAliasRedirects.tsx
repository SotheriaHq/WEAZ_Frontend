import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { publicLinkApi } from '@/api/PublicLinkApi';

/**
 * Carry the query and hash through the redirect.
 *
 * These aliases resolved a username or slug to an id and then navigated to the
 * bare path, dropping everything after it. That is why "Store" in the content
 * viewer landed on the brand's Content tab: the viewer builds
 * `/u/:username?tab=Store`, the alias threw `?tab=Store` away, and the catalog
 * fell back to its default tab. Anything else a caller pins to an alias link —
 * `?collectionId=`, `?visibility=`, a deep-link hash — was lost the same way.
 */
const withIncomingQuery = (path: string, search: string, hash: string): string => {
  const [base, ownSearch = ''] = path.split('?');
  const merged = new URLSearchParams(search);
  // The alias's own params win: a redirect that pins a destination tab means it.
  new URLSearchParams(ownSearch).forEach((value, key) => merged.set(key, value));
  const serialized = merged.toString();
  return `${base}${serialized ? `?${serialized}` : ''}${hash}`;
};

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
  const { search, hash } = useLocation();
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

  if (target) return <Navigate to={withIncomingQuery(target, search, hash)} replace />;
  if (error) return <AliasRedirectError message={error} />;
  return <AliasRedirectShell label="Opening profile..." />;
};

export const StorefrontAliasRedirect: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { search, hash } = useLocation();
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

  if (target) return <Navigate to={withIncomingQuery(target, search, hash)} replace />;
  if (error) return <AliasRedirectError message={error} />;
  return <AliasRedirectShell label="Opening storefront..." />;
};

export const ProductAliasRedirect: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { search, hash } = useLocation();
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

  if (target) return <Navigate to={withIncomingQuery(target, search, hash)} replace />;
  if (error) return <AliasRedirectError message={error} />;
  return <AliasRedirectShell label="Opening product..." />;
};
