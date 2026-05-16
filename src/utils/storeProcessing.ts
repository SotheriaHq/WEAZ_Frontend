export const STORE_PROCESSING_TIME_LABELS: Record<string, string> = {
  '1-2': '1-2 business days',
  '3-5': '3-5 business days',
  '5-7': '5-7 business days',
  '7-14': '7-14 business days',
  '14-21': '14-21 days',
  '21-30': '21-30 days',
  '30-plus': '30+ days',
};

export const getStoreProcessingTimeLabel = (value?: string | null): string => {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  return STORE_PROCESSING_TIME_LABELS[normalized] ?? normalized;
};

export const deriveProductionLeadDaysFromStoreTime = (
  value?: string | null,
  fallback = '7',
): string => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized.includes('plus')) {
    const firstNumber = Number(normalized.match(/\d+/)?.[0]);
    return Number.isFinite(firstNumber) && firstNumber > 0
      ? String(firstNumber)
      : fallback;
  }

  const numbers = normalized
    .match(/\d+/g)
    ?.map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry) && entry > 0);

  if (!numbers?.length) return fallback;
  return String(Math.max(...numbers));
};
