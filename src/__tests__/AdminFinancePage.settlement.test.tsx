import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminFinancePage from '@/pages/admin/AdminFinancePage';

const mockGetOverview = vi.fn();
const mockGetPayment = vi.fn();

vi.mock('@/api/AdminApi', () => ({
  adminFinanceApi: {
    getOverview: (...args: unknown[]) => mockGetOverview(...args),
    getPayment: (...args: unknown[]) => mockGetPayment(...args),
    listPayments: vi.fn(),
    listEscrowHolds: vi.fn(),
    listTransactions: vi.fn(),
    listCommissionRules: vi.fn(),
    listReconciliationRuns: vi.fn(),
    listReconciliationItems: vi.fn(),
    listDocuments: vi.fn(),
    getDocument: vi.fn(),
    createCommissionRule: vi.fn(),
    updateCommissionRule: vi.fn(),
    createReconciliationRun: vi.fn(),
    claimReconciliationItem: vi.fn(),
    releaseReconciliationItem: vi.fn(),
    resolveReconciliationItem: vi.fn(),
    reconcileStalePayments: vi.fn(),
    releaseEscrowHold: vi.fn(),
    freezeEscrowHold: vi.fn(),
    unfreezeEscrowHold: vi.fn(),
  },
  adminOrdersApi: {
    getById: vi.fn(),
  },
}));

vi.mock('@/api/CustomOrderApi', () => ({
  customOrdersAdminApi: {
    getById: vi.fn(),
  },
}));

vi.mock('@/hooks/useAdminPermissions', () => ({
  useAdminPermissions: () => ({
    hasPermission: (permission: string) =>
      permission === 'PAYOUTS_READ' || permission === 'PAYOUTS_PROCESS',
    isSuperAdmin: false,
    isAdmin: true,
    permissions: [],
  }),
}));

vi.mock('@/components/ui/Modal', () => ({
  default: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title?: string;
    children: React.ReactNode;
  }) => (open ? <div><div>{title}</div>{children}</div> : null),
}));

vi.mock('@/components/loaders/VLoader', () => ({
  default: () => <div>Loading</div>,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AdminFinancePage settlement additions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOverview.mockResolvedValue({
      data: {
        currency: 'NGN',
        gmv: 500000,
        totalCommissions: 50000,
        totalPayouts: 200000,
        totalRefunds: 10000,
        activeCommissionRules: 2,
        unresolvedReconciliationItems: 1,
        pendingPayouts: 3,
        activeEscrowHolds: 4,
        settlementState: {
          currency: 'NGN',
          totalHeldFunds: 120000,
          upfrontReleasedFunds: 30000,
          finalReleasePendingFunds: 60000,
          finalReleaseEligibleFunds: 15000,
          frozenFunds: 5000,
          refundedFunds: 7000,
          availableBrandWalletFunds: 25000,
          payoutPendingFunds: 10000,
          paidOutFunds: 80000,
        },
        recentRuns: [],
        recentDocuments: [],
      },
    });
    mockGetPayment.mockResolvedValue({
      data: {
        id: 'payment-1',
        reference: 'pay-ref-1',
        gateway: 'PAYSTACK',
        providerMode: 'live',
        paymentMethod: 'CARD',
        status: 'PAID',
        amount: 100000,
        currency: 'NGN',
        settlementAmount: 100000,
        settlementCurrency: 'NGN',
        subjectType: 'STANDARD_ORDER',
        createdAt: '2026-05-05T10:00:00.000Z',
        confirmedAt: '2026-05-05T10:05:00.000Z',
        lastVerifiedAt: '2026-05-05T10:05:00.000Z',
        requestSnapshot: null,
        responseSnapshot: null,
        nextAction: null,
        bankAccount: null,
        buyer: null,
        orders: [],
        customOrder: null,
        settlementDetails: [
          {
            orderType: 'STANDARD_ORDER',
            orderId: 'order-1',
            customOrderId: null,
            brand: { id: 'brand-1', name: 'Aso Luxe' },
            grossAmount: 100000,
            commissionAmount: 10000,
            brandNetAmount: 90000,
            releaseMode: 'HOLD_UNTIL_DELIVERY',
            upfrontReleasePercent: 0,
            upfrontReleasedAmount: 0,
            finalHeldAmount: 90000,
            snapshotId: 'snapshot-1',
            settlementPolicyId: 'policy-1',
            commissionRuleId: 'commission-1',
            releaseStatus: 'HELD',
          },
        ],
        events: [],
      },
    });
  });

  it('renders overview settlement state and payment settlement details', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/finance/payments/pay-ref-1']}>
        <Routes>
          <Route path="/admin/finance/payments/:reference" element={<AdminFinancePage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Settlement State')).toBeInTheDocument();
      expect(screen.getByText('Total held funds')).toBeInTheDocument();
      expect(screen.getByText('Brand wallet available')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Settlement Details')).toBeInTheDocument();
      expect(screen.getByText('Snapshot id')).toBeInTheDocument();
      expect(screen.getByText('Settlement policy id')).toBeInTheDocument();
      expect(screen.getByText('Commission rule id')).toBeInTheDocument();
    });
  });
});
