export const formatMeasurementLabel = (rawKey: string) =>
  String(rawKey ?? '')
    .trim()
    .replace(/^BRAND[_\-\s]+[^_\-\s]+[_\-\s]+/i, '')
    .replace(/^(MEN|WOMEN|WOMAN|UNISEX)[_\-\s]+/i, '')
    .replace(/[_\-\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());

export const formatCustomOrderCode = (value: string | null | undefined) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return 'Custom order';
  }

  return `#CO-${normalized.slice(0, 8).toUpperCase()}`;
};

const customOrderLabelOverrides: Record<string, string> = {
  PENDING_BRAND_ACCEPTANCE: 'Pre-production Hold',
  BRAND_ACCEPTED: 'Order Intake Locked',
  MEASUREMENTS_UPDATED_PRE_ACCEPTANCE: 'Measurements Updated Before Production',
  MEASUREMENTS_UPDATED_PRE_PRODUCTION: 'Measurements Updated Before Production',
};

export const humanizeCustomOrderToken = (value: string | null | undefined) => {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return '';
  }

  return (
    customOrderLabelOverrides[normalized] ||
    normalized
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (character) => character.toUpperCase())
  );
};

export const formatMeasurementValue = (value: number | string | null | undefined, unit = 'cm') => {
  if (value === null || value === undefined || value === '') {
    return `- ${unit}`;
  }

  const numericValue = Number(value);
  const displayValue = Number.isFinite(numericValue) ? numericValue : value;
  return `${displayValue} ${unit}`;
};
