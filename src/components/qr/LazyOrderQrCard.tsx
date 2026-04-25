import React, { Suspense, lazy } from 'react';
import type { OrderQrCardProps } from './OrderQrCard';

const OrderQrCard = lazy(async () => {
  const mod = await import('./OrderQrCard');
  return { default: mod.default };
});

const LazyOrderQrCard: React.FC<OrderQrCardProps> = (props) => {
  return (
    <Suspense fallback={null}>
      <OrderQrCard {...props} />
    </Suspense>
  );
};

export default LazyOrderQrCard;
