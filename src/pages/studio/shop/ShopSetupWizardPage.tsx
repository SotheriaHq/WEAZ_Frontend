import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';
import StudioScaffold from '@/components/studio/StudioScaffold';
import StoreCreationWizard from '@/pages/store/StoreCreationWizard';
import { getStoreStatus } from '@/api/StoreApi';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '@/store';
import { clearStoreOpenPending, isStoreOpenPending, sleep } from '@/utils/storeSetup';

const ShopSetupWizardPage: React.FC = () => {
  const navigate = useNavigate();
  const user = useSelector((state: RootState) => state.user.profile);

  useEffect(() => {
    let mounted = true;

    const checkStatus = async (): Promise<boolean> => {
      try {
        const status = await getStoreStatus();
        if (!mounted) return false;
        if (status?.isStoreOpen) {
          clearStoreOpenPending(user?.id);
          navigate('/studio/store', { replace: true });
          return true;
        }
      } catch {
        // allow wizard to render for new stores
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
  }, [navigate, user?.id]);

  return (
    <StudioScaffold active="store" onSelect={() => {}}>
      <StoreCreationWizard />
    </StudioScaffold>
  );
};

export default ShopSetupWizardPage;
