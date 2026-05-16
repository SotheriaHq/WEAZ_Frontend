export const DESIGN_MEDIA_REQUIRED_SLOTS = ['Front', 'Back', 'Left', 'Right'] as const;
export const DESIGN_MEDIA_OPTIONAL_SLOTS = ['Extra 1', 'Extra 2'] as const;
export const DESIGN_MEDIA_SLOTS = [
  ...DESIGN_MEDIA_REQUIRED_SLOTS,
  ...DESIGN_MEDIA_OPTIONAL_SLOTS,
] as const;

export const DESIGN_REQUIRED_MEDIA_COUNT = DESIGN_MEDIA_REQUIRED_SLOTS.length;
export const DESIGN_MAX_MEDIA_COUNT = DESIGN_MEDIA_SLOTS.length;

export const DESIGN_FIT_PREFERENCE_OPTIONS = [
  { value: 'SLIM', label: 'Slim' },
  { value: 'REGULAR', label: 'Regular' },
  { value: 'LOOSE', label: 'Loose' },
  { value: 'OVERSIZED', label: 'Oversized' },
] as const;

export const DESIGN_TARGET_AGE_OPTIONS = [
  { value: 'ADULT', label: 'Adult' },
  { value: 'CHILD', label: 'Kids' },
] as const;

export type DesignFitPreference = (typeof DESIGN_FIT_PREFERENCE_OPTIONS)[number]['value'];
export type DesignTargetAgeGroup = (typeof DESIGN_TARGET_AGE_OPTIONS)[number]['value'];
