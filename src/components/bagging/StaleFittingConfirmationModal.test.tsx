import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StaleFittingConfirmationModal from './StaleFittingConfirmationModal';
import type { BagStatus } from '@/api/StoreApi';

const staleStatus = {
  productId: 'design_1',
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
    requiredMeasurementKeys: ['WOMEN_WAIST'],
    requiredFreeformPointIds: [],
    fittingState: 'COMPLETE',
    freshnessState: 'STALE',
    missingMeasurementKeys: [],
    measurementUpdatedAt: '2026-01-01T00:00:00.000Z',
    staleAt: '2026-01-15T00:00:00.000Z',
    requiresStaleConfirmation: true,
  },
  stockState: 'CUSTOM_ONLY',
  userState: {
    authenticated: true,
    isOwner: false,
    hasPreviouslyBaggedOrOrdered: false,
  },
  ui: {
    heartbeatState: 'not_bagged',
    defaultAction: 'CONFIRM_STALE_FITTINGS',
  },
} satisfies BagStatus;

describe('StaleFittingConfirmationModal', () => {
  it('forces the buyer to choose update or continue before stale fittings proceed', () => {
    const onUpdateFittings = vi.fn();
    const onContinue = vi.fn();

    render(
      <StaleFittingConfirmationModal
        isOpen
        product={{ id: 'design_1', name: 'Aso Oke Dress' }}
        status={staleStatus}
        onClose={vi.fn()}
        onUpdateFittings={onUpdateFittings}
        onContinue={onContinue}
      />,
    );

    expect(screen.getByText('Review fittings before bagging')).toBeInTheDocument();
    expect(screen.getByText('Continue with existing fittings')).toBeInTheDocument();
    expect(screen.getByText('Update fittings')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Update fittings'));
    expect(onUpdateFittings).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Continue with existing fittings'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
