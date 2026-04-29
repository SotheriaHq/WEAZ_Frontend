import { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'sonner';
import type { AppDispatch, RootState } from '@/store';
import {
  addToCart,
  fetchCart,
  fetchCustomBagCount,
  openCartDrawer,
} from '@/features/cartSlice';
import { useBagFlow } from '@/features/bagging/BagFlowProvider';
import {
  getBagStatus,
  type BagDefaultAction,
  type BagPulseStatus,
  type BagStatus,
} from '@/api/StoreApi';
import type { SizingMode } from '@/types/sizing';

type BagProductInput = {
  id: string;
  name?: string;
};

type BagInteractionCallbacks = {
  onOpenSelector?: (status: BagStatus, product: BagProductInput) => void;
  onOpenCustomFlow?: (status: BagStatus, product: BagProductInput) => void;
  onOpenFittings?: (status: BagStatus, product: BagProductInput) => void;
  onRequireAuth?: (product: BagProductInput, action: BagDefaultAction) => void;
  onOpenExistingBag?: (status: BagStatus, product: BagProductInput) => void;
};

type StandardBagOptions = {
  size?: string | null;
  color?: string | null;
  quantity?: number;
  sizingMode?: SizingMode;
  requiredMeasurementKeys?: string[];
  sizeFitData?: Record<string, unknown>;
  suppressAuthPrompt?: boolean;
};

type BagProductResult = {
  action: BagDefaultAction;
  status: BagStatus;
};

type BagActionResult = BagProductResult | null;

const isFittingsIncomplete = (status: BagStatus) =>
  status.custom.fittingState === 'MISSING' || status.custom.fittingState === 'PARTIAL';

const readableError = (error: unknown, fallback: string) => {
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object') {
    const response = (error as { response?: { data?: { message?: unknown } } }).response;
    const message = response?.data?.message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
};

export function useBagging() {
  const dispatch = useDispatch<AppDispatch>();
  const isAuthenticated = useSelector((state: RootState) => state.user.isAuthenticated);
  const cartItems = useSelector((state: RootState) => state.cart.items);
  const bagFlow = useBagFlow();
  const [statusByProductId, setStatusByProductId] = useState<Record<string, BagStatus>>({});
  const [loadingByProductId, setLoadingByProductId] = useState<Record<string, boolean>>({});
  const [errorByProductId, setErrorByProductId] = useState<Record<string, string | null>>({});

  const cartProductIds = useMemo(
    () => new Set(cartItems.map((item) => item.productId)),
    [cartItems],
  );

  const setLoading = useCallback((productId: string, loading: boolean) => {
    setLoadingByProductId((prev) => {
      const next = { ...prev };
      if (loading) next[productId] = true;
      else delete next[productId];
      return next;
    });
  }, []);

  const refreshBagCounts = useCallback(async () => {
    await Promise.allSettled([
      dispatch(fetchCart()).unwrap(),
      dispatch(fetchCustomBagCount()).unwrap(),
    ]);
  }, [dispatch]);

  const getStatus = useCallback(
    (productId: string) => statusByProductId[productId] ?? null,
    [statusByProductId],
  );

  const getBagAction = useCallback(
    (productId: string, fallbackDisabled = false): BagDefaultAction => {
      const status = getStatus(productId);
      if (!status) {
        return fallbackDisabled ? 'DISABLED' : 'ADD_STANDARD';
      }
      return status.ui.defaultAction;
    },
    [getStatus],
  );

  const prepareBag = useCallback(
    async (productId: string) => {
      setLoading(productId, true);
      setErrorByProductId((prev) => ({ ...prev, [productId]: null }));
      try {
        const status = await getBagStatus(productId);
        setStatusByProductId((prev) => ({ ...prev, [productId]: status }));
        return status;
      } catch (error) {
        const message = readableError(error, 'Unable to check bag status right now.');
        setErrorByProductId((prev) => ({ ...prev, [productId]: message }));
        throw error;
      } finally {
        setLoading(productId, false);
      }
    },
    [setLoading],
  );

  const addStandard = useCallback(
    async (productId: string, options: StandardBagOptions = {}) => {
      if (loadingByProductId[productId]) return null;
      setLoading(productId, true);
      try {
        await dispatch(
          addToCart({
            productId,
            quantity: options.quantity ?? 1,
            selectedSize: options.size ?? undefined,
            selectedColor: options.color ?? undefined,
            sizingMode: options.sizingMode,
            requiredMeasurementKeys: options.requiredMeasurementKeys,
            sizeFitData: options.sizeFitData,
          }),
        ).unwrap();
        await refreshBagCounts();
        const status = await getBagStatus(productId);
        setStatusByProductId((prev) => ({ ...prev, [productId]: status }));
        setErrorByProductId((prev) => ({ ...prev, [productId]: null }));
        return status;
      } catch (error) {
        const message = readableError(error, 'Failed to bag item.');
        setErrorByProductId((prev) => ({ ...prev, [productId]: message }));
        toast.error(message);
        throw error;
      } finally {
        setLoading(productId, false);
      }
    },
    [dispatch, loadingByProductId, refreshBagCounts, setLoading],
  );

  const beginSelectorFlow = useCallback(
    async (product: BagProductInput, options: BagInteractionCallbacks = {}) => {
      const status = statusByProductId[product.id] ?? (await prepareBag(product.id));
      if (bagFlow) {
        bagFlow.openSelector(product, status);
      } else {
        options.onOpenSelector?.(status, product);
      }
      return status;
    },
    [bagFlow, prepareBag, statusByProductId],
  );

  const beginCustomFlow = useCallback(
    async (product: BagProductInput, options: BagInteractionCallbacks = {}) => {
      if (!isAuthenticated) {
        const resume = () => {
          void beginCustomFlow(product, options);
        };
        if (bagFlow) {
          bagFlow.openAuthPrompt(product, 'OPEN_CUSTOM_FLOW', resume);
        } else {
          options.onRequireAuth?.(product, 'OPEN_CUSTOM_FLOW');
        }
        toast.info('Please sign in to bag items.');
        return null;
      }
      const status = statusByProductId[product.id] ?? (await prepareBag(product.id));
      if (status.custom.alreadyBagged) {
        if (bagFlow) {
          bagFlow.openExistingBag(product, status);
        } else {
          options.onOpenExistingBag?.(status, product);
        }
        return status;
      }
      if (!status.custom.available) {
        toast.error(status.ui.disabledReason || 'This product is not configured for custom bagging yet.');
        return status;
      }
      if (isFittingsIncomplete(status)) {
        if (bagFlow) {
          bagFlow.openFittings(product, status);
        } else {
          options.onOpenFittings?.(status, product);
        }
        return status;
      }
      if (bagFlow) {
        bagFlow.openCustomFlow(product, status);
      } else {
        options.onOpenCustomFlow?.(status, product);
      }
      return status;
    },
    [bagFlow, isAuthenticated, prepareBag, statusByProductId],
  );

  const beginFittingsFlow = useCallback(
    async (product: BagProductInput, options: BagInteractionCallbacks = {}) => {
      const status = statusByProductId[product.id] ?? (await prepareBag(product.id));
      if (bagFlow) {
        bagFlow.openFittings(product, status);
      } else {
        options.onOpenFittings?.(status, product);
      }
      return status;
    },
    [bagFlow, prepareBag, statusByProductId],
  );

  const startCustom = useCallback(
    async (productId: string) => {
      const status = statusByProductId[productId] ?? (await prepareBag(productId));
      if (!status.custom.available) {
        toast.error(status.ui.disabledReason || 'This product is not configured for custom bagging yet.');
      }
      return status;
    },
    [prepareBag, statusByProductId],
  );

  const bagProduct = useCallback(
    async (
      product: BagProductInput,
      options: StandardBagOptions & BagInteractionCallbacks = {},
    ): Promise<BagActionResult> => {
      if (!isAuthenticated) {
        if (options.suppressAuthPrompt) return null;
        const resume = () => {
          void bagProduct(product, { ...options, suppressAuthPrompt: true });
        };
        if (bagFlow) {
          bagFlow.openAuthPrompt(product, 'DISABLED', resume);
        } else {
          options.onRequireAuth?.(product, 'DISABLED');
        }
        toast.info('Please sign in to bag items.');
        return null;
      }

      const status = await prepareBag(product.id);
      if (!status.canBag || status.ui.defaultAction === 'DISABLED') {
        toast.error(status.ui.disabledReason || 'This product cannot be bagged.');
        if (bagFlow) {
          bagFlow.openExistingBag(product, status);
        } else {
          options.onOpenExistingBag?.(status, product);
        }
        return { action: 'DISABLED', status };
      }

      if (status.standard.alreadyBagged || status.custom.alreadyBagged) {
        if (bagFlow) {
          bagFlow.openExistingBag(product, status);
        } else {
          dispatch(openCartDrawer());
          options.onOpenExistingBag?.(status, product);
        }
        toast.info(`${product.name || 'This item'} is already in your bag.`);
        return { action: status.ui.defaultAction, status };
      }

      if (status.ui.defaultAction === 'ADD_STANDARD') {
        await addStandard(product.id, options);
        toast.success('Bagged!');
        return { action: 'ADD_STANDARD', status };
      }

      if (status.ui.defaultAction === 'OPEN_SELECTOR') {
        if (bagFlow) {
          bagFlow.openSelector(product, status);
        } else {
          options.onOpenSelector?.(status, product);
        }
        return { action: 'OPEN_SELECTOR', status };
      }

      if (status.ui.defaultAction === 'OPEN_CUSTOM_FLOW') {
        if (!status.custom.available) {
          toast.error(status.ui.disabledReason || 'This product is not configured for custom bagging yet.');
          return { action: 'DISABLED', status };
        }
        if (isFittingsIncomplete(status)) {
          if (bagFlow) {
            bagFlow.openFittings(product, status);
          } else {
            options.onOpenFittings?.(status, product);
          }
          return { action: 'OPEN_FITTINGS', status };
        }
        if (bagFlow) {
          bagFlow.openCustomFlow(product, status);
        } else {
          options.onOpenCustomFlow?.(status, product);
        }
        return { action: 'OPEN_CUSTOM_FLOW', status };
      }

      if (status.ui.defaultAction === 'OPEN_FITTINGS') {
        if (bagFlow) {
          bagFlow.openFittings(product, status);
        } else {
          options.onOpenFittings?.(status, product);
        }
        return { action: 'OPEN_FITTINGS', status };
      }

      if (bagFlow) {
        bagFlow.openExistingBag(product, status);
      } else {
        options.onOpenExistingBag?.(status, product);
      }
      return { action: status.ui.defaultAction, status };
    },
    [addStandard, bagFlow, isAuthenticated, prepareBag],
  );

  const getPulseStatus = useCallback(
    (productId: string, fallbackDisabled = false): BagPulseStatus => {
      if (loadingByProductId[productId]) return 'bagging';
      const status = statusByProductId[productId];
      if (status) return status.ui.heartbeatState;
      if (fallbackDisabled) return 'disabled';
      if (cartProductIds.has(productId)) return 'currently_bagged';
      return 'not_bagged';
    },
    [cartProductIds, loadingByProductId, statusByProductId],
  );

  return {
    statusByProductId,
    loadingByProductId,
    errorByProductId,
    getStatus,
    getBagAction,
    prepareBag,
    bagProduct,
    addStandard,
    startCustom,
    beginSelectorFlow,
    beginCustomFlow,
    beginFittingsFlow,
    refreshBagCounts,
    getPulseStatus,
  };
}

export default useBagging;
