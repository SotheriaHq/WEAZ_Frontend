import React from 'react';
import StudioScaffold from '@/components/studio/StudioScaffold';
import StoreCreationWizard from '@/pages/store/StoreCreationWizard';

const ShopSetupWizardPage: React.FC = () => {
  return (
    <StudioScaffold active="store" onSelect={() => {}}>
      <StoreCreationWizard />
    </StudioScaffold>
  );
};

export default ShopSetupWizardPage;
