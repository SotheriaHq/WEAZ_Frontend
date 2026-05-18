import type { ReviewSatisfaction } from '@/api/ReviewApi';
import { SATISFACTION_OPTIONS } from './reviewDisplay';

type SatisfactionSelectorProps = {
  value: ReviewSatisfaction;
  onChange: (value: ReviewSatisfaction) => void;
  disabled?: boolean;
};

export default function SatisfactionSelector({ value, onChange, disabled = false }: SatisfactionSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Satisfaction mood">
      {SATISFACTION_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
              selected
                ? `${option.toneClass} ring-2 ring-[color:var(--text-primary)]/20`
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10'
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <span aria-hidden="true">{option.emoji}</span>
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
