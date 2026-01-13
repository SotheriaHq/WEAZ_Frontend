import React from 'react';
import StudioScaffold from '@/components/studio/StudioScaffold';
import StoreEssentials from '@/pages/store/StoreEssentials';

const ShopSetupEssentialsPage: React.FC = () => {
  return (
    <StudioScaffold active="store" onSelect={() => {}}>
      <StoreEssentials />
    </StudioScaffold>
  );
};

export default ShopSetupEssentialsPage;
