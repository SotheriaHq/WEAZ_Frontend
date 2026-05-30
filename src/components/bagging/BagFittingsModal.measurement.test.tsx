import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BagFittingsModal from './BagFittingsModal';
import type { BagStatus } from '@/api/StoreApi';
import { SizeFitApi } from '@/api/SizeFitApi';

vi.mock('@/api/SizeFitApi', () => ({
  SizeFitApi: {
    getMyProfile: vi.fn(),
    updateProfile: vi.fn(),
  },
}));

vi.mock('@/api/StoreApi', () => ({
  getBagStatus: vi.fn(),
}));

vi.mock('@/api/BagApi', () => ({
  BagApi: {
    getSourceBagStatus: vi.fn(),
  },
}));

const baseStatus = {
  productId: 'product_1',
  canBag: true,
  bagMode: 'CUSTOM',
  standard: {
    available: false,
    alreadyBagged: false,
    requiresSize: false,
    requiresColor: false,
    sizes: [],
    colors: [],
    quantity: 0,
    stock: 0,
  },
  custom: {
    available: true,
    alreadyBagged: false,
    configurationId: 'config_1',
    requiredMeasurementKeys: ['WAIST', 'CHEST', 'HIP'],
    requiredFreeformPointIds: [],
    fittingState: 'PARTIAL',
    freshnessState: 'PARTIAL',
    missingMeasurementKeys: ['CHEST'],
    staleMeasurementKeys: [],
    veryStaleMeasurementKeys: [],
    measurementUpdatedAt: null,
    staleAt: null,
    requiresStaleConfirmation: false,
  },
  stockState: 'CUSTOM_ONLY',
  userState: {
    authenticated: true,
    isOwner: false,
    hasPreviouslyBaggedOrOrdered: false,
  },
  ui: {
    heartbeatState: 'not_bagged',
    defaultAction: 'OPEN_FITTINGS',
  },
} satisfies BagStatus;

describe('BagFittingsModal', () => {
  it('renders only missing required measurements, not the full required set', async () => {
    vi.mocked(SizeFitApi.getMyProfile).mockResolvedValue({
      measurements: { WAIST: 32, HIP: 40 },
    } as any);

    render(
      <BagFittingsModal
        isOpen
        product={{ id: 'product_1', name: 'Aso Oke Dress' }}
        status={baseStatus}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByRole('spinbutton')).toHaveLength(1);
    });
    expect(screen.getByLabelText(/chest/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/waist/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/hip/i)).not.toBeInTheDocument();
  });

  it('renders only stale required measurements when refreshing stale fittings', async () => {
    vi.mocked(SizeFitApi.getMyProfile).mockResolvedValue({
      measurements: { WAIST: 32, CHEST: 38, HIP: 40 },
    } as any);

    const staleStatus = {
      ...baseStatus,
      custom: {
        ...baseStatus.custom,
        fittingState: 'COMPLETE',
        freshnessState: 'VERY_STALE',
        missingMeasurementKeys: [],
        staleMeasurementKeys: ['WAIST'],
        veryStaleMeasurementKeys: ['WAIST'],
        requiresStaleConfirmation: true,
      },
    } satisfies BagStatus;

    render(
      <BagFittingsModal
        isOpen
        product={{ id: 'product_1', name: 'Aso Oke Dress' }}
        status={staleStatus}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByRole('spinbutton')).toHaveLength(1);
    });
    expect(screen.getByLabelText(/waist/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/chest/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/hip/i)).not.toBeInTheDocument();
  });
});
