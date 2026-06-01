import {
  MAX_CONTENT_MEDIA_COUNT,
  MEDIA_VIEW_SLOT_OPTIONS,
  REQUIRED_MEDIA_VIEW_SLOTS,
  getMediaViewSlotLabel,
} from '@/utils/contentIntegrity';

export const DESIGN_MEDIA_REQUIRED_SLOTS = REQUIRED_MEDIA_VIEW_SLOTS.map(
  (slot) => getMediaViewSlotLabel(slot),
) as [string, string, string, string];
export const DESIGN_MEDIA_OPTIONAL_SLOTS = MEDIA_VIEW_SLOT_OPTIONS.filter(
  (option) => !option.required,
)
  .slice(0, MAX_CONTENT_MEDIA_COUNT - DESIGN_MEDIA_REQUIRED_SLOTS.length)
  .map((option) => option.label) as [string, string];
export const DESIGN_MEDIA_SLOTS = [
  ...DESIGN_MEDIA_REQUIRED_SLOTS,
  ...DESIGN_MEDIA_OPTIONAL_SLOTS,
] as const;

export const DESIGN_REQUIRED_MEDIA_COUNT = DESIGN_MEDIA_REQUIRED_SLOTS.length;
export const DESIGN_MAX_MEDIA_COUNT = MAX_CONTENT_MEDIA_COUNT;

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
