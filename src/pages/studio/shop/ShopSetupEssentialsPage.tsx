import React, { useEffect } from 'react';
import StudioScaffold from '@/components/studio/StudioScaffold';
import StoreEssentials from '@/pages/store/StoreEssentials';
import { getStoreStatus } from '@/api/StoreApi';
import { useNavigate } from 'react-router-dom';
import { clearStoreOpenPending, isStoreOpenPending, sleep } from '@/utils/storeSetup';

const ShopSetupEssentialsPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const checkStatus = async (): Promise<boolean> => {
      try {
        const status = await getStoreStatus();
        if (!mounted) return false;
        if (status?.isStoreOpen) {
          clearStoreOpenPending();
          navigate('/studio/store', { replace: true });
          return true;
        }
      } catch {
        // allow essentials to render for new stores
      }
      return false;
    };

    const run = async () => {
      const redirected = await checkStatus();
      if (redirected || !isStoreOpenPending()) return;

      for (let attempt = 0; attempt < 6; attempt += 1) {
        await sleep(700);
        const redirectedOnRetry = await checkStatus();
        if (redirectedOnRetry) return;
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
