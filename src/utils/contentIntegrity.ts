export type BackendMediaViewSlot =
  | 'FRONT'
  | 'BACK'
  | 'LEFT_SIDE'
  | 'RIGHT_SIDE'
  | 'DETAIL'
  | 'ON_MODEL'
  | 'FABRIC_DETAIL'
  | 'OTHER';

export type MediaViewSlot = BackendMediaViewSlot | 'INSPIRATION';

export const REQUIRED_MEDIA_VIEW_SLOTS = [
  'FRONT',
  'BACK',
  'LEFT_SIDE',
  'RIGHT_SIDE',
] as const;

export const MAX_CONTENT_MEDIA_COUNT = 6;

export const MEDIA_VIEW_SLOT_OPTIONS: Array<{
  value: MediaViewSlot;
  label: string;
  required: boolean;
}> = [
  { value: 'FRONT', label: 'Front', required: true },
  { value: 'BACK', label: 'Back', required: true },
  { value: 'LEFT_SIDE', label: 'Left Side', required: true },
  { value: 'RIGHT_SIDE', label: 'Right Side', required: true },
  { value: 'DETAIL', label: 'Detail', required: false },
  { value: 'ON_MODEL', label: 'On Model', required: false },
  { value: 'FABRIC_DETAIL', label: 'Fabric Detail', required: false },
  { value: 'INSPIRATION', label: 'Inspiration', required: false },
  { value: 'OTHER', label: 'Other', required: false },
];

const BACKEND_MEDIA_VIEW_SLOTS = new Set<BackendMediaViewSlot>([
  'FRONT',
  'BACK',
  'LEFT_SIDE',
  'RIGHT_SIDE',
  'DETAIL',
  'ON_MODEL',
  'FABRIC_DETAIL',
  'OTHER',
]);

const SLOT_BY_LEGACY_LABEL: Record<string, MediaViewSlot> = {
  FRONT: 'FRONT',
  BACK: 'BACK',
  LEFT: 'LEFT_SIDE',
  'LEFT SIDE': 'LEFT_SIDE',
  RIGHT: 'RIGHT_SIDE',
  'RIGHT SIDE': 'RIGHT_SIDE',
  'BACK SIDE': 'BACK',
  COVER: 'FRONT',
  DETAIL: 'DETAIL',
  'EXTRA 1': 'DETAIL',
  'EXTRA 2': 'ON_MODEL',
  'ON MODEL': 'ON_MODEL',
  FABRIC: 'FABRIC_DETAIL',
  'FABRIC DETAIL': 'FABRIC_DETAIL',
  INSPIRATION: 'INSPIRATION',
  OTHER: 'OTHER',
};

const FALLBACK_SLOT_ORDER: MediaViewSlot[] = [
  'FRONT',
  'BACK',
  'LEFT_SIDE',
  'RIGHT_SIDE',
  'DETAIL',
  'ON_MODEL',
];

export const getMediaViewSlotLabel = (slot?: string | null): string => {
  const normalized = normalizeMediaViewSlot(slot);
  return (
    MEDIA_VIEW_SLOT_OPTIONS.find((option) => option.value === normalized)
      ?.label ?? 'Other'
  );
};

export const normalizeMediaViewSlot = (
  value?: string | null,
  fallbackIndex = 0,
): MediaViewSlot => {
  const raw = String(value ?? '').trim();
  if (raw.length > 0) {
    const upper = raw.toUpperCase().replace(/[\s-]+/g, '_');
    if (upper === 'LEFT') return 'LEFT_SIDE';
    if (upper === 'RIGHT') return 'RIGHT_SIDE';
    if (upper === 'BACK_SIDE') return 'BACK';
    if (BACKEND_MEDIA_VIEW_SLOTS.has(upper as BackendMediaViewSlot)) {
      return upper as BackendMediaViewSlot;
    }
    if (upper === 'INSPIRATION') return 'INSPIRATION';

    const byLabel = SLOT_BY_LEGACY_LABEL[raw.toUpperCase()];
    if (byLabel) return byLabel;
  }

  return FALLBACK_SLOT_ORDER[fallbackIndex] ?? 'OTHER';
};

export const toBackendMediaViewSlot = (
  slot?: string | null,
  fallbackIndex = 0,
): BackendMediaViewSlot => {
  const normalized = normalizeMediaViewSlot(slot, fallbackIndex);
  return normalized === 'INSPIRATION' ? 'OTHER' : normalized;
};

export const getMissingRequiredMediaSlots = <
  T extends { viewSlot?: string | null },
>(
  items: T[],
): MediaViewSlot[] => {
  const present = new Set(
    items
      .map((item, index) => toBackendMediaViewSlot(item.viewSlot, index))
      .filter(Boolean),
  );
  return REQUIRED_MEDIA_VIEW_SLOTS.filter((slot) => !present.has(slot));
};

export type ContentPublicationStatus =
  | 'DRAFT'
  | 'UPLOADING'
  | 'PROCESSING'
  | 'IN_REVIEW'
  | 'CHANGES_REQUESTED'
  | 'REJECTED'
  | 'PUBLISHED'
  | 'FAILED'
  | 'REMOVED'
  | 'ARCHIVED'
  | 'ACTIVE'
  | 'DELETED';

export const CONTENT_STATUS_LABELS: Record<ContentPublicationStatus, string> = {
  DRAFT: 'Draft',
  UPLOADING: 'Uploading',
  PROCESSING: 'Processing',
  IN_REVIEW: 'In Review',
  CHANGES_REQUESTED: 'Changes Requested',
  REJECTED: 'Rejected',
  PUBLISHED: 'Published',
  FAILED: 'Failed',
  REMOVED: 'Removed',
  ARCHIVED: 'Archived',
  ACTIVE: 'Published',
  DELETED: 'Removed',
};

export const getContentStatusLabel = (value?: string | null): string => {
  const normalized = String(value ?? 'DRAFT')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_') as ContentPublicationStatus;
  return CONTENT_STATUS_LABELS[normalized] ?? 'Draft';
};

export const getContentStatusTone = (value?: string | null): string => {
  const normalized = String(value ?? 'DRAFT').trim().toUpperCase();
  if (normalized === 'PUBLISHED' || normalized === 'ACTIVE') {
    return 'bg-emerald-500/90 text-white';
  }
  if (normalized === 'IN_REVIEW' || normalized === 'PROCESSING') {
    return 'bg-sky-500/90 text-white';
  }
  if (normalized === 'CHANGES_REQUESTED') {
    return 'bg-amber-500/90 text-white';
  }
  if (normalized === 'REJECTED' || normalized === 'FAILED' || normalized === 'REMOVED' || normalized === 'DELETED') {
    return 'bg-rose-500/90 text-white';
  }
  if (normalized === 'ARCHIVED') {
    return 'bg-gray-500/90 text-white';
  }
  return 'bg-slate-500/90 text-white';
};
