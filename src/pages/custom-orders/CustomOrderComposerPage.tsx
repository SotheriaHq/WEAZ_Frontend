import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { SizeFitApi } from '@/api/SizeFitApi';
import {
  customOrderOffersApi,
  customOrdersBuyerApi,
  type CustomOrderOffer,
  type CustomOrderSourceType,
  type PricePreviewResponse,
} from '@/api/CustomOrderApi';
import { createIdempotencyKey } from '@/api/idempotency';

const fieldLabel = (key: string) => key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const measurementGuidance = (key: string) => ({
  description: `${fieldLabel(key)} measurement in centimeters. Measure close to the body without pulling too tight.`,
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
  const [offer, setOffer] = useState<CustomOrderOffer | null>(null);
  const [preview, setPreview] = useState<PricePreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [measurementValues, setMeasurementValues] = useState<Record<string, string>>({});
  const [customerName, setCustomerName] = useState('');
  const [contactEmail, setContactEmail] = useState(profile?.email ?? '');
  const [contactPhone, setContactPhone] = useState(profile?.phoneNumber ?? '');
  const [street, setStreet] = useState(profile?.address ?? '');
  const [city, setCity] = useState(profile?.brandCity ?? '');
  const [stateRegion, setStateRegion] = useState(profile?.brandState ?? '');
  const [country, setCountry] = useState(profile?.brandCountry ?? 'Nigeria');
  const [rushSelected, setRushSelected] = useState(false);
  const [measurementConfirmed, setMeasurementConfirmed] = useState(false);
  const createKeyRef = useRef(createIdempotencyKey());

  const offerId = searchParams.get('offerId');
  const sourceId = searchParams.get('sourceId');
  const sourceType = searchParams.get('sourceType') as CustomOrderSourceType | null;

  useEffect(() => {
    setCustomerName([profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim());
  }, [profile?.firstName, profile?.lastName]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        let resolvedOffer: CustomOrderOffer | null = null;
        if (offerId) {
          resolvedOffer = await customOrderOffersApi.getById(offerId);
        } else if (sourceId && sourceType) {
          const list = await customOrderOffersApi.listVisible({
            sourceId,
            sourceType,
            limit: 1,
          });
          resolvedOffer = list.items[0] ?? null;
        }

        if (!active) return;
        setOffer(resolvedOffer);

        if (resolvedOffer?.requiredMeasurementKeys.length) {
          try {
            const sizeFit = await SizeFitApi.getMyProfile();
            if (!active) return;
            const nextValues = resolvedOffer.requiredMeasurementKeys.reduce<Record<string, string>>((accumulator, key) => {
              const raw = (sizeFit.measurements as Record<string, any> | undefined)?.[key];
              if (typeof raw === 'number') {
                accumulator[key] = String(raw);
              } else if (raw && typeof raw === 'object' && typeof raw.value === 'number') {
                accumulator[key] = String(raw.value);
              }
              return accumulator;
            }, {});
            setMeasurementValues(nextValues);
            setMeasurementConfirmed(Object.keys(nextValues).length === 0);
          } catch {
          }
        }
      } catch (error: any) {
        if (!active) return;
        toast.error(error?.response?.data?.message || 'Unable to load custom-order offer');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [offerId, sourceId, sourceType]);

  const missingMeasurements = useMemo(
    () =>
      (offer?.requiredMeasurementKeys ?? []).filter((key) => {
        const value = Number(measurementValues[key]);
        return !(Number.isFinite(value) && value > 0);
      }),
    [measurementValues, offer?.requiredMeasurementKeys],
  );

  const outOfRangeMeasurements = useMemo(
    () =>
      (offer?.requiredMeasurementKeys ?? []).filter((key) => {
        const value = Number(measurementValues[key]);
        if (!Number.isFinite(value) || value <= 0) {
          return false;
        }
        const range = measurementGuidance(key);
        return value < range.min || value > range.max;
      }),
    [measurementValues, offer?.requiredMeasurementKeys],
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
    () =>
      Object.entries(measurementValues).reduce<Record<string, number>>((accumulator, [key, value]) => {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) {
          accumulator[key] = parsed;
        }
        return accumulator;
      }, {}),
    [measurementValues],
  );

  const hasPrefilledMeasurements = useMemo(
    () => Object.keys(measurementPayload).length > 0,
    [measurementPayload],
  );

  const handlePreview = async () => {
    if (!offer) return;
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
        offerId: offer.id,
        offerVersionId: offer.versions?.[0]?.id,
        measurementValues: measurementPayload,
        rushSelected,
        shippingAddress,
      });
      setPreview(data);
      toast.success('Price preview locked for checkout.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to calculate custom-order preview');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!offer) return;
    if (!preview) {
      toast.error('Create a price preview before placing the custom order.');
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
        offerId: offer.id,
        offerVersionId: preview.offerVersionId,
        measurementValues: measurementPayload,
        rushSelected,
        shippingAddress,
        contactInfo,
        customerName: customerName.trim(),
        idempotencyKey: createKeyRef.current,
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

  if (!offer) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-3xl border border-black/10 bg-white/80 p-8 dark:border-white/10 dark:bg-white/5">
          <div className="text-lg font-semibold text-slate-900 dark:text-white">Custom order offer unavailable</div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            This product or design does not have an active custom-order configuration yet.
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
          <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{offer.title}</h1>
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
              This request is being created from a {offer.sourceType.toLowerCase()} with a locked custom-offer version.
            </p>
            <dl className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-start justify-between gap-4">
                <dt>Source type</dt>
                <dd className="font-medium text-slate-900 dark:text-white">{offer.sourceType}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt>Offer version</dt>
                <dd className="font-medium text-slate-900 dark:text-white">v{offer.currentVersion}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt>Fabric sourcing</dt>
                <dd className="font-medium text-slate-900 dark:text-white">{offer.fabricSourcingMode}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Measurement profile</div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Required points: {(offer.requiredMeasurementKeys ?? []).length}. Use centimeters.
            </p>
            {hasPrefilledMeasurements ? (
              <div className="mt-4 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-500/10 dark:text-amber-100">
                <div className="font-semibold">📏 Review saved fittings before checkout</div>
                <p className="mt-1">
                  Saved measurements were prefilled from your profile. You must confirm or update them before price lock and payment.
                </p>
              </div>
            ) : null}
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {offer.requiredMeasurementKeys.map((key) => (
                <label key={key} className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {fieldLabel(key)}
                  </span>
                  <span className="mb-2 block text-xs text-slate-500 dark:text-slate-400">
                    {measurementGuidance(key).description} Expected range {measurementGuidance(key).min} to {measurementGuidance(key).max} cm.
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
                <dd className="text-right font-medium text-slate-900 dark:text-white">{offer.brand?.name ?? 'Brand'}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt>Production lead</dt>
                <dd className="text-right font-medium text-slate-900 dark:text-white">{offer.productionLeadDays} days</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt>Delivery window</dt>
                <dd className="text-right font-medium text-slate-900 dark:text-white">{offer.deliveryMinDays}–{offer.deliveryMaxDays} days</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt>Delivery scope</dt>
                <dd className="text-right font-medium text-slate-900 dark:text-white">{offer.deliveryScope}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt>Revision policy</dt>
                <dd className="text-right font-medium text-slate-900 dark:text-white">{offer.revisionPolicy}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt>Return policy</dt>
                <dd className="text-right font-medium text-slate-900 dark:text-white">{offer.returnPolicy}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt>Defect policy</dt>
                <dd className="text-right font-medium text-slate-900 dark:text-white">{offer.defectPolicy}</dd>
              </div>
            </dl>

            {offer.buyerInstructionText ? (
              <div className="mt-5 rounded-2xl bg-black/[0.04] p-4 text-sm text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
                <div className="mb-1 font-semibold text-slate-900 dark:text-white">Buyer instructions</div>
                <p>{offer.buyerInstructionText}</p>
              </div>
            ) : null}

            <label className="mt-5 flex items-center gap-3 rounded-2xl border border-black/10 px-4 py-3 text-sm dark:border-white/10">
              <input
                type="checkbox"
                checked={rushSelected}
                disabled={!offer.rushEnabled}
                onChange={(event) => setRushSelected(event.target.checked)}
              />
              <span className="text-slate-700 dark:text-slate-200">
                Rush production {offer.rushEnabled ? `(extra ${formatCurrency(Number(offer.rushFee ?? 0))})` : '(not available)'}
              </span>
            </label>
          </section>

          <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
            <div className="text-lg font-semibold text-slate-900 dark:text-white">Checkout preview</div>
            <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between">
                <span>Base production charge</span>
                <span className="font-medium text-slate-900 dark:text-white">{formatCurrency(Number(offer.baseProductionCharge))}</span>
              </div>
              {preview ? (
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
                  <div className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-700 dark:text-emerald-200">
                    Price lock ends {new Date(preview.priceLockExpiresAt).toLocaleString()}.
                  </div>
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
                disabled={submitting || !preview}
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