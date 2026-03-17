import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { getStoreStatus } from '@/api/StoreApi';
import { useMeasurementPoints } from '@/hooks/useMeasurementPoints';
import UniversalSelect from '@/components/forms/UniversalSelect';
import {
  customOrderConfigurationsApi,
  type CreateCustomFabricRuleBasisInput,
  type CustomFabricRuleBasis,
  type CustomOrderConfiguration,
  type CustomOrderConfigurationSizeExtraYard,
  type CustomOrderConfigurationUpsertInput,
  type CustomOrderSourceType,
} from '@/api/CustomOrderApi';

interface CustomOrderConfigurationEditorProps {
  sourceType: CustomOrderSourceType;
  sourceId?: string;
  measurementKeys: string[];
  measurementGender?: 'MEN' | 'WOMEN' | 'UNISEX';
  disabled?: boolean;
}

type ConfigurationFormState = {
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

const POLICY_CUSTOM = '__CUSTOM__';
const DEFAULT_DELIVERY_SCOPE = 'Nigeria';

const REVISION_POLICY_OPTIONS = [
  'One revision after delivery confirmation.',
  'Two revisions within 7 days of delivery confirmation.',
  'One revision before final stitching and one after delivery.',
];

const RETURN_POLICY_OPTIONS = [
  'Custom orders are not returnable except where required by policy.',
  'Returns allowed only for manufacturing defects verified by support.',
  'No returns after production starts. Pre-production cancellation may qualify for partial refund.',
];

const DEFECT_POLICY_OPTIONS = [
  'Defects and material faults are reviewed through support.',
  'Brand will repair confirmed defects within 7 days of report.',
  'Confirmed defects qualify for remake or partial refund based on severity.',
];

type RuleConditionForm = {
  key: string;
  min: string;
  max: string;
};

type RuleFormState = {
  id: string;
  isFallback: boolean;
  outputYards: string;
  conditions: RuleConditionForm[];
};

type SizeExtraYardFormState = {
  sizeLabel: string;
  extraYards: string;
};

const createRuleId = () =>
  `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const formatMeasurementKeyLabel = (rawKey: string) => {
  const noBrandPrefix = rawKey.replace(/^BRAND_[^_]+_/, '');
  const noGenderPrefix = noBrandPrefix.replace(/^(MEN|WOMEN|UNISEX)_/, '');
  return noGenderPrefix
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

const normalizeMeasurementLabel = (value: string) =>
  value.trim().toLowerCase().replace(/[\s_]+/g, ' ');

const parsePolicySelection = (value: string, options: string[]) =>
  options.includes(value) ? value : POLICY_CUSTOM;

const buildRulesFromJson = (value: string): RuleFormState[] => {
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error('Rules JSON must be an array.');
  }

  return parsed
    .sort((left, right) => Number(left?.priority ?? 0) - Number(right?.priority ?? 0))
    .map((rule) => {
      const rawConditions =
        rule?.conditionsJson && typeof rule.conditionsJson === 'object' && !Array.isArray(rule.conditionsJson)
          ? (rule.conditionsJson as Record<string, unknown>)
          : {};

      const conditions = Object.entries(rawConditions).map(([key, value]) => {
        const conditionRecord =
          value && typeof value === 'object' && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : {};

        const minRaw = conditionRecord.min;
        const maxRaw = conditionRecord.max;

        return {
          key,
          min: minRaw == null ? '' : String(minRaw),
          max: maxRaw == null ? '' : String(maxRaw),
        };
      });

      return {
        id: createRuleId(),
        isFallback: Boolean(rule?.isFallback),
        outputYards: String(rule?.outputYards ?? ''),
        conditions,
      };
    });
};

const createDefaultRules = (): RuleFormState[] => buildRulesFromJson(defaultRulesJson);

const applyFallbackYardOutput = (rules: RuleFormState[], outputYards: string): RuleFormState[] =>
  rules.map((rule) => (rule.isFallback ? { ...rule, outputYards } : rule));

const stripYardProfileFromNotes = (rawNotes?: string | null) =>
  String(rawNotes ?? '').replace(/^YARD_PROFILE:[^\n]*(\n\n)?/i, '').trim();

const normalizeRulePayload = (
  rules: RuleFormState[],
): CustomOrderConfigurationUpsertInput['rules'] => {
  if (!Array.isArray(rules) || rules.length === 0) {
    throw new Error('At least one fabric yard rule is required.');
  }

  const fallbackCount = rules.filter((rule) => rule.isFallback).length;
  if (fallbackCount !== 1) {
    throw new Error('Exactly one fallback fabric rule is required.');
  }

  return rules.map((rule, index) => {
    const outputYards = Number(rule.outputYards);
    if (!Number.isFinite(outputYards) || outputYards <= 0) {
      throw new Error(`Rule ${index + 1} must have a positive yard output.`);
    }

    if (!rule.isFallback && rule.conditions.length === 0) {
      throw new Error(`Rule ${index + 1} needs at least one measurement condition or must be fallback.`);
    }

    if (rule.isFallback && rule.conditions.length > 0) {
      throw new Error(`Fallback rule cannot have conditions.`);
    }

    const conditionsJson: Record<string, unknown> = {};

    for (const condition of rule.conditions) {
      const key = condition.key.trim();
      if (!key) {
        throw new Error(`Rule ${index + 1} has an empty measurement condition.`);
      }

      const hasMin = condition.min.trim().length > 0;
      const hasMax = condition.max.trim().length > 0;
      if (!hasMin && !hasMax) {
        throw new Error(`Rule ${index + 1} condition "${formatMeasurementKeyLabel(key)}" needs min, max, or both.`);
      }

      const min = hasMin ? Number(condition.min) : undefined;
      const max = hasMax ? Number(condition.max) : undefined;

      if (hasMin && !Number.isFinite(min)) {
        throw new Error(`Rule ${index + 1} condition "${formatMeasurementKeyLabel(key)}" has invalid min value.`);
      }
      if (hasMax && !Number.isFinite(max)) {
        throw new Error(`Rule ${index + 1} condition "${formatMeasurementKeyLabel(key)}" has invalid max value.`);
      }
      if (min != null && max != null && min > max) {
        throw new Error(`Rule ${index + 1} condition "${formatMeasurementKeyLabel(key)}" has min greater than max.`);
      }

      conditionsJson[key] = {
        ...(min != null ? { min } : {}),
        ...(max != null ? { max } : {}),
      };
    }

    return {
      priority: index + 1,
      conditionsJson,
      outputYards: String(outputYards),
      isFallback: rule.isFallback,
    };
  });
};

const createDefaultForm = (keys: string[]): ConfigurationFormState => ({
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
  deliveryScope: DEFAULT_DELIVERY_SCOPE,
  revisionPolicy: 'One revision after delivery confirmation.',
  returnPolicy: 'Custom orders are not returnable except where required by policy.',
  defectPolicy: 'Defects and material faults are reviewed through support.',
  fabricSourcingMode: 'BRAND_SOURCED',
  notes: '',
  rulesJson: defaultRulesJson,
});

const fieldClassName =
  'w-full rounded-xl border border-black/10 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none transition focus:border-emerald-400 dark:border-white/10 dark:bg-slate-950 dark:text-white';

const requiredFieldLabelClassName =
  'mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';

const infoBadgeClassName =
  'inline-flex h-4 w-4 items-center justify-center rounded-full bg-black/[0.06] text-[10px] leading-none dark:bg-white/[0.1]';

const mapConfigurationToForm = (configuration: CustomOrderConfiguration): ConfigurationFormState => ({
  buyerInstructionText: configuration.buyerInstructionText ?? '',
  requiredMeasurementKeys: configuration.requiredMeasurementKeys,
  fabricRuleBasisId: configuration.fabricRuleBasis?.id ?? '',
  baseProductionCharge: configuration.baseProductionCharge,
  fabricCostPerYard: configuration.fabricCostPerYard,
  rushEnabled: configuration.rushEnabled,
  rushFee: configuration.rushFee ?? '',
  rushProductionLeadDays: configuration.rushProductionLeadDays ? String(configuration.rushProductionLeadDays) : '',
  productionLeadDays: String(configuration.productionLeadDays),
  deliveryMinDays: String(configuration.deliveryMinDays),
  deliveryMaxDays: String(configuration.deliveryMaxDays),
  deliveryScope: configuration.deliveryScope,
  revisionPolicy: configuration.revisionPolicy,
  returnPolicy: configuration.returnPolicy,
  defectPolicy: configuration.defectPolicy,
  fabricSourcingMode: configuration.fabricSourcingMode as ConfigurationFormState['fabricSourcingMode'],
  notes: stripYardProfileFromNotes(configuration.notes),
  rulesJson: JSON.stringify(
    configuration.rules.map((rule) => ({
      priority: rule.priority,
      conditionsJson: rule.conditionsJson,
      outputYards: rule.outputYards,
      isFallback: rule.isFallback,
    })),
    null,
    2,
  ),
});

const CustomOrderConfigurationEditor: React.FC<CustomOrderConfigurationEditorProps> = ({
  sourceType,
  sourceId,
  measurementKeys,
  measurementGender,
  disabled = false,
}) => {
  const [brandId, setBrandId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configuration, setConfiguration] = useState<CustomOrderConfiguration | null>(null);
  const [bases, setBases] = useState<CustomFabricRuleBasis[]>([]);
  const [form, setForm] = useState<ConfigurationFormState>(() => createDefaultForm(measurementKeys));
  const [basisLabel, setBasisLabel] = useState('');
  const [revisionPolicyPreset, setRevisionPolicyPreset] = useState<string>(() =>
    parsePolicySelection(createDefaultForm(measurementKeys).revisionPolicy, REVISION_POLICY_OPTIONS),
  );
  const [returnPolicyPreset, setReturnPolicyPreset] = useState<string>(() =>
    parsePolicySelection(createDefaultForm(measurementKeys).returnPolicy, RETURN_POLICY_OPTIONS),
  );
  const [defectPolicyPreset, setDefectPolicyPreset] = useState<string>(() =>
    parsePolicySelection(createDefaultForm(measurementKeys).defectPolicy, DEFECT_POLICY_OPTIONS),
  );
  const [ruleRows, setRuleRows] = useState<RuleFormState[]>(() => createDefaultRules());
  const [averageBaseYards, setAverageBaseYards] = useState('');
  const [sizeExtraRows, setSizeExtraRows] = useState<SizeExtraYardFormState[]>([
    { sizeLabel: 'XL', extraYards: '1.5' },
    { sizeLabel: 'XXL', extraYards: '2' },
  ]);
  const [manualMeasurementKeyInput, setManualMeasurementKeyInput] = useState('');

  const measurementFilter = useMemo(
    () => (measurementGender && measurementGender !== 'UNISEX' ? { gender: measurementGender } : undefined),
    [measurementGender],
  );
  const { points: measurementPoints } = useMeasurementPoints(measurementFilter);

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
      setLoading(true);
      try {
        const status = await getStoreStatus();
        const basisPromise = customOrderConfigurationsApi.listFabricRuleBases({ includeBrandOnly: true });
        const existingConfigurationPromise = sourceId
          ? (async () => {
              try {
                if (sourceType === 'PRODUCT') {
                  return await customOrderConfigurationsApi.getActiveForProduct(sourceId);
                }
                return await customOrderConfigurationsApi.getActiveForDesign(sourceId);
              } catch {
                return null;
              }
            })()
          : Promise.resolve(null);

        const [basisList, existingConfiguration] = await Promise.all([
          basisPromise,
          existingConfigurationPromise,
        ]);

        if (!active) return;

        setBases(basisList);
        setBrandId(status.brandId ?? existingConfiguration?.brandId ?? null);
        setConfiguration(existingConfiguration);
        const nextForm = existingConfiguration ? mapConfigurationToForm(existingConfiguration) : createDefaultForm(measurementKeys);
        setForm(nextForm);
        setRuleRows(buildRulesFromJson(nextForm.rulesJson));
        setAverageBaseYards(
          existingConfiguration?.yardProfile?.averageBaseYards != null
            ? String(existingConfiguration.yardProfile.averageBaseYards)
            : '',
        );
        setSizeExtraRows(
          existingConfiguration?.yardProfile?.sizeExtraYards?.length
            ? existingConfiguration.yardProfile.sizeExtraYards.map((row) => ({
                sizeLabel: row.sizeLabel,
                extraYards: String(row.extraYards),
              }))
            : [
                { sizeLabel: 'XL', extraYards: '1.5' },
                { sizeLabel: 'XXL', extraYards: '2' },
              ],
        );
        setRevisionPolicyPreset(parsePolicySelection(nextForm.revisionPolicy, REVISION_POLICY_OPTIONS));
        setReturnPolicyPreset(parsePolicySelection(nextForm.returnPolicy, RETURN_POLICY_OPTIONS));
        setDefectPolicyPreset(parsePolicySelection(nextForm.defectPolicy, DEFECT_POLICY_OPTIONS));
      } catch (error: any) {
        if (!active) return;
        toast.error(error?.response?.data?.message || 'Unable to load custom-order configuration editor');
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

  const measurementPointLabelMap = useMemo(() => {
    const entries = measurementPoints.map((point) => [point.key, point.label] as const);
    return new Map(entries);
  }, [measurementPoints]);

  const availableMeasurementKeys = useMemo(() => {
    const keys: string[] = [];
    const seenKeys = new Set<string>();
    const seenLabels = new Set<string>();

    const pushUnique = (rawKey?: string | null, rawLabel?: string | null) => {
      const key = String(rawKey ?? '').trim().toUpperCase();
      if (!key || seenKeys.has(key)) {
        return;
      }

      const label = normalizeMeasurementLabel(rawLabel || measurementPointLabelMap.get(key) || formatMeasurementKeyLabel(key));
      if (!label || seenLabels.has(label)) {
        return;
      }

      seenKeys.add(key);
      seenLabels.add(label);
      keys.push(key);
    };

    [...measurementPoints]
      .sort((left, right) => (left.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.sortOrder ?? Number.MAX_SAFE_INTEGER))
      .forEach((point) => pushUnique(point.key, point.label));

    measurementKeys.forEach((key) => pushUnique(key));
    form.requiredMeasurementKeys.forEach((key) => pushUnique(key));

    return keys;
  }, [form.requiredMeasurementKeys, measurementKeys, measurementPointLabelMap, measurementPoints]);

  const basisOptions = useMemo(
    () => [
      { value: '', label: 'Select a fabric-rule basis' },
      ...bases.map((basis) => ({ value: basis.id, label: basis.label })),
    ],
    [bases],
  );

  const sourcingModeOptions = useMemo(
    () => [
      { value: 'BRAND_SOURCED', label: 'Brand sourced' },
      { value: 'BUYER_SUPPLIED', label: 'Buyer supplied' },
      { value: 'EITHER', label: 'Either' },
    ],
    [],
  );

  const revisionPolicyOptions = useMemo(
    () => [
      ...REVISION_POLICY_OPTIONS.map((option) => ({ value: option, label: option })),
      { value: POLICY_CUSTOM, label: 'Other (custom)' },
    ],
    [],
  );

  const returnPolicyOptions = useMemo(
    () => [
      ...RETURN_POLICY_OPTIONS.map((option) => ({ value: option, label: option })),
      { value: POLICY_CUSTOM, label: 'Other (custom)' },
    ],
    [],
  );

  const defectPolicyOptions = useMemo(
    () => [
      ...DEFECT_POLICY_OPTIONS.map((option) => ({ value: option, label: option })),
      { value: POLICY_CUSTOM, label: 'Other (custom)' },
    ],
    [],
  );

  const getMeasurementLabel = (key: string) => measurementPointLabelMap.get(key) ?? formatMeasurementKeyLabel(key);

  const addRuleRow = () => {
    const conditionKey = form.requiredMeasurementKeys[0];
    setRuleRows((current) => [
      ...current,
      {
        id: createRuleId(),
        isFallback: false,
        outputYards: '',
        conditions: conditionKey
          ? [{ key: conditionKey, min: '', max: '' }]
          : [],
      },
    ]);
  };

  const removeRuleRow = (ruleId: string) => {
    setRuleRows((current) => {
      if (current.length === 1) {
        toast.error('At least one rule is required.');
        return current;
      }
      return current.filter((rule) => rule.id !== ruleId);
    });
  };

  const updateRuleRow = (ruleId: string, update: Partial<RuleFormState>) => {
    setRuleRows((current) =>
      current.map((rule) => {
        if (rule.id !== ruleId) {
          return update.isFallback ? { ...rule, isFallback: false } : rule;
        }

        const next = { ...rule, ...update };
        if (next.isFallback) {
          next.conditions = [];
        }
        return next;
      }),
    );
  };

  const addRuleCondition = (ruleId: string) => {
    const conditionKey = form.requiredMeasurementKeys[0];
    if (!conditionKey) {
      toast.error('Select at least one required measurement key first.');
      return;
    }

    setRuleRows((current) =>
      current.map((rule) =>
        rule.id === ruleId
          ? {
              ...rule,
              conditions: [...rule.conditions, { key: conditionKey, min: '', max: '' }],
            }
          : rule,
      ),
    );
  };

  const addManualMeasurementKey = () => {
    const normalized = manualMeasurementKeyInput
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');

    if (!normalized) {
      return;
    }

    if (form.requiredMeasurementKeys.includes(normalized)) {
      toast.error('Measurement key already selected.');
      return;
    }

    updateForm('requiredMeasurementKeys', [...form.requiredMeasurementKeys, normalized]);
    setManualMeasurementKeyInput('');
  };

  const updateRuleCondition = (
    ruleId: string,
    conditionIndex: number,
    update: Partial<RuleConditionForm>,
  ) => {
    setRuleRows((current) =>
      current.map((rule) => {
        if (rule.id !== ruleId) {
          return rule;
        }

        return {
          ...rule,
          conditions: rule.conditions.map((condition, index) =>
            index === conditionIndex ? { ...condition, ...update } : condition,
          ),
        };
      }),
    );
  };

  const removeRuleCondition = (ruleId: string, conditionIndex: number) => {
    setRuleRows((current) =>
      current.map((rule) => {
        if (rule.id !== ruleId) {
          return rule;
        }
        return {
          ...rule,
          conditions: rule.conditions.filter((_, index) => index !== conditionIndex),
        };
      }),
    );
  };

  const updateForm = <K extends keyof ConfigurationFormState>(key: K, value: ConfigurationFormState[K]) => {
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
      const created = await customOrderConfigurationsApi.createFabricRuleBasis(payload);
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

  const handleSaveConfiguration = async () => {
    if (!sourceId) {
      toast.error('Save the product or design first, then configure its custom-order configuration.');
      return;
    }
    if (!brandId) {
      toast.error('Brand context is unavailable for this store session.');
      return;
    }

    let rules: CustomOrderConfigurationUpsertInput['rules'];
    try {
      rules = normalizeRulePayload(ruleRows);
    } catch (error: any) {
      toast.error(error?.message || 'Fabric yard rules are invalid.');
      return;
    }

    const payload: CustomOrderConfigurationUpsertInput = {
      sourceType,
      sourceId,
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
      deliveryScope: DEFAULT_DELIVERY_SCOPE,
      revisionPolicy: form.revisionPolicy.trim(),
      returnPolicy: form.returnPolicy.trim(),
      defectPolicy: form.defectPolicy.trim(),
      fabricSourcingMode: form.fabricSourcingMode,
      notes: form.notes.trim() || undefined,
      averageBaseYards: averageBaseYards.trim() ? Number(averageBaseYards) : undefined,
      sizeExtraYards: sizeExtraRows
        .map((row) => ({
          sizeLabel: row.sizeLabel.trim(),
          extraYards: Number(row.extraYards),
        }))
        .filter((row) => row.sizeLabel.length > 0 && Number.isFinite(row.extraYards)) as CustomOrderConfigurationSizeExtraYard[],
      rules,
    };

    if (payload.averageBaseYards != null && (!Number.isFinite(payload.averageBaseYards) || payload.averageBaseYards <= 0)) {
      toast.error('Average base yards must be greater than zero.');
      return;
    }

    if ((payload.sizeExtraYards ?? []).some((row) => !Number.isFinite(row.extraYards) || row.extraYards < 0)) {
      toast.error('Each size extra-yard value must be zero or greater.');
      return;
    }

    const missingRequiredFields: string[] = [];
    if (!payload.baseProductionCharge) missingRequiredFields.push('Base production charge');
    if (!payload.fabricCostPerYard) missingRequiredFields.push('Fabric cost per yard');
    if (!payload.fabricRuleBasisId) missingRequiredFields.push('Fabric-rule basis');
    if (!payload.revisionPolicy) missingRequiredFields.push('Revision policy');
    if (!payload.returnPolicy) missingRequiredFields.push('Return policy');
    if (!payload.defectPolicy) missingRequiredFields.push('Defect policy');
    if (payload.requiredMeasurementKeys.length === 0) missingRequiredFields.push('Required measurement keys');

    if (missingRequiredFields.length > 0) {
      toast.error(`Complete required fields: ${missingRequiredFields.join(', ')}`);
      return;
    }

    setSaving(true);
    try {
      const saved = configuration
        ? await customOrderConfigurationsApi.update(configuration.id, payload)
        : await customOrderConfigurationsApi.create(payload);
      setConfiguration(saved);
      const mapped = mapConfigurationToForm(saved);
      setForm(mapped);
      setRuleRows(buildRulesFromJson(mapped.rulesJson));
      setRevisionPolicyPreset(parsePolicySelection(mapped.revisionPolicy, REVISION_POLICY_OPTIONS));
      setReturnPolicyPreset(parsePolicySelection(mapped.returnPolicy, RETURN_POLICY_OPTIONS));
      setDefectPolicyPreset(parsePolicySelection(mapped.defectPolicy, DEFECT_POLICY_OPTIONS));
      toast.success(configuration ? 'Custom-order configuration updated.' : 'Custom-order configuration created.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to save custom-order configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mx-auto max-w-6xl rounded-3xl border border-black/10 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-600 dark:text-emerald-300">Custom Configuration</div>
          <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">Custom-order configuration setup</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Configure the production charge, yard rules, and customer-facing policies for this {sourceType.toLowerCase()}.
          </p>
        </div>
        <div className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200">
          {configuration ? `Configuration v${configuration.currentVersion}` : 'No configuration yet'}
        </div>
      </div>

      {!sourceId ? (
        <div className="mt-5 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-500/10 dark:text-amber-100">
          {`Save this ${sourceType.toLowerCase()} first. The custom-order configuration attaches to a persisted source id.`}
        </div>
      ) : null}

      {loading ? <div className="mt-5 text-sm text-slate-500 dark:text-slate-400">Loading configuration workspace...</div> : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <label className="block sm:col-span-2 xl:col-span-3">
          <span className={requiredFieldLabelClassName}>
            Buyer instructions
            <span className={infoBadgeClassName} title="Optional guidance shown to buyers before they submit measurements.">i</span>
          </span>
          <textarea value={form.buyerInstructionText} onChange={(event) => updateForm('buyerInstructionText', event.target.value)} disabled={disabled} rows={2} className={fieldClassName} />
        </label>
        <label className="block">
          <span className={requiredFieldLabelClassName}>
            Base production charge <span className="text-rose-500">*</span>
            <span className={infoBadgeClassName} title="Labor and production-only cost. Do not include fabric yard cost here.">i</span>
          </span>
          <input value={form.baseProductionCharge} onChange={(event) => updateForm('baseProductionCharge', event.target.value)} disabled={disabled} className={fieldClassName} placeholder="120000" />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">This is separate from fabric cost per yard. Total preview combines both.</p>
        </label>
        <label className="block">
          <span className={requiredFieldLabelClassName}>
            Fabric cost per yard <span className="text-rose-500">*</span>
            <span className={infoBadgeClassName} title="Cost of fabric per yard used by the rule engine to compute yard component.">i</span>
          </span>
          <input value={form.fabricCostPerYard} onChange={(event) => updateForm('fabricCostPerYard', event.target.value)} disabled={disabled} className={fieldClassName} placeholder="10000" />
        </label>
        <label className="block">
          <span className={requiredFieldLabelClassName}>
            Production lead days <span className="text-rose-500">*</span>
            <span className={infoBadgeClassName} title="Estimated days for production before dispatch.">i</span>
          </span>
          <input value={form.productionLeadDays} onChange={(event) => updateForm('productionLeadDays', event.target.value)} disabled={disabled} className={fieldClassName} />
        </label>
        <label className="block">
          <span className={requiredFieldLabelClassName}>
            Delivery min days <span className="text-rose-500">*</span>
            <span className={infoBadgeClassName} title="Fastest delivery target after dispatch.">i</span>
          </span>
          <input value={form.deliveryMinDays} onChange={(event) => updateForm('deliveryMinDays', event.target.value)} disabled={disabled} className={fieldClassName} />
        </label>
        <label className="block">
          <span className={requiredFieldLabelClassName}>
            Delivery max days <span className="text-rose-500">*</span>
            <span className={infoBadgeClassName} title="Latest delivery target after dispatch.">i</span>
          </span>
          <input value={form.deliveryMaxDays} onChange={(event) => updateForm('deliveryMaxDays', event.target.value)} disabled={disabled} className={fieldClassName} />
        </label>
      </div>

      <div className="mt-3 rounded-2xl border border-black/10 bg-black/[0.03] px-4 py-3 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
        Required fields are marked with <span className="font-semibold text-rose-500">*</span>. Hover each <span className={infoBadgeClassName}>i</span> marker to see what the field is used for.
      </div>

      <div className="mt-4 rounded-2xl border border-black/10 p-3 dark:border-white/10">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          Measurement keys and fabric basis <span className="text-rose-500">*</span>
          <span className={infoBadgeClassName} title="This defines which buyer measurements are mandatory and which sizing basis this yard-rule setup belongs to.">i</span>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          What this section does: choose the exact measurement points buyers must submit, then group them under a reusable fabric-rule basis.
        </p>
        <div className="mt-3 max-h-24 overflow-y-auto rounded-xl border border-black/5 p-2 pr-1 dark:border-white/10">
          <div className="flex flex-wrap gap-1.5">
          {availableMeasurementKeys.length === 0 ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">
              No measurement points are available yet. Add a missing key manually below.
            </div>
          ) : (
            availableMeasurementKeys.map((key) => {
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
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${selected ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200' : 'bg-black/[0.05] text-slate-600 dark:bg-white/[0.06] dark:text-slate-300'}`}
                >
                  {getMeasurementLabel(key)}
                </button>
              );
            })
          )}
          </div>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
          <input
            value={manualMeasurementKeyInput}
            onChange={(event) => setManualMeasurementKeyInput(event.target.value)}
            disabled={disabled}
            className={fieldClassName}
            placeholder="Add missing measurement key (e.g. MEN_NECK_CIRCUMFERENCE)"
          />
          <button
            type="button"
            onClick={addManualMeasurementKey}
            disabled={disabled || !manualMeasurementKeyInput.trim()}
            className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60 dark:border-white/10 dark:text-slate-200"
          >
            Add key
          </button>
        </div>
        {missingMeasurementKeys.length > 0 ? (
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Unselected sizing keys: {missingMeasurementKeys.map((key) => getMeasurementLabel(key)).join(', ')}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <UniversalSelect
            value={form.fabricRuleBasisId}
            onChange={(value) => updateForm('fabricRuleBasisId', String(value))}
            options={basisOptions}
            placeholder="Select a fabric-rule basis"
            disabled={disabled}
            className="w-full"
          />
          <button type="button" onClick={handleCreateBasis} disabled={disabled || saving} className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60 dark:border-white/10 dark:text-white">
            Create basis
          </button>
        </div>
        {bases.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            No basis options yet. Create one after selecting the measurement keys this outfit requires.
          </p>
        ) : null}
        <input value={basisLabel} onChange={(event) => setBasisLabel(event.target.value)} disabled={disabled} placeholder="New basis label" className={`${fieldClassName} mt-3`} />
      </div>

      <details className="mt-4 rounded-2xl border border-black/10 p-3 dark:border-white/10" open>
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          Brand yard setup <span className="text-rose-500">*</span>
          <span className={infoBadgeClassName} title="Set base yard for this outfit and extra yards by computed buyer size.">i</span>
        </summary>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          This section is set by the brand for this product/design.
        </p>

        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Average base yards</span>
            <input
              value={averageBaseYards}
              onChange={(event) => setAverageBaseYards(event.target.value)}
              disabled={disabled}
              className={fieldClassName}
              placeholder="e.g. 2"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (!averageBaseYards.trim()) {
                toast.error('Set average base yards first.');
                return;
              }
              setRuleRows((current) => applyFallbackYardOutput(current, averageBaseYards.trim()));
            }}
            disabled={disabled}
            className="h-fit self-end rounded-full border border-black/10 px-4 py-2 text-xs font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200"
          >
            Use as fallback yard
          </button>
        </div>

        <div className="mt-3 space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Extra yards by computed size</div>
          {sizeExtraRows.map((row, index) => (
            <div key={`size_extra_${index}`} className="grid gap-2 md:grid-cols-[1.2fr_1fr_auto]">
              <input
                value={row.sizeLabel}
                onChange={(event) => {
                  const value = event.target.value;
                  setSizeExtraRows((current) =>
                    current.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, sizeLabel: value } : entry,
                    ),
                  );
                }}
                disabled={disabled}
                className={fieldClassName}
                placeholder="Size label (e.g. XXL, UK 14)"
              />
              <input
                value={row.extraYards}
                onChange={(event) => {
                  const value = event.target.value;
                  setSizeExtraRows((current) =>
                    current.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, extraYards: value } : entry,
                    ),
                  );
                }}
                disabled={disabled}
                className={fieldClassName}
                placeholder="Extra yards"
              />
              <button
                type="button"
                onClick={() => setSizeExtraRows((current) => current.filter((_, entryIndex) => entryIndex !== index))}
                disabled={disabled}
                className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setSizeExtraRows((current) => [...current, { sizeLabel: '', extraYards: '' }])}
            disabled={disabled}
            className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200"
          >
            Add size row
          </button>
        </div>
      </details>

      <details className="mt-4 rounded-2xl border border-black/10 p-3 dark:border-white/10">
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900 dark:text-white">Policies, Rush, and Internal Notes</summary>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <label className="flex items-center gap-3 rounded-2xl border border-black/10 px-4 py-3 text-sm dark:border-white/10">
          <input type="checkbox" checked={form.rushEnabled} onChange={(event) => updateForm('rushEnabled', event.target.checked)} disabled={disabled} />
          <span className="text-slate-700 dark:text-slate-200">Rush ordering enabled</span>
        </label>
        <UniversalSelect
          value={form.fabricSourcingMode}
          onChange={(value) => updateForm('fabricSourcingMode', value as ConfigurationFormState['fabricSourcingMode'])}
          options={sourcingModeOptions}
          disabled={disabled}
          className="w-full"
        />
        {form.rushEnabled ? (
          <>
            <input value={form.rushFee} onChange={(event) => updateForm('rushFee', event.target.value)} disabled={disabled} className={fieldClassName} placeholder="Rush fee" />
            <input value={form.rushProductionLeadDays} onChange={(event) => updateForm('rushProductionLeadDays', event.target.value)} disabled={disabled} className={fieldClassName} placeholder="Rush production lead days" />
          </>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-2">
          <span className={requiredFieldLabelClassName}>
            Revision policy <span className="text-rose-500">*</span>
            <span className={infoBadgeClassName} title="How many revisions the buyer gets and under what timeline.">i</span>
          </span>
          <UniversalSelect
            value={revisionPolicyPreset}
            onChange={(value) => {
              const nextValue = String(value);
              setRevisionPolicyPreset(nextValue);
              if (nextValue !== POLICY_CUSTOM) {
                updateForm('revisionPolicy', nextValue);
              }
            }}
            disabled={disabled}
            options={revisionPolicyOptions}
            className="w-full"
          />
          <textarea value={form.revisionPolicy} onChange={(event) => updateForm('revisionPolicy', event.target.value)} disabled={disabled} rows={2} className={fieldClassName} placeholder="Revision policy details" />
        </div>
        <div className="space-y-2">
          <span className={requiredFieldLabelClassName}>
            Return policy <span className="text-rose-500">*</span>
            <span className={infoBadgeClassName} title="Return/refund expectations for custom orders.">i</span>
          </span>
          <UniversalSelect
            value={returnPolicyPreset}
            onChange={(value) => {
              const nextValue = String(value);
              setReturnPolicyPreset(nextValue);
              if (nextValue !== POLICY_CUSTOM) {
                updateForm('returnPolicy', nextValue);
              }
            }}
            disabled={disabled}
            options={returnPolicyOptions}
            className="w-full"
          />
          <textarea value={form.returnPolicy} onChange={(event) => updateForm('returnPolicy', event.target.value)} disabled={disabled} rows={2} className={fieldClassName} placeholder="Return policy details" />
        </div>
        <div className="space-y-2">
          <span className={requiredFieldLabelClassName}>
            Defect policy <span className="text-rose-500">*</span>
            <span className={infoBadgeClassName} title="How defect reports are handled (repair/remake/refund flow).">i</span>
          </span>
          <UniversalSelect
            value={defectPolicyPreset}
            onChange={(value) => {
              const nextValue = String(value);
              setDefectPolicyPreset(nextValue);
              if (nextValue !== POLICY_CUSTOM) {
                updateForm('defectPolicy', nextValue);
              }
            }}
            disabled={disabled}
            options={defectPolicyOptions}
            className="w-full"
          />
          <textarea value={form.defectPolicy} onChange={(event) => updateForm('defectPolicy', event.target.value)} disabled={disabled} rows={2} className={fieldClassName} placeholder="Defect policy details" />
        </div>
        <textarea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} disabled={disabled} rows={2} className={fieldClassName} placeholder="Internal notes" />
      </div>
      </details>

      <details className="mt-4 rounded-2xl border border-black/10 p-3 dark:border-white/10">
        <summary className="mb-2 flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          Fabric yard rules builder <span className="text-rose-500">*</span>
          <span className={infoBadgeClassName} title="Each rule maps buyer measurements to required fabric yards. Fallback is used when no condition rule matches.">i</span>
        </summary>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          Example: Waist 1-3 and Height 4-5 can output 1 yard. Configure rules below instead of editing raw JSON.
        </p>

        <div className="space-y-3">
          {ruleRows.map((rule, ruleIndex) => (
            <div key={rule.id} className="rounded-2xl border border-black/10 p-3 dark:border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Rule {ruleIndex + 1}</div>
                <button
                  type="button"
                  onClick={() => removeRuleRow(rule.id)}
                  disabled={disabled}
                  className="rounded-full border border-black/10 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-60 dark:border-white/10 dark:text-slate-200"
                >
                  Remove rule
                </button>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Output yards</span>
                  <input
                    value={rule.outputYards}
                    onChange={(event) => updateRuleRow(rule.id, { outputYards: event.target.value })}
                    disabled={disabled}
                    className={fieldClassName}
                    placeholder="4"
                  />
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-black/10 px-4 py-3 text-sm dark:border-white/10">
                  <input
                    type="checkbox"
                    checked={rule.isFallback}
                    onChange={(event) => updateRuleRow(rule.id, { isFallback: event.target.checked })}
                    disabled={disabled}
                  />
                  <span className="text-slate-700 dark:text-slate-200">Fallback rule</span>
                </label>
              </div>

              {!rule.isFallback ? (
                <div className="mt-3 rounded-xl border border-black/10 p-3 dark:border-white/10">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Conditions</div>
                  {rule.conditions.length === 0 ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400">No conditions yet. Add one below.</div>
                  ) : (
                    <div className="space-y-2">
                      {rule.conditions.map((condition, conditionIndex) => (
                        <div key={`${rule.id}_${conditionIndex}`} className="grid gap-2 md:grid-cols-[1.4fr_1fr_1fr_auto]">
                          <UniversalSelect
                            value={condition.key}
                            onChange={(value) => updateRuleCondition(rule.id, conditionIndex, { key: String(value) })}
                            disabled={disabled}
                            options={form.requiredMeasurementKeys.map((key) => ({ value: key, label: getMeasurementLabel(key) }))}
                            className="w-full"
                          />
                          <input
                            value={condition.min}
                            onChange={(event) => updateRuleCondition(rule.id, conditionIndex, { min: event.target.value })}
                            disabled={disabled}
                            className={fieldClassName}
                            placeholder="Min"
                          />
                          <input
                            value={condition.max}
                            onChange={(event) => updateRuleCondition(rule.id, conditionIndex, { max: event.target.value })}
                            disabled={disabled}
                            className={fieldClassName}
                            placeholder="Max"
                          />
                          <button
                            type="button"
                            onClick={() => removeRuleCondition(rule.id, conditionIndex)}
                            disabled={disabled}
                            className="rounded-full border border-black/10 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60 dark:border-white/10 dark:text-slate-200"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => addRuleCondition(rule.id)}
                    disabled={disabled}
                    className="mt-3 rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60 dark:border-white/10 dark:text-slate-200"
                  >
                    Add condition
                  </button>
                </div>
              ) : (
                <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">Fallback rule must have no conditions and is used when no other rule matches.</div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addRuleRow}
            disabled={disabled}
            className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60 dark:border-white/10 dark:text-white"
          >
            Add yard rule
          </button>
        </div>
      </details>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Save creates or updates the immutable custom-order configuration configuration for this source.
        </div>
        <button type="button" onClick={handleSaveConfiguration} disabled={disabled || saving || !sourceId} className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-60">
          {saving ? 'Saving configuration...' : configuration ? 'Update configuration' : 'Create configuration'}
        </button>
      </div>
    </section>
  );
};

export default CustomOrderConfigurationEditor;