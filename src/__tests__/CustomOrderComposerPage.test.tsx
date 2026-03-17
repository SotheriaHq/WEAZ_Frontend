import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CustomOrderComposerPage from '@/pages/custom-orders/CustomOrderComposerPage';

const getById = vi.fn();
const getMyProfile = vi.fn();

vi.mock('react-redux', () => ({
  useSelector: (selector: (state: unknown) => unknown) =>
    selector({
      user: {
        profile: {
          firstName: 'Ada',
          lastName: 'Okafor',
          email: 'ada@example.com',
          phoneNumber: '08000000000',
          address: '42 Allen Avenue',
          brandCity: 'Lagos',
          brandState: 'Lagos',
          brandCountry: 'Nigeria',
        },
      },
    }),
}));

vi.mock('@/api/CustomOrderApi', () => ({
  customOrderConfigurationsApi: {
    getById: (...args: unknown[]) => getById(...args),
  },
  customOrdersBuyerApi: {
    previewPrice: vi.fn(),
    create: vi.fn(),
    getDisplayChartPreference: vi.fn().mockResolvedValue({ displayChartFamily: 'UK', updatedAtMs: Date.now() }),
    updateDisplayChartPreference: vi.fn(),
  },
}));

vi.mock('@/api/SizeFitApi', () => ({
  SizeFitApi: {
    getMyProfile: (...args: unknown[]) => getMyProfile(...args),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('CustomOrderComposerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMyProfile.mockResolvedValue({ measurements: {} });
  });

  it('shows unavailable state when the requested configuration is not found', async () => {
    getById.mockRejectedValue({ response: { data: { message: 'Not found' } } });

    render(
      <MemoryRouter initialEntries={['/custom-orders/new?configurationId=configuration-1']}>
        <Routes>
          <Route path="/custom-orders/new" element={<CustomOrderComposerPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(getById).toHaveBeenCalledWith('configuration-1');
    });

    expect(screen.getByText('Custom order configuration unavailable')).toBeInTheDocument();
  });

  it('renders required measurements when an active configuration exists', async () => {
    getById.mockResolvedValue({
      id: 'configuration-1',
      brandId: 'brand-1',
      sourceType: 'PRODUCT',
      sourceId: 'product-1',
      title: 'Bespoke blazer',
      buyerInstructionText: 'Add precise body measurements.',
      requiredMeasurementKeys: ['bust', 'waist'],
      requiredFreeformPointIds: [],
      baseProductionCharge: '120000',
      fabricCostPerYard: '10000',
      rushEnabled: true,
      rushFee: '25000',
      productionLeadDays: 7,
      deliveryMinDays: 2,
      deliveryMaxDays: 5,
      deliveryScope: 'Nigeria',
      revisionPolicy: 'One revision.',
      returnPolicy: 'No returns.',
      defectPolicy: 'Defects only.',
      fabricSourcingMode: 'BRAND_SOURCED',
      isActive: true,
      currentVersion: 1,
      brand: { id: 'brand-1', name: 'Ada Atelier' },
      rules: [],
      versions: [{ id: 'version-1', version: 1, createdAt: '2026-03-12T00:00:00.000Z' }],
    });

    render(
      <MemoryRouter initialEntries={['/custom-orders/new?configurationId=configuration-1']}>
        <Routes>
          <Route path="/custom-orders/new" element={<CustomOrderComposerPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Bespoke blazer')).toBeInTheDocument();
    });

    expect(screen.getByText('Measurement profile')).toBeInTheDocument();
    expect(screen.getByText('Bust')).toBeInTheDocument();
    expect(screen.getByText('Waist')).toBeInTheDocument();
  });
});