import { apiClient } from './httpClient';
import type { AxiosResponse } from 'axios';

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
  gender: 'MALE' | 'FEMALE' | 'EVERYBODY';
  isActive: boolean;
  isFeatured: boolean;
  viewsCount: number;
  likesCount: number;
  createdAt: string;
  updatedAt: string;
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
  userId: string;
  productId: string;
  createdAt: string;
  product: Product;
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
  items: OrderItem[];
  totalAmount: number;
  currency: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  updatedAt: string;
  brand?: {
    id: string;
    name?: string;
    logo?: string | null;
    currency?: string;
  };
}

export interface CheckoutPayload {
  customerName?: string;
  shippingAddress?: Record<string, any>;
  contactInfo?: Record<string, any>;
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
  isFeatured?: boolean;
  isOnSale?: boolean;
  page?: number;
  limit?: number;
}

// ============= Products API =============

export const getProducts = async (params: GetProductsParams): Promise<PaginatedResponse<Product>> => {
  const { brandId, sizes, colors, tags, ...rest } = params;
  
  const queryParams = new URLSearchParams();
  
  Object.entries(rest).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, String(value));
    }
  });
  
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

export const getFeaturedProducts = async (brandId: string, limit = 6): Promise<Product[]> => {
  const res = await apiClient.get(`/store/brands/${brandId}/products?isFeatured=true&limit=${limit}`);
  const data = extractData<PaginatedResponse<Product>>(res);
  return data.data;
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
  const res = await apiClient.post('/store/checkout', payload);
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
  followersCount: number;
  productsCount: number;
  avgRating?: number;
  totalReviews?: number;
  isFollowing: boolean;
}

// ============= Store Drafts =============

export interface StoreDraftData {
  name?: string;
  slug?: string;
  categories?: string[];
  tagline?: string;
  description?: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  logoFileId?: string | null;
  bannerFileId?: string | null;
}

export interface StoreDraftResponse {
  hasDraft: boolean;
  hasBrand?: boolean;
  hasLiveStore?: boolean;
  draft?: {
    id: string;
    data: StoreDraftData;
    step?: number;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
  };
}

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
  followersCount?: number;
  productsCount?: number;
  avgRating?: number;
  totalReviews?: number;
  isFollowing?: boolean;
  _count?: {
    followers?: number;
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
    followersCount: brand.followersCount || brand._count?.followers || 0,
    productsCount: brand.productsCount || brand._count?.products || 0,
    avgRating: brand.avgRating,
    totalReviews: brand.totalReviews,
    isFollowing: brand.isFollowing || false,
  };
};

// Store drafts
export const saveStoreDraft = async (
  payload: StoreDraftData & { step?: number }
): Promise<StoreDraftResponse> => {
  const res = await apiClient.post('/store/draft', payload);
  return extractData<StoreDraftResponse>(res);
};

export const getStoreDraft = async (): Promise<StoreDraftResponse> => {
  const res = await apiClient.get('/store/draft');
  return extractData<StoreDraftResponse>(res);
};

export const getStoreDraftStatus = async (): Promise<StoreDraftResponse> => {
  const res = await apiClient.get('/store/draft/status');
  return extractData<StoreDraftResponse>(res);
};

export const clearStoreDraft = async (): Promise<{ success: boolean }> => {
  const res = await apiClient.delete('/store/draft');
  return extractData<{ success: boolean }>(res);
};

export default {
  getProducts,
  getProductById,
  getFeaturedProducts,
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
  saveStoreDraft,
  getStoreDraft,
  getStoreDraftStatus,
  clearStoreDraft,
};
