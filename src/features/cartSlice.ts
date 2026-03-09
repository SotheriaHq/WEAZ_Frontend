import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from '../api/httpClient';

// Types
export interface ProductBrand {
  id: string;
  name: string;
  logo?: string;
  currency: string;
}

export interface CartItemProduct {
  id: string;
  name: string;
  thumbnail?: string;
  price: number;
  salePrice?: number | null;
  isOnSale: boolean;
  effectivePrice: number;
  sizes: string[];
  colors: string[];
  totalStock: number;
  sizeStock?: Record<string, number>;
}

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  selectedSize?: string | null;
  selectedColor?: string | null;
  product: CartItemProduct;
  brand: ProductBrand;
  itemTotal: number;
}

export interface CartState {
  items: CartItem[];
  itemCount: number;
  totalQuantity: number;
  subtotal: number;
  currency: string;
  isLoading: boolean;
  isDrawerOpen: boolean;
  error: string | null;
  removedItemNotices: Array<{ itemId: string; name: string; reason: 'out_of_stock' | 'unavailable' }>;
  priceChangeNotices: Array<{ itemId: string; name: string; oldPrice: number; newPrice: number; currency?: string }>;
}

const initialState: CartState = {
  items: [],
  itemCount: 0,
  totalQuantity: 0,
  subtotal: 0,
  currency: 'NGN',
  isLoading: false,
  isDrawerOpen: false,
  error: null,
  removedItemNotices: [],
  priceChangeNotices: [],
};

const normalizeCartPayload = (payload: Partial<CartState> | null | undefined): CartState => {
  const items = Array.isArray(payload?.items) ? payload!.items : [];
  const totalQuantityFromItems = items.reduce(
    (sum, item) => sum + (Number(item?.quantity) || 0),
    0,
  );
  const subtotalFromItems = items.reduce(
    (sum, item) => sum + (Number(item?.itemTotal) || 0),
    0,
  );

  return {
    ...initialState,
    ...payload,
    items,
    itemCount:
      typeof payload?.itemCount === 'number'
        ? payload.itemCount
        : items.length,
    totalQuantity:
      typeof payload?.totalQuantity === 'number'
        ? payload.totalQuantity
        : totalQuantityFromItems,
    subtotal:
      typeof payload?.subtotal === 'number'
        ? payload.subtotal
        : subtotalFromItems,
    currency:
      typeof payload?.currency === 'string' && payload.currency.trim().length > 0
        ? payload.currency
        : 'NGN',
    removedItemNotices: Array.isArray(payload?.removedItemNotices)
      ? payload!.removedItemNotices
      : [],
    priceChangeNotices: Array.isArray(payload?.priceChangeNotices)
      ? payload!.priceChangeNotices
      : [],
  };
};

// Helper: unwrap NestJS TransformInterceptor response wrapper
// The interceptor wraps responses as { statusCode, message, data: actualPayload }
const unwrapResponse = (responseData: any) => responseData?.data ?? responseData;

// Async thunks
export const fetchCart = createAsyncThunk('cart/fetchCart', async (_, { rejectWithValue }) => {
  try {
    const response = await apiClient.get('/store/cart');
    return unwrapResponse(response.data);
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch cart');
  }
});

export const addToCart = createAsyncThunk(
  'cart/addToCart',
  async (
    payload: {
      productId: string;
      quantity?: number;
      selectedSize?: string;
      selectedColor?: string;
      sizingMode?: 'NONE' | 'RTW' | 'CUSTOM' | 'RTW_PLUS_CUSTOM';
      sizeFitData?: Record<string, any>;
      requiredMeasurementKeys?: string[];
    },
    { rejectWithValue }
  ) => {
    try {
      const response = await apiClient.post('/store/cart', payload);
      return unwrapResponse(response.data);
    } catch (error: any) {
      const serverMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to add to cart';

      if (
        typeof serverMessage === 'string' &&
        serverMessage.toLowerCase().includes('missing required measurements')
      ) {
        return rejectWithValue(
          '__MEASUREMENTS_REQUIRED__',
        );
      }

      return rejectWithValue(serverMessage);
    }
  }
);

export const updateCartItem = createAsyncThunk(
  'cart/updateCartItem',
  async (payload: { itemId: string; quantity: number }, { rejectWithValue }) => {
    try {
      const response = await apiClient.patch(`/store/cart/${payload.itemId}`, {
        quantity: payload.quantity,
      });
      return unwrapResponse(response.data);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update cart');
    }
  }
);

export const removeFromCart = createAsyncThunk(
  'cart/removeFromCart',
  async (itemId: string, { rejectWithValue }) => {
    try {
      const response = await apiClient.delete(`/store/cart/${itemId}`);
      return unwrapResponse(response.data);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to remove from cart');
    }
  }
);

export const clearCart = createAsyncThunk('cart/clearCart', async (_, { rejectWithValue }) => {
  try {
    await apiClient.delete('/store/cart');
    return true;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to clear cart');
  }
});

export const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    openCartDrawer: (state) => {
      state.isDrawerOpen = true;
    },
    closeCartDrawer: (state) => {
      state.isDrawerOpen = false;
    },
    toggleCartDrawer: (state) => {
      state.isDrawerOpen = !state.isDrawerOpen;
    },
    clearCartNotices: (state) => {
      state.removedItemNotices = [];
      state.priceChangeNotices = [];
    },
    resetCartState: () => initialState,
  },
  extraReducers: (builder) => {
    // Fetch cart
    builder
      .addCase(fetchCart.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCart.fulfilled, (state, action: PayloadAction<CartState>) => {
        const normalized = normalizeCartPayload(action.payload);
        state.isLoading = false;
        const incomingItems = normalized.items || [];
        const previousItems = state.items || [];
        const previousById = new Map(previousItems.map((item) => [item.id, item]));
        const incomingIds = new Set(incomingItems.map((item) => item.id));

        state.removedItemNotices = previousItems
          .filter((item) => !incomingIds.has(item.id))
          .map((item) => ({
            itemId: item.id,
            name: item.product.name,
            reason: (item.product.totalStock ?? 0) <= 0 ? 'out_of_stock' : 'unavailable',
          }));

        state.priceChangeNotices = incomingItems
          .map((item) => {
            const previous = previousById.get(item.id);
            if (!previous) return null;
            if (previous.product.effectivePrice === item.product.effectivePrice) return null;
            return {
              itemId: item.id,
              name: item.product.name,
              oldPrice: previous.product.effectivePrice,
              newPrice: item.product.effectivePrice,
              currency: item.brand?.currency,
            };
          })
          .filter((notice): notice is NonNullable<typeof notice> => Boolean(notice));

        state.items = normalized.items;
        state.itemCount = normalized.itemCount;
        state.totalQuantity = normalized.totalQuantity;
        state.subtotal = normalized.subtotal;
        state.currency = normalized.currency;
      })
      .addCase(fetchCart.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Add to cart
    builder
      .addCase(addToCart.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(addToCart.fulfilled, (state, action: PayloadAction<CartState>) => {
        const normalized = normalizeCartPayload(action.payload);
        state.isLoading = false;
        state.items = normalized.items;
        state.itemCount = normalized.itemCount;
        state.totalQuantity = normalized.totalQuantity;
        state.subtotal = normalized.subtotal;
        state.currency = normalized.currency;
        state.isDrawerOpen = true; // Open drawer after adding
      })
      .addCase(addToCart.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Update cart item
    builder
      .addCase(updateCartItem.pending, (state) => {
        state.error = null;
      })
      .addCase(updateCartItem.fulfilled, (state, action: PayloadAction<CartState>) => {
        const normalized = normalizeCartPayload(action.payload);
        state.items = normalized.items;
        state.itemCount = normalized.itemCount;
        state.totalQuantity = normalized.totalQuantity;
        state.subtotal = normalized.subtotal;
      })
      .addCase(updateCartItem.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Remove from cart
    builder
      .addCase(removeFromCart.pending, (state) => {
        state.error = null;
      })
      .addCase(removeFromCart.fulfilled, (state, action: PayloadAction<CartState>) => {
        const normalized = normalizeCartPayload(action.payload);
        state.items = normalized.items;
        state.itemCount = normalized.itemCount;
        state.totalQuantity = normalized.totalQuantity;
        state.subtotal = normalized.subtotal;
      })
      .addCase(removeFromCart.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Clear cart
    builder
      .addCase(clearCart.fulfilled, (state) => {
        state.items = [];
        state.itemCount = 0;
        state.totalQuantity = 0;
        state.subtotal = 0;
      });
  },
});

export const { openCartDrawer, closeCartDrawer, toggleCartDrawer, clearCartNotices, resetCartState } = cartSlice.actions;

// Selectors
export const selectCartItems = (state: { cart: CartState }) => state.cart.items;
export const selectCartItemCount = (state: { cart: CartState }) => state.cart.itemCount;
export const selectCartTotalQuantity = (state: { cart: CartState }) => state.cart.totalQuantity;
export const selectCartSubtotal = (state: { cart: CartState }) => state.cart.subtotal;
export const selectCartCurrency = (state: { cart: CartState }) => state.cart.currency;
export const selectCartIsLoading = (state: { cart: CartState }) => state.cart.isLoading;
export const selectCartRemovedItemNotices = (state: { cart: CartState }) => state.cart.removedItemNotices;
export const selectCartPriceChangeNotices = (state: { cart: CartState }) => state.cart.priceChangeNotices;
export const selectCartIsDrawerOpen = (state: { cart: CartState }) => state.cart.isDrawerOpen;

export default cartSlice.reducer;
