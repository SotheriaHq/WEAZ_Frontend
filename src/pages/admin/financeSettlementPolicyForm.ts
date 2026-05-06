import type { AdminSettlementPolicy } from '@/types/admin';

export type SettlementPolicyFormValues = {
  orderType: 'STANDARD_ORDER' | 'CUSTOM_ORDER';
  scope: 'PLATFORM' | 'BRAND';
  brandId: string;
  currency: string;
  releaseMode: 'HOLD_UNTIL_DELIVERY' | 'SPLIT_RELEASE';
  upfrontReleaseEnabled: boolean;
  upfrontReleasePercent: string;
  settlementDelayHours: string;
  autoReleaseDays: string;
  finalReleaseTrigger:
    | 'BUYER_DELIVERY_CONFIRMED'
    | 'AUTO_AFTER_DELIVERY'
    | 'ADMIN_APPROVED';
  isDefault: boolean;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo: string;
};

export type SettlementPolicyFormErrors = Partial<
  Record<
    | 'brandId'
    | 'currency'
    | 'upfrontReleasePercent'
    | 'settlementDelayHours'
    | 'autoReleaseDays'
    | 'effectiveFrom'
    | 'effectiveTo',
    string
  >
>;

export const SETTLEMENT_ORDER_TYPE_OPTIONS = [
  { value: 'STANDARD_ORDER', label: 'Standard order' },
  { value: 'CUSTOM_ORDER', label: 'Custom order' },
] as const;

export const SETTLEMENT_SCOPE_OPTIONS = [
  { value: 'PLATFORM', label: 'Platform' },
  { value: 'BRAND', label: 'Brand-specific' },
] as const;

export const SETTLEMENT_RELEASE_MODE_OPTIONS = [
  { value: 'HOLD_UNTIL_DELIVERY', label: 'Hold until delivery' },
  { value: 'SPLIT_RELEASE', label: 'Split release' },
] as const;

export const SETTLEMENT_TRIGGER_OPTIONS = [
  { value: 'BUYER_DELIVERY_CONFIRMED', label: 'Buyer delivery confirmed' },
  { value: 'AUTO_AFTER_DELIVERY', label: 'Auto after delivery window' },
  { value: 'ADMIN_APPROVED', label: 'Admin approved' },
] as const;

const toDateInputValue = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const createEmptySettlementPolicyForm =
  (): SettlementPolicyFormValues => ({
    orderType: 'STANDARD_ORDER',
    scope: 'PLATFORM',
    brandId: '',
    currency: 'NGN',
    releaseMode: 'HOLD_UNTIL_DELIVERY',
    upfrontReleaseEnabled: false,
    upfrontReleasePercent: '0',
    settlementDelayHours: '48',
    autoReleaseDays: '7',
    finalReleaseTrigger: 'BUYER_DELIVERY_CONFIRMED',
    isDefault: false,
    isActive: true,
    effectiveFrom: toDateInputValue(new Date().toISOString()),
    effectiveTo: '',
  });

export const toSettlementPolicyFormValues = (
  policy: AdminSettlementPolicy,
): SettlementPolicyFormValues => ({
  orderType: policy.orderType,
  scope: policy.scope,
  brandId: policy.brandId ?? '',
  currency: policy.currency ?? '',
  releaseMode: policy.releaseMode,
  upfrontReleaseEnabled: Boolean(policy.upfrontReleaseEnabled),
  upfrontReleasePercent: String(policy.upfrontReleasePercent ?? 0),
  settlementDelayHours: String(policy.settlementDelayHours ?? 0),
  autoReleaseDays: String(policy.autoReleaseDays ?? 0),
  finalReleaseTrigger: policy.finalReleaseTrigger as SettlementPolicyFormValues['finalReleaseTrigger'],
  isDefault: Boolean(policy.isDefault),
  isActive: Boolean(policy.isActive),
  effectiveFrom: toDateInputValue(policy.effectiveFrom),
  effectiveTo: toDateInputValue(policy.effectiveTo),
});

export const normalizeSettlementPolicyFormValues = (
  values: SettlementPolicyFormValues,
): SettlementPolicyFormValues => {
  if (values.releaseMode === 'HOLD_UNTIL_DELIVERY') {
    return {
      ...values,
      upfrontReleaseEnabled: false,
      upfrontReleasePercent: '0',
    };
  }

  if (!values.upfrontReleaseEnabled) {
    return {
      ...values,
      upfrontReleasePercent: '0',
    };
  }

  return values;
};

const parseNumericString = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return Number.NaN;
  return Number(trimmed);
};

export const validateSettlementPolicyForm = (
  rawValues: SettlementPolicyFormValues,
): {
  values: SettlementPolicyFormValues;
  errors: SettlementPolicyFormErrors;
} => {
  const values = normalizeSettlementPolicyFormValues(rawValues);
  const errors: SettlementPolicyFormErrors = {};

  if (values.scope === 'BRAND' && !values.brandId.trim()) {
    errors.brandId = 'Select a brand for a brand-specific policy.';
  }

  if (!values.currency.trim()) {
    errors.currency = 'Currency is required.';
  }

  const upfrontReleasePercent = parseNumericString(values.upfrontReleasePercent);
  if (!Number.isFinite(upfrontReleasePercent) || upfrontReleasePercent < 0 || upfrontReleasePercent > 100) {
    errors.upfrontReleasePercent = 'Upfront release percent must be between 0 and 100.';
  }

  const settlementDelayHours = parseNumericString(values.settlementDelayHours);
  if (!Number.isFinite(settlementDelayHours) || settlementDelayHours < 0) {
    errors.settlementDelayHours = 'Settlement delay hours must be 0 or greater.';
  }

  const autoReleaseDays = parseNumericString(values.autoReleaseDays);
  if (!Number.isFinite(autoReleaseDays) || autoReleaseDays < 0) {
    errors.autoReleaseDays = 'Auto release days must be 0 or greater.';
  }

  if (!values.effectiveFrom) {
    errors.effectiveFrom = 'Effective from date is required.';
  }

  if (values.effectiveFrom && values.effectiveTo) {
    const effectiveFrom = new Date(values.effectiveFrom);
    const effectiveTo = new Date(values.effectiveTo);
    if (
      Number.isNaN(effectiveFrom.getTime()) ||
      Number.isNaN(effectiveTo.getTime()) ||
      effectiveTo <= effectiveFrom
    ) {
      errors.effectiveTo = 'Effective to must be after effective from.';
    }
  }

  return { values, errors };
};

export const toSettlementPolicyPayload = (
  rawValues: SettlementPolicyFormValues,
) => {
  const values = normalizeSettlementPolicyFormValues(rawValues);

  return {
    orderType: values.orderType,
    scope: values.scope,
    brandId: values.scope === 'BRAND' ? values.brandId : null,
    currency: values.currency.trim().toUpperCase() || null,
    releaseMode: values.releaseMode,
    upfrontReleaseEnabled: values.releaseMode === 'SPLIT_RELEASE' && values.upfrontReleaseEnabled,
    upfrontReleasePercent:
      values.releaseMode === 'SPLIT_RELEASE' && values.upfrontReleaseEnabled
        ? Number(values.upfrontReleasePercent)
        : 0,
    settlementDelayHours: Number(values.settlementDelayHours),
    autoReleaseDays: Number(values.autoReleaseDays),
    finalReleaseTrigger: values.finalReleaseTrigger,
    isDefault: values.isDefault,
    isActive: values.isActive,
    effectiveFrom: new Date(values.effectiveFrom).toISOString(),
    effectiveTo: values.effectiveTo ? new Date(values.effectiveTo).toISOString() : null,
  };
};
