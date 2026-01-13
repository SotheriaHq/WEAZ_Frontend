import { Navigate, useParams } from 'react-router-dom';

export default function LegacyStoreRedirect() {
  const { brandId } = useParams<{ brandId: string }>();
  const safeBrandId = brandId ? encodeURIComponent(brandId) : '';
  const to = safeBrandId ? `/profile/${safeBrandId}?tab=Collections` : '/profile?tab=Collections';
  return <Navigate to={to} replace />;
}
