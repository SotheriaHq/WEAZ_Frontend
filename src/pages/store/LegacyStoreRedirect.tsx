import { Navigate, useParams } from 'react-router-dom';

export default function LegacyStoreRedirect() {
  const { brandId } = useParams<{ brandId: string }>();
  const safeBrandId = brandId ? encodeURIComponent(brandId) : '';
  // "Store" tab is the public product storefront; "Collections" is a separate (social) collections view.
  const to = safeBrandId ? `/profile/${safeBrandId}?tab=Store` : '/profile?tab=Store';
  return <Navigate to={to} replace />;
}
