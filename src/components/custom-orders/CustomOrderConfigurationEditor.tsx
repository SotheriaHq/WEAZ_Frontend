import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
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
  sourceTitle?: string;
  measurementKeys: string[];
  measurementGender?: 'MEN' | 'WOMEN' | 'UNISEX';
  defaultBaseCharge?: string | number | null;
  defaultProductionLeadDays?: string | number | null;
  defaultProductionLeadLabel?: string | null;
  disabled?: boolean;
  onRequiredMeasurementKeysChange?: (keys: string[]) => void;
}

export interface CustomOrderConfigurationEditorHandle {
  saveConfiguration: (options?: { silentSuccess?: boolean }) => Promise<boolean>;
  buildConfigurationDraft: () => Omit<CustomOrderConfigurationUpsertInput, 'sourceId'> | null;
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

const ENABLE_LEGACY_YARD_SETUP_PANEL = false;

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

type FieldErrors = Partial<Record<
  | 'buyerInstructionText'
  | 'requiredMeasurementKeys'
  | 'fabricRuleBasisId'
  | 'baseProductionCharge'
  | 'fabricCostPerYard'
  | 'productionLeadDays'
  | 'deliveryMinDays'
  | 'deliveryMaxDays'
  | 'revisionPolicy'
  | 'returnPolicy'
  | 'defectPolicy'
  | 'rushFee'
  | 'rushProductionLeadDays',
  string
>>;

const REQUIRED_FIELDS_SUMMARY = 'Some required fields need attention.';
const MEASUREMENT_REGISTRY_EMPTY_MESSAGE =
  'No measurement points are available. Run the measurement registry seed or contact an admin.';
const MEASUREMENT_REGISTRY_LOAD_ERROR_MESSAGE =
  'Measurement points could not load. Try again or contact an admin.';

const FIELD_ERROR_FOCUS_ORDER: Array<keyof FieldErrors> = [
  'buyerInstructionText',
  'baseProductionCharge',
  'fabricCostPerYard',
  'productionLeadDays',
  'deliveryMinDays',
  'deliveryMaxDays',
  'requiredMeasurementKeys',
  'fabricRuleBasisId',
  'rushFee',
  'rushProductionLeadDays',
  'revisionPolicy',
  'returnPolicy',
  'defectPolicy',
];

const FIELD_ERRORS_BY_FORM_KEY: Partial<
  Record<keyof ConfigurationFormState, Array<keyof FieldErrors>>
> = {
  buyerInstructionText: ['buyerInstructionText'],
  requiredMeasurementKeys: ['requiredMeasurementKeys', 'fabricRuleBasisId'],
  fabricRuleBasisId: ['fabricRuleBasisId'],
  baseProductionCharge: ['baseProductionCharge'],
  fabricCostPerYard: ['fabricCostPerYard'],
  productionLeadDays: ['productionLeadDays', 'rushProductionLeadDays'],
  deliveryMinDays: ['deliveryMinDays'],
  deliveryMaxDays: ['deliveryMaxDays'],
  revisionPolicy: ['revisionPolicy'],
  returnPolicy: ['returnPolicy'],
  defectPolicy: ['defectPolicy'],
  rushFee: ['rushFee'],
  rushProductionLeadDays: ['rushProductionLeadDays'],
  rushEnabled: ['rushFee', 'rushProductionLeadDays'],
};

const createRuleId = () =>
  `rule_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const stripMeasurementGenderPrefix = (value: string) =>
  value
    .trim()
    .replace(/^BRAND[_\-\s]+[^_\-\s]+[_\-\s]+/i, '')
    .replace(/^(MEN|WOMEN|WOMAN|UNISEX)[_\-\s]+/i, '');

const formatMeasurementKeyLabel = (rawKey: string) => {
  const noGenderPrefix = stripMeasurementGenderPrefix(rawKey);
  return noGenderPrefix
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

const normalizeMeasurementDisplayLabel = (rawLabel: string) =>
  stripMeasurementGenderPrefix(rawLabel)
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

const normalizeMeasurementLabel = (value: string) =>
  value.trim().toLowerCase().replace(/[\s_]+/g, ' ');

const normalizeMeasurementKeyList = (keys: string[]) =>
  Array.from(
    new Set(
      keys
        .map((key) => String(key ?? '').trim().toUpperCase())
        .filter(Boolean),
    ),
  );

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

const createDefaultForm = (
  defaultProductionLeadDays?: string | number | null,
): ConfigurationFormState => ({
  buyerInstructionText: '',
  requiredMeasurementKeys: [],
  fabricRuleBasisId: '',
  baseProductionCharge: '',
  fabricCostPerYard: '',
  rushEnabled: false,
  rushFee: '',
  rushProductionLeadDays: '',
  productionLeadDays: String(defaultProductionLeadDays ?? '').trim() || '7',
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

const KEY_CHIP_PREVIEW_LIMIT = 14;

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

const CustomOrderConfigurationEditor = forwardRef<CustomOrderConfigurationEditorHandle, CustomOrderConfigurationEditorProps>(({ 
  sourceType,
  sourceId,
  sourceTitle,
  measurementKeys,
  measurementGender,
  defaultBaseCharge,
  defaultProductionLeadDays,
  defaultProductionLeadLabel,
  disabled = false,
  onRequiredMeasurementKeysChange,
}, ref) => {
  const [brandId, setBrandId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [configuration, setConfiguration] = useState<CustomOrderConfiguration | null>(null);
  const [bases, setBases] = useState<CustomFabricRuleBasis[]>([]);
  const [form, setForm] = useState<ConfigurationFormState>(() => createDefaultForm());
  const [basisLabel, setBasisLabel] = useState('');
  const [revisionPolicyPreset, setRevisionPolicyPreset] = useState<string>(() =>
    parsePolicySelection(createDefaultForm().revisionPolicy, REVISION_POLICY_OPTIONS),
  );
  const [returnPolicyPreset, setReturnPolicyPreset] = useState<string>(() =>
    parsePolicySelection(createDefaultForm().returnPolicy, RETURN_POLICY_OPTIONS),
  );
  const [defectPolicyPreset, setDefectPolicyPreset] = useState<string>(() =>
    parsePolicySelection(createDefaultForm().defectPolicy, DEFECT_POLICY_OPTIONS),
  );
  const [ruleRows, setRuleRows] = useState<RuleFormState[]>(() => createDefaultRules());
  const [averageBaseYards, setAverageBaseYards] = useState('');
  const [hasEditedProductionLeadDays, setHasEditedProductionLeadDays] = useState(false);
  const [sizeExtraRows, setSizeExtraRows] = useState<SizeExtraYardFormState[]>([
    { sizeLabel: 'XL', extraYards: '1.5' },
    { sizeLabel: 'XXL', extraYards: '2' },
  ]);
  const [showFabricRules, setShowFabricRules] = useState(false);
  const [manualMeasurementKeyInput, setManualMeasurementKeyInput] = useState('');
  const [hasEditedBaseCharge, setHasEditedBaseCharge] = useState(false);
  const [showAllSelectedKeys, setShowAllSelectedKeys] = useState(false);
  const [showAllPoolKeys, setShowAllPoolKeys] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const containerRef = useRef<HTMLElement | null>(null);
  const fieldErrorRefs = useRef<Partial<Record<keyof FieldErrors, HTMLElement | null>>>({});
  const seededMeasurementKeysSignatureRef = useRef<string>('');

  const normalizedDefaultBaseCharge = useMemo(() => {
    if (defaultBaseCharge == null) {
      return '';
    }
    const parsed = Number(defaultBaseCharge);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return '';
    }
    return String(parsed);
  }, [defaultBaseCharge]);

  const normalizedDefaultProductionLeadDays = useMemo(() => {
    if (defaultProductionLeadDays == null) return '';
    const parsed = Number(defaultProductionLeadDays);
    if (!Number.isFinite(parsed) || parsed <= 0) return '';
    return String(Math.round(parsed));
  }, [defaultProductionLeadDays]);

  const measurementFilter = useMemo(
    () => (measurementGender && measurementGender !== 'UNISEX' ? { gender: measurementGender } : undefined),
    [measurementGender],
  );
  const {
    points: measurementPoints,
    isLoading: isMeasurementPointsLoading,
    error: measurementPointsError,
  } = useMeasurementPoints(measurementFilter);
  const normalizedMeasurementKeys = useMemo(
    () => normalizeMeasurementKeyList(measurementKeys),
    [measurementKeys],
  );
  const looksLikeRegistryWideSeed = useMemo(() => {
    const registryKeys = normalizeMeasurementKeyList(
      measurementPoints.map((point) => point.key),
    );
    const LEGACY_REGISTRY_WIDTH_THRESHOLD = 8;

    return (
      registryKeys.length >= LEGACY_REGISTRY_WIDTH_THRESHOLD &&
      registryKeys.every((key) => normalizedMeasurementKeys.includes(key))
    );
  }, [measurementPoints, normalizedMeasurementKeys]);

  const clearFieldErrors = useCallback((keys: Array<keyof FieldErrors>) => {
    setFieldErrors((current) => {
      let changed = false;
      const next: FieldErrors = { ...current };

      for (const key of keys) {
        if (next[key] == null) {
          continue;
        }
        delete next[key];
        changed = true;
      }

      return changed ? next : current;
    });
  }, []);

  const registerFieldErrorRef = useCallback(
    (key: keyof FieldErrors) => (node: HTMLElement | null) => {
      fieldErrorRefs.current[key] = node;
    },
    [],
  );

  const focusFirstFieldError = useCallback((errors?: FieldErrors) => {
    const firstErrorKey = FIELD_ERROR_FOCUS_ORDER.find((key) =>
      Boolean(errors?.[key]),
    );
    const target = firstErrorKey
      ? fieldErrorRefs.current[firstErrorKey]
      : containerRef.current;

    window.setTimeout(() => {
      if (!target) {
        return;
      }
      if (typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (typeof target.focus === 'function') {
        target.focus({ preventScroll: true });
      }
    }, 0);
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!sourceId) {
        if (!active) return;
        setBrandId(null);
        setConfiguration(null);
        setHasEditedBaseCharge(false);
        setHasEditedProductionLeadDays(false);
        setShowFabricRules(false);
        setFieldErrors({});
        setBases([]);
        const nextForm = createDefaultForm();
        setForm(nextForm);
        setRuleRows(buildRulesFromJson(nextForm.rulesJson));
        setAverageBaseYards('');
        setSizeExtraRows([
          { sizeLabel: 'XL', extraYards: '1.5' },
          { sizeLabel: 'XXL', extraYards: '2' },
        ]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const status = await getStoreStatus();
        const basisPromise = customOrderConfigurationsApi.listFabricRuleBases({ includeBrandOnly: true });
        const existingConfigurationPromise = (async () => {
          if (!sourceId) {
            return null;
          }
          try {
            if (sourceType === 'PRODUCT') {
              return await customOrderConfigurationsApi.getActiveForProduct(sourceId);
            }
            return await customOrderConfigurationsApi.getActiveForDesign(sourceId);
          } catch {
            return null;
          }
        })();

        const [basisList, existingConfiguration] = await Promise.all([
          basisPromise,
          existingConfigurationPromise,
        ]);

        if (!active) return;

        setBases(basisList);
        setBrandId(status.brandId ?? existingConfiguration?.brandId ?? null);
        setConfiguration(existingConfiguration);
        setFieldErrors({});

        if (existingConfiguration) {
          setHasEditedBaseCharge(false);
          setHasEditedProductionLeadDays(false);
          setShowFabricRules(true);
          const nextForm = mapConfigurationToForm(existingConfiguration);
          setForm(nextForm);
          setRuleRows(buildRulesFromJson(nextForm.rulesJson));
          setAverageBaseYards(
            existingConfiguration.yardProfile?.averageBaseYards != null
              ? String(existingConfiguration.yardProfile.averageBaseYards)
              : '',
          );
          setSizeExtraRows(
            existingConfiguration.yardProfile?.sizeExtraYards?.length
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
        } else {
          setHasEditedBaseCharge(false);
          setHasEditedProductionLeadDays(false);
          setShowFabricRules(false);
          setFieldErrors({});
          setAverageBaseYards('');
          setSizeExtraRows([
            { sizeLabel: 'XL', extraYards: '1.5' },
            { sizeLabel: 'XXL', extraYards: '2' },
          ]);
          setForm(createDefaultForm());
          setRuleRows((current) => (current.length > 0 ? current : createDefaultRules()));
        }
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
  }, [sourceId, sourceType]);

  useEffect(() => {
    if (configuration || hasEditedBaseCharge) {
      return;
    }

    setForm((current) => {
      if (!normalizedDefaultBaseCharge) {
        if (current.baseProductionCharge.trim().length > 0) {
          return { ...current, baseProductionCharge: '' };
        }
        return current;
      }

      if (current.baseProductionCharge.trim() === normalizedDefaultBaseCharge) {
        return current;
      }

      return {
        ...current,
        baseProductionCharge: normalizedDefaultBaseCharge,
      };
    });
  }, [configuration, hasEditedBaseCharge, normalizedDefaultBaseCharge]);

  useEffect(() => {
    if (configuration || hasEditedProductionLeadDays || !normalizedDefaultProductionLeadDays) {
      return;
    }

    setForm((current) => {
      if (current.productionLeadDays === normalizedDefaultProductionLeadDays) {
        return current;
      }

      return {
        ...current,
        productionLeadDays: normalizedDefaultProductionLeadDays,
      };
    });
  }, [
    configuration,
    form.productionLeadDays,
    hasEditedProductionLeadDays,
    normalizedDefaultProductionLeadDays,
  ]);

  useEffect(() => {
    if (configuration || !sourceId || !showFabricRules) {
      return;
    }
    if (form.fabricRuleBasisId || bases.length === 0) {
      return;
    }

    setForm((current) => ({
      ...current,
      fabricRuleBasisId: current.fabricRuleBasisId || bases[0].id,
    }));
  }, [bases, configuration, form.fabricRuleBasisId, showFabricRules, sourceId]);

  useEffect(() => {
    if (
      configuration ||
      form.requiredMeasurementKeys.length > 0 ||
      normalizedMeasurementKeys.length === 0 ||
      looksLikeRegistryWideSeed
    ) {
      return;
    }

    const nextSignature = normalizedMeasurementKeys.join('|');
    if (!nextSignature || seededMeasurementKeysSignatureRef.current === nextSignature) {
      return;
    }

    seededMeasurementKeysSignatureRef.current = nextSignature;
    setForm((current) =>
      current.requiredMeasurementKeys.length > 0
        ? current
        : { ...current, requiredMeasurementKeys: normalizedMeasurementKeys },
    );
  }, [configuration, form.requiredMeasurementKeys.length, looksLikeRegistryWideSeed, normalizedMeasurementKeys]);

  useEffect(() => {
    seededMeasurementKeysSignatureRef.current = '';
  }, [configuration?.id, sourceId]);

  const measurementPointLabelMap = useMemo(() => {
    const entries = measurementPoints.map((point) => [
      point.key,
      normalizeMeasurementDisplayLabel(point.label || point.key),
    ] as const);
    return new Map(entries);
  }, [measurementPoints]);

  const measurementPointByKey = useMemo(
    () =>
      new Map(
        measurementPoints.map((point) => [String(point.key ?? '').trim().toUpperCase(), point] as const),
      ),
    [measurementPoints],
  );

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

  const selectedMeasurementKeys = useMemo(
    () =>
      form.requiredMeasurementKeys.filter((key) =>
        availableMeasurementKeys.includes(key),
      ),
    [availableMeasurementKeys, form.requiredMeasurementKeys],
  );

  const normalizedSelectedMeasurementKeys = useMemo(
    () => normalizeMeasurementKeyList(form.requiredMeasurementKeys),
    [form.requiredMeasurementKeys],
  );

  useEffect(() => {
    onRequiredMeasurementKeysChange?.(normalizedSelectedMeasurementKeys);
  }, [normalizedSelectedMeasurementKeys, onRequiredMeasurementKeysChange]);

  const selectableMeasurementKeys = useMemo(
    () =>
      availableMeasurementKeys.filter(
        (key) => !form.requiredMeasurementKeys.includes(key),
      ),
    [availableMeasurementKeys, form.requiredMeasurementKeys],
  );

  const selectedKeysVisible = showAllSelectedKeys
    ? selectedMeasurementKeys
    : selectedMeasurementKeys.slice(0, KEY_CHIP_PREVIEW_LIMIT);
  const selectedKeysHiddenCount = Math.max(
    selectedMeasurementKeys.length - selectedKeysVisible.length,
    0,
  );

  const poolKeysVisible = showAllPoolKeys
    ? selectableMeasurementKeys
    : selectableMeasurementKeys.slice(0, KEY_CHIP_PREVIEW_LIMIT);
  const poolKeysHiddenCount = Math.max(
    selectableMeasurementKeys.length - poolKeysVisible.length,
    0,
  );

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
    setValidationMessage(null);
    const errorsToClear = FIELD_ERRORS_BY_FORM_KEY[key];
    if (errorsToClear?.length) {
      clearFieldErrors(errorsToClear);
    }
    if (key === 'productionLeadDays') {
      setHasEditedProductionLeadDays(true);
    }
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
      setValidationMessage(null);
      setForm((current) => ({ ...current, fabricRuleBasisId: created.id }));
      setShowFabricRules(true);
      toast.success('Fabric-rule basis created.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to create fabric-rule basis');
    } finally {
      setSaving(false);
    }
  };

  const buildConfigurationDraft = useCallback(() => {
    const failDraftValidation = (
      message: string,
      errors?: FieldErrors,
      options?: { showBanner?: boolean },
    ) => {
      setValidationMessage(options?.showBanner === false ? null : message);
      setFieldErrors(errors ?? {});
      focusFirstFieldError(errors);
      toast.error(message);
      return null;
    };

    if (sourceId && !brandId) {
      return failDraftValidation('Brand context is unavailable for this store session.');
    }

    let rules: CustomOrderConfigurationUpsertInput['rules'];
    try {
      rules = normalizeRulePayload(ruleRows);
    } catch (error: any) {
      return failDraftValidation(error?.message || 'Fabric yard rules are invalid.');
    }

    const requiredFreeformPointIds = Array.from(
      new Set(
        form.requiredMeasurementKeys
          .map((key) => measurementPointByKey.get(String(key ?? '').trim().toUpperCase()))
          .filter(
            (point): point is NonNullable<typeof point> =>
              Boolean(point?.id && point.source === 'BRAND_FREEFORM'),
          )
          .map((point) => point.id),
      ),
    );

    const payload: Omit<CustomOrderConfigurationUpsertInput, 'sourceId'> = {
      sourceType,
      buyerInstructionText: form.buyerInstructionText.trim() || undefined,
      requiredMeasurementKeys: form.requiredMeasurementKeys,
      requiredFreeformPointIds,
      ...(form.fabricRuleBasisId.trim()
        ? { fabricRuleBasisId: form.fabricRuleBasisId.trim() }
        : {}),
      baseProductionCharge: form.baseProductionCharge.trim(),
      fabricCostPerYard: form.fabricCostPerYard.trim(),
      rushEnabled: form.rushEnabled,
      rushFee: form.rushEnabled ? form.rushFee.trim() || undefined : undefined,
      rushProductionLeadDays:
        form.rushEnabled && form.rushProductionLeadDays
          ? Number(form.rushProductionLeadDays)
          : undefined,
      productionLeadDays: Number(form.productionLeadDays),
      deliveryMinDays: Number(form.deliveryMinDays),
      deliveryMaxDays: Number(form.deliveryMaxDays),
      deliveryScope: DEFAULT_DELIVERY_SCOPE,
      revisionPolicy: form.revisionPolicy.trim(),
      returnPolicy: form.returnPolicy.trim(),
      defectPolicy: form.defectPolicy.trim(),
      fabricSourcingMode: form.fabricSourcingMode,
      notes: form.notes.trim() || undefined,
      averageBaseYards: averageBaseYards.trim()
        ? Number(averageBaseYards)
        : undefined,
      sizeExtraYards: sizeExtraRows
        .map((row) => ({
          sizeLabel: row.sizeLabel.trim(),
          extraYards: Number(row.extraYards),
        }))
        .filter(
          (row) =>
            row.sizeLabel.length > 0 && Number.isFinite(row.extraYards),
        ) as CustomOrderConfigurationSizeExtraYard[],
      rules,
    };

    if (
      payload.averageBaseYards != null &&
      (!Number.isFinite(payload.averageBaseYards) ||
        payload.averageBaseYards <= 0)
    ) {
      return failDraftValidation('Average base yards must be greater than zero.');
    }

    if (
      (payload.sizeExtraYards ?? []).some(
        (row) => !Number.isFinite(row.extraYards) || row.extraYards < 0,
      )
    ) {
      return failDraftValidation('Each size extra-yard value must be zero or greater.');
    }

    const missingFieldErrors: FieldErrors = {};
    if (!payload.baseProductionCharge) {
      missingFieldErrors.baseProductionCharge = 'Enter the base production charge.';
    }
    if (!payload.fabricCostPerYard) {
      missingFieldErrors.fabricCostPerYard = 'Enter the material cost per yard.';
    }
    if (!form.productionLeadDays.trim()) {
      missingFieldErrors.productionLeadDays = 'Enter the production timeline in days.';
    }
    if (!form.deliveryMinDays.trim()) {
      missingFieldErrors.deliveryMinDays = 'Enter the minimum delivery days.';
    }
    if (!form.deliveryMaxDays.trim()) {
      missingFieldErrors.deliveryMaxDays = 'Enter the maximum delivery days.';
    }
    if (payload.requiredMeasurementKeys.length === 0) {
      missingFieldErrors.requiredMeasurementKeys =
        'Select at least one required measurement point for custom orders.';
    }
    if (showFabricRules && !payload.fabricRuleBasisId) {
      missingFieldErrors.fabricRuleBasisId =
        'Select or create the fabric basis for this custom order.';
    }
    if (!payload.revisionPolicy) {
      missingFieldErrors.revisionPolicy = 'Add the revision policy.';
    }
    if (!payload.returnPolicy) {
      missingFieldErrors.returnPolicy = 'Add the return policy.';
    }
    if (!payload.defectPolicy) {
      missingFieldErrors.defectPolicy = 'Add the defect policy.';
    }
    if (form.rushEnabled) {
      if (!form.rushFee.trim()) {
        missingFieldErrors.rushFee = 'Rush fee is required.';
      }
      if (!form.rushProductionLeadDays.trim()) {
        missingFieldErrors.rushProductionLeadDays =
          'Rush production lead days are required.';
      }
    }

    if (Object.keys(missingFieldErrors).length > 0) {
      return failDraftValidation(REQUIRED_FIELDS_SUMMARY, missingFieldErrors);
    }

    if (form.rushEnabled) {
      const rushFeeValue = Number(form.rushFee);
      if (!Number.isFinite(rushFeeValue) || rushFeeValue <= 0) {
        return failDraftValidation('Rush fee must be a positive number.', {
          rushFee: 'Rush fee must be a positive number.',
        }, { showBanner: false });
      }

      const rushProductionLeadDaysValue = Number(form.rushProductionLeadDays);
      const productionLeadDaysValue = Number(form.productionLeadDays);
      if (
        !Number.isFinite(rushProductionLeadDaysValue) ||
        rushProductionLeadDaysValue < 5
      ) {
        return failDraftValidation('Rush production lead days must be at least 5.', {
          rushProductionLeadDays: 'Rush production lead days must be at least 5.',
        }, { showBanner: false });
      }

      if (
        Number.isFinite(productionLeadDaysValue) &&
        rushProductionLeadDaysValue >= productionLeadDaysValue
      ) {
        return failDraftValidation(
          'Rush production lead time must be shorter than standard production lead time.',
          {
            rushProductionLeadDays:
              'Rush production lead time must be shorter than standard production lead time.',
          },
          { showBanner: false },
        );
      }

      const maxOutputYards = payload.rules.reduce((currentMax, rule) => {
        const yards = Number(rule.outputYards);
        return Number.isFinite(yards) ? Math.max(currentMax, yards) : currentMax;
      }, 0);
      const estimatedPreDeliverySubtotal =
        Number(payload.baseProductionCharge) + maxOutputYards * Number(payload.fabricCostPerYard);
      if (
        estimatedPreDeliverySubtotal > 0 &&
        rushFeeValue > estimatedPreDeliverySubtotal * 0.7
      ) {
        return failDraftValidation(
          'Rush fee cannot exceed 70% of the estimated outfit subtotal before delivery',
          {
            rushFee:
              'Rush fee cannot exceed 70% of the estimated outfit subtotal before delivery',
          },
          { showBanner: false },
        );
      }
    }

    setValidationMessage(null);
    setFieldErrors({});
    return payload;
  }, [
    averageBaseYards,
    brandId,
    focusFirstFieldError,
    measurementPointByKey,
    form,
    showFabricRules,
    ruleRows,
    sizeExtraRows,
    sourceId,
    sourceType,
  ]);

  const handleSaveConfiguration = useCallback(async (options?: { silentSuccess?: boolean }) => {
    if (!sourceId) {
      toast.error('Save the product or design first, then configure its custom-order configuration.');
      return false;
    }
    const draft = buildConfigurationDraft();
    if (!draft) {
      return false;
    }

    let payload: CustomOrderConfigurationUpsertInput = {
      ...draft,
      sourceId,
    };

    const fabricRuleBasisId = String(payload.fabricRuleBasisId ?? '').trim();
    if (!fabricRuleBasisId) {
      try {
        const hiddenBasis = await customOrderConfigurationsApi.createFabricRuleBasis({
          label: `${String(sourceTitle ?? '').trim() || (sourceType === 'PRODUCT' ? 'Product' : 'Design')} fabric rules`,
          measurementKeys: draft.requiredMeasurementKeys,
          gender: measurementGender,
        });
        setBases((current) => [hiddenBasis, ...current]);
        setForm((current) => ({ ...current, fabricRuleBasisId: hiddenBasis.id }));
        payload = {
          ...payload,
          fabricRuleBasisId: hiddenBasis.id,
        };
      } catch (error: any) {
        toast.error(error?.response?.data?.message || 'Unable to prepare fabric-rule basis');
        return false;
      }
    } else if (fabricRuleBasisId !== payload.fabricRuleBasisId) {
      payload = {
        ...payload,
        fabricRuleBasisId,
      };
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
      if (!options?.silentSuccess) {
        toast.success(configuration ? 'Custom-order configuration updated.' : 'Custom-order configuration created.');
      }
      return true;
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to save custom-order configuration');
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    buildConfigurationDraft,
    configuration,
    measurementGender,
    sourceTitle,
    sourceType,
    sourceId,
  ]);

  useImperativeHandle(ref, () => ({
    saveConfiguration: (options?: { silentSuccess?: boolean }) =>
      handleSaveConfiguration(options),
    buildConfigurationDraft: () => buildConfigurationDraft(),
  }), [buildConfigurationDraft, handleSaveConfiguration]);

  const getFieldErrorId = (key: keyof FieldErrors) =>
    `custom-order-${key}-error`;
  const getFieldInputClassName = (key: keyof FieldErrors) =>
    `${fieldClassName} ${fieldErrors[key] ? 'border-rose-400 focus:border-rose-500 dark:border-rose-500/50' : ''}`;
  const renderFieldError = (key: keyof FieldErrors) =>
    fieldErrors[key] ? (
      <p
        id={getFieldErrorId(key)}
        className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-300"
      >
        {fieldErrors[key]}
      </p>
    ) : null;

  return (
    <section
      ref={containerRef}
      className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-primary)]/90 p-2.5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-xs text-slate-600 dark:text-slate-300">
          Configure the production charge and customer-facing policies.
        </p>
        <div className="rounded-full border border-black/10 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-white/10 dark:text-slate-200">
          {configuration ? `Configuration v${configuration.currentVersion}` : 'No config yet'}
        </div>
      </div>

      {validationMessage ? (
        <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-200">
          ⚠️ {validationMessage}
        </div>
      ) : null}

      {!sourceId ? (
        <div className="mt-5 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-4 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-500/10 dark:text-amber-100">
          Save this item first so the custom-order settings can attach to it.
        </div>
      ) : null}

      {loading ? <div className="mt-5 text-sm text-slate-500 dark:text-slate-400">Loading configuration workspace...</div> : null}

      {/* Buyer instructions — full row */}
      <label
        ref={registerFieldErrorRef('buyerInstructionText')}
        tabIndex={-1}
        className="block"
      >
        <span className={requiredFieldLabelClassName}>
          Buyer instructions
          <span className={infoBadgeClassName} title="Optional guidance shown to buyers before they submit measurements.">i</span>
        </span>
        <textarea
          value={form.buyerInstructionText}
          onChange={(event) => updateForm('buyerInstructionText', event.target.value)}
          disabled={disabled}
          rows={1}
          aria-invalid={Boolean(fieldErrors.buyerInstructionText)}
          aria-describedby={fieldErrors.buyerInstructionText ? getFieldErrorId('buyerInstructionText') : undefined}
          className={getFieldInputClassName('buyerInstructionText')}
        />
        {renderFieldError('buyerInstructionText')}
      </label>

      {/* Charges row — two equal columns */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label
          ref={registerFieldErrorRef('baseProductionCharge')}
          tabIndex={-1}
          className="block"
        >
          <span className={requiredFieldLabelClassName}>
            Base charge <span className="text-rose-500">*</span>
            <span className={infoBadgeClassName} title="Labor and production-only cost, excluding fabric yard cost.">i</span>
          </span>
          <input
            value={form.baseProductionCharge}
            onChange={(event) => {
              setHasEditedBaseCharge(true);
              updateForm('baseProductionCharge', event.target.value);
            }}
            disabled={disabled}
            aria-invalid={Boolean(fieldErrors.baseProductionCharge)}
            aria-describedby={fieldErrors.baseProductionCharge ? getFieldErrorId('baseProductionCharge') : undefined}
            className={getFieldInputClassName('baseProductionCharge')}
            placeholder="120000"
          />
          {renderFieldError('baseProductionCharge')}
          {hasEditedBaseCharge &&
            normalizedDefaultBaseCharge &&
            form.baseProductionCharge.trim() !== normalizedDefaultBaseCharge && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                This differs from the product price ({Number(normalizedDefaultBaseCharge).toLocaleString()}).
                The custom order base charge will be independent of the product price.
              </p>
            )}
        </label>
        <label
          ref={registerFieldErrorRef('fabricCostPerYard')}
          tabIndex={-1}
          className="block"
        >
          <span className={requiredFieldLabelClassName}>
            Material cost per yard <span className="text-rose-500">*</span>
            <span className={infoBadgeClassName} title="Estimated material cost used when pricing custom orders.">i</span>
          </span>
          <input
            value={form.fabricCostPerYard}
            onChange={(event) => updateForm('fabricCostPerYard', event.target.value)}
            disabled={disabled}
            aria-invalid={Boolean(fieldErrors.fabricCostPerYard)}
            aria-describedby={fieldErrors.fabricCostPerYard ? getFieldErrorId('fabricCostPerYard') : undefined}
            className={getFieldInputClassName('fabricCostPerYard')}
            placeholder="10000"
          />
          {renderFieldError('fabricCostPerYard')}
        </label>
      </div>

      {/* Days row — three compact columns */}
      <div className="mt-2 grid grid-cols-3 gap-2">
        <label
          ref={registerFieldErrorRef('productionLeadDays')}
          tabIndex={-1}
          className="block"
        >
          <span className={requiredFieldLabelClassName}>
            Lead days <span className="text-rose-500">*</span>
            <span className={infoBadgeClassName} title="Production days before dispatch.">i</span>
          </span>
          <input
            value={form.productionLeadDays}
            onChange={(event) => updateForm('productionLeadDays', event.target.value)}
            disabled={disabled}
            aria-invalid={Boolean(fieldErrors.productionLeadDays)}
            aria-describedby={fieldErrors.productionLeadDays ? getFieldErrorId('productionLeadDays') : undefined}
            className={getFieldInputClassName('productionLeadDays')}
            placeholder="7"
          />
          {renderFieldError('productionLeadDays')}
          {normalizedDefaultProductionLeadDays ? (
            <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
              Default from store setup{defaultProductionLeadLabel ? `: ${defaultProductionLeadLabel}` : ''}. You can override for this item.
            </p>
          ) : null}
        </label>
        <label
          ref={registerFieldErrorRef('deliveryMinDays')}
          tabIndex={-1}
          className="block"
        >
          <span className={requiredFieldLabelClassName}>
            Min delivery <span className="text-rose-500">*</span>
            <span className={infoBadgeClassName} title="Fastest delivery target after dispatch.">i</span>
          </span>
          <input
            value={form.deliveryMinDays}
            onChange={(event) => updateForm('deliveryMinDays', event.target.value)}
            disabled={disabled}
            aria-invalid={Boolean(fieldErrors.deliveryMinDays)}
            aria-describedby={fieldErrors.deliveryMinDays ? getFieldErrorId('deliveryMinDays') : undefined}
            className={getFieldInputClassName('deliveryMinDays')}
            placeholder="3"
          />
          {renderFieldError('deliveryMinDays')}
        </label>
        <label
          ref={registerFieldErrorRef('deliveryMaxDays')}
          tabIndex={-1}
          className="block"
        >
          <span className={requiredFieldLabelClassName}>
            Max delivery <span className="text-rose-500">*</span>
            <span className={infoBadgeClassName} title="Latest delivery target after dispatch.">i</span>
          </span>
          <input
            value={form.deliveryMaxDays}
            onChange={(event) => updateForm('deliveryMaxDays', event.target.value)}
            disabled={disabled}
            aria-invalid={Boolean(fieldErrors.deliveryMaxDays)}
            aria-describedby={fieldErrors.deliveryMaxDays ? getFieldErrorId('deliveryMaxDays') : undefined}
            className={getFieldInputClassName('deliveryMaxDays')}
            placeholder="7"
          />
          {renderFieldError('deliveryMaxDays')}
        </label>
      </div>

      <p className="mt-1.5 text-[10px] text-slate-400 dark:text-slate-500">
        Fields marked <span className="text-rose-500 font-semibold">*</span> are required. Hover <span className={infoBadgeClassName}>i</span> for details.
      </p>

      <div
        ref={registerFieldErrorRef('requiredMeasurementKeys')}
        tabIndex={-1}
        aria-invalid={Boolean(fieldErrors.requiredMeasurementKeys)}
        aria-describedby={fieldErrors.requiredMeasurementKeys ? getFieldErrorId('requiredMeasurementKeys') : undefined}
        className={`mt-4 rounded-2xl border p-3 ${fieldErrors.requiredMeasurementKeys ? 'border-rose-300 bg-rose-50/40 dark:border-rose-500/40 dark:bg-rose-500/10' : 'border-black/10 dark:border-white/10'}`}
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          Measurement points <span className="text-rose-500">*</span>
          <span className={infoBadgeClassName} title="This defines which buyer measurements are mandatory and which sizing basis this yard-rule setup belongs to.">i</span>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Select the measurements buyers must provide for this custom order.
        </p>
        {renderFieldError('requiredMeasurementKeys')}
        {/* Selected keys */}
        <div className="mt-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            In use
            {selectedMeasurementKeys.length > 0 && (
              <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                {selectedMeasurementKeys.length}
              </span>
            )}
          </div>
          <div className="mt-2 min-h-[2.5rem] rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2 dark:border-emerald-300/20 dark:bg-emerald-400/10">
            {selectedMeasurementKeys.length === 0 ? (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Select measurement points below to build this custom order.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {selectedKeysVisible.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      updateForm(
                        'requiredMeasurementKeys',
                        form.requiredMeasurementKeys.filter((entry) => entry !== key),
                      )
                    }
                    disabled={disabled}
                    className="group inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/15 pl-2.5 pr-1.5 py-1 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/25 dark:border-emerald-300/20 dark:text-emerald-200"
                    title="Remove measurement key"
                  >
                    {getMeasurementLabel(key)}
                    <span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] leading-none group-hover:bg-emerald-500/40">×</span>
                  </button>
                ))}
              </div>
            )}

            {selectedMeasurementKeys.length > KEY_CHIP_PREVIEW_LIMIT ? (
              <button
                type="button"
                onClick={() => setShowAllSelectedKeys((current) => !current)}
                disabled={disabled}
                className="mt-2 rounded-full border border-emerald-500/25 px-3 py-1 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-500/20 disabled:opacity-60 dark:border-emerald-300/20 dark:text-emerald-200"
              >
                {showAllSelectedKeys ? 'Show less' : `Show more (${selectedKeysHiddenCount})`}
              </button>
            ) : null}
          </div>
        </div>

        {/* Left in pool */}
        <div className="mt-3 max-h-36 overflow-y-auto rounded-xl border border-black/5 p-2 pr-1 dark:border-white/10">
          <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Left in pool
            {selectableMeasurementKeys.length > 0 && (
              <span className="rounded-full bg-black/[0.06] px-1.5 py-0.5 text-[10px] font-bold tabular-nums dark:bg-white/[0.08]">
                {selectableMeasurementKeys.length}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
          {selectableMeasurementKeys.length === 0 ? (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {isMeasurementPointsLoading
                ? 'Loading measurement points...'
                : measurementPointsError
                  ? MEASUREMENT_REGISTRY_LOAD_ERROR_MESSAGE
                  : availableMeasurementKeys.length === 0
                    ? MEASUREMENT_REGISTRY_EMPTY_MESSAGE
                    : 'All available measurement points are selected.'}
            </div>
          ) : (
            poolKeysVisible.map((key) => {
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    updateForm(
                      'requiredMeasurementKeys',
                      [...form.requiredMeasurementKeys, key],
                    )
                  }
                  disabled={disabled}
                  className="rounded-full bg-black/[0.05] px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-purple-500/10 hover:text-purple-700 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-purple-400/15 dark:hover:text-purple-300"
                >
                  + {getMeasurementLabel(key)}
                </button>
              );
            })
          )}
          </div>

          {selectableMeasurementKeys.length > KEY_CHIP_PREVIEW_LIMIT ? (
            <button
              type="button"
              onClick={() => setShowAllPoolKeys((current) => !current)}
              disabled={disabled}
              className="mt-2 rounded-full border border-black/10 px-3 py-1 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-black/[0.04] disabled:opacity-60 dark:border-white/10 dark:text-slate-200 dark:hover:bg-white/[0.08]"
            >
              {showAllPoolKeys ? 'Show less' : `Show more (${poolKeysHiddenCount})`}
            </button>
          ) : null}
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
          <input
            value={manualMeasurementKeyInput}
            onChange={(event) => setManualMeasurementKeyInput(event.target.value)}
            disabled={disabled}
            className={fieldClassName}
            placeholder="Add missing measurement key"
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

        <div className="mt-4 rounded-xl border border-black/10 p-3 dark:border-white/10">
          <label className={`flex cursor-pointer items-center justify-between gap-4 rounded-lg px-3 py-2 transition-colors ${showFabricRules ? 'bg-purple-50/70 dark:bg-purple-500/10' : 'bg-slate-50 dark:bg-white/5'}`}>
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">Add fabric rules</p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Reveal the fabric-rule basis and yard-rule builder only when you need measurement-based pricing.
              </p>
            </div>
            <div className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 ${showFabricRules ? 'bg-purple-600' : 'bg-slate-300 dark:bg-white/20'}`}>
              <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${showFabricRules ? 'translate-x-5' : 'translate-x-0'}`} />
              <input
                type="checkbox"
                className="sr-only"
                aria-label="Add fabric rules"
                checked={showFabricRules}
                onChange={(event) => setShowFabricRules(event.target.checked)}
                disabled={disabled}
              />
            </div>
          </label>
        </div>

        {showFabricRules ? (
          <div
            ref={registerFieldErrorRef('fabricRuleBasisId')}
            tabIndex={-1}
            className="mt-4 space-y-2"
          >
            <div
              className={`grid gap-3 ${fieldErrors.fabricRuleBasisId ? 'rounded-xl border border-rose-300 bg-rose-50/40 p-3 dark:border-rose-500/40 dark:bg-rose-500/10' : ''}`}
            >
              <UniversalSelect
                value={form.fabricRuleBasisId}
                onChange={(value) => updateForm('fabricRuleBasisId', String(value))}
                options={basisOptions}
                placeholder="Select a fabric-rule basis"
                disabled={disabled}
                className="w-full"
              />
              {renderFieldError('fabricRuleBasisId')}
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <input
                  value={basisLabel}
                  onChange={(event) => setBasisLabel(event.target.value)}
                  disabled={disabled || saving}
                  className={fieldClassName}
                  placeholder="New fabric-rule basis label (e.g. Ankara Kaftan Base)"
                />
                <button
                  type="button"
                  onClick={handleCreateBasis}
                  disabled={disabled || saving}
                  className="rounded-full border border-black/10 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60 dark:border-white/10 dark:text-white"
                >
                  Create basis
                </button>
              </div>
            </div>
            {!bases.length ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No fabric-rule basis exists yet. Create one after selecting the measurement keys this source requires.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {ENABLE_LEGACY_YARD_SETUP_PANEL ? (
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
      ) : null}

      <details className="mt-4 overflow-hidden rounded-2xl border border-black/10 dark:border-white/10">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors">
          <span>Policies, Rush &amp; Notes</span>
          <span className="text-xs font-normal text-slate-400">click to expand</span>
        </summary>

        <div className="space-y-5 border-t border-black/10 p-4 dark:border-white/10">

          {/* ── Row 1: Rush toggle + Fabric sourcing ── */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Rush toggle card */}
            <label className={`flex cursor-pointer items-center justify-between gap-4 rounded-xl px-4 py-3 transition-colors ${form.rushEnabled ? 'bg-emerald-50/80 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800' : 'bg-slate-50 border border-black/10 dark:bg-white/5 dark:border-white/10'}`}>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-white">⚡ Rush ordering</p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Allow buyers to request rush production</p>
              </div>
              <div className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 ${form.rushEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/20'}`}>
                <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.rushEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                <input
                  type="checkbox"
                  className="sr-only"
                  aria-label="Rush ordering enabled"
                  checked={form.rushEnabled}
                  onChange={(event) => updateForm('rushEnabled', event.target.checked)}
                  disabled={disabled}
                />
              </div>
            </label>

            {/* Fabric sourcing */}
            <div className="space-y-1.5">
              <span className={requiredFieldLabelClassName}>
                Fabric sourcing
                <span className={infoBadgeClassName} title="Who supplies the fabric for the custom order.">i</span>
              </span>
              <UniversalSelect
                value={form.fabricSourcingMode}
                onChange={(value) => updateForm('fabricSourcingMode', value as ConfigurationFormState['fabricSourcingMode'])}
                options={sourcingModeOptions}
                disabled={disabled}
                className="w-full"
              />
            </div>
          </div>

          {/* ── Row 2: Rush fields (conditional) ── */}
          {form.rushEnabled ? (
            <div className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-800 dark:bg-emerald-950/20 sm:grid-cols-2">
              <label
                ref={registerFieldErrorRef('rushFee')}
                tabIndex={-1}
                className="space-y-1.5"
              >
                <span className={requiredFieldLabelClassName}>
                  Rush fee <span className="text-rose-500">*</span>
                  <span className={infoBadgeClassName} title="Extra amount charged when the buyer selects rush production.">i</span>
                </span>
                <input
                  value={form.rushFee}
                  onChange={(event) => updateForm('rushFee', event.target.value)}
                  disabled={disabled}
                  aria-invalid={Boolean(fieldErrors.rushFee)}
                  aria-describedby={fieldErrors.rushFee ? getFieldErrorId('rushFee') : undefined}
                  className={getFieldInputClassName('rushFee')}
                  placeholder="e.g. 5000"
                  inputMode="decimal"
                />
                {renderFieldError('rushFee')}
              </label>
              <label
                ref={registerFieldErrorRef('rushProductionLeadDays')}
                tabIndex={-1}
                className="space-y-1.5"
              >
                <span className={requiredFieldLabelClassName}>
                  Rush lead days <span className="text-rose-500">*</span>
                  <span className={infoBadgeClassName} title="Must be shorter than the standard lead time and at least 5 days.">i</span>
                </span>
                <input
                  value={form.rushProductionLeadDays}
                  onChange={(event) => updateForm('rushProductionLeadDays', event.target.value)}
                  disabled={disabled}
                  aria-invalid={Boolean(fieldErrors.rushProductionLeadDays)}
                  aria-describedby={fieldErrors.rushProductionLeadDays ? getFieldErrorId('rushProductionLeadDays') : undefined}
                  className={getFieldInputClassName('rushProductionLeadDays')}
                  placeholder="e.g. 5"
                  inputMode="numeric"
                />
                {renderFieldError('rushProductionLeadDays')}
              </label>
            </div>
          ) : null}

          {/* ── Row 3: Policy cards ── */}
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Revision policy */}
            <div
              ref={registerFieldErrorRef('revisionPolicy')}
              tabIndex={-1}
              className={`space-y-1.5 rounded-xl border p-3 ${fieldErrors.revisionPolicy ? 'border-rose-300 bg-rose-50/40 dark:border-rose-500/40 dark:bg-rose-500/10' : 'border-black/10 dark:border-white/10'}`}
            >
              <span className={requiredFieldLabelClassName}>
                Revision <span className="text-rose-500">*</span>
                <span className={infoBadgeClassName} title="How many revisions the buyer gets and under what timeline.">i</span>
              </span>
              <UniversalSelect
                value={revisionPolicyPreset}
                onChange={(value) => {
                  const nextValue = String(value);
                  setRevisionPolicyPreset(nextValue);
                  if (nextValue !== POLICY_CUSTOM) updateForm('revisionPolicy', nextValue);
                }}
                disabled={disabled}
                options={revisionPolicyOptions}
                optionAllowWrap
                className="w-full"
              />
              <textarea
                value={form.revisionPolicy}
                onChange={(event) => updateForm('revisionPolicy', event.target.value)}
                disabled={disabled}
                rows={2}
                aria-invalid={Boolean(fieldErrors.revisionPolicy)}
                aria-describedby={fieldErrors.revisionPolicy ? getFieldErrorId('revisionPolicy') : undefined}
                className={getFieldInputClassName('revisionPolicy')}
                placeholder="Revision policy details"
              />
              {renderFieldError('revisionPolicy')}
            </div>

            {/* Return policy */}
            <div
              ref={registerFieldErrorRef('returnPolicy')}
              tabIndex={-1}
              className={`space-y-1.5 rounded-xl border p-3 ${fieldErrors.returnPolicy ? 'border-rose-300 bg-rose-50/40 dark:border-rose-500/40 dark:bg-rose-500/10' : 'border-black/10 dark:border-white/10'}`}
            >
              <span className={requiredFieldLabelClassName}>
                Returns <span className="text-rose-500">*</span>
                <span className={infoBadgeClassName} title="Return/refund expectations for custom orders.">i</span>
              </span>
              <UniversalSelect
                value={returnPolicyPreset}
                onChange={(value) => {
                  const nextValue = String(value);
                  setReturnPolicyPreset(nextValue);
                  if (nextValue !== POLICY_CUSTOM) updateForm('returnPolicy', nextValue);
                }}
                disabled={disabled}
                options={returnPolicyOptions}
                optionAllowWrap
                className="w-full"
              />
              <textarea
                value={form.returnPolicy}
                onChange={(event) => updateForm('returnPolicy', event.target.value)}
                disabled={disabled}
                rows={2}
                aria-invalid={Boolean(fieldErrors.returnPolicy)}
                aria-describedby={fieldErrors.returnPolicy ? getFieldErrorId('returnPolicy') : undefined}
                className={getFieldInputClassName('returnPolicy')}
                placeholder="Return policy details"
              />
              {renderFieldError('returnPolicy')}
            </div>

            {/* Defect policy */}
            <div
              ref={registerFieldErrorRef('defectPolicy')}
              tabIndex={-1}
              className={`space-y-1.5 rounded-xl border p-3 ${fieldErrors.defectPolicy ? 'border-rose-300 bg-rose-50/40 dark:border-rose-500/40 dark:bg-rose-500/10' : 'border-black/10 dark:border-white/10'}`}
            >
              <span className={requiredFieldLabelClassName}>
                Defects <span className="text-rose-500">*</span>
                <span className={infoBadgeClassName} title="How defect reports are handled (repair/remake/refund flow).">i</span>
              </span>
              <UniversalSelect
                value={defectPolicyPreset}
                onChange={(value) => {
                  const nextValue = String(value);
                  setDefectPolicyPreset(nextValue);
                  if (nextValue !== POLICY_CUSTOM) updateForm('defectPolicy', nextValue);
                }}
                disabled={disabled}
                options={defectPolicyOptions}
                optionAllowWrap
                className="w-full"
              />
              <textarea
                value={form.defectPolicy}
                onChange={(event) => updateForm('defectPolicy', event.target.value)}
                disabled={disabled}
                rows={2}
                aria-invalid={Boolean(fieldErrors.defectPolicy)}
                aria-describedby={fieldErrors.defectPolicy ? getFieldErrorId('defectPolicy') : undefined}
                className={getFieldInputClassName('defectPolicy')}
                placeholder="Defect policy details"
              />
              {renderFieldError('defectPolicy')}
            </div>
          </div>

          {/* ── Internal notes ── */}
          <div className="space-y-1.5">
            <span className={requiredFieldLabelClassName}>Internal notes (private)</span>
            <textarea
              value={form.notes}
              onChange={(event) => updateForm('notes', event.target.value)}
              disabled={disabled}
              rows={2}
              className={fieldClassName}
              placeholder="Notes visible only to you — order context, reminders, etc."
            />
          </div>

        </div>
      </details>

      {showFabricRules ? (
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
      ) : null}

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        Custom-order configuration is saved automatically when you publish updates.
      </p>
    </section>
  );
});

CustomOrderConfigurationEditor.displayName = 'CustomOrderConfigurationEditor';

export default CustomOrderConfigurationEditor;
