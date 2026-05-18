import type { ReviewPromptDto, ReviewSatisfaction, ReviewTargetType } from '@/api/ReviewApi';

export const REVIEW_TEXT_MAX_LENGTH = 5000;

export const SATISFACTION_OPTIONS: Array<{
  value: ReviewSatisfaction;
  label: string;
  emoji: string;
  toneClass: string;
}> = [
  { value: 'NONE', label: 'Neutral', emoji: '😐', toneClass: 'border-gray-200 bg-gray-50 text-gray-700 dark:border-white/10 dark:bg-white/5 dark:text-gray-200' },
  { value: 'ANGRY', label: 'Angry', emoji: '😠', toneClass: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200' },
  { value: 'SAD', label: 'Sad', emoji: '😢', toneClass: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-200' },
  { value: 'OKAY', label: 'Okay', emoji: '🙂', toneClass: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200' },
  { value: 'HAPPY', label: 'Happy', emoji: '😊', toneClass: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200' },
  { value: 'EXCITED', label: 'Excited', emoji: '🤩', toneClass: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/20 dark:bg-fuchsia-500/10 dark:text-fuchsia-200' },
];

export const getSatisfactionOption = (value?: ReviewSatisfaction | null) =>
  SATISFACTION_OPTIONS.find((option) => option.value === value) ?? SATISFACTION_OPTIONS[0];

export const targetLabel = (targetType: ReviewTargetType) => {
  switch (targetType) {
    case 'PRODUCT':
      return 'product';
    case 'COLLECTION':
      return 'collection';
    case 'DESIGN':
      return 'design';
    case 'CUSTOM_ORDER':
      return 'custom order';
    case 'BRAND':
      return 'brand';
    default:
      return 'purchase';
  }
};

export const promptTitle = (prompt: ReviewPromptDto) => {
  const label = targetLabel(prompt.targetType);
  const suffix = prompt.orderId
    ? `order #${prompt.orderId.slice(0, 8).toUpperCase()}`
    : prompt.customOrderId
      ? `custom order #${prompt.customOrderId.slice(0, 8).toUpperCase()}`
      : 'completed purchase';
  return `Review this ${label} from ${suffix}`;
};

export const formatReviewDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatEditWindow = (value?: string | null) => {
  if (!value) return 'Edit window unavailable';
  const remainingMs = new Date(value).getTime() - Date.now();
  if (remainingMs <= 0) return 'Edit window expired';
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.max(1, Math.ceil((remainingMs % (60 * 60 * 1000)) / (60 * 1000)));
  return hours > 0 ? `${hours}h ${minutes}m left to edit` : `${minutes}m left to edit`;
};
