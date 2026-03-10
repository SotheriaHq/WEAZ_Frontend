import React, { Suspense, lazy } from 'react';
import type { EntityQrModalProps } from './EntityQrModal';

const EntityQrModal = lazy(async () => {
  const mod = await import('./EntityQrModal');
  return { default: mod.default };
});

const LazyEntityQrModal: React.FC<EntityQrModalProps> = (props) => {
  return (
    <Suspense fallback={null}>
      <EntityQrModal {...props} />
    </Suspense>
  );
};

export default LazyEntityQrModal;
