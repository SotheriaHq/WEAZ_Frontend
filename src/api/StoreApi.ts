import { apiClient } from './httpClient';
import type { AxiosResponse } from 'axios';
import { createIdempotencyKey } from './idempotency';

// Helper to extract data from axios response
const extractData = <T>(res: AxiosResponse): T => {
  // Handle wrapped API responses with data field
  if (res.data && typeof res.data === 'object' && 'data' in res.data) {
    return res.data.data as T;
  }
  return res.data as T;
};

// ============= Types =============

export interface Product {
  id: string;
  collectionId: string;
  brandId: string;
  name: string;
  description?: string;
  price: number;
  salePrice?: number;
  saleStartAt?: string;
  saleEndAt?: string;
  sizes: string[];
  sizeStock?: Record<string, number>;
  colors: string[];
  colorImages?: Record<string, string>;
  images: string[];
  thumbnail?: string;
  totalStock: number;
  lowStockThreshold: number;
  tags: string[];
  filterValueIds?: string[];
  filterSelection?: Record<string, string[]>;
  filters?: Array<{
    dimensionId: string;
    dimensionSlug: string;
    dimensionName: string;
    valueId: string;
    valueSlug: string;
    valueName: string;
  }>;
  gender: 'MALE' | 'FEMALE' | 'EVERYBODY';
  isActive: boolean;
  isFeatured: boolean;
  viewsCount: number;
  threadsCount: number;
  createdAt: string;
  updatedAt: string;
  categoryId?: string;
  categoryTypeId?: string;
  subCategoryId?: string;
  categoryType?: {
    id: string;
    categoryId: string;
    slug: string;
    name: string;
  };
  collection?: {
    id: string;
    name: string;
    thumbnail?: string;
    brand?: {
      id: string;
      brandName: string;
      logoUrl?: string;
    };
  };
  brand?: {
    id: string;
    brandName: string;
    logoUrl?: string;
  };
}

export interface CartItem {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
  createdAt: string;
  updatedAt: string;
  product: Product;
}

export interface WishlistItem {
  id: string;
  addedAt: string;
  product: Product;
  availabilityStatus?:
    | 'AVAILABLE'
    | 'OUT_OF_STOCK'
    | 'ARCHIVED'
    | 'DELETED'
    | 'UNPUBLISHED'
    | 'STORE_CLOSED'
    | 'OWN_PRODUCT';
  availabilityReason?:
    | 'available'
    | 'out_of_stock'
    | 'archived'
    | 'deleted'
    | 'not_in_store'
    | 'store_closed'
    | 'own_product';
  isAvailable?: boolean;
  canAddToCart?: boolean;
}

export interface OrderItem {
  productId: string;
  name: string;
  thumbnail?: string | null;
  price: number;
  quantity: number;
  selectedSize?: string | null;
  selectedColor?: string | null;
}

export interface Order {
  id: string;
  brandId: string;
  buyerId?: string | null;
  customerName: string;
  shippingAddress?: Record<string, any> | null;
  contactInfo?: Record<string, any> | null;
  sizeFitSnapshot?: Record<string, any> | null;
  items: OrderItem[];
  totalAmount: number;
  shippingCost?: number;
  discountAmount?: number;
  promoCode?: string | null;
  currency: string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string;
  paymentReference?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  brand?: {
    id: string;
    name?: string;
    logo?: string | null;
    currency?: string;
  };
}

export interface OrderAccessResolution {
  orderId: string;
  viewerRole: 'BUYER' | 'BRAND';
  destination: string;
}

export type PaymentMethodType =
  | 'PAYSTACK'
  | 'FLUTTERWAVE'
  | 'BANK_TRANSFER'
  | 'PAY_ON_DELIVERY'
  | 'PENDING_SELECTION';

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  street: string;
  apartment?: string;
  city: string;
  state: string;
  postalCode?: string;
  country: string;
  phone: string;
}

export interface CheckoutPayload {
  customerName?: string;
  shippingAddress?: ShippingAddress;
  contactInfo?: Record<string, any>;
  paymentMethod?: PaymentMethodType;
  promoCode?: string;
}

export interface CreateProductPayload {
  collectionId: string;
  name: string;
  price: number;
  totalStock: number;
  description?: string;
  salePrice?: number;
  images?: string[];
  thumbnail?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  hasMore: boolean;
}

export interface GetProductsParams {
  brandId: string;
  minPrice?: number;
  maxPrice?: number;
  sizes?: string[];
  colors?: string[];
  tags?: string[];
  gender?: string;
  search?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'popular';
  sortBy?: 'newest' | 'price_asc' | 'price_desc' | 'popular';
  isFeatured?: boolean;
  isOnSale?: boolean;
  onSale?: boolean;
  page?: number;
  limit?: number;
}

// ============= Products API =============

export const getProducts = async (params: GetProductsParams): Promise<PaginatedResponse<Product>> => {
  const { brandId, sizes, colors, tags, sort, sortBy, isOnSale, onSale, ...rest } = params;
  
  const queryParams = new URLSearchParams();
  
  Object.entries(rest).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, String(value));
    }
  });

  // Backend uses sortBy/onSale naming
  const resolvedSortBy = sortBy ?? sort;
  if (resolvedSortBy) queryParams.append('sortBy', String(resolvedSortBy));
  const resolvedOnSale = onSale ?? isOnSale;
  if (typeof resolvedOnSale === 'boolean') queryParams.append('onSale', String(resolvedOnSale));
  
  // Handle array params
  if (sizes?.length) {
    sizes.forEach(size => queryParams.append('sizes', size));
  }
  if (colors?.length) {
    colors.forEach(color => queryParams.append('colors', color));
  }
  if (tags?.length) {
    tags.forEach(tag => queryParams.append('tags', tag));
  }
  
  const res = await apiClient.get(`/store/brands/${brandId}/products?${queryParams.toString()}`);
  return extractData<PaginatedResponse<Product>>(res);
};

export const getProductById = async (productId: string): Promise<Product> => {
  const res = await apiClient.get(`/store/products/${productId}`);
  return extractData<Product>(res);
};

// ============= Cart API =============

export const getCart = async (): Promise<{ items: CartItem[]; subtotal: number; itemCount: number }> => {
  const res = await apiClient.get('/store/cart');
  return extractData<{ items: CartItem[]; subtotal: number; itemCount: number }>(res);
};

export const addToCart = async (data: {
  productId: string;
  quantity: number;
  selectedSize?: string;
  selectedColor?: string;
}): Promise<CartItem> => {
  const res = await apiClient.post('/store/cart', data);
  return extractData<CartItem>(res);
};

export const updateCartItem = async (
  cartItemId: string,
  data: { quantity: number }
): Promise<CartItem> => {
  const res = await apiClient.patch(`/store/cart/${cartItemId}`, data);
  return extractData<CartItem>(res);
};

export const removeCartItem = async (cartItemId: string): Promise<void> => {
  await apiClient.delete(`/store/cart/${cartItemId}`);
};

export const clearCart = async (): Promise<void> => {
  await apiClient.delete('/store/cart');
};

// ============= Checkout & Orders =============

export const checkout = async (payload: CheckoutPayload): Promise<{ orders: Order[] }> => {
  const res = await apiClient.post('/store/checkout', payload, {
    headers: { 'Idempotency-Key': createIdempotencyKey() },
  });
  return extractData<{ orders: Order[] }>(res);
};

export const getMyOrders = async (page = 1, limit = 20): Promise<{ items: Order[]; total: number; totalPages: number; hasNextPage?: boolean; page: number; limit: number }> => {
  const params = new URLSearchParams();
  params.append('page', String(page));
  params.append('limit', String(limit));
  const res = await apiClient.get(`/store/orders?${params.toString()}`);
  return extractData(res);
};

export const getMyOrder = async (orderId: string): Promise<Order> => {
  const res = await apiClient.get(`/store/orders/${orderId}`);
  return extractData<Order>(res);
};

export const resolveOrderAccess = async (
  orderId: string,
): Promise<OrderAccessResolution> => {
  const res = await apiClient.get(`/store/orders/${orderId}/resolve`);
  return extractData<OrderAccessResolution>(res);
};

// ============= Seller Products =============

export const getBrandProductsForOwner = async (brandId: string, limit = 50) => {
  const res = await apiClient.get(`/brands/${brandId}/products?limit=${limit}`);
  return extractData<PaginatedResponse<Product>>(res);
};

export const createProduct = async (payload: CreateProductPayload) => {
  const res = await apiClient.post('/products', payload);
  return extractData<Product>(res);
};

export const updateProduct = async (productId: string, payload: Partial<CreateProductPayload>) => {
  const res = await apiClient.patch(`/products/${productId}`, payload);
  return extractData<Product>(res);
};

export const deleteProduct = async (productId: string) => {
  await apiClient.delete(`/products/${productId}`);
};

// ============= Wishlist API =============

export const getWishlist = async (params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<WishlistItem>> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', String(params.page));
  if (params?.limit) queryParams.append('limit', String(params.limit));
  
  const res = await apiClient.get(`/store/wishlist?${queryParams.toString()}`);
  return extractData<PaginatedResponse<WishlistItem>>(res);
};

export const addToWishlist = async (productId: string): Promise<WishlistItem> => {
  const res = await apiClient.post('/store/wishlist', { productId });
  return extractData<WishlistItem>(res);
};

export const removeFromWishlist = async (productId: string): Promise<void> => {
  await apiClient.delete(`/store/wishlist/${productId}`);
};

export const isInWishlist = async (productId: string): Promise<boolean> => {
  const res = await apiClient.get(`/store/wishlist/${productId}/check`);
  const data = extractData<{ isWishlisted: boolean }>(res);
  return data.isWishlisted;
};

// ============= Brand Store Info =============

export interface BrandStoreInfo {
  id: string;
  brandName: string;
  description?: string;
  logoUrl?: string;
  coverUrl?: string;
  location?: string;
  brandTags: string[];
  socialInstagram?: string;
  socialTwitter?: string;
  socialWebsite?: string;
  patchesCount: number;
  productsCount: number;
  avgRating?: number;
  totalReviews?: number;
  isPatched: boolean;
}

// ============= Store Status & Setup =============

export interface StoreStatusResponse {
  brandId: string;
  isStoreOpen: boolean;
  isSetupComplete: boolean;
  missingFields: string[];
  profile: {
    name: string;
    description?: string | null;
    tagline?: string | null;
    logo?: string | null;
    banner?: string | null;
    tags: string[];
    contactEmail?: string | null;
    socialInstagram?: string | null;
    socialTwitter?: string | null;
    socialTiktok?: string | null;
    socialWebsite?: string | null;
    responseTimeSla?: string | null;
  };
}

export interface StoreProfileUpdateData {
  description?: string;
  tagline?: string;
  logo?: string;
  banner?: string;
  tags?: string[];
  contactEmail?: string;
  socialInstagram?: string;
  socialTwitter?: string;
  socialTiktok?: string;
  socialWebsite?: string;
}

export interface StoreWizardPrefillResponse {
  brand: {
    storeName: string;
    slug: string;
    contactEmail: string;
    description: string;
    instagram: string;
    twitter: string;
    website: string;
    tags: string[];
    tagline: string;
    responseTimeSla?: string;
  };
  system: {
    categories: Array<{ id: string; slug: string; name: string }>;
    tags: string[];
  };
  flags: {
    isEmailVerified: boolean;
    hasLiveStore: boolean;
  };
}

export interface StoreGeneralSettingsResponse {
  brandId?: string;
  storeName: string;
  slug: string;
  description: string;
  tagline: string;
  logo: string;
  banner: string;
  tags: string[];
  contactEmail: string;
  isEmailVerified: boolean;
  isStoreOpen: boolean;
  isSetupComplete: boolean;
  missingFields: string[];
  storeNameLastChangedAt: string | null;
  storeNameNextAllowedAt: string | null;
  responseTimeSla?: string;
}

export interface StorePoliciesResponse {
  brandId: string;
  shippingRegions: string[];
  processingTime: string;
  shippingMethods: string[];
  freeShippingThreshold: number | null;
  returnsAccepted: boolean;
  returnWindow: string;
  returnConditions: string[];
  refundMethod: string;
  responseTimeSla: string;
  sizeChart: Record<string, any> | null;
  shippingRules: Record<string, any> | null;
}

export interface StorePoliciesUpdateData {
  shippingRegions?: string[];
  processingTime?: string;
  shippingMethods?: string[];
  freeShippingThreshold?: number | null;
  returnsAccepted?: boolean;
  returnWindow?: string;
  returnConditions?: string[];
  refundMethod?: string;
  responseTimeSla?: string;
  sizeChart?: Record<string, any> | null;
  shippingRules?: Record<string, any> | null;
}

export const getStoreWizardPrefill = async (): Promise<StoreWizardPrefillResponse> => {
  const res = await apiClient.get('/store/wizard/prefill');
  return extractData<StoreWizardPrefillResponse>(res);
};

export const getStoreGeneralSettings = async (): Promise<StoreGeneralSettingsResponse> => {
  const res = await apiClient.get('/store/settings/general');
  return extractData<StoreGeneralSettingsResponse>(res);
};

export const updateStoreName = async (payload: {
  newName: string;
  currentPassword: string;
}): Promise<StoreGeneralSettingsResponse> => {
  const res = await apiClient.patch('/store/settings/name', payload);
  return extractData<StoreGeneralSettingsResponse>(res);
};

export const getStoreStatus = async (): Promise<StoreStatusResponse> => {
  const res = await apiClient.get('/store/status');
  return extractData<StoreStatusResponse>(res);
};

export const openStore = async (): Promise<{ success: boolean; message: string; brandId: string }> => {
  const res = await apiClient.post('/store/open');
  return extractData<{ success: boolean; message: string; brandId: string }>(res);
};

export const closeStore = async (): Promise<{ success: boolean; message: string; brandId: string }> => {
  const res = await apiClient.post('/store/close');
  return extractData<{ success: boolean; message: string; brandId: string }>(res);
};

export const updateStoreProfile = async (data: StoreProfileUpdateData): Promise<StoreStatusResponse> => {
  const res = await apiClient.patch('/store/profile', data);
  return extractData<StoreStatusResponse>(res);
};

export const getStorePolicies = async (): Promise<StorePoliciesResponse> => {
  const res = await apiClient.get('/store/policies');
  return extractData<StorePoliciesResponse>(res);
};

export const updateStorePolicies = async (
  data: StorePoliciesUpdateData
): Promise<StorePoliciesResponse> => {
  const res = await apiClient.patch('/store/policies', data);
  return extractData<StorePoliciesResponse>(res);
};

interface RawBrandData {
  id: string;
  brandName?: string;
  brand_name?: string;
  description?: string;
  logoUrl?: string;
  logo_url?: string;
  coverUrl?: string;
  cover_url?: string;
  location?: string;
  brandTags?: string[];
  tags?: string[];
  socialInstagram?: string;
  instagram?: string;
  socialTwitter?: string;
  twitter?: string;
  socialWebsite?: string;
  website?: string;
  patchesCount?: number;
  productsCount?: number;
  avgRating?: number;
  totalReviews?: number;
  isPatched?: boolean;
  _count?: {
    patches?: number;
    products?: number;
  };
}

export const getBrandStoreInfo = async (brandId: string): Promise<BrandStoreInfo> => {
  const res = await apiClient.get(`/brands/${brandId}`);
  const brand = extractData<RawBrandData>(res);
  
  // Transform to store info format
  return {
    id: brand.id,
    brandName: brand.brandName || brand.brand_name || '',
    description: brand.description,
    logoUrl: brand.logoUrl || brand.logo_url,
    coverUrl: brand.coverUrl || brand.cover_url,
    location: brand.location,
    brandTags: brand.brandTags || brand.tags || [],
    socialInstagram: brand.socialInstagram || brand.instagram,
    socialTwitter: brand.socialTwitter || brand.twitter,
    socialWebsite: brand.socialWebsite || brand.website,
    patchesCount: brand.patchesCount || brand._count?.patches || 0,
    productsCount: brand.productsCount || brand._count?.products || 0,
    avgRating: brand.avgRating,
    totalReviews: brand.totalReviews,
    isPatched: brand.isPatched || false,
  };
};

// ===================== Price Change Preview (Item #8) =====================

export interface CollectionPriceImpact {
  collectionId: string;
  collectionTitle: string;
  currentMinPrice: number | null;
  currentMaxPrice: number | null;
  newMinPrice: number | null;
  newMaxPrice: number | null;
  productsCount: number;
  isPublished: boolean;
}

export interface PriceChangePreviewResponse {
  productId: string;
  productName: string;
  currentPrice: number;
  newPrice: number;
  currency: string;
  affectedCollections: CollectionPriceImpact[];
}

/**
 * Get preview of how a price change affects collection price ranges
 * Call this before confirming a product price update
 */
export const getProductPriceChangePreview = async (
  productId: string,
  newPrice: number,
  newSalePrice?: number | null
): Promise<PriceChangePreviewResponse> => {
  const res = await apiClient.post(`/store/products/${productId}/price-preview`, {
    newPrice,
    newSalePrice,
  });
  return extractData<PriceChangePreviewResponse>(res);
};

export default {
  getProducts,
  getProductById,
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  isInWishlist,
  getBrandStoreInfo,
  getStoreWizardPrefill,
  getStoreGeneralSettings,
  updateStoreName,
  getStoreStatus,
  openStore,
  closeStore,
  updateStoreProfile,
  getStorePolicies,
  updateStorePolicies,
  getProductPriceChangePreview,
  resolveOrderAccess,
};
