import React, { useEffect } from 'react';
import StudioScaffold from '@/components/studio/StudioScaffold';
import StoreCreationWizard from '@/pages/store/StoreCreationWizard';
import { getStoreStatus } from '@/api/StoreApi';
import { useNavigate } from 'react-router-dom';

const ShopSetupWizardPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const status = await getStoreStatus();
        if (!mounted) return;
        if (status?.isSetupComplete || status?.isStoreOpen) {
          navigate('/studio/store', { replace: true });
        }
      } catch {
        // allow wizard to render for new stores
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  return (
    <StudioScaffold active="store" onSelect={() => {}}>
      <StoreCreationWizard />
    </StudioScaffold>
  );
};

export default ShopSetupWizardPage;
