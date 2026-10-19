import type { ReactNode } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

/** Keep previously issued payment returns and receipts working after the move. */
export function LegacyStudioBillingRedirect({
  children,
}: {
  children: ReactNode;
}) {
  const [params] = useSearchParams();
  if (params.get('tab') !== 'subscription') return children;
  const next = new URLSearchParams(params);
  next.set('tab', 'subscription-billing');
  return <Navigate replace to={`/settings?${next.toString()}`} />;
}
