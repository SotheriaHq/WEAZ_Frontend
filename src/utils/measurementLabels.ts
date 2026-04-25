const GENDER_PREFIX_PATTERN = /^(MEN|WOMEN|MALE|FEMALE|UNISEX)_+/i;

export const formatMeasurementLabel = (rawValue?: string | null) => {
  const normalized = String(rawValue || '')
    .trim()
    .replace(GENDER_PREFIX_PATTERN, '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return 'Measurement';
  }

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
};
