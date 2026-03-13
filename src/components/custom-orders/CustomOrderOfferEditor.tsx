import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { getStoreStatus } from '@/api/StoreApi';
import {
  customOrderOffersApi,
  type CreateCustomFabricRuleBasisInput,
  type CustomFabricRuleBasis,
  type CustomOrderOffer,
  type CustomOrderOfferUpsertInput,
  type CustomOrderSourceType,
} from '@/api/CustomOrderApi';

interface CustomOrderOfferEditorProps {
  sourceType: CustomOrderSourceType;
  sourceId?: string;
  measurementKeys: string[];
  measurementGender?: 'MEN' | 'WOMEN' | 'UNISEX';
  disabled?: boolean;
}

type OfferFormState = {
  title: string;
  buyerInstructionText: string;
  requiredMeasurementKeys: string[];
  fabricRuleBasisId: string;
  baseProductionCharge: string;
  fabricCostPerYard: string;
  rushEnabled: boolean;
  rushFee: string;
  rushProductionLeadDays: string;
  productionLeadDays: string;
  deliveryMinDays: string;
  deliveryMaxDays: string;
  deliveryScope: string;
  revisionPolicy: string;
  returnPolicy: string;
  defectPolicy: string;
  fabricSourcingMode: 'BRAND_SOURCED' | 'BUYER_SUPPLIED' | 'EITHER';
  notes: string;
  rulesJson: string;
};

const defaultRulesJson = JSON.stringify(
  [
    {
      priority: 1,
      conditionsJson: {},
      outputYards: '4',
      isFallback: true,
    },
  ],
  null,
  2,
);

const createDefaultForm = (keys: string[]): OfferFormState => ({
  title: '',
  buyerInstructionText: '',
  requiredMeasurementKeys: keys,
  fabricRuleBasisId: '',
  baseProductionCharge: '',
  fabricCostPerYard: '',
  rushEnabled: false,
  rushFee: '',
  rushProductionLeadDays: '',
  productionLeadDays: '7',
  deliveryMinDays: '2',
  deliveryMaxDays: '5',
  deliveryScope: 'Nigeria',
  revisionPolicy: 'One revision after delivery confirmation.',
  returnPolicy: 'Custom orders are not returnable except where required by policy.',
  defectPolicy: 'Defects and material faults are reviewed through support.',
  fabricSourcingMode: 'BRAND_SOURCED',
  notes: '',
  rulesJson: defaultRulesJson,
});

const fieldClassName =
  'w-full rounded-2xl border border-black/10 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-400 dark:border-white/10 dark:bg-slate-950 dark:text-white';

const parseRules = (value: string) => {
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error('Rules JSON must be an array.');
  }
  return parsed;
};

const mapOfferToForm = (offer: CustomOrderOffer): OfferFormState => ({
  title: offer.title,
  buyerInstructionText: offer.buyerInstructionText ?? '',
  requiredMeasurementKeys: offer.requiredMeasurementKeys,
  fabricRuleBasisId: offer.fabricRuleBasis?.id ?? '',
  baseProductionCharge: offer.baseProductionCharge,
  fabricCostPerYard: offer.fabricCostPerYard,
  rushEnabled: offer.rushEnabled,
  rushFee: offer.rushFee ?? '',
  rushProductionLeadDays: offer.rushProductionLeadDays ? String(offer.rushProductionLeadDays) : '',
  productionLeadDays: String(offer.productionLeadDays),
  deliveryMinDays: String(offer.deliveryMinDays),
  deliveryMaxDays: String(offer.deliveryMaxDays),
  deliveryScope: offer.deliveryScope,
  revisionPolicy: offer.revisionPolicy,
  returnPolicy: offer.returnPolicy,
  defectPolicy: offer.defectPolicy,
  fabricSourcingMode: offer.fabricSourcingMode as OfferFormState['fabricSourcingMode'],
  notes: offer.notes ?? '',
  rulesJson: JSON.stringify(
    offer.rules.map((rule) => ({
      priority: rule.priority,
      conditionsJson: rule.conditionsJson,
      outputYards: rule.outputYards,
      isFallback: rule.isFallback,
    })),
    null,
    2,
  ),
});

const CustomOrderOfferEditor: React.FC<CustomOrderOfferEditorProps> = ({
  sourceType,
  sourceId,
  measurementKeys,
  measurementGender,
  disabled = false,
}) => {
  const [brandId, setBrandId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [offer, setOffer] = useState<CustomOrderOffer | null>(null);
  const [bases, setBases] = useState<CustomFabricRuleBasis[]>([]);
  const [form, setForm] = useState<OfferFormState>(() => createDefaultForm(measurementKeys));
  const [basisLabel, setBasisLabel] = useState('');

  useEffect(() => {
    setForm((current) => ({
      ...current,
      requiredMeasurementKeys:
        current.requiredMeasurementKeys.length > 0 ? current.requiredMeasurementKeys : measurementKeys,
    }));
  }, [measurementKeys]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!sourceId) {
        return;
      }

      setLoading(true);
      try {
        const status = await getStoreStatus();
        if (!active) return;
        setBrandId(status.brandId);

        const [basisList, offerList] = await Promise.all([
          customOrderOffersApi.listFabricRuleBases({ includeBrandOnly: true }),
          customOrderOffersApi.listBrandOffers(status.brandId, {
            sourceType,
            sourceId,
            limit: 10,
          }),
        ]);

        if (!active) return;

        setBases(basisList);
        const existingOffer = offerList.items[0] ?? null;
        setOffer(existingOffer);
        setForm(existingOffer ? mapOfferToForm(existingOffer) : createDefaultForm(measurementKeys));
      } catch (error: any) {
        if (!active) return;
        toast.error(error?.response?.data?.message || 'Unable to load custom-order offer editor');
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [measurementKeys, sourceId, sourceType]);

  const missingMeasurementKeys = useMemo(
    () => measurementKeys.filter((key) => !form.requiredMeasurementKeys.includes(key)),
    [form.requiredMeasurementKeys, measurementKeys],
  );

  const updateForm = <K extends keyof OfferFormState>(key: K, value: OfferFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleCreateBasis = async () => {
    const payload: CreateCustomFabricRuleBasisInput = {
      label: basisLabel.trim(),
      measurementKeys: form.requiredMeasurementKeys,
      gender: measurementGender,
    };

    if (!payload.label || payload.measurementKeys.length === 0) {
      toast.error('Add a basis label and at least one required measurement key first.');
      return;
    }

    setSaving(true);
    try {
      const created = await customOrderOffersApi.createFabricRuleBasis(payload);
      setBases((current) => [created, ...current]);
      setBasisLabel('');
      setForm((current) => ({ ...current, fabricRuleBasisId: created.id }));
      toast.success('Fabric-rule basis created.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to create fabric-rule basis');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOffer = async () => {
    if (!sourceId) {
      toast.error('Save the product or design first, then configure its custom-order offer.');
      return;
    }
    if (!brandId) {
      toast.error('Brand context is unavailable for this store session.');
      return;
    }

    let rules: CustomOrderOfferUpsertInput['rules'];
    try {
      rules = parseRules(form.rulesJson);
    } catch (error: any) {
      toast.error(error?.message || 'Rules JSON is invalid.');
      return;
    }

    const payload: CustomOrderOfferUpsertInput = {
      sourceType,
      sourceId,
      title: form.title.trim(),
      buyerInstructionText: form.buyerInstructionText.trim() || undefined,
      requiredMeasurementKeys: form.requiredMeasurementKeys,
      requiredFreeformPointIds: [],
      fabricRuleBasisId: form.fabricRuleBasisId,
      baseProductionCharge: form.baseProductionCharge.trim(),
      fabricCostPerYard: form.fabricCostPerYard.trim(),
      rushEnabled: form.rushEnabled,
      rushFee: form.rushEnabled ? form.rushFee.trim() || undefined : undefined,
      rushProductionLeadDays: form.rushEnabled && form.rushProductionLeadDays ? Number(form.rushProductionLeadDays) : undefined,
      productionLeadDays: Number(form.productionLeadDays),
      deliveryMinDays: Number(form.deliveryMinDays),
      deliveryMaxDays: Number(form.deliveryMaxDays),
      deliveryScope: form.deliveryScope.trim(),
      revisionPolicy: form.revisionPolicy.trim(),
      returnPolicy: form.returnPolicy.trim(),
      defectPolicy: form.defectPolicy.trim(),
      fabricSourcingMode: form.fabricSourcingMode,
      notes: form.notes.trim() || undefined,
      rules,
    };

    if (!payload.title || !payload.fabricRuleBasisId || payload.requiredMeasurementKeys.length === 0) {
      toast.error('Title, measurement keys, and fabric-rule basis are required.');
      return;
    }

    setSaving(true);
    try {
      const saved = offer
        ? await customOrderOffersApi.update(offer.id, payload)
        : await customOrderOffersApi.create(payload);
      setOffer(saved);
      setForm(mapOfferToForm(saved));
      toast.success(offer ? 'Custom-order offer updated.' : 'Custom-order offer created.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to save custom-order offer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-3xl border border-black/10 bg-white/80 p-6 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300">Custom Offer</div>
          <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">Custom-order offer setup</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Configure the production charge, yard rules, and customer-facing policies for this {sourceType.toLowerCase()}.
          </p>
        </div>
        <div className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200">
          {offer ? `Offer v${offer.currentVersion}` : 'No offer yet'}
        </div>
      </div>

      {!sourceId ? (
        <div className="mt-5 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-500/10 dark:text-amber-100">
          Save this {sourceType.toLowerCase()} first. The custom-order offer attaches to a persisted source id.
        </div>
      ) : null}

      {loading ? <div className="mt-5 text-sm text-slate-500 dark:text-slate-400">Loading offer workspace...</div> : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Offer title</span>
          <input value={form.title} onChange={(event) => updateForm('title', event.target.value)} disabled={disabled} className={fieldClassName} />
        </label>
        <label className="block md:col-span-2">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Buyer instructions</span>
          <textarea value={form.buyerInstructionText} onChange={(event) => updateForm('buyerInstructionText', event.target.value)} disabled={disabled} rows={3} className={fieldClassName} />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Base production charge</span>
          <input value={form.baseProductionCharge} onChange={(event) => updateForm('baseProductionCharge', event.target.value)} disabled={disabled} className={fieldClassName} placeholder="120000" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Fabric cost per yard</span>
          <input value={form.fabricCostPerYard} onChange={(event) => updateForm('fabricCostPerYard', event.target.value)} disabled={disabled} className={fieldClassName} placeholder="10000" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Production lead days</span>
          <input value={form.productionLeadDays} onChange={(event) => updateForm('productionLeadDays', event.target.value)} disabled={disabled} className={fieldClassName} />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Delivery scope</span>
          <input value={form.deliveryScope} onChange={(event) => updateForm('deliveryScope', event.target.value)} disabled={disabled} className={fieldClassName} />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Delivery min days</span>
          <input value={form.deliveryMinDays} onChange={(event) => updateForm('deliveryMinDays', event.target.value)} disabled={disabled} className={fieldClassName} />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Delivery max days</span>
          <input value={form.deliveryMaxDays} onChange={(event) => updateForm('deliveryMaxDays', event.target.value)} disabled={disabled} className={fieldClassName} />
        </label>
      </div>

      <div className="mt-5 rounded-2xl border border-black/10 p-4 dark:border-white/10">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">Measurement keys and fabric basis</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {measurementKeys.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">Add measurement keys in the sizing section first.</div>
          ) : (
            measurementKeys.map((key) => {
              const selected = form.requiredMeasurementKeys.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    updateForm(
                      'requiredMeasurementKeys',
                      selected
                        ? form.requiredMeasurementKeys.filter((entry) => entry !== key)
                        : [...form.requiredMeasurementKeys, key],
                    )
                  }
                  disabled={disabled}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${selected ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200' : 'bg-black/[0.05] text-slate-600 dark:bg-white/[0.06] dark:text-slate-300'}`}
                >
                  {key}
                </button>
              );
            })
          )}
        </div>
        {missingMeasurementKeys.length > 0 ? (
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">Unselected sizing keys: {missingMeasurementKeys.join(', ')}</div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <select value={form.fabricRuleBasisId} onChange={(event) => updateForm('fabricRuleBasisId', event.target.value)} disabled={disabled} className={fieldClassName}>
            <option value="">Select a fabric-rule basis</option>
            {bases.map((basis) => (
              <option key={basis.id} value={basis.id}>{basis.label}</option>
            ))}
          </select>
          <button type="button" onClick={handleCreateBasis} disabled={disabled || saving} className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60 dark:border-white/10 dark:text-white">
            Create basis
          </button>
        </div>
        <input value={basisLabel} onChange={(event) => setBasisLabel(event.target.value)} disabled={disabled} placeholder="New basis label" className={`${fieldClassName} mt-3`} />
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="flex items-center gap-3 rounded-2xl border border-black/10 px-4 py-3 text-sm dark:border-white/10">
          <input type="checkbox" checked={form.rushEnabled} onChange={(event) => updateForm('rushEnabled', event.target.checked)} disabled={disabled} />
          <span className="text-slate-700 dark:text-slate-200">Rush ordering enabled</span>
        </label>
        <select value={form.fabricSourcingMode} onChange={(event) => updateForm('fabricSourcingMode', event.target.value as OfferFormState['fabricSourcingMode'])} disabled={disabled} className={fieldClassName}>
          <option value="BRAND_SOURCED">Brand sourced</option>
          <option value="BUYER_SUPPLIED">Buyer supplied</option>
          <option value="EITHER">Either</option>
        </select>
        {form.rushEnabled ? (
          <>
            <input value={form.rushFee} onChange={(event) => updateForm('rushFee', event.target.value)} disabled={disabled} className={fieldClassName} placeholder="Rush fee" />
            <input value={form.rushProductionLeadDays} onChange={(event) => updateForm('rushProductionLeadDays', event.target.value)} disabled={disabled} className={fieldClassName} placeholder="Rush production lead days" />
          </>
        ) : null}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <textarea value={form.revisionPolicy} onChange={(event) => updateForm('revisionPolicy', event.target.value)} disabled={disabled} rows={4} className={fieldClassName} placeholder="Revision policy" />
        <textarea value={form.returnPolicy} onChange={(event) => updateForm('returnPolicy', event.target.value)} disabled={disabled} rows={4} className={fieldClassName} placeholder="Return policy" />
        <textarea value={form.defectPolicy} onChange={(event) => updateForm('defectPolicy', event.target.value)} disabled={disabled} rows={4} className={fieldClassName} placeholder="Defect policy" />
        <textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} disabled={disabled} rows={4} className={fieldClassName} placeholder="Internal notes" />
      </div>

      <div className="mt-5">
        <div className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Fabric yard rules JSON</div>
        <textarea value={form.rulesJson} onChange={(event) => updateForm('rulesJson', event.target.value)} disabled={disabled} rows={10} className={fieldClassName} />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Save creates or updates the immutable custom-order offer configuration for this source.
        </div>
        <button type="button" onClick={handleSaveOffer} disabled={disabled || saving || !sourceId} className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-60">
          {saving ? 'Saving offer...' : offer ? 'Update offer' : 'Create offer'}
        </button>
      </div>
    </section>
  );
};

export default CustomOrderOfferEditor;