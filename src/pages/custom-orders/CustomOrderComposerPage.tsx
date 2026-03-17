import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
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

const fieldLabel = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const isWeightKey = (key: string) => key.toUpperCase().includes('WEIGHT');
const toInches = (cm: number) => cm / 2.54;
const toCentimeters = (inch: number) => inch * 2.54;
const round = (value: number) => Math.round(value * 100) / 100;
const convertDisplayToCm = (key: string, rawValue: string, unit: 'CM' | 'IN') => {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return NaN;
  if (unit === 'IN' && !isWeightKey(key)) {
    return round(toCentimeters(parsed));
  }
  return parsed;
};

const measurementGuidance = (key: string) => ({
  description: `${fieldLabel(key)} measurement. Measure close to the body without pulling too tight.`,
  min: 1,
  max: 300,
});

const formatCurrency = (value: number | undefined, currency = 'NGN') =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(Number(value ?? 0));

const inputClassName =
  'w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-400 dark:border-white/10 dark:bg-slate-950 dark:text-white';

const CustomOrderComposerPage: React.FC = () => {
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
  const [baselineRequiredKeys, setBaselineRequiredKeys] = useState<string[]>([]);
  const [displayChartFamily, setDisplayChartFamily] = useState<CustomOrderChartFamily>('UK');
  const [pricingChartFamily, setPricingChartFamily] = useState<CustomOrderChartFamily>('HYBRID_UK_NIGERIA');
  const [noDirectMatchAcknowledged, setNoDirectMatchAcknowledged] = useState(false);
  const createKeyRef = useRef(createIdempotencyKey());

  const configurationId = searchParams.get('configurationId');

  useEffect(() => {
    setCustomerName([profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim());
  }, [profile?.firstName, profile?.lastName]);

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
          if (active) {
            setDisplayChartFamily(preference.displayChartFamily);
          }
        } catch {
          // Fallback to default chart for guests or unavailable preference endpoint.
        }

        if (resolvedConfiguration?.requiredMeasurementKeys.length) {
          try {
            const sizeFit = await SizeFitApi.getMyProfile();
            if (!active) return;
            const profileBaselineKeys = sizeFit.baselineRequiredKeys ?? [];
            setBaselineRequiredKeys(profileBaselineKeys);
            setLengthUnit(sizeFit.preferredLengthUnit ?? 'CM');
            const effectiveRequiredKeys = Array.from(
              new Set([...profileBaselineKeys, ...resolvedConfiguration.requiredMeasurementKeys]),
            );

            const nextValues = effectiveRequiredKeys.reduce<Record<string, string>>((accumulator, key) => {
              const raw = (sizeFit.measurements as Record<string, any> | undefined)?.[key];
              if (typeof raw === 'number') {
                accumulator[key] =
                  (sizeFit.preferredLengthUnit ?? 'CM') === 'IN' && !isWeightKey(key)
                    ? String(round(toInches(raw)))
                    : String(raw);
              } else if (raw && typeof raw === 'object' && typeof raw.value === 'number') {
                accumulator[key] =
                  (sizeFit.preferredLengthUnit ?? 'CM') === 'IN' && !isWeightKey(key)
                    ? String(round(toInches(raw.value)))
                    : String(raw.value);
              }
              return accumulator;
            }, {});
            setMeasurementValues(nextValues);
            const hasAnyMissing = effectiveRequiredKeys.some((key) => {
              const value = Number(nextValues[key]);
              return !(Number.isFinite(value) && value > 0);
            });
            setMeasurementConfirmed(!hasAnyMissing);
          } catch {
            setBaselineRequiredKeys([]);
          }
        } else {
          setBaselineRequiredKeys([]);
        }
      } catch (error: any) {
        if (!active) return;
        toast.error(error?.response?.data?.message || 'Unable to load custom-order configuration');
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
    () => Array.from(new Set([...(baselineRequiredKeys ?? []), ...(configuration?.requiredMeasurementKeys ?? [])])),
    [baselineRequiredKeys, configuration?.requiredMeasurementKeys],
  );

  const additionalRequiredKeys = useMemo(
    () => (configuration?.requiredMeasurementKeys ?? []).filter((key) => !(baselineRequiredKeys ?? []).includes(key)),
    [baselineRequiredKeys, configuration?.requiredMeasurementKeys],
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
        if (!Number.isFinite(value) || value <= 0) {
          return false;
        }
        const range = measurementGuidance(key);
        return value < range.min || value > range.max;
      }),
    [lengthUnit, measurementValues, requiredMeasurementKeys],
  );

  const shippingAddress = useMemo(
    () => ({
      street,
      city,
      state: stateRegion,
      country,
    }),
    [city, country, stateRegion, street],
  );

  const contactInfo = useMemo(
    () => ({
      email: contactEmail,
      phone: contactPhone,
    }),
    [contactEmail, contactPhone],
  );

  const measurementPayload = useMemo(
    () => {
      return requiredMeasurementKeys.reduce<Record<string, number>>((accumulator, key) => {
        const parsed = convertDisplayToCm(key, measurementValues[key] ?? '', lengthUnit);
        if (Number.isFinite(parsed) && parsed > 0) {
          accumulator[key] = parsed;
        }
        return accumulator;
      }, {});
    },
    [lengthUnit, measurementValues, requiredMeasurementKeys],
  );

  const hasPrefilledMeasurements = useMemo(
    () => Object.keys(measurementPayload).length > 0,
    [measurementPayload],
  );

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
    if (!measurementConfirmed) {
      toast.error('Confirm the measurement snapshot before continuing.');
      return;
    }
    setSubmitting(true);
    try {
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
        toast.success('Price preview locked for checkout.');
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
    if (!configuration) return;
    if (!preview) {
      toast.error('Create a price preview before placing the custom order.');
      return;
    }
    if (preview.quoteStatus === 'MANUAL_QUOTE_REQUIRED') {
      toast.error('Manual quote review is pending. Checkout cannot continue yet.');
      return;
    }
    if (!preview.checkoutIntentId) {
      toast.error('Price preview is not locked for checkout yet.');
      return;
    }
    if (preview.noDirectMatch && !noDirectMatchAcknowledged) {
      toast.error('Acknowledge the no-direct-match guidance before creating this order.');
      return;
    }
    if (!customerName.trim() || !contactEmail.trim() || !contactPhone.trim() || !street.trim() || !city.trim() || !stateRegion.trim() || !country.trim()) {
      toast.error('Complete the delivery and contact information first.');
      return;
    }

    setSubmitting(true);
    try {
      const order = await customOrdersBuyerApi.create({
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
      toast.success('Custom order created. Continue to payment on the next screen.');
      navigate(`/custom-orders/${order.id}`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to create custom order');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 py-10 text-sm text-slate-500">Loading custom-order workspace...</div>;
  }

  if (!configuration) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-3xl border border-black/10 bg-white/80 p-8 dark:border-white/10 dark:bg-white/5">
          <div className="text-lg font-semibold text-slate-900 dark:text-white">Custom order configuration unavailable</div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Open this page from a product or design custom-order button so the locked configuration can be loaded.
          </p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-5 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300">Custom Order</div>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{configuration.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Build the request, lock the price preview, then create the order and continue to payment.
          </p>
        </div>
        <button type="button" onClick={() => navigate(-1)} className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200">
          Back
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Source summary</div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              This request is being created from a {configuration.sourceType.toLowerCase()} with a locked custom-configuration version.
            </p>
            <dl className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-start justify-between gap-4">
                <dt>Source type</dt>
                <dd className="font-medium text-slate-900 dark:text-white">{configuration.sourceType}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt>Configuration version</dt>
                <dd className="font-medium text-slate-900 dark:text-white">v{configuration.currentVersion}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt>Fabric sourcing</dt>
                <dd className="font-medium text-slate-900 dark:text-white">{configuration.fabricSourcingMode}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Measurement profile</div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Baseline required points: {baselineRequiredKeys.length}. Additional points for this configuration: {additionalRequiredKeys.length}. Use {lengthUnit === 'IN' ? 'inches' : 'centimeters'} for length values.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <UniversalSelect
                label="Length unit"
                value={lengthUnit}
                onChange={(value) => handleLengthUnitChange(value as 'CM' | 'IN')}
                options={[
                  { value: 'CM', label: 'Centimeters (cm)' },
                  { value: 'IN', label: 'Inches (in)' },
                ]}
              />
              <UniversalSelect
                label="Display chart"
                value={displayChartFamily}
                onChange={(value) => setDisplayChartFamily(value as CustomOrderChartFamily)}
                options={[
                  { value: 'UK', label: 'UK' },
                  { value: 'US', label: 'US' },
                  { value: 'NIGERIA', label: 'Nigeria' },
                  { value: 'ASIA', label: 'Asia' },
                ]}
              />
              <UniversalSelect
                label="Pricing chart"
                value={pricingChartFamily}
                onChange={(value) => setPricingChartFamily(value as CustomOrderChartFamily)}
                options={[
                  { value: 'HYBRID_UK_NIGERIA', label: 'Hybrid UK + Nigeria' },
                  { value: 'UK', label: 'UK only' },
                  { value: 'NIGERIA', label: 'Nigeria only' },
                  { value: 'US', label: 'US only' },
                  { value: 'ASIA', label: 'Asia only' },
                ]}
              />
            </div>
            {hasPrefilledMeasurements ? (
              <div className="mt-4 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-500/10 dark:text-amber-100">
                <div className="font-semibold">📏 Review saved fittings before checkout</div>
                <p className="mt-1">
                  Saved measurements were prefilled from your profile. You must confirm or update them before price lock and payment.
                </p>
              </div>
            ) : null}

            {baselineRequiredKeys.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-emerald-300/50 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-600/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                <div className="font-semibold">Baseline profile (required for all custom orders)</div>
                <p className="mt-1">
                  These common points are always required. They are prefilled from your saved profile where available.
                </p>
              </div>
            ) : null}

            {additionalRequiredKeys.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-indigo-300/50 bg-indigo-50/70 px-4 py-3 text-sm text-indigo-800 dark:border-indigo-600/40 dark:bg-indigo-500/10 dark:text-indigo-200">
                <div className="font-semibold">Additional points requested by this brand configuration</div>
                <p className="mt-1">
                  These optional profile points are requested only for this custom-order flow.
                </p>
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {requiredMeasurementKeys.map((key) => (
                <label key={key} className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {fieldLabel(key)}
                  </span>
                  <span className="mb-2 inline-flex rounded-full bg-black/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                    {(baselineRequiredKeys ?? []).includes(key) ? 'Baseline required' : 'Configuration specific'}
                  </span>
                  <span className="mb-2 block text-xs text-slate-500 dark:text-slate-400">
                    {measurementGuidance(key).description} Expected range {lengthUnit === 'IN' && !isWeightKey(key)
                      ? round(toInches(measurementGuidance(key).min))
                      : measurementGuidance(key).min} to {lengthUnit === 'IN' && !isWeightKey(key)
                      ? round(toInches(measurementGuidance(key).max))
                      : measurementGuidance(key).max} {lengthUnit === 'IN' && !isWeightKey(key) ? 'in' : 'cm'}.
                  </span>
                  <input
                    value={measurementValues[key] ?? ''}
                    onChange={(event) => {
                      setMeasurementConfirmed(false);
                      setMeasurementValues((current) => ({ ...current, [key]: event.target.value }));
                    }}
                    inputMode="decimal"
                    placeholder="0"
                    className={inputClassName}
                  />
                  {outOfRangeMeasurements.includes(key) ? (
                    <span className="mt-2 block text-xs font-medium text-rose-600 dark:text-rose-300">
                      This value is outside the supported V1 range.
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-black/10 px-4 py-3 text-sm dark:border-white/10">
              <input
                type="checkbox"
                checked={measurementConfirmed}
                onChange={(event) => setMeasurementConfirmed(event.target.checked)}
              />
              <span className="text-slate-700 dark:text-slate-200">
                I confirm these measurement values are the exact snapshot I want used for pricing, checkout, and brand production review.
              </span>
            </label>
            {hasPrefilledMeasurements ? (
              <div className="mt-3 rounded-2xl bg-black/[0.04] px-4 py-3 text-xs text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
                Proceeding with saved values means the brand will only receive this confirmed measurement snapshot. Fit issues caused by stale measurements may lead to disputes rather than free remakes.
              </div>
            ) : null}
          </section>

          <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Delivery details</div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Customer name</span>
                <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} className={inputClassName} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Email</span>
                <input value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} className={inputClassName} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Phone</span>
                <input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} className={inputClassName} />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Street</span>
                <input value={street} onChange={(event) => setStreet(event.target.value)} className={inputClassName} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">City</span>
                <input value={city} onChange={(event) => setCity(event.target.value)} className={inputClassName} />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">State</span>
                <input value={stateRegion} onChange={(event) => setStateRegion(event.target.value)} className={inputClassName} />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Country</span>
                <input value={country} onChange={(event) => setCountry(event.target.value)} className={inputClassName} />
              </label>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Policy and delivery guidance</div>
            <dl className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-start justify-between gap-4">
                <dt>Brand</dt>
                <dd className="text-right font-medium text-slate-900 dark:text-white">{configuration.brand?.name ?? 'Brand'}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt>Production lead</dt>
                <dd className="text-right font-medium text-slate-900 dark:text-white">{configuration.productionLeadDays} days</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt>Delivery window</dt>
                <dd className="text-right font-medium text-slate-900 dark:text-white">{configuration.deliveryMinDays}–{configuration.deliveryMaxDays} days</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt>Revision policy</dt>
                <dd className="text-right font-medium text-slate-900 dark:text-white">{configuration.revisionPolicy}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt>Return policy</dt>
                <dd className="text-right font-medium text-slate-900 dark:text-white">{configuration.returnPolicy}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt>Defect policy</dt>
                <dd className="text-right font-medium text-slate-900 dark:text-white">{configuration.defectPolicy}</dd>
              </div>
            </dl>

            {configuration.buyerInstructionText ? (
              <div className="mt-5 rounded-2xl bg-black/[0.04] p-4 text-sm text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
                <div className="mb-1 font-semibold text-slate-900 dark:text-white">Buyer instructions</div>
                <p>{configuration.buyerInstructionText}</p>
              </div>
            ) : null}

            <label className="mt-5 flex items-center gap-3 rounded-2xl border border-black/10 px-4 py-3 text-sm dark:border-white/10">
              <input
                type="checkbox"
                checked={rushSelected}
                disabled={!configuration.rushEnabled}
                onChange={(event) => setRushSelected(event.target.checked)}
              />
              <span className="text-slate-700 dark:text-slate-200">
                Rush production {configuration.rushEnabled ? `(extra ${formatCurrency(Number(configuration.rushFee ?? 0))})` : '(not available)'}
              </span>
            </label>
          </section>

          <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Checkout preview</div>
            <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <span>Base production charge</span>
                <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(Number(configuration.baseProductionCharge))}</span>
              </div>
              {preview ? (
                <>
                  {preview.buyerPriceSummary ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span>Subtotal</span>
                        <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(preview.buyerPriceSummary.subtotal ?? preview.buyerPriceSummary.grandTotal, preview.currency)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Shipping</span>
                        <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(preview.buyerPriceSummary.shippingFee ?? 0, preview.currency)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Rush fee</span>
                        <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(preview.buyerPriceSummary.rushFee ?? 0, preview.currency)}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-black/10 pt-3 text-base dark:border-white/10">
                        <span className="font-semibold text-slate-900 dark:text-white">Grand total</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-300">{formatCurrency(preview.buyerPriceSummary.grandTotal, preview.currency)}</span>
                      </div>
                    </>
                  ) : null}
                  <div className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-700 dark:text-emerald-200">
                    {preview.quoteStatus === 'MANUAL_QUOTE_REQUIRED'
                      ? 'Manual quote is required. Brand/admin review must decide this request before payment can begin.'
                      : `Price lock ends ${new Date(preview.priceLockExpiresAt || '').toLocaleString()}.`}
                    {preview.noDirectMatch ? (
                      <div className="mt-2">
                        No direct size label match was found. {preview.conversionGuidance ?? 'Nearest band guidance has been applied.'}
                      </div>
                    ) : null}
                  </div>
                  {preview.noDirectMatch ? (
                    <label className="rounded-2xl border border-amber-300/60 bg-amber-50 px-3 py-3 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-500/10 dark:text-amber-100">
                      <span className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={noDirectMatchAcknowledged}
                          onChange={(event) => setNoDirectMatchAcknowledged(event.target.checked)}
                        />
                        <span>
                          I acknowledge this conversion used nearest-band guidance and accept the displayed chart mapping.
                        </span>
                      </span>
                    </label>
                  ) : null}
                </>
              ) : (
                <div className="rounded-2xl bg-black/[0.04] px-4 py-3 text-xs dark:bg-white/[0.04]">
                  Generate a preview to lock the buyer-facing price before placing the order.
                </div>
              )}
            </div>

            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={handlePreview}
                disabled={submitting}
                className="w-full rounded-full border border-black/10 px-4 py-3 text-sm font-semibold text-slate-800 disabled:opacity-60 dark:border-white/10 dark:text-white"
              >
                {submitting ? 'Calculating preview...' : 'Lock price preview'}
              </button>
              <button
                type="button"
                onClick={handleCreateOrder}
                disabled={submitting || !preview || preview.quoteStatus === 'MANUAL_QUOTE_REQUIRED'}
                className="w-full rounded-full bg-emerald-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
              >
                {submitting ? 'Creating custom order...' : 'Create custom order'}
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Payment starts after the custom order is created, on the next screen.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default CustomOrderComposerPage;