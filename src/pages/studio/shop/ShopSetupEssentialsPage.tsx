import React, { useEffect } from 'react';
import StudioScaffold from '@/components/studio/StudioScaffold';
import StoreEssentials from '@/pages/store/StoreEssentials';
import { getStoreStatus } from '@/api/StoreApi';
import { useNavigate } from 'react-router-dom';

const ShopSetupEssentialsPage: React.FC = () => {
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
        // allow essentials to render for new stores
      }
    };
    void run();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  return (
    <StudioScaffold active="store" onSelect={() => {}}>
      <StoreEssentials />
    </StudioScaffold>
  );
};

export default ShopSetupEssentialsPage;
