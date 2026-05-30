import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { apiClient } from '../api/httpClient';
import { unwrapApiResponse } from '@/types/auth';
import { queryClient } from '@/query/queryClient';
import { queryKeys } from '@/query/queryKeys';

const WISHLIST_READ_TTL_MS = 30 * 1000;

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
    ownerId?: string;
  };
}

export interface WishlistItem {
  id: string;
  addedAt: string;
  product: WishlistProduct;
  availabilityStatus:
    | 'AVAILABLE'
    | 'OUT_OF_STOCK'
    | 'ARCHIVED'
    | 'DELETED'
    | 'UNPUBLISHED'
    | 'STORE_CLOSED'
    | 'OWN_PRODUCT';
  availabilityReason:
    | 'available'
    | 'out_of_stock'
    | 'archived'
    | 'deleted'
    | 'not_in_store'
    | 'store_closed'
    | 'own_product';
  isAvailable: boolean;
  canAddToCart: boolean;
}

export interface WishlistState {
  items: WishlistItem[];
  total: number;
  isLoading: boolean;
  isDrawerOpen: boolean;
  error: string | null;
  // Track wishlisted product IDs for quick lookup
  wishlistedIds: Set<string>;
  lastFetchedAt: number;
  lastFetchKey: string | null;
  priceChangeNotices: Array<{ productId: string; name: string; oldPrice: number; newPrice: number; currency?: string }>;
}

const initialState: WishlistState = {
  items: [],
  total: 0,
  isLoading: false,
  isDrawerOpen: false,
  error: null,
  wishlistedIds: new Set(),
  lastFetchedAt: 0,
  lastFetchKey: null,
  priceChangeNotices: [],
};

type FetchWishlistArgs = { page?: number; limit?: number; force?: boolean };
type LifecycleRootState = {
  wishlist: WishlistState;
  user?: { profile?: { id?: string | null } | null };
};

const selectLifecycleUserId = (state: LifecycleRootState) => state.user?.profile?.id ?? null;

const getWishlistFetchKey = (params: FetchWishlistArgs = {}) =>
  JSON.stringify({
    page: params.page ?? 1,
    limit: params.limit ?? null,
  });

// Async thunks
export const fetchWishlist = createAsyncThunk(
  'wishlist/fetchWishlist',
  async (params: FetchWishlistArgs = {}, { getState, rejectWithValue }) => {
    try {
      const state = getState() as LifecycleRootState;
      const wishlist = state.wishlist;
      const userId = selectLifecycleUserId(state);
      const requestKey = getWishlistFetchKey(params);
      const wishlistQueryKey = queryKeys.store.wishlist(userId, { page: params.page ?? 1, limit: params.limit ?? null });
      if (
        !params.force &&
        wishlist.lastFetchKey === requestKey &&
        wishlist.lastFetchedAt > 0 &&
        Date.now() - wishlist.lastFetchedAt < WISHLIST_READ_TTL_MS
      ) {
        return { items: wishlist.items, total: wishlist.total };
      }
      if (params.force) {
        queryClient.removeQueries({ queryKey: wishlistQueryKey, exact: true });
      }
      return await queryClient.fetchQuery({
        queryKey: wishlistQueryKey,
        queryFn: async () => {
          const response = await apiClient.get('/store/wishlist', { params });
          return unwrapApiResponse(response.data);
        },
        staleTime: WISHLIST_READ_TTL_MS,
      });
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch wishlist');
    }
  }
);

export const addToWishlist = createAsyncThunk(
  'wishlist/addToWishlist',
  async (productId: string, { getState, rejectWithValue }) => {
    try {
      const userId = selectLifecycleUserId(getState() as LifecycleRootState);
      const response = await apiClient.post('/store/wishlist', { productId });
      const payload = unwrapApiResponse<Record<string, unknown>>(response.data);
      queryClient.invalidateQueries({ queryKey: queryKeys.store.wishlistRoot(userId) });
      return { productId, ...(payload ?? {}) };
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to add to wishlist');
    }
  }
);

export const removeFromWishlist = createAsyncThunk(
  'wishlist/removeFromWishlist',
  async (productId: string, { getState, rejectWithValue }) => {
    const userId = selectLifecycleUserId(getState() as LifecycleRootState);
    try {
      await apiClient.delete(`/store/wishlist/${productId}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.store.wishlistRoot(userId) });
      return productId;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        queryClient.invalidateQueries({ queryKey: queryKeys.store.wishlistRoot(userId) });
        return productId;
      }
      return rejectWithValue(error.response?.data?.message || 'Failed to remove from wishlist');
    }
  }
);

export const checkWishlistStatus = createAsyncThunk(
  'wishlist/checkStatus',
  async (productId: string, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(`/store/wishlist/${productId}/check`);
      const payload = unwrapApiResponse<{ isWishlisted?: boolean }>(response.data);
      return { productId, isWishlisted: Boolean(payload?.isWishlisted) };
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
    clearWishlistNotices: (state) => {
      state.priceChangeNotices = [];
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
      state.lastFetchedAt = 0;
      state.lastFetchKey = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch wishlist
    builder
      .addCase(fetchWishlist.pending, (state, action) => {
        const requestKey = getWishlistFetchKey(action.meta.arg);
        const isFresh =
          !action.meta.arg?.force &&
          state.lastFetchKey === requestKey &&
          state.lastFetchedAt > 0 &&
          Date.now() - state.lastFetchedAt < WISHLIST_READ_TTL_MS;
        state.isLoading = !isFresh;
        state.error = null;
      })
      .addCase(fetchWishlist.fulfilled, (state, action) => {
        state.isLoading = false;
        const payload: any = action.payload;
        const items: WishlistItem[] = Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload)
            ? payload
            : [];

        const previousItems = state.items || [];
        const previousByProductId = new Map<string, WishlistItem>();
        previousItems.forEach((item) => {
          const productId = item?.product?.id;
          if (typeof productId === 'string') {
            previousByProductId.set(productId, item);
          }
        });
        state.priceChangeNotices = items
          .map((item) => {
            const productId = item?.product?.id;
            if (!productId) return null;
            const previous = previousByProductId.get(productId);
            if (!previous) return null;
            if (previous.product.effectivePrice === item.product.effectivePrice) return null;
            return {
              productId,
              name: item.product.name,
              oldPrice: previous.product.effectivePrice,
              newPrice: item.product.effectivePrice,
              currency: item.product.brand?.currency,
            };
          })
          .filter((notice): notice is NonNullable<typeof notice> => Boolean(notice));

        state.items = items;
        state.total = typeof payload?.total === 'number' ? payload.total : items.length;
        state.lastFetchedAt = Date.now();
        state.lastFetchKey = getWishlistFetchKey(action.meta.arg);
        // Rebuild wishlisted IDs set
        state.wishlistedIds = new Set(
          items
            .map((item) => item?.product?.id)
            .filter((id): id is string => typeof id === 'string')
        );
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
        const productId = action.payload.productId;
        if (!state.wishlistedIds.has(productId)) {
          state.wishlistedIds.add(productId);
          state.total += 1;
        }
        state.lastFetchedAt = 0;
        state.lastFetchKey = null;
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
        state.lastFetchedAt = 0;
        state.lastFetchKey = null;
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
  clearWishlistNotices,
  resetWishlistState,
  toggleWishlistOptimistic,
} = wishlistSlice.actions;

// Selectors
export const selectWishlistItems = (state: { wishlist: WishlistState }) => state.wishlist.items;
export const selectWishlistTotal = (state: { wishlist: WishlistState }) => state.wishlist.total;
export const selectWishlistIsLoading = (state: { wishlist: WishlistState }) => state.wishlist.isLoading;
export const selectWishlistIsDrawerOpen = (state: { wishlist: WishlistState }) => state.wishlist.isDrawerOpen;
export const selectWishlistPriceChangeNotices = (state: { wishlist: WishlistState }) =>
  state.wishlist.priceChangeNotices;
export const selectIsProductWishlisted = (state: { wishlist: WishlistState }, productId: string) =>
  state.wishlist.wishlistedIds.has(productId);

export default wishlistSlice.reducer;
