import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CustomOrdersPage from '@/pages/studio/CustomOrdersPage';
import AdminCustomOrdersPage from '@/pages/admin/AdminCustomOrdersPage';

const getStoreStatus = vi.fn();
const brandList = vi.fn();
const brandGetById = vi.fn();
const brandAccept = vi.fn();
const adminRiskDashboard = vi.fn();
const adminList = vi.fn();
const adminRefundReviews = vi.fn();
const adminStaleOrders = vi.fn();
const adminListDisputes = vi.fn();
const adminPendingBases = vi.fn();
const adminGetById = vi.fn();
const adminFlagRisk = vi.fn();
const adminLedgerAllocations = vi.fn();
const adminUpdateRetentionHold = vi.fn();

vi.mock('@/api/StoreApi', () => ({
  getStoreStatus: (...args: unknown[]) => getStoreStatus(...args),
}));

vi.mock('@/api/CustomOrderApi', () => ({
  customOrdersBrandApi: {
    list: (...args: unknown[]) => brandList(...args),
    getById: (...args: unknown[]) => brandGetById(...args),
    accept: (...args: unknown[]) => brandAccept(...args),
    reject: vi.fn(),
    updateProgressStage: vi.fn(),
    createExtensionRequest: vi.fn(),
    respondToBuyerCounter: vi.fn(),
    updateLifecycleStatus: vi.fn(),
  },
  customOrdersAdminApi: {
    getRiskDashboard: (...args: unknown[]) => adminRiskDashboard(...args),
    list: (...args: unknown[]) => adminList(...args),
    getRefundReviews: (...args: unknown[]) => adminRefundReviews(...args),
    getStaleOrders: (...args: unknown[]) => adminStaleOrders(...args),
    listDisputes: (...args: unknown[]) => adminListDisputes(...args),
    getPendingFabricRuleBases: (...args: unknown[]) => adminPendingBases(...args),
    getById: (...args: unknown[]) => adminGetById(...args),
    getLedgerAllocations: (...args: unknown[]) => adminLedgerAllocations(...args),
    flagRisk: (...args: unknown[]) => adminFlagRisk(...args),
    updateRetentionHold: (...args: unknown[]) => adminUpdateRetentionHold(...args),
    remindBrand: vi.fn(),
    escalateRefundReview: vi.fn(),
    updateDispute: vi.fn(),
    reviewFabricRuleBasis: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const brandOrderDetail = {
  id: 'order-1',
  status: 'PENDING_BRAND_ACCEPTANCE',
  paymentStatus: 'PAID',
  offerVersionId: 'offer-v1',
  source: {
    type: 'PRODUCT',
    id: 'product-1',
    title: 'Bespoke blazer',
    brandName: 'Ada Atelier',
  },
  measurementSnapshot: { bust: 92, waist: 74 },
  currentProgressStage: 'ORDER_RECEIVED',
  measurementConfirmedAt: '2026-03-12T10:00:00.000Z',
  promisedProductionAt: '2026-03-20T10:00:00.000Z',
  promisedDispatchAt: '2026-03-22T10:00:00.000Z',
  promisedDeliveryAt: '2026-03-24T10:00:00.000Z',
  buyerAcceptanceWindowEndsAt: '2026-03-28T10:00:00.000Z',
  internalPriceBreakdown: { production: 120000 },
  progressEvents: [],
  extensionRequests: [],
  disputes: [],
  issues: [],
} as any;

const adminOrderDetail = {
  ...brandOrderDetail,
  status: 'DISPUTED',
  ledgerAllocations: [],
  measurementRetentionUntil: '2026-06-12T10:00:00.000Z',
  anonymizedAt: null,
  retentionHoldType: null,
  retentionHoldReason: null,
  retentionHoldUntil: null,
} as any;

describe('Custom-order operations consoles', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getStoreStatus.mockResolvedValue({
      brandId: 'brand-1',
      isStoreOpen: true,
      isSetupComplete: true,
      missingFields: [],
      profile: { name: 'Ada Atelier', tags: [] },
    });

    brandList.mockResolvedValue({
      items: [
        {
          id: 'order-1',
          status: 'PENDING_BRAND_ACCEPTANCE',
          paymentStatus: 'PAID',
          sourceType: 'PRODUCT',
          sourceId: 'product-1',
          sourceTitle: 'Bespoke blazer',
          brand: { name: 'Ada Atelier' },
          buyerPriceSummary: { grandTotal: 185000, currency: 'NGN' },
          currentProgressStage: 'ORDER_RECEIVED',
          createdAt: '2026-03-12T10:00:00.000Z',
        },
      ],
      page: 1,
      limit: 25,
      total: 1,
    });
    brandGetById.mockResolvedValue(brandOrderDetail);
    brandAccept.mockResolvedValue(brandOrderDetail);

    adminRiskDashboard.mockResolvedValue({
      overview: {
        periodDays: 30,
        ordersPlaced: 1,
        rushOrders: 0,
        brandRejections: 0,
        disputesOpened: 1,
        refundsInitiated: 0,
        adminEscalations: 0,
        currentStaleOrders: 0,
        currentAcceptanceSlaRisk: 1,
        currentAcceptanceTimeouts: 0,
        rushOrdersWithExceptions: 0,
      },
      brandRisk: [],
    });
    adminList.mockResolvedValue({
      items: [
        {
          id: 'order-1',
          status: 'DISPUTED',
          paymentStatus: 'PAID',
          sourceType: 'PRODUCT',
          sourceId: 'product-1',
          sourceTitle: 'Bespoke blazer',
          brand: { name: 'Ada Atelier' },
          buyerPriceSummary: { grandTotal: 185000, currency: 'NGN' },
          currentProgressStage: 'ORDER_RECEIVED',
          createdAt: '2026-03-12T10:00:00.000Z',
        },
      ],
      page: 1,
      limit: 20,
      total: 1,
    });
    adminRefundReviews.mockResolvedValue({ items: [], page: 1, limit: 8, total: 0 });
    adminStaleOrders.mockResolvedValue({ items: [], page: 1, limit: 8, total: 0 });
    adminListDisputes.mockResolvedValue({ items: [], page: 1, limit: 8, total: 0 });
    adminPendingBases.mockResolvedValue([]);
    adminGetById.mockResolvedValue(adminOrderDetail);
    adminLedgerAllocations.mockResolvedValue({ items: [], page: 1, limit: 50, total: 0 });
    adminFlagRisk.mockResolvedValue(adminOrderDetail);
    adminUpdateRetentionHold.mockResolvedValue({ retentionHoldType: 'SUPPORT' });
  });

  it('requires confirmation before a brand accepts a custom order', async () => {
    render(
      <MemoryRouter initialEntries={['/studio/custom-orders/order-1']}>
        <Routes>
          <Route path="/studio/custom-orders/:orderId" element={<CustomOrdersPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Brand review')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    expect(await screen.findByText('Accept custom order?')).toBeInTheDocument();
    expect(brandAccept).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Accept order' }));

    await waitFor(() => {
      expect(brandAccept).toHaveBeenCalledWith('brand-1', 'order-1', '');
    });
  });

  it('requires confirmation before admin risk-flagging', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/custom-orders/order-1']}>
        <Routes>
          <Route path="/admin/custom-orders/:orderId" element={<AdminCustomOrdersPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Flag risk' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Short reason'), {
      target: { value: 'Repeated delays' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Flag risk' }));

    expect(await screen.findByText('Flag elevated order risk?')).toBeInTheDocument();
    expect(adminFlagRisk).not.toHaveBeenCalled();

    fireEvent.click(screen.getAllByRole('button', { name: 'Flag risk' }).at(-1)!);

    await waitFor(() => {
      expect(adminFlagRisk).toHaveBeenCalledWith('order-1', {
        reason: 'Repeated delays',
        note: undefined,
      });
    });
  });
});