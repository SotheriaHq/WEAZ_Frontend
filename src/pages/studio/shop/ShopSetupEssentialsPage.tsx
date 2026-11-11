import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import StudioScaffold from '@/components/studio/StudioScaffold';
import StoreEssentials from '@/pages/store/StoreEssentials';
import { getStoreStatus } from '@/api/StoreApi';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '@/store';
import { getActiveBrandId } from '@/lib/brandAccess';
import { clearStoreOpenPending, isStoreOpenPending, sleep } from '@/utils/storeSetup';

const ShopSetupEssentialsPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.user.profile);
  const activeBrandId = getActiveBrandId(user);

  useEffect(() => {
    let mounted = true;

    const checkStatus = async (): Promise<boolean> => {
      try {
        const status = await getStoreStatus({ expectedBrandId: activeBrandId });
        if (!mounted) return false;
        if (status?.isSetupComplete === true) {
          clearStoreOpenPending(user?.id);
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
      if (redirected || !isStoreOpenPending(user?.id)) return;

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
  }, [navigate, user?.id, activeBrandId]);

  return (
    <StudioScaffold active="store" onSelect={() => {}}>
      <StoreEssentials />
    </StudioScaffold>
  );
};

export default ShopSetupEssentialsPage;
