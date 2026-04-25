import type { CSSProperties } from 'react';

const STANDARD_VARIANT_COLOR_HEX_MAP: Record<string, string> = {
  Black: '#000000',
  White: '#FFFFFF',
  Navy: '#1E3A5F',
  Indigo: '#4F46E5',
  Red: '#DC2626',
  Green: '#16A34A',
  Yellow: '#EAB308',
  Purple: '#9333EA',
  Orange: '#EA580C',
  Blue: '#2563EB',
  Pink: '#EC4899',
  Brown: '#92400E',
  Gray: '#6B7280',
  Burgundy: '#800020',
  Teal: '#14B8A6',
  Gold: '#D4AF37',
  'Black/Gold': 'linear-gradient(135deg, #000000 50%, #D4AF37 50%)',
  Multi: 'linear-gradient(135deg, #EC4899, #8B5CF6, #3B82F6, #10B981)',
};

const normalizeLookupKey = (value: string) => value.trim().toLowerCase();

const hashString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

const buildFallbackTone = (value: string) => {
  const hash = hashString(value);
  const hue = hash % 360;
  const saturation = 58 + (hash % 12);
  const lightness = 46 + (hash % 10);
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
};

export type VariantColorPresentation = {
  label: string;
  swatchStyle: CSSProperties;
  toneLabel: string;
  hasImage: boolean;
};

export const resolveVariantColorPresentation = (
  color: string,
  options?: {
    colorImages?: Record<string, string> | null;
    colorHexCodes?: Record<string, string> | null;
  },
): VariantColorPresentation => {
  const label = String(color ?? '').trim() || 'Variant color';
  const normalized = normalizeLookupKey(label);

  const imageEntry = options?.colorImages
    ? Object.entries(options.colorImages).find(
        ([key]) => normalizeLookupKey(key) === normalized,
      )
    : null;
  if (imageEntry?.[1]) {
    return {
      label,
      swatchStyle: {
        backgroundImage: `url(${imageEntry[1]})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      },
      toneLabel: 'Fabric image',
      hasImage: true,
    };
  }

  const hexEntry = options?.colorHexCodes
    ? Object.entries(options.colorHexCodes).find(
        ([key]) => normalizeLookupKey(key) === normalized,
      )
    : null;
  const paletteValue =
    hexEntry?.[1] ?? STANDARD_VARIANT_COLOR_HEX_MAP[label] ?? null;

  if (paletteValue) {
    return {
      label,
      swatchStyle: paletteValue.includes('gradient')
        ? { background: paletteValue }
        : { backgroundColor: paletteValue },
      toneLabel: hexEntry?.[1]
        ? 'Variant color'
        : STANDARD_VARIANT_COLOR_HEX_MAP[label]
          ? 'Variant color'
          : 'Variant color',
      hasImage: false,
    };
  }

  return {
    label,
    swatchStyle: { backgroundColor: buildFallbackTone(label) },
    toneLabel: 'Descriptive color',
    hasImage: false,
  };
};