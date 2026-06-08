import { apiClient } from './httpClient';
import type { LegalAcceptancePayload } from '@/api/LegalApi';
import type { AxiosResponse } from 'axios';
import { createIdempotencyKey } from './idempotency';
import type { PayoutSourceBreakdown } from '@/types/payouts';

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

export type BagMode = 'STANDARD' | 'CUSTOM' | 'STANDARD_OR_CUSTOM' | 'UNAVAILABLE';
export type BagFittingState = 'COMPLETE' | 'PARTIAL' | 'MISSING' | 'NOT_REQUIRED';
export type BagFreshnessState = 'FRESH' | 'STALE' | 'VERY_STALE' | 'MISSING' | 'PARTIAL' | 'NOT_REQUIRED';
export type BagStockState = 'IN_STOCK' | 'OUT_OF_STOCK' | 'CUSTOM_ONLY' | 'UNAVAILABLE';
export type BagPulseStatus =
  | 'not_bagged'
  | 'previously_bagged'
  | 'currently_bagged'
  | 'bagging'
  | 'disabled';
export type BagDefaultAction =
  | 'ADD_STANDARD'
  | 'OPEN_SELECTOR'
  | 'OPEN_CUSTOM_FLOW'
  | 'OPEN_FITTINGS'
  | 'CONFIRM_STALE_FITTINGS'
  | 'DISABLED';

export type BagDuplicateClassification =
  | 'IN_BAG'
  | 'SUBMITTED_UNPAID'
  | 'PAID_ACTIVE'
  | 'COMPLETED_ALLOWED'
  | 'COMPLETED_BLOCKED'
  | 'UNKNOWN';

export interface BagStatus {
  productId: string;
  canBag: boolean;
  bagMode: BagMode;
  standard: {
    available: boolean;
    alreadyBagged: boolean;
    cartItemId?: string | null;
    requiresSize: boolean;
    requiresColor: boolean;
    selectedSize?: string | null;
    selectedColor?: string | null;
    sizes: string[];
    colors: string[];
    quantity: number;
    stock: number;
  };
  custom: {
    available: boolean;
    alreadyBagged: boolean;
    checkoutSessionId?: string | null;
    checkoutIntentId?: string | null;
    configurationId?: string | null;
    requiredMeasurementKeys: string[];
    requiredFreeformPointIds: string[];
    fittingState: BagFittingState;
    freshnessState?: BagFreshnessState;
    missingMeasurementKeys: string[];
    staleMeasurementKeys?: string[];
    veryStaleMeasurementKeys?: string[];
    measurementUpdatedAt?: string | null;
    staleAfterDays?: number;
    staleAt?: string | null;
    veryStaleAfterDays?: number;
    veryStaleAt?: string | null;
    requiresStaleConfirmation?: boolean;
  };
  customOrder?: {
    enabled: boolean;
    inBag: boolean;
    sessionId?: string | null;
    checkoutIntentId?: string | null;
    configurationId?: string | null;
    requiredMeasurementKeys: string[];
    requiredFreeformPointIds: string[];
    fittingsComplete: boolean;
    freshnessState?: BagFreshnessState;
    missingMeasurementKeys: string[];
    staleMeasurementKeys?: string[];
    veryStaleMeasurementKeys?: string[];
    measurementUpdatedAt?: string | null;
    staleAfterDays?: number;
    staleAt?: string | null;
    veryStaleAfterDays?: number;
    veryStaleAt?: string | null;
    requiresStaleConfirmation?: boolean;
  };
  duplicateState?: {
    inBag: boolean;
    submittedUnpaid: boolean;
    paidActive: boolean;
    completedPolicy: 'ALLOW_REPEAT' | 'BLOCK_REPEAT' | 'UNKNOWN';
    reason?: string | null;
    classifications: BagDuplicateClassification[];
  };
  stockState: BagStockState;
  userState: {
    authenticated: boolean;
    isOwner: boolean;
    hasPreviouslyBaggedOrOrdered: boolean;
  };
  ui: {
    heartbeatState: BagPulseStatus;
    defaultAction: BagDefaultAction;
    disabledReason?: string | null;
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
  id?: string;
  orderItemId?: string;
  productId: string;
  name: string;
  productName?: string | null;
  thumbnail?: string | null;
  image?: string | null;
  price: number;
  unitPrice?: number;
  quantity: number;
  selectedSize?: string | null;
  selectedColor?: string | null;
  reviewState?: 'CAN_CREATE' | 'ALREADY_REVIEWED' | 'BLOCKED_BY_DISPUTE' | 'NOT_DELIVERED';
  existingReviewId?: string | null;
}

export interface OrderFinanceRelease {
  stage: 'SHIPPED_RELEASE' | 'DELIVERED_RELEASE';
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
  releasedAt?: string | null;
  eligibleAt?: string | null;
  condition?: string | null;
}

export interface OrderFinanceBreakdown {
  currency: string;
  itemSubtotal: number;
  shippingAmount: number;
  discountAmount: number;
  grossAmount: number;
  paymentReference?: string | null;
  paymentStatus?: string | null;
  paidAt?: string | null;
  escrowStatus?: string | null;
  commissionRate?: number | null;
  commissionAmount?: number | null;
  netBrandAmount?: number | null;
  releaseSchedule?: OrderFinanceRelease[];
  ledgerTransactions?: Array<{
    id: string;
    type: string;
    description: string;
    totalAmount: number;
    currency: string;
    createdAt: string;
    entries: Array<{
      id: string;
      direction: 'DEBIT' | 'CREDIT';
      amount: number;
      accountCode?: string | null;
      accountName?: string | null;
      accountType?: string | null;
      accountSubType?: string | null;
    }>;
  }>;
}

export interface OrderBuyerReceipt {
  id: string;
  documentNumber: string;
  type: string;
  issuedAt: string;
  currency: string;
  grossAmount: number;
  commissionAmount?: number | null;
  netAmount?: number | null;
  paymentAttemptId?: string | null;
  paymentReference?: string | null;
  settlementCurrency?: string | null;
  settlementAmount?: number | null;
  issuedToName?: string | null;
  lineItems?: Array<{ label: string; amount: number }>;
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
  deliveredAt?: string | null;
  buyerConfirmedDeliveryAt?: string | null;
  financeBreakdown?: OrderFinanceBreakdown | null;
  buyerReceipt?: OrderBuyerReceipt | null;
  createdAt: string;
  updatedAt: string;
  orderItems?: OrderItem[];
  brand?: {
    id: string;
    name?: string;
    logo?: string | null;
    currency?: string;
    contactEmail?: string | null;
    owner?: {
      phoneNumber?: string | null;
      address?: string | null;
    } | null;
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

export type CheckoutPaymentMethod = 'PAYSTACK' | 'FLUTTERWAVE' | 'BANK_TRANSFER';

export type FlutterwavePaymentChannel =
  | 'CARD'
  | 'BANK_TRANSFER'
  | 'BANK_ACCOUNT'
  | 'USSD'
  | 'MOBILE_MONEY';

export interface BillingAddress {
  firstName: string;
  lastName: string;
  street: string;
  apartment?: string;
  city: string;
  state: string;
  postalCode?: string;
  country: string;
}

export interface PaymentContactDetails {
  email: string;
  phone: string;
  billingSameAsShipping: boolean;
  billingAddress?: BillingAddress;
  consentAccepted: boolean;
  legalAcceptances?: LegalAcceptancePayload[];
}

export interface PaystackPaymentData extends PaymentContactDetails {
  method: 'PAYSTACK';
  channel: 'CARD' | 'BANK_TRANSFER';
  useSavedCard?: boolean;
  savedCardId?: string | null;
  saveNewCard?: boolean;
  newCardDraft?: {
    cardHolderName: string;
    cardNumber: string;
    expiry: string;
    cvv: string;
  } | null;
  savedCardDisplay?: {
    id: string;
    brand: string | null;
    bank: string | null;
    last4: string;
    expMonth: string | null;
    expYear: string | null;
    reusable: boolean;
    lastUsedAt: string;
  } | null;
}

export interface FlutterwavePaymentData extends PaymentContactDetails {
  method: 'FLUTTERWAVE';
  channel: FlutterwavePaymentChannel;
  bankAccount?: {
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  ussd?: {
    bankCode: string;
    bankName: string;
  };
  mobileMoney?: {
    countryCode: 'GH' | 'KE';
    networkId: string;
    networkName: string;
    phone: string;
  };
}

export interface DirectBankTransferPaymentData extends PaymentContactDetails {
  method: 'BANK_TRANSFER';
  channel: 'BANK_TRANSFER';
  senderName: string;
  senderPhone: string;
  senderBankName: string;
  transferPurpose: string;
}

export type PaymentData =
  | PaystackPaymentData
  | FlutterwavePaymentData
  | DirectBankTransferPaymentData;

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

export const getBagStatus = async (productId: string): Promise<BagStatus> => {
  const res = await apiClient.get(`/store/products/${productId}/bag-status`);
  return extractData<BagStatus>(res);
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

// ============= Orders =============

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

export const confirmMyOrderDelivery = async (
  orderId: string,
  note?: string,
): Promise<Order> => {
  const res = await apiClient.post(`/store/orders/${orderId}/confirm-delivery`, { note });
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
  isEmailVerified?: boolean;
  isProfileComplete?: boolean;
  profileMissingFields?: string[];
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
  paymentAccount?: StorePaymentAccountSummary | null;
}

export interface StorePaymentAccountSummary {
  id: string | null;
  provider: string;
  status: 'PENDING_SETUP' | 'PENDING_SYNC' | 'ACTIVE' | 'SYNC_ERROR' | string;
  isReady: boolean;
  businessName: string | null;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  bankCode: string | null;
  bankName: string | null;
  accountName: string | null;
  maskedAccountNumber: string | null;
  subaccountCode: string | null;
  subaccountId: string | null;
  subaccountActive: boolean;
  subaccountVerified: boolean;
  transferRecipientCode: string | null;
  transferRecipientId: string | null;
  transferRecipientActive: boolean;
  lastSyncError: string | null;
  accountResolvedAt: string | null;
  subaccountLastSyncAt: string | null;
  transferRecipientLastSyncAt: string | null;
  lastProviderSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  paystackBankId: string | null;
  updatedAt: string | null;
}

const STORE_STATUS_TTL_MS = 30 * 1000;
let storeStatusCache: { data: StoreStatusResponse; expiresAt: number } | null = null;
let storeStatusPending: Promise<StoreStatusResponse> | null = null;

const clearStoreStatusCache = () => {
  storeStatusCache = null;
  storeStatusPending = null;
};

export interface StorePaymentAccountResponse {
  brandId: string;
  provider: 'PAYSTACK' | string;
  isRequiredForStoreOpen: boolean;
  suggestedDefaults: {
    businessName: string;
    primaryContactName: string | null;
    primaryContactEmail: string | null;
    primaryContactPhone: string | null;
  };
  account: StorePaymentAccountSummary;
}

export interface StorePaymentBankOption {
  id: number;
  code: string;
  name: string;
  currency: string;
}

export interface StorePayoutStatementSummary {
  id: string;
  documentNumber: string;
  issuedAt: string;
  downloadPath: string;
}

export interface StoreWalletPayoutItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  providerTransferStatus: string | null;
  createdAt: string;
  processedAt: string | null;
  paidAt: string | null;
  statement: StorePayoutStatementSummary | null;
}

export interface StoreWalletResponse {
  brandId: string;
  currency: string;
  paymentAccount?: StorePaymentAccountSummary | null;
  summary: {
    availableForPayout: number;
    heldInEscrow: number;
    totalEarnings: number;
    totalPaidOut: number;
    pendingPayoutTotal: number;
    pendingPayoutCount: number;
  };
  recentPayouts: StoreWalletPayoutItem[];
}

export interface StorePayoutListResponse {
  items: Array<
    StoreWalletPayoutItem & {
      providerTransferFailureMessage?: string | null;
      providerTransferReference?: string | null;
    }
  >;
  total: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
}

export interface StorePayoutStatementResponse {
  id: string;
  payoutId: string;
  documentNumber: string;
  issuedAt: string;
  currency: string;
  grossAmount: number;
  netAmount: number;
  contentHtml: string;
}

export interface StorePayoutDetailResponse {
  id: string;
  brandId: string;
  amount: number;
  currency: string;
  status: string;
  provider: string | null;
  reference: string | null;
  providerTransferStatus: string | null;
  providerTransferReference: string | null;
  providerTransferFailureMessage: string | null;
  providerTransferInitiatedAt: string | null;
  providerTransferFinalizedAt: string | null;
  providerTransferReversedAt: string | null;
  failureReason: string | null;
  statusReason: string | null;
  createdAt: string;
  processedAt: string | null;
  paidAt: string | null;
  statement: StorePayoutStatementSummary | null;
  sourceBreakdown: PayoutSourceBreakdown;
}

export interface StorePaymentAccountUpdateData {
  bankCode?: string;
  accountNumber?: string;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
}

export interface StorePaymentAccountVerificationData {
  bankCode: string;
  accountNumber: string;
}

export interface StorePaymentAccountVerificationResponse {
  bankCode: string;
  bankName: string;
  paystackBankId: number | null;
  accountNumber: string;
  maskedAccountNumber: string | null;
  accountName: string | null;
  message: string;
  verifiedAt: string;
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
  paymentAccount?: StorePaymentAccountSummary | null;
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

export const getStoreStatus = async (options?: { forceRefresh?: boolean }): Promise<StoreStatusResponse> => {
  const forceRefresh = options?.forceRefresh === true;
  if (!forceRefresh && storeStatusCache && storeStatusCache.expiresAt > Date.now()) {
    return storeStatusCache.data;
  }
  if (!forceRefresh && storeStatusPending) {
    return storeStatusPending;
  }

  storeStatusPending = (async () => {
    const res = await apiClient.get('/store/status');
    const data = extractData<StoreStatusResponse>(res);
    storeStatusCache = { data, expiresAt: Date.now() + STORE_STATUS_TTL_MS };
    return data;
  })();

  try {
    return await storeStatusPending;
  } finally {
    storeStatusPending = null;
  }
};

export type OpenStorePayload = {
  legalAcceptances?: LegalAcceptancePayload[];
};

export const openStore = async (
  payload: OpenStorePayload = {},
): Promise<{ success: boolean; message: string; brandId: string }> => {
  const res = await apiClient.post('/store/open', payload);
  clearStoreStatusCache();
  return extractData<{ success: boolean; message: string; brandId: string }>(res);
};

export const closeStore = async (): Promise<{ success: boolean; message: string; brandId: string }> => {
  const res = await apiClient.post('/store/close');
  clearStoreStatusCache();
  return extractData<{ success: boolean; message: string; brandId: string }>(res);
};

export const updateStoreProfile = async (data: StoreProfileUpdateData): Promise<StoreStatusResponse> => {
  const res = await apiClient.patch('/store/profile', data);
  const status = extractData<StoreStatusResponse>(res);
  storeStatusCache = { data: status, expiresAt: Date.now() + STORE_STATUS_TTL_MS };
  return status;
};

export const getStorePolicies = async (): Promise<StorePoliciesResponse> => {
  const res = await apiClient.get('/store/policies');
  return extractData<StorePoliciesResponse>(res);
};

export const getStorePaymentAccount = async (): Promise<StorePaymentAccountResponse> => {
  const res = await apiClient.get('/store/payment-account');
  return extractData<StorePaymentAccountResponse>(res);
};

export const listStorePaymentBanks = async (): Promise<StorePaymentBankOption[]> => {
  const res = await apiClient.get('/store/payment-account/banks');
  return extractData<StorePaymentBankOption[]>(res);
};

export const getStoreWallet = async (): Promise<StoreWalletResponse> => {
  const res = await apiClient.get('/store/wallet');
  return extractData<StoreWalletResponse>(res);
};

export const listStorePayouts = async (params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<StorePayoutListResponse> => {
  const res = await apiClient.get('/store/payouts', {
    params: {
      page: params?.page,
      limit: params?.limit,
      status: params?.status,
    },
  });
  return extractData<StorePayoutListResponse>(res);
};

export const getStorePayoutStatement = async (
  payoutId: string,
): Promise<StorePayoutStatementResponse> => {
  const res = await apiClient.get(`/store/payouts/${payoutId}/statement`);
  return extractData<StorePayoutStatementResponse>(res);
};

export const getStorePayoutDetail = async (
  payoutId: string,
): Promise<StorePayoutDetailResponse> => {
  const res = await apiClient.get(`/store/payouts/${payoutId}`);
  return extractData<StorePayoutDetailResponse>(res);
};

export const updateStorePaymentAccount = async (
  data: StorePaymentAccountUpdateData,
  options?: { idempotencyKey?: string },
): Promise<StorePaymentAccountResponse> => {
  const idempotencyKey = options?.idempotencyKey ?? createIdempotencyKey();
  const res = await apiClient.patch('/store/payment-account', data, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return extractData<StorePaymentAccountResponse>(res);
};

export const verifyStorePaymentAccount = async (
  data: StorePaymentAccountVerificationData,
): Promise<StorePaymentAccountVerificationResponse> => {
  const res = await apiClient.post('/store/payment-account/verify', data);
  return extractData<StorePaymentAccountVerificationResponse>(res);
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
  getBagStatus,
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
  getStorePaymentAccount,
  updateStoreName,
  getStoreStatus,
  listStorePaymentBanks,
  verifyStorePaymentAccount,
  getStoreWallet,
  listStorePayouts,
  getStorePayoutDetail,
  getStorePayoutStatement,
  openStore,
  closeStore,
  updateStoreProfile,
  getStorePolicies,
  updateStorePaymentAccount,
  updateStorePolicies,
  getProductPriceChangePreview,
  resolveOrderAccess,
};
