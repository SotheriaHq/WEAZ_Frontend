import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '@/store';
import { SizeFitApi } from '@/api/SizeFitApi';
import {
  customOrderConfigurationsApi,
  customOrdersBuyerApi,
  type CustomOrderChartFamily,
  type CustomOrderConfiguration,
  type PricePreviewResponse,
} from '@/api/CustomOrderApi';
import { createIdempotencyKey } from '@/api/idempotency';
import UniversalSelect from '@/components/forms/UniversalSelect';
import { formatMeasurementLabel } from '@/components/custom-orders/customOrderFormatting';
import { deriveSizeRecommendation, DISPLAY_CHART_OPTIONS, PRICING_CHART_OPTIONS } from '@/lib/sizeCharts';
import type { SizeFitProfile } from '@/types/sizeFit';
import {
  loadCustomOrderAddressBook,
  removeCustomOrderAddress,
  upsertCustomOrderAddress,
  type CustomOrderSavedAddress,
} from '@/lib/customOrderAddressBook';
import { openCartDrawer } from '@/features/cartSlice';

export interface CustomOrderComposerPageProps {
  configurationIdOverride?: string | null;
  embedded?: boolean;
  onClose?: () => void;
  onOrderCreated?: (orderId: string) => void;
}

type RequiredMeasurementPoint = NonNullable<CustomOrderConfiguration['requiredMeasurementPoints']>[number];

const fieldLabel = (key: string) =>
  formatMeasurementLabel(key)
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());

const isWeightKey = (key: string) => key.toUpperCase().includes('WEIGHT');
const toInches = (cm: number) => cm / 2.54;
const toCentimeters = (inch: number) => inch * 2.54;
const round = (value: number) => Math.round(value * 100) / 100;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

const normalizeMeasurementKey = (key: string) => String(key ?? '').trim().toUpperCase();

const normalizeMeasurementKeyList = (keys: string[] | null | undefined) =>
  Array.from(new Set((keys ?? []).map(normalizeMeasurementKey).filter(Boolean)));

const resolveBuyerRequiredMeasurementKeys = (
  configuration: CustomOrderConfiguration | null,
) => {
  if (!configuration) return [];

  return normalizeMeasurementKeyList(
    configuration.resolvedRequiredMeasurementKeys?.length
      ? configuration.resolvedRequiredMeasurementKeys
      : [
          ...(configuration.requiredMeasurementKeys ?? []),
          ...(configuration.requiredMeasurementPoints ?? []).map((point) => point.key),
        ],
  );
};

const convertDisplayToCm = (key: string, rawValue: string, unit: 'CM' | 'IN') => {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return NaN;
  if (unit === 'IN' && !isWeightKey(key)) return round(toCentimeters(parsed));
  return parsed;
};

const measurementGuidance = (
  key: string,
  point?: RequiredMeasurementPoint,
) => ({
  description:
    point?.description ||
    `${point?.label || fieldLabel(key)} measurement. Measure close to the body without pulling too tight.`,
  min: point?.minValueCm ?? 1,
  max: point?.maxValueCm ?? 300,
});

const formatCurrency = (value: number | undefined, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(Number(value ?? 0));

const inputClassName =
  'w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-400 dark:border-white/10 dark:bg-slate-950 dark:text-white';

const buildMeasurementSignature = (values: Record<string, number>) =>
  JSON.stringify(
    Object.entries(values)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, Number(value)]),
  );

const parseStoredMeasurement = (raw: unknown) => {
  const normalized = Number(
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>).value
      : raw,
  );
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
};

const CustomOrderComposerPage: React.FC<CustomOrderComposerPageProps> = ({
  configurationIdOverride,
  embedded = false,
  onClose,
  onOrderCreated,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const profile = useSelector((state: RootState) => state.user.profile);

  const [configuration, setConfiguration] = useState<CustomOrderConfiguration | null>(null);
  const [preview, setPreview] = useState<PricePreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [measurementValues, setMeasurementValues] = useState<Record<string, string>>({});
  const [lengthUnit, setLengthUnit] = useState<'CM' | 'IN'>('CM');
  const [customerName, setCustomerName] = useState('');
  const [contactEmail, setContactEmail] = useState(profile?.email ?? '');
  const [contactPhone, setContactPhone] = useState(profile?.phoneNumber ?? '');
  const [street, setStreet] = useState(profile?.address ?? '');
  const [city, setCity] = useState(profile?.brandCity ?? '');
  const [stateRegion, setStateRegion] = useState(profile?.brandState ?? '');
  const [country, setCountry] = useState(profile?.brandCountry ?? 'Nigeria');
  const [rushSelected, setRushSelected] = useState(false);
  const [measurementConfirmed, setMeasurementConfirmed] = useState(false);
  const [measurementRecencyConfirmed, setMeasurementRecencyConfirmed] = useState(false);
  const [sizeFitProfile, setSizeFitProfile] = useState<SizeFitProfile | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<CustomOrderSavedAddress[]>([]);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [openAddressMenuId, setOpenAddressMenuId] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [displayChartFamily, setDisplayChartFamily] = useState<CustomOrderChartFamily>('UK');
  const [pricingChartFamily, setPricingChartFamily] = useState<CustomOrderChartFamily>('HYBRID_UK_NIGERIA');
  const [noDirectMatchAcknowledged, setNoDirectMatchAcknowledged] = useState(false);

  const createKeyRef = useRef(createIdempotencyKey());
  const configurationId = configurationIdOverride ?? searchParams.get('configurationId');

  const dismissEmbeddedComposer = useCallback(() => {
    if (embedded) {
      onClose?.();
    }
  }, [embedded, onClose]);

  useEffect(() => {
    setCustomerName([profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim());
  }, [profile?.firstName, profile?.lastName]);

  const applySavedAddress = useCallback((address: CustomOrderSavedAddress) => {
    setCustomerName(address.customerName);
    setContactEmail(address.contactEmail);
    setContactPhone(address.contactPhone);
    setStreet(address.street);
    setCity(address.city);
    setStateRegion(address.state);
    setCountry(address.country);
    setEditingAddressId(address.id);
    setOpenAddressMenuId(null);
    setShowAddressForm(false);
  }, []);

  useEffect(() => {
    const stored = loadCustomOrderAddressBook(profile?.id);
    setSavedAddresses(stored);
    if (stored[0]) {
      applySavedAddress(stored[0]);
      setShowAddressForm(false);
    } else {
      setShowAddressForm(true);
    }
  }, [applySavedAddress, profile?.id]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const resolvedConfiguration = configurationId
          ? await customOrderConfigurationsApi.getById(configurationId)
          : null;

        if (!active) return;
        setConfiguration(resolvedConfiguration);

        try {
          const preference = await customOrdersBuyerApi.getDisplayChartPreference();
          if (active) setDisplayChartFamily(preference.displayChartFamily);
        } catch {
          // Keep default preference.
        }

        const buyerRequiredKeys = resolveBuyerRequiredMeasurementKeys(resolvedConfiguration);

        if (buyerRequiredKeys.length) {
          try {
            const sizeFit = await SizeFitApi.getMyProfile();
            if (!active) return;
            setSizeFitProfile(sizeFit);
            setLengthUnit(sizeFit.preferredLengthUnit ?? 'CM');

            const nextValues = buyerRequiredKeys.reduce<Record<string, string>>(
              (accumulator, key) => {
                const normalized = parseStoredMeasurement(
                  (sizeFit.measurements as Record<string, unknown> | undefined)?.[key],
                );
                if (normalized == null) return accumulator;
                accumulator[key] =
                  (sizeFit.preferredLengthUnit ?? 'CM') === 'IN' && !isWeightKey(key)
                    ? String(round(toInches(normalized)))
                    : String(normalized);
                return accumulator;
              },
              {},
            );

            setMeasurementValues(nextValues);
            setMeasurementConfirmed(
              !buyerRequiredKeys.some((key) => {
                const value = Number(nextValues[key]);
                return !(Number.isFinite(value) && value > 0);
              }),
            );

            const lastUpdatedAt = sizeFit.lastUpdatedAt
              ? new Date(sizeFit.lastUpdatedAt).getTime()
              : NaN;
            setMeasurementRecencyConfirmed(
              Number.isFinite(lastUpdatedAt) && Date.now() - lastUpdatedAt <= FOURTEEN_DAYS_MS,
            );
          } catch {
            if (!active) return;
            setSizeFitProfile(null);
            setMeasurementRecencyConfirmed(false);
          }
        } else {
          setSizeFitProfile(null);
          setMeasurementRecencyConfirmed(false);
        }
      } catch (error: any) {
        if (!active) return;
        toast.error(
          error?.response?.data?.message || 'Unable to load custom-order configuration',
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [configurationId]);

  const requiredMeasurementKeys = useMemo(
    () => resolveBuyerRequiredMeasurementKeys(configuration),
    [
      configuration?.requiredMeasurementKeys,
      configuration?.requiredMeasurementPoints,
      configuration?.resolvedRequiredMeasurementKeys,
    ],
  );

  const measurementPointByKey = useMemo(
    () =>
      new Map(
        (configuration?.requiredMeasurementPoints ?? []).map((point) => [
          normalizeMeasurementKey(point.key),
          point,
        ]),
      ),
    [configuration?.requiredMeasurementPoints],
  );

  const getMeasurementLabel = useCallback(
    (key: string) => measurementPointByKey.get(normalizeMeasurementKey(key))?.label || fieldLabel(key),
    [measurementPointByKey],
  );

  const getMeasurementGuidance = useCallback(
    (key: string) => measurementGuidance(key, measurementPointByKey.get(normalizeMeasurementKey(key))),
    [measurementPointByKey],
  );

  const missingMeasurements = useMemo(
    () =>
      requiredMeasurementKeys.filter((key) => {
        const value = convertDisplayToCm(key, measurementValues[key] ?? '', lengthUnit);
        return !(Number.isFinite(value) && value > 0);
      }),
    [lengthUnit, measurementValues, requiredMeasurementKeys],
  );

  const outOfRangeMeasurements = useMemo(
    () =>
      requiredMeasurementKeys.filter((key) => {
        const value = convertDisplayToCm(key, measurementValues[key] ?? '', lengthUnit);
        if (!Number.isFinite(value) || value <= 0) return false;
        const range = getMeasurementGuidance(key);
        return value < range.min || value > range.max;
      }),
    [getMeasurementGuidance, lengthUnit, measurementValues, requiredMeasurementKeys],
  );

  const shippingAddress = useMemo(
    () => ({ street, city, state: stateRegion, country }),
    [city, country, stateRegion, street],
  );

  const contactInfo = useMemo(
    () => ({ email: contactEmail, phone: contactPhone }),
    [contactEmail, contactPhone],
  );

  const measurementPayload = useMemo(
    () =>
      requiredMeasurementKeys.reduce<Record<string, number>>((accumulator, key) => {
        const parsed = convertDisplayToCm(key, measurementValues[key] ?? '', lengthUnit);
        if (Number.isFinite(parsed) && parsed > 0) accumulator[key] = parsed;
        return accumulator;
      }, {}),
    [lengthUnit, measurementValues, requiredMeasurementKeys],
  );

  const hasPrefilledMeasurements = useMemo(
    () => Object.keys(measurementPayload).length > 0,
    [measurementPayload],
  );

  const liveRecommendation = useMemo(
    () => deriveSizeRecommendation(measurementPayload, displayChartFamily),
    [displayChartFamily, measurementPayload],
  );

  const currentMeasurementSignature = useMemo(
    () => buildMeasurementSignature(measurementPayload),
    [measurementPayload],
  );

  const savedMeasurementSignature = useMemo(() => {
    const savedMeasurements =
      sizeFitProfile?.measurements && typeof sizeFitProfile.measurements === 'object'
        ? (sizeFitProfile.measurements as Record<string, unknown>)
        : {};

    const normalized = requiredMeasurementKeys.reduce<Record<string, number>>((accumulator, key) => {
      const value = parseStoredMeasurement(savedMeasurements[key]);
      if (value != null) accumulator[key] = value;
      return accumulator;
    }, {});

    return buildMeasurementSignature(normalized);
  }, [requiredMeasurementKeys, sizeFitProfile?.measurements]);

  const needsMeasurementProfileSave = useMemo(
    () =>
      currentMeasurementSignature !== savedMeasurementSignature ||
      (sizeFitProfile?.preferredLengthUnit ?? 'CM') !== lengthUnit,
    [
      currentMeasurementSignature,
      lengthUnit,
      savedMeasurementSignature,
      sizeFitProfile?.preferredLengthUnit,
    ],
  );

  const measurementsLastUpdatedAtMs = useMemo(() => {
    if (!sizeFitProfile?.lastUpdatedAt) return null;
    const parsed = new Date(sizeFitProfile.lastUpdatedAt).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }, [sizeFitProfile?.lastUpdatedAt]);

  const needsMeasurementReviewPrompt = useMemo(() => {
    if (!Object.keys(measurementPayload).length) return false;
    if (!measurementsLastUpdatedAtMs) return true;
    return Date.now() - measurementsLastUpdatedAtMs > FOURTEEN_DAYS_MS;
  }, [measurementPayload, measurementsLastUpdatedAtMs]);

  useEffect(() => {
    if (!needsMeasurementReviewPrompt) {
      setMeasurementRecencyConfirmed(true);
    }
  }, [needsMeasurementReviewPrompt]);

  const currentAddressDraft = useMemo(
    () => ({
      id: editingAddressId ?? undefined,
      customerName: customerName.trim(),
      contactEmail: contactEmail.trim(),
      contactPhone: contactPhone.trim(),
      street: street.trim(),
      city: city.trim(),
      state: stateRegion.trim(),
      country: country.trim() || 'Nigeria',
      updatedAt: new Date().toISOString(),
    }),
    [
      city,
      contactEmail,
      contactPhone,
      country,
      customerName,
      editingAddressId,
      stateRegion,
      street,
    ],
  );

  const isCurrentAddressComplete = useMemo(
    () =>
      Boolean(
        currentAddressDraft.customerName &&
          currentAddressDraft.contactEmail &&
          currentAddressDraft.contactPhone &&
          currentAddressDraft.street &&
          currentAddressDraft.city &&
          currentAddressDraft.state,
      ),
    [currentAddressDraft],
  );

  const persistMeasurementProfile = useCallback(async () => {
    if (!Object.keys(measurementPayload).length || !needsMeasurementProfileSave) {
      return sizeFitProfile;
    }

    const updated = await SizeFitApi.updateProfile({
      measurements: measurementPayload,
      preferredLengthUnit: lengthUnit,
    });
    setSizeFitProfile(updated);
    return updated;
  }, [lengthUnit, measurementPayload, needsMeasurementProfileSave, sizeFitProfile]);

  const handleLengthUnitChange = (nextUnit: 'CM' | 'IN') => {
    if (nextUnit === lengthUnit) return;
    setMeasurementValues((current) => {
      const converted: Record<string, string> = { ...current };
      for (const key of requiredMeasurementKeys) {
        if (isWeightKey(key)) continue;
        const parsed = Number(current[key]);
        if (!Number.isFinite(parsed)) continue;
        converted[key] =
          nextUnit === 'IN'
            ? String(round(toInches(parsed)))
            : String(round(toCentimeters(parsed)));
      }
      return converted;
    });
    setLengthUnit(nextUnit);
  };

  const handlePreview = async () => {
    if (!configuration) return;
    if (missingMeasurements.length > 0) {
      toast.error(`Add all ${missingMeasurements.length} required measurements before previewing.`);
      return;
    }
    if (outOfRangeMeasurements.length > 0) {
      toast.error('Review the highlighted measurements before locking the preview.');
      return;
    }
    if (needsMeasurementReviewPrompt && !measurementRecencyConfirmed) {
      toast.error('Review and confirm that these measurements are current within the last 14 days.');
      return;
    }
    if (!measurementConfirmed) {
      toast.error('Confirm the measurement snapshot before continuing.');
      return;
    }

    setSubmitting(true);
    try {
      await persistMeasurementProfile();
      const data = await customOrdersBuyerApi.previewPrice({
        configurationId: configuration.id,
        configurationVersionId: configuration.versions?.[0]?.id,
        measurementValues: measurementPayload,
        rushSelected,
        shippingAddress,
        pricingChartFamily,
        displayChartFamily,
        resolverPolicy: 'MAX_OF_BOTH',
      });
      setPreview(data);
      if (data.quoteStatus === 'MANUAL_QUOTE_REQUIRED') {
        toast.error('This measurement profile requires manual quote review before payment.');
      } else {
        toast.success('Price preview locked. Add this custom request to your bag when ready.');
      }

      void customOrdersBuyerApi.updateDisplayChartPreference({
        displayChartFamily,
        updatedAtMs: Date.now(),
      });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to calculate custom-order preview');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateOrder = async () => {
    // Guard against double-submit: state updates are async so we gate at
    // the top of the handler before setSubmitting(true) is reached.
    if (submitting) return;
    if (!configuration) return;
    if (!preview) {
      toast.error('Create a price preview before placing the custom order.');
      return;
    }
    if (preview.quoteStatus === 'MANUAL_QUOTE_REQUIRED') {
      toast.error('Manual quote review is pending. This request cannot be added to your bag yet.');
      return;
    }
    if (!preview.checkoutIntentId) {
      toast.error('Price preview is not locked yet.');
      return;
    }
    if (preview.noDirectMatch && !noDirectMatchAcknowledged) {
      toast.error('Acknowledge the no-direct-match guidance before creating this order.');
      return;
    }
    if (needsMeasurementReviewPrompt && !measurementRecencyConfirmed) {
      toast.error('Review and confirm that these measurements are current within the last 14 days.');
      return;
    }
    if (!customerName.trim() || !contactEmail.trim() || !contactPhone.trim() || !street.trim() || !city.trim() || !stateRegion.trim() || !country.trim()) {
      toast.error('Complete the delivery and contact information first.');
      return;
    }

    setSubmitting(true);
    let createdOrderId: string | null = null;
    let checkoutIntentId: string | null = null;
    try {
      const submission = await customOrdersBuyerApi.create({
        checkoutIntentId: preview.checkoutIntentId,
        configurationId: configuration.id,
        configurationVersionId: preview.configurationVersionId,
        measurementValues: measurementPayload,
        rushSelected,
        shippingAddress,
        contactInfo,
        customerName: customerName.trim(),
        idempotencyKey: createKeyRef.current,
        noDirectMatchAcknowledged,
      });
      createdOrderId = submission.customOrderId ?? null;
      checkoutIntentId = submission.checkoutIntentId;

      const nextAddresses = upsertCustomOrderAddress(profile?.id, currentAddressDraft);
      setSavedAddresses(nextAddresses);
      if (nextAddresses[0]) setEditingAddressId(nextAddresses[0].id);

      // ALREADY_PLACED: order exists (e.g. idempotent retry). Navigate to it.
      if (createdOrderId) {
        dismissEmbeddedComposer();
        navigate(
          `/profile?tab=orders&kind=custom&orderId=${encodeURIComponent(createdOrderId)}`,
        );
        onOrderCreated?.(createdOrderId);
        return;
      }

      if (!checkoutIntentId) {
        throw new Error('Checkout intent is missing after submission.');
      }
      toast.success('Custom order added to your bag. Continue checkout from your bag.');
      dismissEmbeddedComposer();
      dispatch(openCartDrawer());
      return;

    } catch (error: any) {
      const apiMessage: string = error?.response?.data?.message ?? '';

      if (apiMessage === 'CUSTOM_ORDER_DUPLICATE_IN_BAG') {
        toast.error('This custom request is already in your bag.');
        dismissEmbeddedComposer();
        dispatch(openCartDrawer());
        return;
      }

      // Specific recovery: price lock expired between preview and submission.
      // Prompt the user to re-preview so they get a fresh checkout intent.
      if (
        apiMessage === 'CUSTOM_ORDER_CHECKOUT_INTENT_EXPIRED' ||
        apiMessage.includes('INTENT_EXPIRED')
      ) {
        setPreview(null);
        toast.error(
          'Your pricing lock expired before the order could be placed. Your measurements are still saved — tap "Preview & Lock Price" to get a fresh quote and try again.',
        );
        return;
      }

      const fallbackMessage =
        createdOrderId
          ? 'Order was already placed. Open it to review the payment status.'
          : checkoutIntentId
            ? 'Custom order was added to your bag, but refresh failed. Open your bag to continue.'
            : 'Unable to add this custom order to your bag.';
      toast.error(apiMessage || fallbackMessage);
      if (createdOrderId) {
        navigate(
          `/profile?tab=orders&kind=custom&orderId=${encodeURIComponent(createdOrderId)}`,
        );
        onOrderCreated?.(createdOrderId);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveCurrentAddress = useCallback(() => {
    if (!isCurrentAddressComplete) {
      toast.error('Complete the delivery details before saving this address.');
      return;
    }

    const nextAddresses = upsertCustomOrderAddress(profile?.id, currentAddressDraft);
    setSavedAddresses(nextAddresses);
    if (nextAddresses[0]) setEditingAddressId(nextAddresses[0].id);
    setOpenAddressMenuId(null);
    setShowAddressForm(false);
    toast.success(editingAddressId ? 'Delivery address updated.' : 'Delivery address saved.');
  }, [
    currentAddressDraft,
    editingAddressId,
    isCurrentAddressComplete,
    profile?.id,
  ]);

  const handleStartNewAddress = useCallback(() => {
    setShowAddressForm(true);
    setEditingAddressId(null);
    setOpenAddressMenuId(null);
    setStreet('');
    setCity('');
    setStateRegion('');
    setCountry('Nigeria');
  }, []);

  const handleEditSavedAddress = useCallback((address: CustomOrderSavedAddress) => {
    setCustomerName(address.customerName);
    setContactEmail(address.contactEmail);
    setContactPhone(address.contactPhone);
    setStreet(address.street);
    setCity(address.city);
    setStateRegion(address.state);
    setCountry(address.country);
    setEditingAddressId(address.id);
    setOpenAddressMenuId(null);
    setShowAddressForm(true);
  }, []);

  const handleCancelAddressForm = useCallback(() => {
    setOpenAddressMenuId(null);
    if (editingAddressId) {
      const currentAddress = savedAddresses.find((address) => address.id === editingAddressId);
      if (currentAddress) {
        applySavedAddress(currentAddress);
        return;
      }
    }
    if (savedAddresses[0]) {
      applySavedAddress(savedAddresses[0]);
      return;
    }
    setShowAddressForm(true);
  }, [applySavedAddress, editingAddressId, savedAddresses]);

  const handleDeleteSavedAddress = useCallback(
    (addressId: string) => {
      const nextAddresses = removeCustomOrderAddress(profile?.id, addressId);
      setSavedAddresses(nextAddresses);
      setOpenAddressMenuId(null);
      if (editingAddressId === addressId) {
        setEditingAddressId(null);
        if (nextAddresses[0]) {
          applySavedAddress(nextAddresses[0]);
        } else {
          setShowAddressForm(true);
        }
      }
      toast.success('Delivery address removed.');
    },
    [applySavedAddress, editingAddressId, profile?.id],
  );

  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-slate-500">Loading custom-order workspace...</div>;
  }

  if (!configuration) {
    return (
      <div className={embedded ? 'w-full px-2 py-2' : 'mx-auto max-w-3xl px-4 py-10'}>
        <div className="rounded-3xl border border-black/10 bg-white/80 p-8 dark:border-white/10 dark:bg-white/5">
          <div className="text-lg font-semibold text-slate-900 dark:text-white">Custom order configuration unavailable</div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Open this page from a product or design custom-order button so the locked configuration can be loaded.
          </p>
          <button
            type="button"
            onClick={() => {
              if (embedded) {
                onClose?.();
                return;
              }
              navigate(-1);
            }}
            className="mt-5 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? 'w-full px-2 py-2' : 'mx-auto max-w-6xl px-4 py-10'}>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300">Custom Order</div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{configuration.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Build the request, lock the price preview, then add this custom request to your bag.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (embedded) {
              onClose?.();
              return;
            }
            navigate(-1);
          }}
          className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200"
        >
          Back
        </button>
      </div>
      <div className="mb-6 rounded-3xl border border-emerald-200/80 bg-emerald-50/80 p-5 text-sm text-emerald-950 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100">
        <p className="font-semibold">Payment split notice</p>
        <p className="mt-2">
          Customers pay the full quoted total at checkout. Threadly retains the platform commission, and the brand receives the net settlement in milestone releases after production and delivery conditions are met.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Measurement profile</div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Only the measurement points this brand requested are shown here. Any new values you confirm will be saved back to your profile so you do not need to type them again next time.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <UniversalSelect label="Length unit" value={lengthUnit} onChange={(value) => handleLengthUnitChange(value as 'CM' | 'IN')} options={[{ value: 'CM', label: 'Centimeters (cm)' }, { value: 'IN', label: 'Inches (in)' }]} />
              <UniversalSelect label="Display chart" value={displayChartFamily} onChange={(value) => setDisplayChartFamily(value as CustomOrderChartFamily)} options={DISPLAY_CHART_OPTIONS} />
              <UniversalSelect label="Pricing chart" value={pricingChartFamily} onChange={(value) => setPricingChartFamily(value as CustomOrderChartFamily)} options={PRICING_CHART_OPTIONS} />
            </div>
            <div className="mt-4 rounded-2xl border border-indigo-300/50 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100">
              <div className="font-semibold">Live size recommendation</div>
              <p className="mt-1">
                {liveRecommendation.computedSize
                  ? `${displayChartFamily} display resolves to ${liveRecommendation.computedSize}.`
                  : 'Chart sizing is optional here. Add bust/chest, waist, and hip values if you want a live size recommendation too.'}
              </p>
              {liveRecommendation.conversionGuidance ? <p className="mt-1">{liveRecommendation.conversionGuidance}</p> : null}
            </div>
            {hasPrefilledMeasurements ? (
              <div className="mt-4 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-500/10 dark:text-amber-100">
                <div className="font-semibold">Review saved fittings before checkout</div>
                <p className="mt-1">Saved measurements were prefilled from your profile. You must confirm or update them before price lock and payment.</p>
              </div>
            ) : null}
            {needsMeasurementReviewPrompt ? (
              <div className="mt-4 rounded-2xl border border-rose-300/60 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-700/40 dark:bg-rose-500/10 dark:text-rose-100">
                <div className="font-semibold">Review measurements before checkout</div>
                <p className="mt-1">
                  {measurementsLastUpdatedAtMs
                    ? `Your saved profile was last updated on ${new Date(measurementsLastUpdatedAtMs).toLocaleDateString()}. Review or refresh these values before placing the order if that is older than 14 days.`
                    : 'There is no recent measurement-update timestamp on your profile yet. Review these values carefully before placing the order.'}
                </p>
              </div>
            ) : null}
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {requiredMeasurementKeys.map((key) => (
                <label key={key} className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{getMeasurementLabel(key)}</span>
                  <span className="mb-2 inline-flex rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-300">Required by brand</span>
                  <span className="mb-2 block text-xs text-slate-500 dark:text-slate-400">
                    {getMeasurementGuidance(key).description} Expected range {lengthUnit === 'IN' && !isWeightKey(key) ? round(toInches(getMeasurementGuidance(key).min)) : getMeasurementGuidance(key).min} to {lengthUnit === 'IN' && !isWeightKey(key) ? round(toInches(getMeasurementGuidance(key).max)) : getMeasurementGuidance(key).max} {lengthUnit === 'IN' && !isWeightKey(key) ? 'in' : 'cm'}.
                  </span>
                  <input
                    value={measurementValues[key] ?? ''}
                    onChange={(event) => {
                      setMeasurementConfirmed(false);
                      if (needsMeasurementReviewPrompt) setMeasurementRecencyConfirmed(false);
                      setMeasurementValues((current) => ({ ...current, [key]: event.target.value }));
                    }}
                    inputMode="decimal"
                    placeholder="0"
                    className={inputClassName}
                  />
                  {outOfRangeMeasurements.includes(key) ? <span className="mt-2 block text-xs font-medium text-rose-600 dark:text-rose-300">This value is outside the supported V1 range.</span> : null}
                </label>
              ))}
            </div>
            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-black/10 px-4 py-3 text-sm dark:border-white/10">
              <input type="checkbox" checked={measurementConfirmed} onChange={(event) => setMeasurementConfirmed(event.target.checked)} />
              <span className="text-slate-700 dark:text-slate-200">I confirm these measurement values are the exact snapshot I want used for pricing, checkout, and brand production review.</span>
            </label>
            {needsMeasurementReviewPrompt ? (
              <label className="mt-3 flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-500/10 dark:text-amber-100">
                <input type="checkbox" checked={measurementRecencyConfirmed} onChange={(event) => setMeasurementRecencyConfirmed(event.target.checked)} />
                <span>I confirm these measurements were reviewed and are still accurate within the last 14 days.</span>
              </label>
            ) : null}
          </section>

          <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Delivery details</div>
            <div className="mt-4 rounded-2xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">Saved delivery addresses</div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Your most recently used address is selected first. Add a new one only when you need another saved delivery profile.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={handleStartNewAddress} className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black">Add new address</button>
                </div>
              </div>
              {savedAddresses.length > 0 ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {savedAddresses.map((address) => {
                    const isActive = editingAddressId === address.id;
                    return (
                      <div key={address.id} className={`relative rounded-2xl border p-3 ${isActive ? 'border-emerald-400 bg-emerald-50/70 dark:border-emerald-500/40 dark:bg-emerald-500/10' : 'border-black/10 bg-white dark:border-white/10 dark:bg-slate-950'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <button type="button" onClick={() => applySavedAddress(address)} className="flex-1 text-left">
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">{address.customerName}</div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{address.street}, {address.city}, {address.state}</div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{address.contactPhone} · {address.contactEmail}</div>
                          </button>
                          <div className="relative">
                            <button type="button" onClick={() => setOpenAddressMenuId((current) => (current === address.id ? null : address.id))} className="rounded-full border border-black/10 px-2 py-1 text-xs font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300" aria-label="Open address actions">...</button>
                            {openAddressMenuId === address.id ? (
                              <div className="absolute right-0 top-10 z-10 w-36 rounded-2xl border border-black/10 bg-white p-1.5 shadow-xl dark:border-white/10 dark:bg-slate-950">
                                <button type="button" onClick={() => applySavedAddress(address)} className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5">Use address</button>
                                <button type="button" onClick={() => handleEditSavedAddress(address)} className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/5">Edit</button>
                                <button type="button" onClick={() => handleDeleteSavedAddress(address.id)} className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-500/10">Delete</button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">No saved delivery addresses yet. Add a new address to continue with delivery details.</p>}
            </div>
            {showAddressForm ? (
              <div className="mt-5 rounded-2xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">{editingAddressId ? 'Edit saved address' : 'Add new delivery address'}</div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Save this address for reuse or keep it as the active delivery profile for this order.</p>
                  </div>
                  {savedAddresses.length > 0 ? (
                    <button type="button" onClick={handleCancelAddressForm} className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200">Cancel</button>
                  ) : null}
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="block md:col-span-2"><span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Customer name</span><input value={customerName} onChange={(event) => setCustomerName(event.target.value)} className={inputClassName} /></label>
                  <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Email</span><input value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} className={inputClassName} /></label>
                  <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Phone</span><input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} className={inputClassName} /></label>
                  <label className="block md:col-span-2"><span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Street</span><input value={street} onChange={(event) => setStreet(event.target.value)} className={inputClassName} /></label>
                  <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">City</span><input value={city} onChange={(event) => setCity(event.target.value)} className={inputClassName} /></label>
                  <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">State</span><input value={stateRegion} onChange={(event) => setStateRegion(event.target.value)} className={inputClassName} /></label>
                  <label className="block md:col-span-2"><span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Country</span><input value={country} onChange={(event) => setCountry(event.target.value)} className={inputClassName} /></label>
                </div>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  {savedAddresses.length > 0 ? (
                    <button type="button" onClick={handleCancelAddressForm} className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200">Use saved address only</button>
                  ) : null}
                  <button type="button" onClick={handleSaveCurrentAddress} className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-black">{editingAddressId ? 'Update address' : 'Save address'}</button>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-black/10 bg-black/[0.02] px-4 py-5 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
                Delivery form is hidden while you use a saved address. Click <span className="font-semibold text-slate-900 dark:text-white">Add new address</span> to open the form again.
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Policy and delivery guidance</div>
            <dl className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-start justify-between gap-4"><dt>Brand</dt><dd className="text-right font-medium text-slate-900 dark:text-white">{configuration.brand?.name ?? 'Brand'}</dd></div>
              <div className="flex items-start justify-between gap-4"><dt>Production lead</dt><dd className="text-right font-medium text-slate-900 dark:text-white">{configuration.productionLeadDays} days</dd></div>
              <div className="flex items-start justify-between gap-4"><dt>Delivery window</dt><dd className="text-right font-medium text-slate-900 dark:text-white">{configuration.deliveryMinDays}-{configuration.deliveryMaxDays} days</dd></div>
              <div className="flex items-start justify-between gap-4"><dt>Revision policy</dt><dd className="text-right font-medium text-slate-900 dark:text-white">{configuration.revisionPolicy}</dd></div>
              <div className="flex items-start justify-between gap-4"><dt>Return policy</dt><dd className="text-right font-medium text-slate-900 dark:text-white">{configuration.returnPolicy}</dd></div>
              <div className="flex items-start justify-between gap-4"><dt>Defect policy</dt><dd className="text-right font-medium text-slate-900 dark:text-white">{configuration.defectPolicy}</dd></div>
            </dl>
            {configuration.buyerInstructionText ? <div className="mt-5 rounded-2xl bg-black/[0.04] p-4 text-sm text-slate-600 dark:bg-white/[0.04] dark:text-slate-300"><div className="mb-1 font-semibold text-slate-900 dark:text-white">Buyer instructions</div><p>{configuration.buyerInstructionText}</p></div> : null}
            <label className="mt-5 flex items-center gap-3 rounded-2xl border border-black/10 px-4 py-3 text-sm dark:border-white/10">
              <input type="checkbox" checked={rushSelected} disabled={!configuration.rushEnabled} onChange={(event) => setRushSelected(event.target.checked)} />
              <span className="text-slate-700 dark:text-slate-200">Rush production {configuration.rushEnabled ? `(extra ${formatCurrency(Number(configuration.rushFee ?? 0))})` : '(not available)'}</span>
            </label>
          </section>

          <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Bag preview</div>
            <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between"><span>Base production charge</span><span className="font-medium text-slate-900 dark:text-white">{formatCurrency(Number(configuration.baseProductionCharge))}</span></div>
              {preview ? (
                <>
                  {preview.buyerPriceSummary ? (
                    <>
                      {(preview.buyerPriceSummary.fabricCharge ?? 0) > 0 && (
                        <div className="flex items-center justify-between"><span>Fabric charge</span><span className="font-medium text-slate-900 dark:text-white">{formatCurrency(preview.buyerPriceSummary.fabricCharge ?? 0, preview.currency)}</span></div>
                      )}
                      {(preview.buyerPriceSummary.rushFee ?? 0) > 0 && (
                        <div className="flex items-center justify-between"><span>Rush fee</span><span className="font-medium text-slate-900 dark:text-white">{formatCurrency(preview.buyerPriceSummary.rushFee ?? 0, preview.currency)}</span></div>
                      )}
                      <div className="flex items-center justify-between"><span>Subtotal</span><span className="font-medium text-slate-900 dark:text-white">{formatCurrency(preview.buyerPriceSummary.subtotal ?? preview.buyerPriceSummary.grandTotal, preview.currency)}</span></div>
                      <div className="flex items-center justify-between"><span>Shipping</span><span className="font-medium text-slate-900 dark:text-white">{formatCurrency(preview.buyerPriceSummary.shippingFee ?? 0, preview.currency)}</span></div>
                      <div className="flex items-center justify-between border-t border-black/10 pt-3 text-base dark:border-white/10"><span className="font-semibold text-slate-900 dark:text-white">Grand total</span><span className="font-semibold text-emerald-600 dark:text-emerald-300">{formatCurrency(preview.buyerPriceSummary.grandTotal, preview.currency)}</span></div>
                    </>
                  ) : null}
                  <div className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-700 dark:text-emerald-200">
                    {preview.quoteStatus === 'MANUAL_QUOTE_REQUIRED' ? 'Manual quote is required. Brand/admin review must decide this request before payment can begin.' : `Price lock ends ${new Date(preview.priceLockExpiresAt || '').toLocaleString()}.`}
                    {preview.noDirectMatch ? <div className="mt-2">No direct size label match was found. {preview.conversionGuidance ?? 'Nearest band guidance has been applied.'}</div> : null}
                  </div>
                  {preview.noDirectMatch ? (
                    <label className="rounded-2xl border border-amber-300/60 bg-amber-50 px-3 py-3 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-500/10 dark:text-amber-100">
                      <span className="flex items-start gap-2"><input type="checkbox" checked={noDirectMatchAcknowledged} onChange={(event) => setNoDirectMatchAcknowledged(event.target.checked)} /><span>I acknowledge this conversion used nearest-band guidance and accept the displayed chart mapping.</span></span>
                    </label>
                  ) : null}
                </>
              ) : <div className="rounded-2xl bg-black/[0.04] px-4 py-3 text-xs dark:bg-white/[0.04]">Generate a preview to lock the buyer-facing price before placing the order.</div>}
            </div>
            <div className="mt-5 space-y-3">
              <button type="button" onClick={handlePreview} disabled={submitting} className="w-full rounded-full border border-black/10 px-4 py-3 text-sm font-semibold text-slate-800 disabled:opacity-60 dark:border-white/10 dark:text-white">{submitting ? 'Calculating preview...' : 'Lock price preview'}</button>
              <button type="button" onClick={handleCreateOrder} disabled={submitting || !preview || preview.quoteStatus === 'MANUAL_QUOTE_REQUIRED'} className="w-full rounded-full bg-emerald-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60">
                {submitting ? 'Adding to bag...' : preview?.checkoutIntentId ? 'Add custom order to bag' : 'Create custom order'}
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {preview?.checkoutIntentId
                  ? 'Your price is locked. Add this custom request to your bag, then pay from bag checkout.'
                  : 'Lock the price preview above, then add this custom request to your bag.'}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default CustomOrderComposerPage;
