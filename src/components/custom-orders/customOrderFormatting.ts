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

export const humanizeCustomOrderToken = (value: string | null | undefined) =>
  String(value ?? '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());

export const formatMeasurementValue = (value: number | string | null | undefined, unit = 'cm') => {
  if (value === null || value === undefined || value === '') {
    return `- ${unit}`;
  }

  const numericValue = Number(value);
  const displayValue = Number.isFinite(numericValue) ? numericValue : value;
  return `${displayValue} ${unit}`;
};
