import { clsx } from 'clsx';

export interface SwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Id of the visible text that names this setting. */
  labelledBy: string;
  /** Id of the text that explains it, read after the name. */
  describedBy?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * On/off control for a single setting. The name and explanation live in the
 * caller's own text (`labelledBy`/`describedBy`), so the switch carries no copy.
 */
export default function Switch({
  checked,
  onChange,
  labelledBy,
  describedBy,
  disabled = false,
  className,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-primary)]',
        checked
          ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]'
          : 'border-[var(--border-default)] bg-[var(--surface-secondary)]',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={clsx(
          'inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none',
          checked ? 'translate-x-6' : 'translate-x-1',
        )}
      />
    </button>
  );
}
