import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';
import type { AppDispatch, RootState } from '@/store';
import { addToCart, fetchCart, fetchCustomBagCount, openCartDrawer } from '@/features/cartSlice';
import AuthRequiredPrompt from '@/components/auth/AuthRequiredPrompt';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import LazyCustomOrderComposerPage from '@/components/custom-orders/LazyCustomOrderComposerPage';
import { BagApi, type BagSourceType } from '@/api/BagApi';
import type { BagDefaultAction, BagStatus } from '@/api/StoreApi';
import ProductBagSelectorModal from '@/components/bagging/ProductBagSelectorModal';
import BagFittingsModal from '@/components/bagging/BagFittingsModal';
import StaleFittingConfirmationModal from '@/components/bagging/StaleFittingConfirmationModal';

type BagProductInput = {
  id: string;
  name?: string;
  sourceType?: BagSourceType;
  sourceId?: string;
  selectedSize?: string | null;
  selectedColor?: string | null;
  quantity?: number;
};

type BagFlowTarget = {
  product: BagProductInput;
  status: BagStatus;
};

type PendingAuthResume = {
  product: BagProductInput;
  action: BagDefaultAction;
  returnPath: string;
  resume?: () => void | Promise<void>;
};

type PendingBagAction = {
  productId: string;
  productName?: string;
  sourceType?: BagSourceType;
  sourceId?: string;
  intendedAction: BagDefaultAction;
  returnPath: string;
};

const PENDING_BAG_ACTION_KEY = 'threadly.pendingBagAction.v1';

const canUseSessionStorage = () =>
  typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';

const savePendingBagAction = (pending: PendingBagAction) => {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.setItem(PENDING_BAG_ACTION_KEY, JSON.stringify(pending));
  } catch {
    // Session storage can be unavailable in restricted browser contexts.
  }
};

const readPendingBagAction = (): PendingBagAction | null => {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_BAG_ACTION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingBagAction;
    return parsed?.productId || parsed?.sourceId ? parsed : null;
  } catch {
    return null;
  }
};

const clearPendingBagAction = () => {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.removeItem(PENDING_BAG_ACTION_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
};

type BagFlowContextValue = {
  openSelector: (product: BagProductInput, status: BagStatus) => void;
  openCustomFlow: (product: BagProductInput, status: BagStatus) => void;
  openFittings: (product: BagProductInput, status: BagStatus) => void;
  openStaleConfirmation: (product: BagProductInput, status: BagStatus) => void;
  openAuthPrompt: (
    product: BagProductInput,
    action: BagDefaultAction,
    resume?: () => void | Promise<void>,
  ) => void;
  openExistingBag: (product: BagProductInput, status: BagStatus) => void;
  closeActiveFlow: () => void;
};

const BagFlowContext = createContext<BagFlowContextValue | null>(null);

export function useBagFlow() {
  return useContext(BagFlowContext);
}

type BagFlowProviderProps = {
  children: React.ReactNode;
};

export function BagFlowProvider({ children }: BagFlowProviderProps) {
  const dispatch = useDispatch<AppDispatch>();
  const location = useLocation();
  const isAuthenticated = useSelector((state: RootState) => state.user.isAuthenticated);

  const [selectorTarget, setSelectorTarget] = useState<BagFlowTarget | null>(null);
  const [customTarget, setCustomTarget] = useState<BagFlowTarget | null>(null);
  const [fittingsTarget, setFittingsTarget] = useState<BagFlowTarget | null>(null);
  const [staleTarget, setStaleTarget] = useState<BagFlowTarget | null>(null);
  const [pendingAuth, setPendingAuth] = useState<PendingAuthResume | null>(null);

  const pendingResumeRef = useRef<PendingAuthResume | null>(null);

  useEffect(() => {
    pendingResumeRef.current = pendingAuth;
  }, [pendingAuth]);

  const closeActiveFlow = useCallback(() => {
    setSelectorTarget(null);
    setCustomTarget(null);
    setFittingsTarget(null);
    setStaleTarget(null);
    setPendingAuth(null);
    pendingResumeRef.current = null;
    clearPendingBagAction();
  }, []);

  const routeResolvedStatus = useCallback(
    async (
      product: BagProductInput,
      status: BagStatus,
      intendedAction?: BagDefaultAction,
    ) => {
      setPendingAuth(null);
      setSelectorTarget(null);
      setCustomTarget(null);
      setFittingsTarget(null);
      setStaleTarget(null);

      if (status.standard.alreadyBagged || status.custom.alreadyBagged) {
        dispatch(openCartDrawer());
        return;
      }

      const action = intendedAction && intendedAction !== 'DISABLED'
        ? intendedAction
        : status.ui.defaultAction;

      if (!status.canBag || action === 'DISABLED') {
        toast.error(status.ui.disabledReason || 'This product cannot be bagged.');
        return;
      }

      if (action === 'ADD_STANDARD') {
        await dispatch(addToCart({ productId: product.id, quantity: 1 })).unwrap();
        await Promise.allSettled([
          dispatch(fetchCart({ force: true })).unwrap(),
          dispatch(fetchCustomBagCount({ force: true })).unwrap(),
        ]);
        dispatch(openCartDrawer());
        return;
      }

      if (action === 'OPEN_SELECTOR') {
        setSelectorTarget({ product, status });
        return;
      }

      if (action === 'OPEN_FITTINGS') {
        setFittingsTarget({ product, status });
        return;
      }

      if (action === 'CONFIRM_STALE_FITTINGS') {
        setStaleTarget({ product, status });
        return;
      }

      if (action === 'OPEN_CUSTOM_FLOW') {
        if (!status.custom.available || !status.custom.configurationId) {
          toast.error(status.ui.disabledReason || 'This product is not configured for custom bagging yet.');
          return;
        }
        if (status.custom.fittingState === 'MISSING' || status.custom.fittingState === 'PARTIAL') {
          setFittingsTarget({ product, status });
          return;
        }
        if (
          status.custom.requiresStaleConfirmation ||
          status.custom.freshnessState === 'STALE' ||
          status.custom.freshnessState === 'VERY_STALE'
        ) {
          setStaleTarget({ product, status });
          return;
        }
        setCustomTarget({ product, status });
      }
    },
    [dispatch],
  );

  const resumePersistedBagAction = useCallback(async () => {
    const pending = readPendingBagAction();
    if (!pending?.productId) {
      clearPendingBagAction();
      return false;
    }

    clearPendingBagAction();
    const product = {
      id: pending.productId,
      name: pending.productName,
      sourceType: pending.sourceType,
      sourceId: pending.sourceId,
    };
    const status =
      pending.sourceType && pending.sourceType !== 'PRODUCT'
        ? await BagApi.getSourceBagStatus(pending.sourceType, pending.sourceId ?? pending.productId)
        : await BagApi.getProductBagStatus(pending.productId);
    await routeResolvedStatus(product, status, pending.intendedAction);
    return true;
  }, [routeResolvedStatus]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const resume = pendingResumeRef.current;

    pendingResumeRef.current = null;
    setPendingAuth(null);

    void resumePersistedBagAction()
      .then((handled) => {
        if (!handled && resume?.resume) {
          return Promise.resolve(resume.resume());
        }
        return undefined;
      })
      .catch(() => undefined);
  }, [isAuthenticated, resumePersistedBagAction]);

  const openSelector = useCallback((product: BagProductInput, status: BagStatus) => {
    setPendingAuth(null);
    setCustomTarget(null);
    setFittingsTarget(null);
    setStaleTarget(null);
    setSelectorTarget({ product, status });
  }, []);

  const openCustomFlow = useCallback((product: BagProductInput, status: BagStatus) => {
    if (!status.custom.available || !status.custom.configurationId) {
      toast.error(status.ui.disabledReason || 'This product is not configured for custom bagging yet.');
      return;
    }
    if (status.custom.fittingState === 'MISSING' || status.custom.fittingState === 'PARTIAL') {
      setFittingsTarget({ product, status });
      return;
    }
    if (
      status.custom.requiresStaleConfirmation ||
      status.custom.freshnessState === 'STALE' ||
      status.custom.freshnessState === 'VERY_STALE'
    ) {
      setStaleTarget({ product, status });
      return;
    }

    setPendingAuth(null);
    setSelectorTarget(null);
    setFittingsTarget(null);
    setStaleTarget(null);
    setCustomTarget({ product, status });
  }, []);

  const openFittings = useCallback((product: BagProductInput, status: BagStatus) => {
    setPendingAuth(null);
    setSelectorTarget(null);
    setCustomTarget(null);
    setStaleTarget(null);
    setFittingsTarget({ product, status });
  }, []);

  const openStaleConfirmation = useCallback((product: BagProductInput, status: BagStatus) => {
    setPendingAuth(null);
    setSelectorTarget(null);
    setCustomTarget(null);
    setFittingsTarget(null);
    setStaleTarget({ product, status });
  }, []);

  const openAuthPrompt = useCallback(
    (product: BagProductInput, action: BagDefaultAction, resume?: () => void | Promise<void>) => {
      setSelectorTarget(null);
      setCustomTarget(null);
      setFittingsTarget(null);
      setStaleTarget(null);
      const returnPath = `${location.pathname}${location.search}${location.hash}`;
      const nextPending = { product, action, returnPath, resume };
      setPendingAuth(nextPending);
      pendingResumeRef.current = nextPending;
      savePendingBagAction({
        productId: product.id,
        productName: product.name,
        sourceType: product.sourceType,
        sourceId: product.sourceId,
        intendedAction: action,
        returnPath,
      });
    },
    [location.hash, location.pathname, location.search],
  );

  const openExistingBag = useCallback(
    (_product: BagProductInput, _status: BagStatus) => {
      setPendingAuth(null);
      setSelectorTarget(null);
      setCustomTarget(null);
      setFittingsTarget(null);
      setStaleTarget(null);
      dispatch(openCartDrawer());
    },
    [dispatch],
  );

  const value = useMemo(
    () => ({
      openSelector,
      openCustomFlow,
      openFittings,
      openStaleConfirmation,
      openAuthPrompt,
      openExistingBag,
      closeActiveFlow,
    }),
    [closeActiveFlow, openAuthPrompt, openCustomFlow, openExistingBag, openFittings, openSelector, openStaleConfirmation],
  );

  const customConfigurationId = customTarget?.status.custom.configurationId ?? null;

  return (
    <BagFlowContext.Provider value={value}>
      {children}

      <AuthRequiredPrompt
        isOpen={Boolean(pendingAuth)}
        onClose={closeActiveFlow}
        onAuthNavigate={() => setPendingAuth(null)}
        feature="cart"
        title={pendingAuth ? 'Sign in to continue bagging' : undefined}
        description={
          pendingAuth
            ? `${pendingAuth.product.name || 'This item'} needs your account so we can save it to your bag.`
            : undefined
        }
      />

      <ProductBagSelectorModal
        isOpen={Boolean(selectorTarget)}
        product={selectorTarget?.product ?? null}
        status={selectorTarget?.status ?? null}
        onClose={closeActiveFlow}
        onRequireFittings={(product, status) => {
          setSelectorTarget(null);
          setFittingsTarget({ product, status });
        }}
        onRequireStaleConfirmation={(product, status) => {
          setSelectorTarget(null);
          setStaleTarget({ product, status });
        }}
      />

      <BagFittingsModal
        isOpen={Boolean(fittingsTarget)}
        product={fittingsTarget?.product ?? null}
        status={fittingsTarget?.status ?? null}
        onClose={closeActiveFlow}
        onResolved={(nextStatus) => {
          if (!fittingsTarget) return;
          void routeResolvedStatus(fittingsTarget.product, nextStatus);
        }}
      />

      <StaleFittingConfirmationModal
        isOpen={Boolean(staleTarget)}
        product={staleTarget?.product ?? null}
        status={staleTarget?.status ?? null}
        onClose={closeActiveFlow}
        onUpdateFittings={() => {
          if (!staleTarget) return;
          openFittings(staleTarget.product, staleTarget.status);
        }}
        onContinue={() => {
          if (!staleTarget) return;
          const target = staleTarget;
          setStaleTarget(null);
          if (target.status.standard.available && !target.status.custom.configurationId) {
            void dispatch(
              addToCart({
                productId: target.product.id,
                quantity: target.product.quantity ?? 1,
                selectedSize: target.product.selectedSize ?? undefined,
                selectedColor: target.product.selectedColor ?? undefined,
                measurementOverrideAccepted: true,
              }),
            )
              .unwrap()
              .then(async () => {
                await Promise.allSettled([
                  dispatch(fetchCart({ force: true })).unwrap(),
                  dispatch(fetchCustomBagCount({ force: true })).unwrap(),
                ]);
                dispatch(openCartDrawer());
              })
              .catch((error) => {
                toast.error(
                  typeof error === 'string' && error.trim()
                    ? error
                    : 'Unable to bag with saved fittings.',
                );
              });
            return;
          }
          setCustomTarget(target);
        }}
      />

      <AnimatePresence>
        {customTarget && customConfigurationId && (
          <OverlayPortal>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-layer-modal flex items-stretch justify-center bg-black/50 p-0 sm:p-4"
              onClick={closeActiveFlow}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 16 }}
                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                className="relative flex h-full w-full max-w-6xl overflow-hidden bg-white shadow-2xl sm:h-[92vh] sm:rounded-[28px] dark:bg-slate-950"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="h-full w-full overflow-y-auto">
                  <LazyCustomOrderComposerPage
                    configurationIdOverride={customConfigurationId}
                    embedded
                    onClose={closeActiveFlow}
                  />
                </div>
              </motion.div>
            </motion.div>
          </OverlayPortal>
        )}
      </AnimatePresence>
    </BagFlowContext.Provider>
  );
}

export default BagFlowProvider;
