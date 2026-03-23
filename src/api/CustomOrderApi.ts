import { apiClient } from './httpClient';
import { createIdempotencyKey } from './idempotency';
import { unwrapApiResponse } from '@/types/auth';

export type CustomOrderSourceType = 'PRODUCT' | 'DESIGN';
export type CustomOrderStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PENDING_BRAND_ACCEPTANCE'
  | 'ACCEPTED'
  | 'IN_PRODUCTION'
  | 'READY_FOR_DISPATCH'
  | 'IN_TRANSIT'
  | 'DELIVERED_PENDING_BUYER_CONFIRMATION'
  | 'COMPLETED'
  | 'REJECTED_BY_BRAND'
  | 'CANCELLED_BY_BUYER_PRE_ACCEPTANCE'
  | 'DELIVERY_ISSUE_REPORTED'
  | 'REFUND_IN_PROGRESS'
  | 'DISPUTED'
  | 'CLOSED';

export type CustomOrderProgressStage =
  | 'ORDER_PLACED'
  | 'ORDER_RECEIVED'
  | 'FABRIC_AND_PIECE_PURCHASE_GATHERING'
  | 'DESIGN_MODE'
  | 'FINAL_TOUCHES_AND_PACKAGING'
  | 'READY_FOR_DELIVERY';

export type CustomOrderDisputeStatus =
  | 'OPEN'
  | 'BRAND_RESPONDED'
  | 'ADMIN_REVIEW'
  | 'RESOLVED'
  | 'CLOSED';

export type CustomOrderDisputeResolution =
  | 'FULL_REFUND'
  | 'PARTIAL_REFUND'
  | 'REMAKE'
  | 'NO_ACTION'
  | 'ESCALATED';

export type CustomFabricRuleBasisStatus = 'BRAND_ONLY' | 'APPROVED_GLOBAL' | 'REJECTED';

export type CustomOrderIssueType =
  | 'WRONG_ITEM'
  | 'MATERIAL_DEFECT'
  | 'MEASUREMENT_NON_COMPLIANCE'
  | 'UNFINISHED_WORK'
  | 'NON_DELIVERY'
  | 'UNREASONABLE_DELAY'
  | 'OTHER';

export type CustomOrderExtensionResponseStatus =
  | 'OPEN'
  | 'ACCEPTED'
  | 'COUNTERED'
  | 'REJECTED'
  | 'EXPIRED';

export type CustomOrderExtensionTargetType = 'PRODUCTION' | 'DELIVERY' | 'BOTH';
export type CustomOrderChartFamily =
  | 'UK'
  | 'US'
  | 'NIGERIA'
  | 'ASIA'
  | 'HYBRID_UK_NIGERIA'
  | 'HYBRID_US_NIGERIA';
export type CustomOrderResolverPolicy =
  | 'PRIMARY_ONLY'
  | 'MAX_OF_BOTH'
  | 'WEIGHTED_AVERAGE_TO_NEAREST_BAND';
export type CustomOrderQuoteStatus = 'AUTO_PRICED' | 'MANUAL_QUOTE_REQUIRED';

export type CustomOrderRetentionHoldType = 'LEGAL' | 'SUPPORT';

export interface CustomOrderConfigurationRule {
  id: string;
  priority: number;
  conditionsJson: Record<string, unknown>;
  outputYards: string;
  isFallback: boolean;
}

export interface CustomOrderConfigurationRuleInput {
  priority: number;
  conditionsJson: Record<string, unknown>;
  outputYards: string;
  isFallback?: boolean;
}

export interface CustomOrderConfigurationSizeExtraYard {
  sizeLabel: string;
  extraYards: number;
}

export interface CustomOrderConfigurationYardProfile {
  averageBaseYards?: number;
  sizeExtraYards: CustomOrderConfigurationSizeExtraYard[];
}

export interface CustomOrderConfigurationUpsertInput {
  sourceType: CustomOrderSourceType;
  sourceId: string;
  title?: string;
  buyerInstructionText?: string;
  requiredMeasurementKeys: string[];
  requiredFreeformPointIds?: string[];
  fabricRuleBasisId: string;
  baseProductionCharge: string;
  fabricCostPerYard: string;
  rushEnabled: boolean;
  rushFee?: string;
  rushProductionLeadDays?: number;
  productionLeadDays: number;
  deliveryMinDays: number;
  deliveryMaxDays: number;
  deliveryScope: string;
  revisionPolicy: string;
  returnPolicy: string;
  defectPolicy: string;
  fabricSourcingMode: 'BRAND_SOURCED' | 'BUYER_SUPPLIED' | 'EITHER';
  notes?: string;
  averageBaseYards?: number;
  sizeExtraYards?: CustomOrderConfigurationSizeExtraYard[];
  rules: CustomOrderConfigurationRuleInput[];
}

export interface CustomOrderConfiguration {
  id: string;
  brandId: string;
  sourceType: CustomOrderSourceType;
  sourceId: string;
  title: string;
  buyerInstructionText?: string | null;
  requiredMeasurementKeys: string[];
  requiredFreeformPointIds: string[];
  baseProductionCharge: string;
  fabricCostPerYard: string;
  rushEnabled: boolean;
  rushFee?: string | null;
  rushProductionLeadDays?: number | null;
  productionLeadDays: number;
  deliveryMinDays: number;
  deliveryMaxDays: number;
  deliveryScope: string;
  revisionPolicy: string;
  returnPolicy: string;
  defectPolicy: string;
  fabricSourcingMode: string;
  notes?: string | null;
  yardProfile?: CustomOrderConfigurationYardProfile | null;
  isActive: boolean;
  currentVersion: number;
  brand?: {
    id: string;
    name: string;
    ownerId?: string;
  };
  fabricRuleBasis?: {
    id: string;
    label: string;
    measurementKeys: string[];
  };
  rules: CustomOrderConfigurationRule[];
  versions?: Array<{
    id: string;
    version: number;
    createdAt: string;
  }>;
}

export interface CustomOrderListItem {
  id: string;
  status: CustomOrderStatus;
  paymentStatus: string;
  sourceType: CustomOrderSourceType;
  sourceId: string;
  sourceTitle: string;
  brand: {
    name: string;
  };
  buyerPriceSummary: {
    grandTotal: number;
    currency: string;
  };
  currentProgressStage?: CustomOrderProgressStage | null;
  createdAt: string;
}

export interface CustomOrderTimelineEvent {
  id: string;
  actorType: string;
  actorId?: string | null;
  eventType: string;
  payloadJson?: Record<string, unknown> | null;
  createdAt: string;
}

export interface CustomOrderProgressEvent {
  id: string;
  stage: CustomOrderProgressStage;
  note?: string | null;
  changedById?: string | null;
  changedAt: string;
  staleThresholdAt?: string | null;
  adminEscalatedAt?: string | null;
}

export interface CustomOrderExtensionRequest {
  id: string;
  targetType: CustomOrderExtensionTargetType;
  requestedExtraDays: number;
  reason: string;
  buyerResponseStatus: CustomOrderExtensionResponseStatus;
  buyerCounterDays?: number | null;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface CustomOrderIssue {
  id: string;
  reasonType: CustomOrderIssueType | string;
  buyerStatement: string;
  status?: string;
  createdAt: string;
}

export interface CustomOrderDispute {
  id: string;
  status: CustomOrderDisputeStatus | string;
  resolution?: CustomOrderDisputeResolution | string | null;
  adminNotes?: string | null;
  assignedAdminId?: string | null;
  customOrderId?: string;
  openedAt: string;
  resolvedAt?: string | null;
}

export interface CustomOrderPayoutRecord {
  id: string;
  status: string;
  amount: number | string;
  currency: string;
  reference?: string | null;
  createdAt: string;
}

export interface CustomOrderLedgerAllocation {
  id: string;
  allocationType: string;
  amount: number | string;
  currency: string;
  status: string;
  eligibleAt?: string | null;
  paidOutAt?: string | null;
  reversedAt?: string | null;
  reversalReason?: string | null;
  payoutId?: string | null;
  payout?: CustomOrderPayoutRecord | null;
  customOrder?: {
    id: string;
    brandId: string;
    buyerId: string;
    sourceTitleSnapshot: string;
    sourceBrandNameSnapshot?: string | null;
    status: CustomOrderStatus;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CustomFabricRuleBasis {
  id: string;
  label: string;
  measurementKeys: string[];
  status: CustomFabricRuleBasisStatus;
  gender?: 'MEN' | 'WOMEN' | 'UNISEX' | null;
  moderationNotes?: string | null;
  yardTemplate?: CustomFabricRuleBasisYardTemplate | null;
  reviewedById?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomFabricRuleBasisSizeMultiplier {
  sizeLabel: string;
  multiplier: number;
}

export interface CustomFabricRuleBasisYardTemplate {
  averageBaseYards?: number;
  sizeMultipliers: CustomFabricRuleBasisSizeMultiplier[];
}

export interface CreateCustomFabricRuleBasisInput {
  label: string;
  measurementKeys: string[];
  gender?: 'MEN' | 'WOMEN' | 'UNISEX';
}

export interface CreateAdminCustomFabricRuleBasisInput extends CreateCustomFabricRuleBasisInput {
}

export interface UpdateAdminCustomFabricRuleBasisInput {
  label?: string;
  measurementKeys?: string[];
  gender?: 'MEN' | 'WOMEN' | 'UNISEX';
}

export interface CustomOrderStaleItem {
  id: string;
  stage: CustomOrderProgressStage;
  changedAt: string;
  staleThresholdAt?: string | null;
  staleBuyerWarnedAt?: string | null;
  adminEscalatedAt?: string | null;
  customOrder: CustomOrderListItem & {
    buyerAcceptanceWindowEndsAt?: string | null;
    lastBrandProgressUpdateAt?: string | null;
  };
}

export interface CustomOrderDisputeListItem {
  id: string;
  customOrderId: string;
  status: CustomOrderDisputeStatus | string;
  resolution?: CustomOrderDisputeResolution | string | null;
  adminNotes?: string | null;
  assignedAdminId?: string | null;
  openedAt: string;
  resolvedAt?: string | null;
  customOrder: {
    id: string;
    brandId: string;
    buyerId: string;
    sourceTitleSnapshot: string;
    sourceBrandNameSnapshot?: string | null;
    status: CustomOrderStatus;
  };
}

export interface CustomOrderDetail {
  id: string;
  status: CustomOrderStatus;
  paymentStatus: string;
  paymentReference?: string | null;
  source: {
    type: CustomOrderSourceType;
    id: string;
    title: string;
    slug?: string | null;
    primaryMediaUrl?: string | null;
    brandName?: string | null;
  };
  configurationVersionId: string;
  buyerPriceSummary: {
    grandTotal: number;
    subtotal?: number;
    currency?: string;
    shippingFee?: number;
    rushFee?: number;
  };
  internalPriceBreakdown?: Record<string, unknown>;
  quoteStatus?: CustomOrderQuoteStatus;
  chartLock?: {
    pricingChartFamily: CustomOrderChartFamily;
    displayChartFamily: CustomOrderChartFamily;
    resolverPolicy: CustomOrderResolverPolicy;
    chartVersionId: string;
    computedSize?: string | null;
    noDirectMatch?: boolean;
    conversionGuidance?: string | null;
    quoteStatus?: CustomOrderQuoteStatus;
  } | null;
  exceptionDecision?: Record<string, unknown> | null;
  measurementSnapshot: Record<string, number>;
  measurementConfirmedAt?: string | null;
  currentProgressStage?: CustomOrderProgressStage | null;
  acceptedAt?: string | null;
  buyerAcceptedAt?: string | null;
  completedAt?: string | null;
  promisedProductionAt?: string | null;
  promisedDispatchAt?: string | null;
  promisedDeliveryAt?: string | null;
  buyerAcceptanceWindowEndsAt?: string | null;
  measurementRetentionUntil?: string | null;
  anonymizedAt?: string | null;
  retentionHoldType?: CustomOrderRetentionHoldType | null;
  retentionHoldReason?: string | null;
  retentionHoldUntil?: string | null;
  retentionHoldSetById?: string | null;
  retentionHoldSetAt?: string | null;
  progressEvents: CustomOrderProgressEvent[];
  extensionRequests: CustomOrderExtensionRequest[];
  issues: CustomOrderIssue[];
  disputes: CustomOrderDispute[];
  ledgerAllocations?: CustomOrderLedgerAllocation[];
  timelineEvents: CustomOrderTimelineEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface PricePreviewResponse {
  checkoutIntentId: string | null;
  configurationId: string;
  configurationVersionId: string;
  currency: string;
  buyerPriceSummary: {
    grandTotal: number;
    subtotal?: number;
    shippingFee?: number;
    rushFee?: number;
  } | null;
  priceLockExpiresAt: string | null;
  quoteStatus: CustomOrderQuoteStatus;
  pricingChartFamily?: CustomOrderChartFamily;
  displayChartFamily?: CustomOrderChartFamily;
  resolverPolicy?: CustomOrderResolverPolicy;
  computedSize?: string | null;
  chartVersionId?: string;
  noDirectMatch?: boolean;
  conversionGuidance?: string | null;
}

export interface DisplayChartPreference {
  displayChartFamily: CustomOrderChartFamily;
  updatedAtMs: number;
}

export interface CustomOrderExceptionReviewItem {
  id: string;
  createdAt: string;
  payload: Record<string, unknown>;
  customOrder: {
    id: string;
    brandId: string;
    sourceTitleSnapshot: string;
    sourceBrandNameSnapshot?: string | null;
    status: CustomOrderStatus;
    createdAt: string;
  };
}

export interface CustomOrderPaymentInitResult {
  paymentAttemptId: string;
  reference: string;
  gateway: string;
  status: string;
  channel?: string;
  callbackUrl?: string;
  authorizationUrl?: string;
  bankAccount?: Record<string, unknown>;
  nextAction?: Record<string, unknown>;
}

export interface CustomOrderPaymentVerificationResult {
  success: boolean;
  status: string;
  paymentAttemptId: string;
  reference: string;
  amount: number;
  currency: string;
  paidAt?: string;
  channel?: string;
  failureMessage?: string;
  customOrderId: string;
  awaitingProviderConfirmation?: boolean;
  recoveryAction?: string;
  recoveryMessage?: string;
}

export interface PaginatedCustomOrders<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface CustomOrderRiskDashboard {
  overview: {
    periodDays: number;
    ordersPlaced: number;
    rushOrders: number;
    brandRejections: number;
    disputesOpened: number;
    refundsInitiated: number;
    adminEscalations: number;
    currentStaleOrders: number;
    currentAcceptanceSlaRisk: number;
    currentAcceptanceTimeouts: number;
    rushOrdersWithExceptions: number;
  };
  brandRisk: Array<{
    brandId: string;
    brandName?: string | null;
    riskScore: number;
    ordersPlaced: number;
    rushOrders: number;
    brandRejections: number;
    disputesOpened: number;
    refundsInitiated: number;
    adminEscalations: number;
    staleOrders: number;
    acceptanceSlaRisk: number;
    acceptanceTimeouts: number;
    rushOrdersWithExceptions: number;
  }>;
}

export interface CustomOrderRefundReviewListItem {
  id: string;
  status: CustomOrderStatus;
  paymentStatus: string;
  paymentReference?: string | null;
  sourceTitle: string;
  sourceBrandName?: string | null;
  createdAt: string;
  updatedAt: string;
  brand?: {
    id: string;
    name: string;
    ownerId?: string;
  };
  disputeCount: number;
  issueCount: number;
  latestRefundTimelineEvent?: CustomOrderTimelineEvent | null;
  latestRefundEvent?: {
    type: string;
    source: string;
    payload?: Record<string, unknown> | null;
    createdAt: string;
  } | null;
  latestPaymentAttempt?: {
    id: string;
    reference: string;
    status: string;
    provider: string;
    amount: number;
    currency: string;
    confirmedAt?: string | null;
    lastVerifiedAt?: string | null;
    failureMessage?: string | null;
    createdAt: string;
  } | null;
}

export interface CustomOrderRefundReviewDetail {
  order: CustomOrderDetail;
  paymentAttempts: Array<{
    id: string;
    reference: string;
    status: string;
    provider: string;
    amount: number;
    currency: string;
    confirmedAt?: string | null;
    lastVerifiedAt?: string | null;
    failureMessage?: string | null;
    requestSnapshot?: Record<string, unknown> | null;
    responseSnapshot?: Record<string, unknown> | null;
    createdAt: string;
  }>;
  paymentEvents: Array<{
    paymentAttemptId: string;
    type: string;
    source: string;
    payload?: Record<string, unknown> | null;
    createdAt: string;
  }>;
}

export interface UpdateCustomOrderRetentionHoldInput {
  clear: boolean;
  holdType?: CustomOrderRetentionHoldType;
  reason?: string;
  holdUntil?: string;
}

const withParams = <T extends Record<string, unknown>>(params?: T) => {
  const entries = Object.entries(params ?? {}).filter(([, value]) => value !== undefined && value !== null && value !== '');
  return entries.length > 0 ? { params: Object.fromEntries(entries) } : undefined;
};

const parseConfigurationYardProfile = (
  notes?: string | null,
): CustomOrderConfigurationYardProfile | null => {
  const raw = String(notes ?? '');
  const prefix = 'YARD_PROFILE:';
  if (!raw.startsWith(prefix)) {
    return null;
  }

  const body = raw.slice(prefix.length);
  const jsonLine = body.split('\n')[0]?.trim();
  if (!jsonLine) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonLine) as {
      averageBaseYards?: unknown;
      sizeExtraYards?: Array<{ sizeLabel?: unknown; extraYards?: unknown }>;
    };

    const sizeExtraYards = Array.isArray(parsed.sizeExtraYards)
      ? parsed.sizeExtraYards
          .map((entry) => ({
            sizeLabel: String(entry?.sizeLabel ?? '').trim(),
            extraYards: Number(entry?.extraYards),
          }))
          .filter((entry) => entry.sizeLabel.length > 0 && Number.isFinite(entry.extraYards) && entry.extraYards >= 0)
      : [];

    const averageBaseYards =
      typeof parsed.averageBaseYards === 'number' && Number.isFinite(parsed.averageBaseYards)
        ? parsed.averageBaseYards
        : undefined;

    if (averageBaseYards == null && sizeExtraYards.length === 0) {
      return null;
    }

    return {
      averageBaseYards,
      sizeExtraYards,
    };
  } catch {
    return null;
  }
};

const hydrateConfiguration = (configuration: CustomOrderConfiguration): CustomOrderConfiguration => ({
  ...configuration,
  yardProfile: parseConfigurationYardProfile(configuration.notes),
});

const hydrateConfigurationPage = (
  page: PaginatedCustomOrders<CustomOrderConfiguration>,
): PaginatedCustomOrders<CustomOrderConfiguration> => ({
  ...page,
  items: page.items.map(hydrateConfiguration),
});

const toConfigurationPayload = (
  payload: CustomOrderConfigurationUpsertInput | Partial<CustomOrderConfigurationUpsertInput>,
) => {
  const next = { ...payload } as Record<string, unknown>;
  if (next.averageBaseYards === undefined) {
    delete next.averageBaseYards;
  }
  if (!Array.isArray(next.sizeExtraYards)) {
    delete next.sizeExtraYards;
  }
  return next;
};

const parseBasisTemplate = (moderationNotes?: string | null): CustomFabricRuleBasisYardTemplate | null => {
  const raw = String(moderationNotes ?? '');
  if (!raw.startsWith('YARD_TEMPLATE:')) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw.slice('YARD_TEMPLATE:'.length)) as {
      averageBaseYards?: unknown;
      sizeMultipliers?: Array<{ sizeLabel?: unknown; multiplier?: unknown }>;
    };

    const sizeMultipliers = Array.isArray(parsed.sizeMultipliers)
      ? parsed.sizeMultipliers
          .map((entry) => ({
            sizeLabel: String(entry?.sizeLabel ?? '').trim(),
            multiplier: Number(entry?.multiplier),
          }))
          .filter((entry) => entry.sizeLabel.length > 0 && Number.isFinite(entry.multiplier) && entry.multiplier > 0)
      : [];

    const averageBaseYards =
      typeof parsed.averageBaseYards === 'number' && Number.isFinite(parsed.averageBaseYards)
        ? parsed.averageBaseYards
        : undefined;

    return {
      averageBaseYards,
      sizeMultipliers,
    };
  } catch {
    return null;
  }
};

const hydrateBasis = (basis: CustomFabricRuleBasis): CustomFabricRuleBasis => ({
  ...basis,
  yardTemplate: parseBasisTemplate(basis.moderationNotes),
});

const hydrateBasisList = (bases: CustomFabricRuleBasis[]) => bases.map(hydrateBasis);

const isNotFoundResponse = (error: any) =>
  Number(error?.response?.status) === 404;

export const customOrderConfigurationsApi = {
  async getActiveForProduct(productId: string) {
    try {
      const response = await apiClient.get(`/products/${productId}/custom-order-configuration`);
      return hydrateConfiguration(unwrapApiResponse<CustomOrderConfiguration>(response.data));
    } catch (error) {
      if (isNotFoundResponse(error)) {
        return null;
      }
      throw error;
    }
  },

  async getActiveForDesign(designId: string) {
    try {
      const response = await apiClient.get(`/designs/${designId}/custom-order-configuration`);
      return hydrateConfiguration(unwrapApiResponse<CustomOrderConfiguration>(response.data));
    } catch (error) {
      if (isNotFoundResponse(error)) {
        return null;
      }
      throw error;
    }
  },

  async listVisible(params?: {
    page?: number;
    limit?: number;
    isActive?: boolean;
  }) {
    const response = await apiClient.get('/custom-order-configurations', withParams(params));
    return hydrateConfigurationPage(
      unwrapApiResponse<PaginatedCustomOrders<CustomOrderConfiguration>>(response.data),
    );
  },

  async getById(configurationId: string) {
    const response = await apiClient.get(`/custom-order-configurations/${configurationId}`);
    return hydrateConfiguration(unwrapApiResponse<CustomOrderConfiguration>(response.data));
  },

  async create(payload: CustomOrderConfigurationUpsertInput) {
    const response = await apiClient.post('/custom-order-configurations', toConfigurationPayload(payload));
    return hydrateConfiguration(unwrapApiResponse<CustomOrderConfiguration>(response.data));
  },

  async update(configurationId: string, payload: Partial<CustomOrderConfigurationUpsertInput>) {
    const response = await apiClient.patch(
      `/custom-order-configurations/${configurationId}`,
      toConfigurationPayload(payload),
    );
    return hydrateConfiguration(unwrapApiResponse<CustomOrderConfiguration>(response.data));
  },

  async listFabricRuleBases(params?: { includeBrandOnly?: boolean }) {
    const response = await apiClient.get('/custom-fabric-rule-bases', withParams(params));
    return hydrateBasisList(unwrapApiResponse<CustomFabricRuleBasis[]>(response.data));
  },

  async createFabricRuleBasis(payload: CreateCustomFabricRuleBasisInput) {
    const response = await apiClient.post('/custom-fabric-rule-bases', payload);
    return hydrateBasis(unwrapApiResponse<CustomFabricRuleBasis>(response.data));
  },
};

export const customOrdersBuyerApi = {
  async previewPrice(payload: {
    configurationId: string;
    configurationVersionId?: string;
    measurementValues: Record<string, number>;
    rushSelected?: boolean;
    shippingAddress?: Record<string, unknown>;
    pricingChartFamily?: CustomOrderChartFamily;
    displayChartFamily?: CustomOrderChartFamily;
    resolverPolicy?: CustomOrderResolverPolicy;
  }) {
    const response = await apiClient.post('/custom-orders/price-preview', {
      ...payload,
      idempotencyKey: createIdempotencyKey(),
    });
    return unwrapApiResponse<PricePreviewResponse>(response.data);
  },

  async create(payload: {
    checkoutIntentId: string;
    configurationId: string;
    configurationVersionId?: string;
    measurementValues: Record<string, number>;
    rushSelected: boolean;
    shippingAddress: Record<string, unknown>;
    contactInfo: Record<string, unknown>;
    customerName: string;
    idempotencyKey?: string;
    noDirectMatchAcknowledged?: boolean;
  }) {
    const response = await apiClient.post('/custom-orders', {
      ...payload,
      idempotencyKey: payload.idempotencyKey ?? createIdempotencyKey(),
    });
    return unwrapApiResponse<CustomOrderDetail>(response.data);
  },

  async initializePayment(
    orderId: string,
    payload: {
      paymentMethod: 'PAYSTACK' | 'FLUTTERWAVE' | 'BANK_TRANSFER';
      email: string;
      callbackUrl?: string;
      paymentData?: Record<string, unknown>;
      idempotencyKey?: string;
    },
  ) {
    const response = await apiClient.post(`/custom-orders/${orderId}/payment/initialize`, {
      ...payload,
      idempotencyKey: payload.idempotencyKey ?? createIdempotencyKey(),
    });
    return unwrapApiResponse<CustomOrderPaymentInitResult>(response.data);
  },

  async verifyPayment(orderId: string, payload: {
    reference: string;
    gateway: string;
    otp?: string;
    statusHint?: string;
  }) {
    const response = await apiClient.post(`/custom-orders/${orderId}/payment/verify`, payload);
    return unwrapApiResponse<CustomOrderPaymentVerificationResult>(response.data);
  },

  async list(params?: { page?: number; limit?: number; status?: CustomOrderStatus; stage?: CustomOrderProgressStage; q?: string }) {
    const response = await apiClient.get('/custom-orders', withParams(params));
    return unwrapApiResponse<PaginatedCustomOrders<CustomOrderListItem>>(response.data);
  },

  async getById(orderId: string) {
    const response = await apiClient.get(`/custom-orders/${orderId}`);
    return unwrapApiResponse<CustomOrderDetail>(response.data);
  },

  async cancel(orderId: string, reason: string) {
    const response = await apiClient.post(`/custom-orders/${orderId}/cancel`, { reason });
    return unwrapApiResponse<CustomOrderDetail>(response.data);
  },

  async confirmDelivery(orderId: string, note?: string) {
    const response = await apiClient.post(`/custom-orders/${orderId}/confirm-delivery`, { note });
    return unwrapApiResponse<CustomOrderDetail>(response.data);
  },

  async reportIssue(orderId: string, payload: {
    issueType: CustomOrderIssueType;
    description: string;
    evidenceJson?: Record<string, unknown>;
  }) {
    const response = await apiClient.post(`/custom-orders/${orderId}/report-issue`, payload);
    return unwrapApiResponse<CustomOrderDetail>(response.data);
  },

  async respondToExtension(orderId: string, requestId: string, payload: {
    response: CustomOrderExtensionResponseStatus;
    counterDays?: number;
  }) {
    const response = await apiClient.post(`/custom-orders/${orderId}/extension-requests/${requestId}/respond`, payload);
    return unwrapApiResponse<CustomOrderDetail>(response.data);
  },

  async getDisplayChartPreference() {
    const response = await apiClient.get('/custom-orders/preferences/display-chart');
    return unwrapApiResponse<DisplayChartPreference>(response.data);
  },

  async updateDisplayChartPreference(payload: DisplayChartPreference) {
    const response = await apiClient.post('/custom-orders/preferences/display-chart', payload);
    return unwrapApiResponse<DisplayChartPreference>(response.data);
  },
};

export const customOrdersBrandApi = {
  async list(brandId: string, params?: { page?: number; limit?: number; status?: CustomOrderStatus; stage?: CustomOrderProgressStage; q?: string }) {
    const response = await apiClient.get(`/brands/${brandId}/custom-orders`, withParams(params));
    return unwrapApiResponse<PaginatedCustomOrders<CustomOrderListItem>>(response.data);
  },

  async getById(brandId: string, orderId: string) {
    const response = await apiClient.get(`/brands/${brandId}/custom-orders/${orderId}`);
    return unwrapApiResponse<CustomOrderDetail>(response.data);
  },

  async accept(brandId: string, orderId: string, note?: string) {
    const response = await apiClient.post(`/brands/${brandId}/custom-orders/${orderId}/accept`, { note });
    return unwrapApiResponse<CustomOrderDetail>(response.data);
  },

  async reject(brandId: string, orderId: string, reason: string) {
    const response = await apiClient.post(`/brands/${brandId}/custom-orders/${orderId}/reject`, { reason });
    return unwrapApiResponse<CustomOrderDetail>(response.data);
  },

  async updateProgressStage(brandId: string, orderId: string, payload: {
    stage: CustomOrderProgressStage;
    note?: string;
  }) {
    const response = await apiClient.post(`/brands/${brandId}/custom-orders/${orderId}/progress-stage`, payload);
    return unwrapApiResponse<CustomOrderDetail>(response.data);
  },

  async createExtensionRequest(brandId: string, orderId: string, payload: {
    targetType: CustomOrderExtensionTargetType;
    requestedExtraDays: number;
    reason: string;
  }) {
    const response = await apiClient.post(`/brands/${brandId}/custom-orders/${orderId}/extension-requests`, payload);
    return unwrapApiResponse<CustomOrderDetail>(response.data);
  },

  async respondToBuyerCounter(brandId: string, orderId: string, requestId: string, payload: {
    response: 'ACCEPTED' | 'REJECTED';
    note?: string;
  }) {
    const response = await apiClient.post(`/brands/${brandId}/custom-orders/${orderId}/extension-requests/${requestId}/respond`, payload);
    return unwrapApiResponse<CustomOrderDetail>(response.data);
  },

  async updateLifecycleStatus(brandId: string, orderId: string, payload: {
    status: CustomOrderStatus;
    note?: string;
  }) {
    const response = await apiClient.patch(`/brands/${brandId}/custom-orders/${orderId}/status`, payload);
    return unwrapApiResponse<CustomOrderDetail>(response.data);
  },

  async requestExceptionReview(
    brandId: string,
    orderId: string,
    payload: { reason: string; requestedQuoteTotal?: string },
  ) {
    const response = await apiClient.post(
      `/brands/${brandId}/custom-orders/${orderId}/exception-review-requests`,
      payload,
    );
    return unwrapApiResponse<CustomOrderDetail>(response.data);
  },
};

export const customOrdersAdminApi = {
  async getSummary() {
    const response = await apiClient.get('/admin/custom-orders/summary');
    return unwrapApiResponse<Record<string, unknown>>(response.data);
  },

  async getRiskDashboard(params?: { days?: number; limit?: number; brandId?: string }) {
    const response = await apiClient.get('/admin/custom-orders/risk-dashboard', withParams(params));
    return unwrapApiResponse<CustomOrderRiskDashboard>(response.data);
  },

  async list(params?: { page?: number; limit?: number; status?: CustomOrderStatus; stage?: CustomOrderProgressStage; brandId?: string; q?: string }) {
    const response = await apiClient.get('/admin/custom-orders', withParams(params));
    return unwrapApiResponse<PaginatedCustomOrders<CustomOrderListItem>>(response.data);
  },

  async getById(orderId: string) {
    const response = await apiClient.get(`/admin/custom-orders/${orderId}`);
    return unwrapApiResponse<CustomOrderDetail>(response.data);
  },

  async getRefundReviews(params?: { page?: number; limit?: number; brandId?: string; q?: string; includeSettled?: boolean }) {
    const response = await apiClient.get('/admin/custom-orders/refund-reviews', withParams(params));
    return unwrapApiResponse<PaginatedCustomOrders<CustomOrderRefundReviewListItem>>(response.data);
  },

  async getRefundReview(orderId: string) {
    const response = await apiClient.get(`/admin/custom-orders/refund-reviews/${orderId}`);
    return unwrapApiResponse<CustomOrderRefundReviewDetail>(response.data);
  },

  async getStaleOrders(params?: { page?: number; limit?: number; brandId?: string; escalatedOnly?: boolean }) {
    const response = await apiClient.get('/admin/custom-orders/stale', withParams(params));
    return unwrapApiResponse<PaginatedCustomOrders<CustomOrderStaleItem>>(response.data);
  },

  async listDisputes(params?: { page?: number; limit?: number; status?: CustomOrderDisputeStatus | string }) {
    const response = await apiClient.get('/admin/custom-order-disputes', withParams(params));
    return unwrapApiResponse<PaginatedCustomOrders<CustomOrderDisputeListItem>>(response.data);
  },

  async getLedgerAllocations(params?: { page?: number; limit?: number; customOrderId?: string; brandId?: string; payoutId?: string }) {
    const response = await apiClient.get('/admin/custom-order-ledger-allocations', withParams(params));
    return unwrapApiResponse<PaginatedCustomOrders<CustomOrderLedgerAllocation>>(response.data);
  },

  async updateDispute(
    disputeId: string,
    payload: {
      status?: CustomOrderDisputeStatus | string;
      resolution?: CustomOrderDisputeResolution | string;
      adminNotes?: string;
      assignedAdminId?: string;
    },
  ) {
    const response = await apiClient.patch(`/admin/custom-order-disputes/${disputeId}`, payload);
    return unwrapApiResponse<CustomOrderDispute>(response.data);
  },

  async getPendingFabricRuleBases() {
    const response = await apiClient.get('/admin/custom-fabric-rule-bases/pending');
    return hydrateBasisList(unwrapApiResponse<CustomFabricRuleBasis[]>(response.data));
  },

  async reviewFabricRuleBasis(
    basisId: string,
    payload: { status: CustomFabricRuleBasisStatus; moderationNotes?: string },
  ) {
    const response = await apiClient.patch(`/admin/custom-fabric-rule-bases/${basisId}/review`, payload);
    return hydrateBasis(unwrapApiResponse<CustomFabricRuleBasis>(response.data));
  },

  async listFabricRuleBases(params?: { includeBrandOnly?: boolean }) {
    const response = await apiClient.get('/admin/custom-fabric-rule-bases', withParams(params));
    return hydrateBasisList(unwrapApiResponse<CustomFabricRuleBasis[]>(response.data));
  },

  async createFabricRuleBasis(payload: CreateAdminCustomFabricRuleBasisInput) {
    const response = await apiClient.post('/admin/custom-fabric-rule-bases', payload);
    return hydrateBasis(unwrapApiResponse<CustomFabricRuleBasis>(response.data));
  },

  async updateFabricRuleBasis(basisId: string, payload: UpdateAdminCustomFabricRuleBasisInput) {
    const response = await apiClient.patch(`/admin/custom-fabric-rule-bases/${basisId}`, payload);
    return hydrateBasis(unwrapApiResponse<CustomFabricRuleBasis>(response.data));
  },

  async deleteFabricRuleBasis(basisId: string) {
    const response = await apiClient.delete(`/admin/custom-fabric-rule-bases/${basisId}`);
    return unwrapApiResponse<{ id: string }>(response.data);
  },

  async remindBrand(orderId: string, note?: string) {
    const response = await apiClient.post(`/admin/custom-orders/${orderId}/remind-brand`, { note });
    return unwrapApiResponse<CustomOrderDetail>(response.data);
  },

  async flagRisk(orderId: string, payload: { reason: string; note?: string }) {
    const response = await apiClient.post(`/admin/custom-orders/${orderId}/flag-risk`, payload);
    return unwrapApiResponse<CustomOrderDetail>(response.data);
  },

  async escalateRefundReview(orderId: string, payload: { reason: string; note?: string }) {
    const response = await apiClient.post(`/admin/custom-orders/${orderId}/escalate-refund-review`, payload);
    return unwrapApiResponse<CustomOrderDetail>(response.data);
  },

  async cancelPaidOrder(orderId: string, payload: { reason: string; note?: string }) {
    const response = await apiClient.post(`/admin/custom-orders/${orderId}/cancel`, payload);
    return unwrapApiResponse<Record<string, unknown>>(response.data);
  },

  async updateRetentionHold(orderId: string, payload: UpdateCustomOrderRetentionHoldInput) {
    const response = await apiClient.patch(`/admin/custom-orders/${orderId}/retention-hold`, payload);
    return unwrapApiResponse<Record<string, unknown>>(response.data);
  },

  async listExceptionReviews(params?: {
    page?: number;
    limit?: number;
    brandId?: string;
    status?: 'NEW' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  }) {
    const response = await apiClient.get('/admin/custom-orders/exception-reviews', withParams(params));
    return unwrapApiResponse<PaginatedCustomOrders<CustomOrderExceptionReviewItem>>(response.data);
  },

  async decideExceptionReview(
    orderId: string,
    eventId: string,
    payload: {
      decision: 'APPROVED' | 'REJECTED' | 'REQUEST_MORE_INFO';
      rationale: string;
      approvedQuoteTotal?: string;
    },
  ) {
    const response = await apiClient.post(
      `/admin/custom-orders/${orderId}/exception-reviews/${eventId}/decide`,
      payload,
    );
    return unwrapApiResponse<CustomOrderDetail>(response.data);
  },
};
