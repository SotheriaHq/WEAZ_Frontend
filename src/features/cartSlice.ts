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
};

// Async thunks
export const fetchCart = createAsyncThunk('cart/fetchCart', async (_, { rejectWithValue }) => {
  try {
    const response = await apiClient.get('/store/cart');
    return response.data;
  } catch (error: any) {
    return rejectWithValue(error.response?.data?.message || 'Failed to fetch cart');
  }
});

export const addToCart = createAsyncThunk(
  'cart/addToCart',
  async (
    payload: { productId: string; quantity?: number; selectedSize?: string; selectedColor?: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await apiClient.post('/store/cart', payload);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to add to cart');
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
      return response.data;
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
      return response.data;
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
        state.isLoading = false;
        state.items = action.payload.items;
        state.itemCount = action.payload.itemCount;
        state.totalQuantity = action.payload.totalQuantity;
        state.subtotal = action.payload.subtotal;
        state.currency = action.payload.currency;
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
        state.isLoading = false;
        state.items = action.payload.items;
        state.itemCount = action.payload.itemCount;
        state.totalQuantity = action.payload.totalQuantity;
        state.subtotal = action.payload.subtotal;
        state.currency = action.payload.currency;
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
        state.items = action.payload.items;
        state.itemCount = action.payload.itemCount;
        state.totalQuantity = action.payload.totalQuantity;
        state.subtotal = action.payload.subtotal;
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
        state.items = action.payload.items;
        state.itemCount = action.payload.itemCount;
        state.totalQuantity = action.payload.totalQuantity;
        state.subtotal = action.payload.subtotal;
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

export const { openCartDrawer, closeCartDrawer, toggleCartDrawer, resetCartState } = cartSlice.actions;

// Selectors
export const selectCartItems = (state: { cart: CartState }) => state.cart.items;
export const selectCartItemCount = (state: { cart: CartState }) => state.cart.itemCount;
export const selectCartTotalQuantity = (state: { cart: CartState }) => state.cart.totalQuantity;
export const selectCartSubtotal = (state: { cart: CartState }) => state.cart.subtotal;
export const selectCartCurrency = (state: { cart: CartState }) => state.cart.currency;
export const selectCartIsLoading = (state: { cart: CartState }) => state.cart.isLoading;
export const selectCartIsDrawerOpen = (state: { cart: CartState }) => state.cart.isDrawerOpen;

export default cartSlice.reducer;
