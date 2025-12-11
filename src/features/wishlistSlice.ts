import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from '../api/httpClient';

// Types
export interface WishlistProduct {
  id: string;
  collectionId: string;
  brandId: string;
  name: string;
  description?: string;
  price: number;
  salePrice?: number | null;
  effectivePrice: number;
  isOnSale: boolean;
  discountPercent?: number | null;
  thumbnail?: string;
  images: string[];
  sizes: string[];
  colors: string[];
  totalStock: number;
  isOutOfStock: boolean;
  brand: {
    id: string;
    name: string;
    logo?: string;
    currency: string;
  };
}

export interface WishlistItem {
  id: string;
  addedAt: string;
  product: WishlistProduct;
}

export interface WishlistState {
  items: WishlistItem[];
  total: number;
  isLoading: boolean;
  isDrawerOpen: boolean;
  error: string | null;
  // Track wishlisted product IDs for quick lookup
  wishlistedIds: Set<string>;
}

const initialState: WishlistState = {
  items: [],
  total: 0,
  isLoading: false,
  isDrawerOpen: false,
  error: null,
  wishlistedIds: new Set(),
};

// Async thunks
export const fetchWishlist = createAsyncThunk(
  'wishlist/fetchWishlist',
  async (params: { page?: number; limit?: number } = {}, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/store/wishlist', { params });
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch wishlist');
    }
  }
);

export const addToWishlist = createAsyncThunk(
  'wishlist/addToWishlist',
  async (productId: string, { rejectWithValue }) => {
    try {
      const response = await apiClient.post('/store/wishlist', { productId });
      return { productId, ...response.data };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to add to wishlist');
    }
  }
);

export const removeFromWishlist = createAsyncThunk(
  'wishlist/removeFromWishlist',
  async (productId: string, { rejectWithValue }) => {
    try {
      await apiClient.delete(`/store/wishlist/${productId}`);
      return productId;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to remove from wishlist');
    }
  }
);

export const checkWishlistStatus = createAsyncThunk(
  'wishlist/checkStatus',
  async (productId: string, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(`/store/wishlist/${productId}/check`);
      return { productId, isWishlisted: response.data.isWishlisted };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to check wishlist status');
    }
  }
);

export const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    openWishlistDrawer: (state) => {
      state.isDrawerOpen = true;
    },
    closeWishlistDrawer: (state) => {
      state.isDrawerOpen = false;
    },
    toggleWishlistDrawer: (state) => {
      state.isDrawerOpen = !state.isDrawerOpen;
    },
    resetWishlistState: () => initialState,
    // Optimistic update for toggle
    toggleWishlistOptimistic: (state, action: PayloadAction<string>) => {
      const productId = action.payload;
      if (state.wishlistedIds.has(productId)) {
        state.wishlistedIds.delete(productId);
        state.items = state.items.filter((item) => item.product.id !== productId);
        state.total = Math.max(0, state.total - 1);
      } else {
        state.wishlistedIds.add(productId);
        state.total += 1;
      }
    },
  },
  extraReducers: (builder) => {
    // Fetch wishlist
    builder
      .addCase(fetchWishlist.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchWishlist.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload.items;
        state.total = action.payload.total;
        // Rebuild wishlisted IDs set
        state.wishlistedIds = new Set(action.payload.items.map((item: WishlistItem) => item.product.id));
      })
      .addCase(fetchWishlist.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Add to wishlist
    builder
      .addCase(addToWishlist.pending, (state) => {
        state.error = null;
      })
      .addCase(addToWishlist.fulfilled, (state, action) => {
        state.wishlistedIds.add(action.payload.productId);
        state.total += 1;
      })
      .addCase(addToWishlist.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Remove from wishlist
    builder
      .addCase(removeFromWishlist.pending, (state) => {
        state.error = null;
      })
      .addCase(removeFromWishlist.fulfilled, (state, action) => {
        const productId = action.payload;
        state.wishlistedIds.delete(productId);
        state.items = state.items.filter((item) => item.product.id !== productId);
        state.total = Math.max(0, state.total - 1);
      })
      .addCase(removeFromWishlist.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Check wishlist status
    builder.addCase(checkWishlistStatus.fulfilled, (state, action) => {
      const { productId, isWishlisted } = action.payload;
      if (isWishlisted) {
        state.wishlistedIds.add(productId);
      } else {
        state.wishlistedIds.delete(productId);
      }
    });
  },
});

export const {
  openWishlistDrawer,
  closeWishlistDrawer,
  toggleWishlistDrawer,
  resetWishlistState,
  toggleWishlistOptimistic,
} = wishlistSlice.actions;

// Selectors
export const selectWishlistItems = (state: { wishlist: WishlistState }) => state.wishlist.items;
export const selectWishlistTotal = (state: { wishlist: WishlistState }) => state.wishlist.total;
export const selectWishlistIsLoading = (state: { wishlist: WishlistState }) => state.wishlist.isLoading;
export const selectWishlistIsDrawerOpen = (state: { wishlist: WishlistState }) => state.wishlist.isDrawerOpen;
export const selectIsProductWishlisted = (state: { wishlist: WishlistState }, productId: string) =>
  state.wishlist.wishlistedIds.has(productId);

export default wishlistSlice.reducer;
