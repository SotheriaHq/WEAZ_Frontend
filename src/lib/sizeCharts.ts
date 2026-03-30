import type { CustomOrderChartFamily } from '@/api/CustomOrderApi';

type ChartBand = {
  label: string;
  bustMin: number;
  bustMax: number;
  waistMin: number;
  waistMax: number;
  hipsMin: number;
  hipsMax: number;
};

export type AlphaDisplayRow = {
  alpha: string;
  uk: string;
  us: string;
  eu: string;
  nigeria: string;
  bust: string;
  waist: string;
  hips: string;
};

export type ChartSourceReference = {
  label: string;
  url: string;
  note: string;
};

export type SizeRecommendation = {
  displayChartFamily: CustomOrderChartFamily;
  computedSize: string | null;
  alphaSize: string | null;
  noDirectMatch: boolean;
  conversionGuidance: string | null;
  missingMeasurementKeys: string[];
};

const CHART_BANDS: Record<
  Exclude<CustomOrderChartFamily, 'HYBRID_UK_NIGERIA' | 'HYBRID_US_NIGERIA'>,
  ChartBand[]
> = {
  UK: [
    { label: 'UK 8', bustMin: 80, bustMax: 84, waistMin: 62, waistMax: 66, hipsMin: 88, hipsMax: 92 },
    { label: 'UK 10', bustMin: 84, bustMax: 88, waistMin: 66, waistMax: 70, hipsMin: 92, hipsMax: 96 },
    { label: 'UK 12', bustMin: 88, bustMax: 92, waistMin: 70, waistMax: 74, hipsMin: 96, hipsMax: 100 },
    { label: 'UK 14', bustMin: 92, bustMax: 98, waistMin: 74, waistMax: 80, hipsMin: 100, hipsMax: 106 },
    { label: 'UK 16', bustMin: 98, bustMax: 104, waistMin: 80, waistMax: 86, hipsMin: 106, hipsMax: 112 },
    { label: 'UK 18', bustMin: 104, bustMax: 112, waistMin: 86, waistMax: 94, hipsMin: 112, hipsMax: 120 },
  ],
  US: [
    { label: 'US 4', bustMin: 80, bustMax: 84, waistMin: 62, waistMax: 66, hipsMin: 88, hipsMax: 92 },
    { label: 'US 6', bustMin: 84, bustMax: 88, waistMin: 66, waistMax: 70, hipsMin: 92, hipsMax: 96 },
    { label: 'US 8', bustMin: 88, bustMax: 92, waistMin: 70, waistMax: 74, hipsMin: 96, hipsMax: 100 },
    { label: 'US 10', bustMin: 92, bustMax: 98, waistMin: 74, waistMax: 80, hipsMin: 100, hipsMax: 106 },
    { label: 'US 12', bustMin: 98, bustMax: 104, waistMin: 80, waistMax: 86, hipsMin: 106, hipsMax: 112 },
    { label: 'US 14', bustMin: 104, bustMax: 112, waistMin: 86, waistMax: 94, hipsMin: 112, hipsMax: 120 },
  ],
  NIGERIA: [
    { label: 'NG 8', bustMin: 80, bustMax: 85, waistMin: 62, waistMax: 67, hipsMin: 88, hipsMax: 93 },
    { label: 'NG 10', bustMin: 85, bustMax: 90, waistMin: 67, waistMax: 72, hipsMin: 93, hipsMax: 98 },
    { label: 'NG 12', bustMin: 90, bustMax: 96, waistMin: 72, waistMax: 78, hipsMin: 98, hipsMax: 104 },
    { label: 'NG 14', bustMin: 96, bustMax: 102, waistMin: 78, waistMax: 84, hipsMin: 104, hipsMax: 110 },
    { label: 'NG 16', bustMin: 102, bustMax: 110, waistMin: 84, waistMax: 92, hipsMin: 110, hipsMax: 118 },
    { label: 'NG 18', bustMin: 110, bustMax: 120, waistMin: 92, waistMax: 102, hipsMin: 118, hipsMax: 128 },
  ],
  ASIA: [
    { label: 'ASIA M', bustMin: 78, bustMax: 84, waistMin: 60, waistMax: 66, hipsMin: 84, hipsMax: 92 },
    { label: 'ASIA L', bustMin: 84, bustMax: 90, waistMin: 66, waistMax: 72, hipsMin: 92, hipsMax: 98 },
    { label: 'ASIA XL', bustMin: 90, bustMax: 96, waistMin: 72, waistMax: 78, hipsMin: 98, hipsMax: 104 },
    { label: 'ASIA XXL', bustMin: 96, bustMax: 102, waistMin: 78, waistMax: 84, hipsMin: 104, hipsMax: 110 },
    { label: 'ASIA 3XL', bustMin: 102, bustMax: 110, waistMin: 84, waistMax: 92, hipsMin: 110, hipsMax: 118 },
    { label: 'ASIA 4XL', bustMin: 110, bustMax: 120, waistMin: 92, waistMax: 102, hipsMin: 118, hipsMax: 128 },
  ],
};

export const DISPLAY_CHART_OPTIONS: Array<{ value: CustomOrderChartFamily; label: string }> = [
  { value: 'UK', label: 'UK' },
  { value: 'US', label: 'US' },
  { value: 'NIGERIA', label: 'Nigeria' },
  { value: 'HYBRID_UK_NIGERIA', label: 'UK-Nigeria Hybrid' },
  { value: 'HYBRID_US_NIGERIA', label: 'US-Nigeria Hybrid' },
  { value: 'ASIA', label: 'Asia' },
];

export const PRICING_CHART_OPTIONS: Array<{ value: CustomOrderChartFamily; label: string }> = [
  { value: 'HYBRID_UK_NIGERIA', label: 'Hybrid UK + Nigeria' },
  { value: 'HYBRID_US_NIGERIA', label: 'Hybrid US + Nigeria' },
  { value: 'UK', label: 'UK only' },
  { value: 'US', label: 'US only' },
  { value: 'NIGERIA', label: 'Nigeria only' },
  { value: 'ASIA', label: 'Asia only' },
];

export const SIZE_CHART_SOURCES: ChartSourceReference[] = [
  {
    label: 'ASOS Women Size Guide',
    url: 'https://www.asos.com/us/discover/size-charts/women/',
    note: 'Reference for women single-size and dual-size UK/US/EU conversions.',
  },
  {
    label: 'ASOS Men Size Guide',
    url: 'https://www.asos.com/us/discover/size-charts/men/',
    note: 'Reference for men chest, waist, inseam, and EU conversion ranges.',
  },
  {
    label: 'Edge Abah Size Chart',
    url: 'https://edgeabah.com/size-chart',
    note: 'Reference for Nigeria women and men ready-to-wear sizing and custom-fit measurement prompts.',
  },
  {
    label: 'Nuga Sizing Chart',
    url: 'https://www.nuga.uk/en-ng/pages/sizing-chart',
    note: 'Additional Nigeria womenswear reference for body-measurement consistency.',
  },
];

export const SIZE_COMPUTATION_METHODS = [
  {
    family: 'UK',
    description: 'Direct UK banding using bust, waist, and hips against the active chart pack.',
  },
  {
    family: 'US',
    description: 'Direct US banding using the same body measurements, mapped to US labels.',
  },
  {
    family: 'NIGERIA',
    description: 'Direct Nigeria banding using Nigeria-market RTW measurement ranges.',
  },
  {
    family: 'HYBRID_UK_NIGERIA',
    description: 'Hybrid pricing picks the stricter of the UK and Nigeria band results, so under-sizing is avoided when the two charts disagree.',
  },
  {
    family: 'HYBRID_US_NIGERIA',
    description: 'Hybrid pricing picks the stricter of the US and Nigeria band results, then exposes the nearest mapped display label.',
  },
  {
    family: 'ASIA',
    description: 'Direct Asia-market banding using the same body-measurement snapshot.',
  },
];

export const WOMEN_ALPHA_ROWS: AlphaDisplayRow[] = [
  { alpha: 'XS', uk: '6', us: '2', eu: '34', nigeria: '6', bust: '84', waist: '65', hips: '89' },
  { alpha: 'S', uk: '8-10', us: '4-6', eu: '36-38', nigeria: '8-10', bust: '89-94', waist: '70-75', hips: '94-99' },
  { alpha: 'M', uk: '12-14', us: '8-10', eu: '40-42', nigeria: '12-14', bust: '99-104', waist: '80-85', hips: '104-109' },
  { alpha: 'L', uk: '16-18', us: '12-14', eu: '44-46', nigeria: '16-18', bust: '111-118', waist: '92-99', hips: '116-123' },
  { alpha: 'XL', uk: '20', us: '16', eu: '48', nigeria: '20', bust: '125', waist: '106', hips: '130' },
  { alpha: '2XL', uk: '22-24', us: '18-20', eu: '50-52', nigeria: '22-24', bust: '132-139', waist: '113-120', hips: '137-144' },
];

export const MEN_ALPHA_ROWS: AlphaDisplayRow[] = [
  { alpha: 'XS', uk: '36', us: '36', eu: '46', nigeria: 'XS', bust: '84-91', waist: '71-76', hips: '88-94' },
  { alpha: 'S', uk: '38', us: '38', eu: '48', nigeria: 'S', bust: '91-96', waist: '76-81', hips: '94-99' },
  { alpha: 'M', uk: '40', us: '40', eu: '50', nigeria: 'M', bust: '96-101', waist: '81-86', hips: '99-104' },
  { alpha: 'L', uk: '42', us: '42', eu: '52', nigeria: 'L', bust: '101-106', waist: '86-91', hips: '104-110' },
  { alpha: 'XL', uk: '44', us: '44', eu: '54', nigeria: 'XL', bust: '106-111', waist: '91-96', hips: '110-116' },
  { alpha: '2XL', uk: '46', us: '46', eu: '56', nigeria: '2XL', bust: '111-116', waist: '96-101', hips: '116-122' },
  { alpha: '3XL', uk: '48', us: '48', eu: '58', nigeria: '3XL', bust: '116-121', waist: '101-106', hips: '122-128' },
];

const finiteNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const pickMeasurement = (measurements: Record<string, unknown>, candidates: string[]) => {
  for (const key of candidates) {
    const value = finiteNumber(measurements[key]);
    if (value != null) return value;
  }
  return null;
};

const inferMeasurementGender = (
  measurements: Record<string, unknown>,
  measurementGender?: 'MEN' | 'WOMEN' | null,
): 'MEN' | 'WOMEN' => {
  if (measurementGender === 'MEN' || measurementGender === 'WOMEN') {
    return measurementGender;
  }

  const keys = Object.keys(measurements);
  if (keys.some((key) => key.startsWith('MEN_'))) {
    return 'MEN';
  }
  return 'WOMEN';
};

const normalizeLabelToken = (value: string) =>
  value
    .toUpperCase()
    .replace(/\b(UK|US|NG|ASIA)\b/g, '')
    .replace(/\s+/g, '')
    .trim();

const extractNumericToken = (value: string) => {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
};

const matchesAlphaRowValue = (rowValue: string, label: string) => {
  const normalizedRowValue = normalizeLabelToken(rowValue);
  const normalizedLabel = normalizeLabelToken(label);
  if (!normalizedRowValue || !normalizedLabel) return false;
  if (normalizedRowValue === normalizedLabel) return true;

  const labelNumber = extractNumericToken(normalizedLabel);
  if (labelNumber == null) return false;

  if (normalizedRowValue.includes('-')) {
    const [startRaw, endRaw] = normalizedRowValue.split('-', 2);
    const start = extractNumericToken(startRaw);
    const end = extractNumericToken(endRaw);
    if (start == null || end == null) return false;
    return labelNumber >= start && labelNumber <= end;
  }

  const rowNumber = extractNumericToken(normalizedRowValue);
  return rowNumber != null ? rowNumber === labelNumber : false;
};

const parseAlphaRange = (value: string) => {
  const numbers = value.match(/\d+/g)?.map(Number) ?? [];
  if (!numbers.length) return null;
  if (numbers.length === 1) return { min: numbers[0], max: numbers[0] };
  return { min: numbers[0], max: numbers[numbers.length - 1] };
};

const resolveAlphaSizeFromMeasurements = (
  measurements: Record<string, unknown>,
  measurementGender: 'MEN' | 'WOMEN',
): string | null => {
  const bust = pickMeasurement(measurements, ['BUST', 'WOMEN_BUST', 'WOMEN_CHEST_FULL_BUST', 'MEN_CHEST']);
  const waist = pickMeasurement(measurements, ['WAIST', 'WOMEN_WAIST', 'MEN_WAIST']);
  const hips = pickMeasurement(measurements, ['HIPS', 'HIP', 'WOMEN_HIP', 'MEN_HIP']);

  if (bust == null || waist == null || hips == null) {
    return null;
  }

  const rows = measurementGender === 'MEN' ? MEN_ALPHA_ROWS : WOMEN_ALPHA_ROWS;
  const exact = rows.find((row) => {
    const bustRange = parseAlphaRange(row.bust);
    const waistRange = parseAlphaRange(row.waist);
    const hipsRange = parseAlphaRange(row.hips);
    if (!bustRange || !waistRange || !hipsRange) return false;
    return (
      bust >= bustRange.min &&
      bust <= bustRange.max &&
      waist >= waistRange.min &&
      waist <= waistRange.max &&
      hips >= hipsRange.min &&
      hips <= hipsRange.max
    );
  });

  if (exact) {
    return exact.alpha.toUpperCase();
  }

  const nearest = rows.reduce(
    (best, row) => {
      const bustRange = parseAlphaRange(row.bust);
      const waistRange = parseAlphaRange(row.waist);
      const hipsRange = parseAlphaRange(row.hips);
      if (!bustRange || !waistRange || !hipsRange) return best;

      const midpoint =
        (bustRange.min + bustRange.max + waistRange.min + waistRange.max + hipsRange.min + hipsRange.max) / 6;
      const delta = Math.abs(midpoint - (bust + waist + hips) / 3);
      if (delta < best.delta) {
        return { delta, alpha: row.alpha.toUpperCase() };
      }
      return best;
    },
    { delta: Number.MAX_SAFE_INTEGER, alpha: null as string | null },
  );

  return nearest.alpha;
};

const resolveAlphaSize = (
  label: string | null,
  displayChartFamily: CustomOrderChartFamily,
  measurementGender: 'MEN' | 'WOMEN',
  measurements: Record<string, unknown>,
): string | null => {
  const measurementBased = resolveAlphaSizeFromMeasurements(measurements, measurementGender);
  if (measurementBased) return measurementBased;
  if (!label) return null;

  const asiaMatch = label.match(/^ASIA\s+(.+)$/i);
  if (asiaMatch?.[1]) {
    return asiaMatch[1].trim().toUpperCase();
  }

  const rows = measurementGender === 'MEN' ? MEN_ALPHA_ROWS : WOMEN_ALPHA_ROWS;
  const normalizedLabel = label.toUpperCase().trim();
  const columnKey: keyof Pick<AlphaDisplayRow, 'uk' | 'us' | 'nigeria'> =
    displayChartFamily === 'US' || normalizedLabel.startsWith('US ')
      ? 'us'
      : displayChartFamily === 'NIGERIA' || normalizedLabel.startsWith('NG ')
        ? 'nigeria'
        : 'uk';

  const match = rows.find((row) => matchesAlphaRowValue(row[columnKey], normalizedLabel));
  return match?.alpha ?? null;
};

const computeCandidate = (
  family: Exclude<CustomOrderChartFamily, 'HYBRID_UK_NIGERIA' | 'HYBRID_US_NIGERIA'>,
  measurements: Record<string, unknown>,
) => {
  const bust = pickMeasurement(measurements, ['BUST', 'WOMEN_BUST', 'WOMEN_CHEST_FULL_BUST', 'MEN_CHEST']);
  const waist = pickMeasurement(measurements, ['WAIST', 'WOMEN_WAIST', 'MEN_WAIST']);
  const hips = pickMeasurement(measurements, ['HIPS', 'HIP', 'WOMEN_HIP', 'MEN_HIP']);
  const missingMeasurementKeys = [
    ...(bust == null ? ['BUST'] : []),
    ...(waist == null ? ['WAIST'] : []),
    ...(hips == null ? ['HIPS'] : []),
  ];

  if (missingMeasurementKeys.length > 0) {
    return {
      label: null,
      bandIndex: 0,
      noDirectMatch: false,
      nearestLabel: null,
      missingMeasurementKeys,
    };
  }

  const bands = CHART_BANDS[family];
  const exact = bands.findIndex((band, idx) => {
    const inBust = bust! >= band.bustMin && (idx === bands.length - 1 ? bust! <= band.bustMax : bust! < band.bustMax);
    const inWaist = waist! >= band.waistMin && (idx === bands.length - 1 ? waist! <= band.waistMax : waist! < band.waistMax);
    const inHips = hips! >= band.hipsMin && (idx === bands.length - 1 ? hips! <= band.hipsMax : hips! < band.hipsMax);
    return inBust && inWaist && inHips;
  });

  if (exact >= 0) {
    return {
      label: bands[exact].label,
      bandIndex: exact,
      noDirectMatch: false,
      nearestLabel: bands[exact].label,
      missingMeasurementKeys: [],
    };
  }

  const nearest = bands.reduce(
    (best, band, idx) => {
      const midpoint = (band.bustMin + band.bustMax + band.waistMin + band.waistMax + band.hipsMin + band.hipsMax) / 6;
      const delta = Math.abs(midpoint - (bust! + waist! + hips!) / 3);
      if (delta < best.delta) {
        return { delta, idx, label: band.label };
      }
      return best;
    },
    { delta: Number.MAX_SAFE_INTEGER, idx: 0, label: bands[0].label },
  );

  return {
    label: nearest.label,
    bandIndex: nearest.idx,
    noDirectMatch: true,
    nearestLabel: nearest.label,
    missingMeasurementKeys: [],
  };
};

export const deriveSizeRecommendation = (
  measurements: Record<string, unknown>,
  displayChartFamily: CustomOrderChartFamily,
  measurementGender?: 'MEN' | 'WOMEN' | null,
): SizeRecommendation => {
  const uk = computeCandidate('UK', measurements);
  const us = computeCandidate('US', measurements);
  const nigeria = computeCandidate('NIGERIA', measurements);
  const asia = computeCandidate('ASIA', measurements);
  const resolvedMeasurementGender = inferMeasurementGender(measurements, measurementGender);

  const missingMeasurementKeys = Array.from(
    new Set([...uk.missingMeasurementKeys, ...us.missingMeasurementKeys, ...nigeria.missingMeasurementKeys]),
  );

  if (missingMeasurementKeys.length > 0) {
    return {
      displayChartFamily,
      computedSize: null,
      alphaSize: null,
      noDirectMatch: false,
      conversionGuidance: 'Update your bust, waist, and hip measurements to compute a live size.',
      missingMeasurementKeys,
    };
  }

  const candidates = { UK: uk, US: us, NIGERIA: nigeria, ASIA: asia };
  const hybridUkNigeria = uk.bandIndex >= nigeria.bandIndex ? uk : nigeria;
  const hybridUsNigeria = us.bandIndex >= nigeria.bandIndex ? us : nigeria;
  const resolved =
    displayChartFamily === 'HYBRID_UK_NIGERIA'
      ? hybridUkNigeria
      : displayChartFamily === 'HYBRID_US_NIGERIA'
        ? hybridUsNigeria
        : candidates[displayChartFamily as keyof typeof candidates];

  return {
    displayChartFamily,
    computedSize: resolved?.label ?? null,
    alphaSize: resolveAlphaSize(resolved?.label ?? null, displayChartFamily, resolvedMeasurementGender, measurements),
    noDirectMatch: Boolean(resolved?.noDirectMatch),
    conversionGuidance:
      resolved?.noDirectMatch && resolved?.nearestLabel
        ? `Nearest mapped band: ${resolved.nearestLabel}`
        : null,
    missingMeasurementKeys: [],
  };
};
