import type { StoreWizardData } from '@/types/storeWizard';

export const STORE_SHIPPING_COUNTRIES = [
  { value: 'nigeria', label: 'Nigeria', flag: '🇳🇬', accent: 'from-emerald-500/20 to-emerald-600/20' },
  { value: 'ghana', label: 'Ghana', flag: '🇬🇭', accent: 'from-amber-500/20 to-red-500/20' },
  { value: 'kenya', label: 'Kenya', flag: '🇰🇪', accent: 'from-green-500/20 to-red-500/20' },
  { value: 'south-africa', label: 'South Africa', flag: '🇿🇦', accent: 'from-cyan-500/20 to-emerald-500/20' },
  { value: 'rwanda', label: 'Rwanda', flag: '🇷🇼', accent: 'from-yellow-500/20 to-blue-500/20' },
  { value: 'egypt', label: 'Egypt', flag: '🇪🇬', accent: 'from-red-500/20 to-gray-500/20' },
  { value: 'uk', label: 'United Kingdom', flag: '🇬🇧', accent: 'from-blue-500/20 to-red-500/20' },
  { value: 'us', label: 'United States', flag: '🇺🇸', accent: 'from-blue-500/20 to-indigo-500/20' },
] as const;

export const ALLOWED_RETURN_WINDOWS = ['7', '14'] as const;
export const ALLOWED_RESPONSE_TIME_SLAS = ['2h', 'same-day', '24h'] as const;
export const ALLOWED_CUSTOM_ORDER_LEAD_TIMES = ['1-2', '2-4', '4-7'] as const;

export const STORE_RETURN_WINDOW_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
] as const;

export const STORE_CUSTOM_ORDER_LEAD_TIME_OPTIONS = [
  { value: '1-2', label: '1-2 days' },
  { value: '2-4', label: '2-4 days' },
  { value: '4-7', label: '4-7 days' },
] as const;

export const STORE_RESPONSE_SLA_OPTIONS = [
  { value: '2h', label: 'Within 2 hours' },
  { value: 'same-day', label: 'Same business day' },
  { value: '24h', label: 'Within 24 hours' },
] as const;

export const STORE_REFUND_METHOD_OPTIONS = [
  { value: 'original', label: 'Original payment method' },
  { value: 'store-credit', label: 'Store credit' },
  { value: 'exchange', label: 'Exchange only' },
] as const;

const LEGACY_LEAD_TIME_MAP: Record<string, (typeof ALLOWED_CUSTOM_ORDER_LEAD_TIMES)[number]> = {
  '7-14': '4-7',
  '14-21': '4-7',
  '21-30': '4-7',
  '30-plus': '4-7',
};

export const sanitizeShippingRegions = (regions: string[] | undefined | null): string[] => {
  if (!Array.isArray(regions)) return [];
  const allowed = new Set(STORE_SHIPPING_COUNTRIES.map((entry) => entry.value));
  return regions.filter((region) => allowed.has(region as (typeof STORE_SHIPPING_COUNTRIES)[number]['value']));
};

export const sanitizeReturnWindow = (
  value: string | undefined | null,
  fallback: (typeof ALLOWED_RETURN_WINDOWS)[number] = '14',
): (typeof ALLOWED_RETURN_WINDOWS)[number] => {
  const normalized = String(value ?? '').trim();
  return (ALLOWED_RETURN_WINDOWS as readonly string[]).includes(normalized)
    ? (normalized as (typeof ALLOWED_RETURN_WINDOWS)[number])
    : fallback;
};

export const sanitizeResponseTimeSla = (
  value: string | undefined | null,
  fallback: (typeof ALLOWED_RESPONSE_TIME_SLAS)[number] = '24h',
): (typeof ALLOWED_RESPONSE_TIME_SLAS)[number] => {
  const normalized = String(value ?? '').trim();
  return (ALLOWED_RESPONSE_TIME_SLAS as readonly string[]).includes(normalized)
    ? (normalized as (typeof ALLOWED_RESPONSE_TIME_SLAS)[number])
    : fallback;
};

export const sanitizeCustomOrderLeadTime = (
  value: string | undefined | null,
  fallback: (typeof ALLOWED_CUSTOM_ORDER_LEAD_TIMES)[number] = '2-4',
): (typeof ALLOWED_CUSTOM_ORDER_LEAD_TIMES)[number] => {
  const normalized = String(value ?? '').trim();
  if ((ALLOWED_CUSTOM_ORDER_LEAD_TIMES as readonly string[]).includes(normalized)) {
    return normalized as (typeof ALLOWED_CUSTOM_ORDER_LEAD_TIMES)[number];
  }
  return LEGACY_LEAD_TIME_MAP[normalized] ?? fallback;
};

export type StorePoliciesStepValidation = {
  valid: boolean;
  missing: string[];
};

export const getStorePoliciesStepValidation = (
  data: Pick<
    StoreWizardData,
    | 'shippingRegions'
    | 'processingTime'
    | 'shippingMethods'
    | 'freeShippingThreshold'
    | 'returnsAccepted'
    | 'returnWindow'
    | 'refundMethod'
    | 'responseTimeSla'
    | 'contactEmail'
    | 'customOrdersEnabled'
    | 'customOrderLeadTime'
  >,
): StorePoliciesStepValidation => {
  const missing: string[] = [];

  if (!data.shippingRegions.length) missing.push('At least one shipping country');
  if (!data.processingTime.trim()) missing.push('Processing time');
  if (!data.shippingMethods.length) missing.push('At least one shipping method');
  if (
    data.shippingMethods.includes('free-threshold') &&
    (data.freeShippingThreshold === null || data.freeShippingThreshold === undefined || data.freeShippingThreshold <= 0)
  ) {
    missing.push('Free shipping threshold');
  }
  if (!data.responseTimeSla.trim()) missing.push('Customer response commitment');
  if (!data.contactEmail.trim()) missing.push('Contact email');

  if (data.returnsAccepted) {
    const returnWindow = String(data.returnWindow ?? '').trim();
    if (!(ALLOWED_RETURN_WINDOWS as readonly string[]).includes(returnWindow)) {
      missing.push('Return window (7 or 14 days)');
    }
    if (!data.refundMethod.trim()) missing.push('Refund method');
  }

  if (data.customOrdersEnabled) {
    const leadTime = String(data.customOrderLeadTime ?? '').trim();
    if (!(ALLOWED_CUSTOM_ORDER_LEAD_TIMES as readonly string[]).includes(leadTime)) {
      missing.push('Custom-order lead time (max 7 days)');
    }
  }

  return { valid: missing.length === 0, missing };
};