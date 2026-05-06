import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AdminSettlementPoliciesPage from '@/pages/admin/AdminSettlementPoliciesPage';

const mockListSettlementPolicies = vi.fn();
const mockGetSettlementPolicy = vi.fn();
const mockCreateSettlementPolicy = vi.fn();
const mockUpdateSettlementPolicy = vi.fn();
const mockActivateSettlementPolicy = vi.fn();
const mockDeactivateSettlementPolicy = vi.fn();
const mockPreviewSettlementPolicy = vi.fn();
const mockBrandList = vi.fn();

let permissionState = {
  canRead: true,
  canProcess: true,
};

vi.mock('@/api/AdminApi', () => ({
  adminFinanceApi: {
    listSettlementPolicies: (...args: unknown[]) => mockListSettlementPolicies(...args),
    getSettlementPolicy: (...args: unknown[]) => mockGetSettlementPolicy(...args),
    createSettlementPolicy: (...args: unknown[]) => mockCreateSettlementPolicy(...args),
    updateSettlementPolicy: (...args: unknown[]) => mockUpdateSettlementPolicy(...args),
    activateSettlementPolicy: (...args: unknown[]) => mockActivateSettlementPolicy(...args),
    deactivateSettlementPolicy: (...args: unknown[]) => mockDeactivateSettlementPolicy(...args),
    previewSettlementPolicy: (...args: unknown[]) => mockPreviewSettlementPolicy(...args),
  },
  adminBrandsApi: {
    list: (...args: unknown[]) => mockBrandList(...args),
  },
}));

vi.mock('@/hooks/useAdminPermissions', () => ({
  useAdminPermissions: () => ({
    hasPermission: (permission: string) => {
      if (permission === 'PAYOUTS_READ') return permissionState.canRead;
      if (permission === 'PAYOUTS_PROCESS') return permissionState.canProcess;
      return false;
    },
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

const basePolicy = {
  id: 'policy-1',
  orderType: 'STANDARD_ORDER' as const,
  scope: 'PLATFORM' as const,
  brandId: null,
  currency: 'NGN',
  releaseMode: 'HOLD_UNTIL_DELIVERY' as const,
  upfrontReleaseEnabled: false,
  upfrontReleasePercent: 0,
  settlementDelayHours: 48,
  autoReleaseDays: 7,
  finalReleaseTrigger: 'BUYER_DELIVERY_CONFIRMED',
  isDefault: true,
  isActive: true,
  effectiveFrom: '2026-05-05T10:00:00.000Z',
  effectiveTo: null,
  createdAt: '2026-05-05T10:00:00.000Z',
  updatedAt: '2026-05-05T10:00:00.000Z',
};

const brandResponse = {
  data: {
    items: [
      {
        id: 'brand-1',
        name: 'Aso Luxe',
        owner: { email: 'brand@example.com' },
      },
    ],
  },
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <AdminSettlementPoliciesPage />
    </MemoryRouter>,
  );

describe('AdminSettlementPoliciesPage', () => {
  beforeEach(() => {
    permissionState = { canRead: true, canProcess: true };
    mockListSettlementPolicies.mockResolvedValue({ data: [basePolicy] });
    mockGetSettlementPolicy.mockResolvedValue({ data: basePolicy });
    mockCreateSettlementPolicy.mockResolvedValue({ data: basePolicy });
    mockUpdateSettlementPolicy.mockResolvedValue({ data: basePolicy });
    mockActivateSettlementPolicy.mockResolvedValue({ data: { ...basePolicy, isActive: true } });
    mockDeactivateSettlementPolicy.mockResolvedValue({ data: { ...basePolicy, isActive: false } });
    mockPreviewSettlementPolicy.mockResolvedValue({
      data: {
        writesSnapshot: false,
        writesLedger: false,
        resolvedSettlementPolicy: {
          ...basePolicy,
          id: 'policy-1',
        },
        settlementBreakdown: {
          orderType: 'STANDARD_ORDER',
          brandId: 'brand-1',
          orderId: null,
          customOrderId: null,
          grossAmount: 100000,
          currency: 'NGN',
          commissionRuleId: 'commission-1',
          commissionScope: 'PLATFORM',
          commissionSource: 'RULE',
          commissionRate: 10,
          commissionAmount: 10000,
          brandNetAmount: 90000,
          settlementPolicyId: 'policy-1',
          releaseMode: 'HOLD_UNTIL_DELIVERY',
          upfrontReleaseEnabled: false,
          upfrontReleasePercent: 0,
          upfrontReleaseGrossAmount: 0,
          upfrontReleaseCommissionAmount: 0,
          upfrontReleaseNetBrandAmount: 0,
          finalReleaseGrossAmount: 100000,
          finalReleaseCommissionAmount: 10000,
          finalReleaseNetBrandAmount: 90000,
          settlementDelayHours: 48,
          autoReleaseDays: 7,
          finalReleaseTrigger: 'BUYER_DELIVERY_CONFIRMED',
          calculatedAt: '2026-05-05T10:00:00.000Z',
        },
        commissionBreakdown: {
          commissionRuleId: 'commission-1',
          commissionSource: 'RULE',
          commissionScope: 'PLATFORM',
          commissionRate: 10,
          commissionAmount: 10000,
        },
      },
    });
    mockBrandList.mockResolvedValue(brandResponse);
    vi.clearAllMocks();
    mockListSettlementPolicies.mockResolvedValue({ data: [basePolicy] });
    mockGetSettlementPolicy.mockResolvedValue({ data: basePolicy });
    mockCreateSettlementPolicy.mockResolvedValue({ data: basePolicy });
    mockUpdateSettlementPolicy.mockResolvedValue({ data: basePolicy });
    mockActivateSettlementPolicy.mockResolvedValue({ data: { ...basePolicy, isActive: true } });
    mockDeactivateSettlementPolicy.mockResolvedValue({ data: { ...basePolicy, isActive: false } });
    mockPreviewSettlementPolicy.mockResolvedValue({
      data: {
        writesSnapshot: false,
        writesLedger: false,
        resolvedSettlementPolicy: { ...basePolicy, id: 'policy-1' },
        settlementBreakdown: {
          orderType: 'STANDARD_ORDER',
          brandId: 'brand-1',
          orderId: null,
          customOrderId: null,
          grossAmount: 100000,
          currency: 'NGN',
          commissionRuleId: 'commission-1',
          commissionScope: 'PLATFORM',
          commissionSource: 'RULE',
          commissionRate: 10,
          commissionAmount: 10000,
          brandNetAmount: 90000,
          settlementPolicyId: 'policy-1',
          releaseMode: 'HOLD_UNTIL_DELIVERY',
          upfrontReleaseEnabled: false,
          upfrontReleasePercent: 0,
          upfrontReleaseGrossAmount: 0,
          upfrontReleaseCommissionAmount: 0,
          upfrontReleaseNetBrandAmount: 0,
          finalReleaseGrossAmount: 100000,
          finalReleaseCommissionAmount: 10000,
          finalReleaseNetBrandAmount: 90000,
          settlementDelayHours: 48,
          autoReleaseDays: 7,
          finalReleaseTrigger: 'BUYER_DELIVERY_CONFIRMED',
          calculatedAt: '2026-05-05T10:00:00.000Z',
        },
        commissionBreakdown: {
          commissionRuleId: 'commission-1',
          commissionSource: 'RULE',
          commissionScope: 'PLATFORM',
          commissionRate: 10,
          commissionAmount: 10000,
        },
      },
    });
    mockBrandList.mockResolvedValue(brandResponse);
  });

  it('renders settlement policies in the list', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Settlement Release Policies')).toBeInTheDocument();
      expect(screen.getByText('STANDARD ORDER')).toBeInTheDocument();
      expect(screen.getByText('HOLD UNTIL DELIVERY')).toBeInTheDocument();
    });
  });

  it('keeps hold-until-delivery upfront fields disabled and enables them for split release', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('Create policy')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Create policy'));

    const upfrontToggle = screen.getByRole('button', { name: /Upfront release enabled/i });
    const upfrontInput = screen
      .getByText('Upfront release percent')
      .parentElement?.querySelector('input') as HTMLInputElement;

    expect(upfrontToggle).toBeDisabled();
    expect(upfrontInput).toBeDisabled();
    expect(upfrontInput.value).toBe('0');

    fireEvent.click(screen.getByRole('button', { name: /Hold until delivery/i }));
    fireEvent.click(screen.getByText('Split release'));

    expect(screen.getByRole('button', { name: /Upfront release enabled/i })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Upfront release enabled/i }));
    expect(upfrontInput).not.toBeDisabled();
  });

  it('renders settlement preview breakdown', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('Preview settlement')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Preview settlement'));

    fireEvent.click(screen.getByRole('button', { name: /Select a brand/i }));
    fireEvent.click(screen.getByText('Aso Luxe'));
    fireEvent.change(
      screen.getByText('Amount').parentElement?.querySelector('input') as HTMLInputElement,
      { target: { value: '100000' } },
    );

    fireEvent.click(screen.getByText('Run preview'));

    await waitFor(() => {
      expect(screen.getByText('Settlement breakdown')).toBeInTheDocument();
      expect(screen.getByText('Total commission')).toBeInTheDocument();
      expect(screen.getByText('Commission rule ID')).toBeInTheDocument();
    });
  });

  it('shows activate or deactivate confirmation before mutating', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('Deactivate')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Deactivate'));

    expect(screen.getAllByText('Deactivate policy').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Deactivate policy' })[0]);

    await waitFor(() => {
      expect(mockDeactivateSettlementPolicy).toHaveBeenCalledWith('policy-1');
    });
  });

  it('renders backend validation errors clearly', async () => {
    mockCreateSettlementPolicy.mockRejectedValue({
      response: { data: { message: ['Overlap detected for effective window.'] } },
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Create policy')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Create policy'));
    fireEvent.click(screen.getAllByRole('button', { name: 'Create policy' })[1]);

    await waitFor(() => {
      expect(screen.getByText('Overlap detected for effective window.')).toBeInTheDocument();
    });
  });

  it('disables mutation actions for admins without payouts.process', async () => {
    permissionState = { canRead: true, canProcess: false };

    renderPage();

    await waitFor(() => {
      expect(screen.queryByText('Create policy')).not.toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeDisabled();
      expect(screen.getByText('Deactivate')).toBeDisabled();
    });
  });
});
