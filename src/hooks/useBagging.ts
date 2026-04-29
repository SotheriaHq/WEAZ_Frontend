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

type StandardBagOptions = {
  size?: string | null;
  color?: string | null;
  quantity?: number;
  sizingMode?: SizingMode;
  requiredMeasurementKeys?: string[];
  sizeFitData?: Record<string, unknown>;
};

type BagProductResult = {
  action: BagDefaultAction;
  status: BagStatus;
};

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
        return status;
      } catch (error) {
        toast.error(readableError(error, 'Failed to bag item.'));
        throw error;
      } finally {
        setLoading(productId, false);
      }
    },
    [dispatch, loadingByProductId, refreshBagCounts, setLoading],
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
    async (product: BagProductInput, options: StandardBagOptions = {}): Promise<BagProductResult | null> => {
      if (!isAuthenticated) {
        toast.info('Please sign in to bag items.');
        return null;
      }

      const status = await prepareBag(product.id);
      if (!status.canBag || status.ui.defaultAction === 'DISABLED') {
        toast.error(status.ui.disabledReason || 'This product cannot be bagged.');
        return { action: 'DISABLED', status };
      }

      if (status.standard.alreadyBagged || status.custom.alreadyBagged) {
        dispatch(openCartDrawer());
        toast.info(`${product.name || 'This item'} is already in your bag.`);
        return { action: status.ui.defaultAction, status };
      }

      if (status.ui.defaultAction === 'ADD_STANDARD') {
        await addStandard(product.id, options);
        toast.success('Bagged!');
        return { action: 'ADD_STANDARD', status };
      }

      if (status.ui.defaultAction === 'OPEN_FITTINGS') {
        toast.info('Add your required fittings to continue custom bagging.');
      }

      return { action: status.ui.defaultAction, status };
    },
    [addStandard, dispatch, isAuthenticated, prepareBag],
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
    prepareBag,
    bagProduct,
    addStandard,
    startCustom,
    refreshBagCounts,
    getPulseStatus,
  };
}

export default useBagging;
