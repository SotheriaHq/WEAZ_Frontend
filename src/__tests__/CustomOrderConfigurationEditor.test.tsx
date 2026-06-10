import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CustomOrderConfigurationEditor, {
  type CustomOrderConfigurationEditorHandle,
} from '@/components/custom-orders/CustomOrderConfigurationEditor';

const getStoreStatus = vi.fn();
const listFabricRuleBases = vi.fn();
const getActiveForProduct = vi.fn();
const getActiveForDesign = vi.fn();
const createFabricRuleBasis = vi.fn();
const createConfiguration = vi.fn();
const updateConfiguration = vi.fn();
const toastError = vi.fn();
const toastSuccess = vi.fn();
const useMeasurementPoints = vi.fn();

const measurementRegistryPoints = [
  'WOMEN_BUST',
  'WOMEN_WAIST',
  'WOMEN_HIP',
  'WOMEN_SHOULDER',
  'WOMEN_ARM_LENGTH',
  'WOMEN_THIGH',
  'WOMEN_INSEAM',
  'WOMEN_BACK_WIDTH',
  'WOMEN_NECK',
].map((key, index) => ({
  id: `point-${index + 1}`,
  key,
  label: key.replace(/_/g, ' '),
  description: null,
  category: 'GENERAL',
  gender: 'WOMEN',
  source: 'SYSTEM',
  status: 'APPROVED_GLOBAL',
  brandId: null,
  minValueCm: null,
  maxValueCm: null,
  minValueChildCm: null,
  maxValueChildCm: null,
  sortOrder: index,
  isActive: true,
}));

const defaultFabricRuleBasis = {
  id: 'basis-1',
  label: 'Dress block',
  measurementKeys: ['bust', 'waist'],
  status: 'BRAND_ONLY',
  gender: 'WOMEN',
  createdAt: '2026-03-12T00:00:00.000Z',
  updatedAt: '2026-03-12T00:00:00.000Z',
};

vi.mock('@/api/StoreApi', () => ({
  getStoreStatus: (...args: unknown[]) => getStoreStatus(...args),
}));

vi.mock('@/hooks/useMeasurementPoints', () => ({
  useMeasurementPoints: (...args: unknown[]) => useMeasurementPoints(...args),
}));

vi.mock('@/api/CustomOrderApi', () => ({
  customOrderConfigurationsApi: {
    listFabricRuleBases: (...args: unknown[]) => listFabricRuleBases(...args),
    getActiveForProduct: (...args: unknown[]) => getActiveForProduct(...args),
    getActiveForDesign: (...args: unknown[]) => getActiveForDesign(...args),
    createFabricRuleBasis: (...args: unknown[]) => createFabricRuleBasis(...args),
    create: (...args: unknown[]) => createConfiguration(...args),
    update: (...args: unknown[]) => updateConfiguration(...args),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastError(...args),
    success: (...args: unknown[]) => toastSuccess(...args),
  },
}));

describe('CustomOrderConfigurationEditor', () => {
  const addMeasurementKey = async (
    user: ReturnType<typeof userEvent.setup>,
    value: string,
    expectedSelectedCount: number,
  ) => {
    const input = screen.getByPlaceholderText('Add missing measurement key');
    await user.clear(input);
    await user.type(input, value);
    await user.click(screen.getByRole('button', { name: 'Add key' }));
    await waitFor(() => {
      expect(screen.queryAllByTitle('Remove measurement key')).toHaveLength(expectedSelectedCount);
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getStoreStatus.mockResolvedValue({
      brandId: 'brand-1',
      isStoreOpen: true,
      isSetupComplete: true,
      missingFields: [],
      profile: {
        name: 'Ada Atelier',
        tags: [],
      },
    });
    listFabricRuleBases.mockResolvedValue([defaultFabricRuleBasis]);
    createFabricRuleBasis.mockResolvedValue({
      id: 'hidden-basis-1',
      label: 'Product fabric rules',
      measurementKeys: ['BUST'],
      status: 'BRAND_ONLY',
      gender: 'WOMEN',
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
    });
    getActiveForProduct.mockResolvedValue(null);
    getActiveForDesign.mockResolvedValue(null);
    useMeasurementPoints.mockReturnValue({
      points: [],
      isLoading: false,
    });
    createConfiguration.mockResolvedValue({
      id: 'configuration-1',
      brandId: 'brand-1',
      sourceType: 'PRODUCT',
      sourceId: 'product-1',
      title: 'Bespoke blazer',
      buyerInstructionText: 'Bring your final measurements.',
      requiredMeasurementKeys: ['bust', 'waist'],
      requiredFreeformPointIds: [],
      baseProductionCharge: '120000',
      fabricCostPerYard: '10000',
      rushEnabled: false,
      rushFee: null,
      rushProductionLeadDays: null,
      productionLeadDays: 7,
      deliveryMinDays: 2,
      deliveryMaxDays: 5,
      deliveryScope: 'Nigeria',
      revisionPolicy: 'One revision after delivery confirmation.',
      returnPolicy: 'Custom orders are not returnable except where required by policy.',
      defectPolicy: 'Defects and material faults are reviewed through support.',
      fabricSourcingMode: 'BRAND_SOURCED',
      notes: null,
      isActive: true,
      currentVersion: 1,
      fabricRuleBasis: {
        id: 'basis-1',
        label: 'Dress block',
        measurementKeys: ['bust', 'waist'],
      },
      rules: [
        {
          id: 'rule-1',
          priority: 1,
          conditionsJson: {},
          outputYards: '4',
          isFallback: true,
        },
      ],
    });
  });

  it('shows the save-first state when the source has not been persisted yet', () => {
    render(<CustomOrderConfigurationEditor sourceType="PRODUCT" measurementKeys={['bust', 'waist']} />);

    expect(screen.getByText('Save this item first so the custom-order settings can attach to it.')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Select a fabric-rule basis')).not.toBeInTheDocument();
    expect(getStoreStatus).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Create configuration' })).not.toBeInTheDocument();
  });

  it('saves a new custom-order configuration for a persisted source', async () => {
    const user = userEvent.setup();
    const editorRef = createRef<CustomOrderConfigurationEditorHandle>();

    render(
      <CustomOrderConfigurationEditor
        ref={editorRef}
        sourceType="PRODUCT"
        sourceId="product-1"
        measurementKeys={[]}
        measurementGender="WOMEN"
      />,
    );

    await waitFor(() => {
      expect(getStoreStatus).toHaveBeenCalled();
      expect(listFabricRuleBases).toHaveBeenCalledWith({ includeBrandOnly: true });
      expect(getActiveForProduct).toHaveBeenCalledWith('product-1');
    });

    await addMeasurementKey(user, 'BUST', 1);

    await user.type(screen.getByRole('textbox', { name: /buyer instructions/i }), 'Bring your final measurements.');
    await user.type(screen.getByPlaceholderText('120000'), '120000');
    await user.type(screen.getByPlaceholderText('10000'), '10000');

    await waitFor(() => {
      expect(editorRef.current).not.toBeNull();
    });

    await act(async () => {
      const saved = await editorRef.current!.saveConfiguration();
      expect(saved).toBe(true);
    });

    expect(createConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'PRODUCT',
        sourceId: 'product-1',
        buyerInstructionText: 'Bring your final measurements.',
        requiredMeasurementKeys: ['BUST'],
        fabricRuleBasisId: 'hidden-basis-1',
        baseProductionCharge: '120000',
        fabricCostPerYard: '10000',
      }),
    );
    expect(createFabricRuleBasis).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Product fabric rules',
        measurementKeys: ['BUST'],
        gender: 'WOMEN',
      }),
    );

    expect(screen.getByText('Configuration v1')).toBeInTheDocument();
    expect(toastSuccess).toHaveBeenCalledWith('Custom-order configuration created.');
  });

  it('requires rush fee and rush lead days before saving when rush is enabled', async () => {
    const user = userEvent.setup();
    const editorRef = createRef<CustomOrderConfigurationEditorHandle>();

    render(
      <CustomOrderConfigurationEditor
        ref={editorRef}
        sourceType="PRODUCT"
        sourceId="product-1"
        measurementKeys={[]}
        measurementGender="WOMEN"
      />,
    );

    await waitFor(() => {
      expect(getStoreStatus).toHaveBeenCalled();
      expect(listFabricRuleBases).toHaveBeenCalledWith({ includeBrandOnly: true });
      expect(getActiveForProduct).toHaveBeenCalledWith('product-1');
    });

    await addMeasurementKey(user, 'BUST', 1);

    await user.type(screen.getByRole('textbox', { name: /buyer instructions/i }), 'Bring your final measurements.');
    await user.type(screen.getByPlaceholderText('120000'), '120000');
    await user.type(screen.getByPlaceholderText('10000'), '10000');
    await user.click(screen.getByRole('checkbox', { name: /rush ordering enabled/i }));

    await waitFor(() => {
      expect(editorRef.current).not.toBeNull();
    });

    await act(async () => {
      const saved = await editorRef.current!.saveConfiguration();
      expect(saved).toBe(false);
    });

    expect(toastError).toHaveBeenCalledWith('Some required fields need attention.');
    expect(screen.getByText('Rush fee is required.')).toBeInTheDocument();
    expect(screen.getByText('Rush production lead days are required.')).toBeInTheDocument();
    expect(createConfiguration).not.toHaveBeenCalled();
  });

  it('shows registry guidance and requires measurement points before saving', async () => {
    const user = userEvent.setup();
    const editorRef = createRef<CustomOrderConfigurationEditorHandle>();

    render(
      <CustomOrderConfigurationEditor
        ref={editorRef}
        sourceType="PRODUCT"
        sourceId="product-1"
        measurementKeys={[]}
        measurementGender="WOMEN"
      />,
    );

    await waitFor(() => {
      expect(getStoreStatus).toHaveBeenCalled();
      expect(listFabricRuleBases).toHaveBeenCalledWith({ includeBrandOnly: true });
      expect(getActiveForProduct).toHaveBeenCalledWith('product-1');
    });

    expect(screen.getByText('No measurement points are available. Run the measurement registry seed or contact an admin.')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('120000'), '120000');
    await user.type(screen.getByPlaceholderText('10000'), '10000');

    await waitFor(() => {
      expect(editorRef.current).not.toBeNull();
    });

    await act(async () => {
      const saved = await editorRef.current!.saveConfiguration();
      expect(saved).toBe(false);
    });

    expect(toastError).toHaveBeenCalledWith('Some required fields need attention.');
    expect(screen.getByText('Select at least one required measurement point for custom orders.')).toBeInTheDocument();
    expect(createConfiguration).not.toHaveBeenCalled();
  });

  it('shows rush fee validation inline and blocks save when the rush fee is invalid', async () => {
    const user = userEvent.setup();
    const editorRef = createRef<CustomOrderConfigurationEditorHandle>();

    render(
      <CustomOrderConfigurationEditor
        ref={editorRef}
        sourceType="PRODUCT"
        sourceId="product-1"
        measurementKeys={[]}
        measurementGender="WOMEN"
      />,
    );

    await waitFor(() => {
      expect(getStoreStatus).toHaveBeenCalled();
      expect(listFabricRuleBases).toHaveBeenCalledWith({ includeBrandOnly: true });
      expect(getActiveForProduct).toHaveBeenCalledWith('product-1');
    });

    await addMeasurementKey(user, 'BUST', 1);

    await addMeasurementKey(user, 'BUST', 1);

    await user.type(screen.getByRole('textbox', { name: /buyer instructions/i }), 'Bring your final measurements.');
    await user.type(screen.getByPlaceholderText('120000'), '120000');
    await user.type(screen.getByPlaceholderText('10000'), '10000');
    await user.click(screen.getByRole('checkbox', { name: /rush ordering enabled/i }));
    await user.clear(screen.getByPlaceholderText('e.g. 5000'));
    await user.type(screen.getByPlaceholderText('e.g. 5000'), '0');
    await user.clear(screen.getByPlaceholderText('e.g. 5'));
    await user.type(screen.getByPlaceholderText('e.g. 5'), '5');

    await waitFor(() => {
      expect(editorRef.current).not.toBeNull();
    });

    await act(async () => {
      const saved = await editorRef.current!.saveConfiguration();
      expect(saved).toBe(false);
    });

    expect(screen.getByText('Rush fee must be a positive number.')).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith('Rush fee must be a positive number.');
    expect(createConfiguration).not.toHaveBeenCalled();
  });

  it('creates a hidden fabric-rule basis when none exists yet', async () => {
    const user = userEvent.setup();
    const editorRef = createRef<CustomOrderConfigurationEditorHandle>();

    listFabricRuleBases.mockResolvedValue([]);
    createFabricRuleBasis.mockResolvedValue({
      id: 'hidden-basis-1',
      label: 'Product fabric rules',
      measurementKeys: ['bust', 'waist'],
      status: 'BRAND_ONLY',
      gender: 'WOMEN',
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:00:00.000Z',
    });

    render(
      <CustomOrderConfigurationEditor
        ref={editorRef}
        sourceType="PRODUCT"
        sourceId="product-1"
        sourceTitle="Tailored jacket"
        measurementKeys={[]}
        measurementGender="WOMEN"
      />,
    );

    await waitFor(() => {
      expect(getStoreStatus).toHaveBeenCalled();
      expect(listFabricRuleBases).toHaveBeenCalledWith({ includeBrandOnly: true });
      expect(getActiveForProduct).toHaveBeenCalledWith('product-1');
    });

    await addMeasurementKey(user, 'BUST', 1);

    await user.type(screen.getByRole('textbox', { name: /buyer instructions/i }), 'Bring your final measurements.');
    await user.type(screen.getByPlaceholderText('120000'), '120000');
    await user.type(screen.getByPlaceholderText('10000'), '10000');

    await waitFor(() => {
      expect(editorRef.current).not.toBeNull();
    });

    await act(async () => {
      const saved = await editorRef.current!.saveConfiguration();
      expect(saved).toBe(true);
    });

    expect(createFabricRuleBasis).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Tailored jacket fabric rules',
        measurementKeys: ['BUST'],
        gender: 'WOMEN',
      }),
    );
    expect(createConfiguration).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'PRODUCT',
        sourceId: 'product-1',
        fabricRuleBasisId: 'hidden-basis-1',
      }),
    );
  });

  it('does not auto-seed the full registry as required keys for a new configuration', async () => {
    useMeasurementPoints.mockReturnValue({
      points: measurementRegistryPoints,
      isLoading: false,
    });

    render(
      <CustomOrderConfigurationEditor
        sourceType="PRODUCT"
        sourceId="product-1"
        measurementKeys={measurementRegistryPoints.map((point) => point.key)}
        measurementGender="WOMEN"
      />,
    );

    await waitFor(() => {
      expect(getStoreStatus).toHaveBeenCalled();
      expect(listFabricRuleBases).toHaveBeenCalledWith({ includeBrandOnly: true });
      expect(getActiveForProduct).toHaveBeenCalledWith('product-1');
    });

    expect(screen.queryAllByTitle('Remove measurement key')).toHaveLength(0);
  });
});
