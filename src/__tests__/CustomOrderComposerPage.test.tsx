import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CustomOrderComposerPage from '@/pages/custom-orders/CustomOrderComposerPage';

const getById = vi.fn();
const getMyProfile = vi.fn();
const updateProfile = vi.fn();
const previewPrice = vi.fn();
const dispatchMock = vi.fn();

vi.mock('react-redux', () => ({
  useDispatch: () => dispatchMock,
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
    previewPrice: (...args: unknown[]) => previewPrice(...args),
    create: vi.fn(),
    getDisplayChartPreference: vi.fn().mockResolvedValue({ displayChartFamily: 'UK', updatedAtMs: Date.now() }),
    updateDisplayChartPreference: vi.fn(),
  },
}));

vi.mock('@/api/SizeFitApi', () => ({
  SizeFitApi: {
    getMyProfile: (...args: unknown[]) => getMyProfile(...args),
    updateProfile: (...args: unknown[]) => updateProfile(...args),
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
    dispatchMock.mockReset();
    getMyProfile.mockResolvedValue({ measurements: {} });
    updateProfile.mockResolvedValue({ measurements: {}, preferredLengthUnit: 'CM' });
    previewPrice.mockResolvedValue({
      quoteStatus: 'AUTO_PRICED',
      configurationVersionId: 'version-1',
      checkoutIntentId: 'intent-1',
      buyerPriceSummary: { grandTotal: 120000, currency: 'NGN' },
    });
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

  it('renders and submits freeform measurement keys resolved from the active configuration', async () => {
    getById.mockResolvedValue({
      id: 'configuration-1',
      brandId: 'brand-1',
      sourceType: 'PRODUCT',
      sourceId: 'product-1',
      title: 'Bespoke blazer',
      buyerInstructionText: 'Add precise body measurements.',
      requiredMeasurementKeys: ['WOMEN_WAIST'],
      requiredFreeformPointIds: ['point-shoulder'],
      resolvedRequiredMeasurementKeys: ['WOMEN_WAIST', 'BRAND_SHOULDER'],
      requiredMeasurementPoints: [
        {
          id: 'point-shoulder',
          key: 'BRAND_SHOULDER',
          label: 'Shoulder',
          description: 'Brand-specific shoulder measurement.',
          minValueCm: 1,
          maxValueCm: 300,
        },
      ],
      baseProductionCharge: '120000',
      fabricCostPerYard: '10000',
      rushEnabled: false,
      rushFee: null,
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

    fireEvent.change(screen.getAllByPlaceholderText('0')[0], { target: { value: '70' } });
    fireEvent.change(screen.getAllByPlaceholderText('0')[1], { target: { value: '40' } });
    fireEvent.click(screen.getByText(/I confirm these measurement values/i).closest('label')!.querySelector('input')!);
    fireEvent.click(screen.getByText(/I confirm these measurements were reviewed/i).closest('label')!.querySelector('input')!);
    fireEvent.click(screen.getByRole('button', { name: /Lock price preview/i }));

    await waitFor(() => {
      expect(previewPrice).toHaveBeenCalledWith(
        expect.objectContaining({
          measurementValues: expect.objectContaining({
            WOMEN_WAIST: 70,
            BRAND_SHOULDER: 40,
          }),
        }),
      );
    });
  });

  /*
    A failed submit has to say WHICH field, under that field.

    The toast used to be the entire error report - it named the section and
    left the reader to find the input, which on this form is usually off
    screen. scrollIntoView and focus are not assertable in jsdom, so this
    covers the part that carries the meaning: the per-field flag, its wording,
    and that it clears the moment the field is corrected.
  */
  it('flags each incomplete delivery field by name instead of only toasting', async () => {
    getById.mockResolvedValue({
      id: 'configuration-1',
      brandId: 'brand-1',
      sourceType: 'PRODUCT',
      sourceId: 'product-1',
      title: 'Bespoke blazer',
      requiredMeasurementKeys: ['WOMEN_WAIST'],
      requiredFreeformPointIds: [],
      baseProductionCharge: '120000',
      fabricCostPerYard: '10000',
      rushEnabled: false,
      rushFee: null,
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

    // Lock a preview so the bag button is reachable at all.
    fireEvent.change(screen.getAllByPlaceholderText('0')[0], { target: { value: '70' } });
    fireEvent.click(
      screen
        .getByText(/I confirm these measurement values/i)
        .closest('label')!
        .querySelector('input')!,
    );
    // Only rendered when the saved profile is stale enough to need re-confirming.
    const recency = screen.queryByText(/I confirm these measurements were reviewed/i);
    if (recency) {
      fireEvent.click(recency.closest('label')!.querySelector('input')!);
    }
    fireEvent.click(screen.getByRole('button', { name: /Lock price preview/i }));
    await waitFor(() => expect(previewPrice).toHaveBeenCalled());

    // Empty two fields the profile had filled, then try to bag it.
    const street = document.getElementById('custom-order-delivery-street') as HTMLInputElement;
    const phone = document.getElementById('custom-order-delivery-contactPhone') as HTMLInputElement;
    fireEvent.change(street, { target: { value: '' } });
    fireEvent.change(phone, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Add custom order to bag/i }));

    await waitFor(() => {
      expect(screen.getByText('Street is required')).toBeInTheDocument();
    });
    expect(street.getAttribute('aria-invalid')).toBe('true');
    // The phone flag is its own wording, not the generic required line.
    expect(screen.queryByText('Phone is required')).not.toBeInTheDocument();

    // Correcting the field clears its flag without another submit.
    fireEvent.change(street, { target: { value: '42 Allen Avenue' } });
    await waitFor(() => {
      expect(screen.queryByText('Street is required')).not.toBeInTheDocument();
    });
  });
});
