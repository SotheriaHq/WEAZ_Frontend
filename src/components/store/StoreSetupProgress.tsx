import React from 'react';

/**
 * One progress rail for the WHOLE of store setup.
 *
 * Setup spans two pages — Store Essentials, then the four-step creation wizard
 * — and neither showed any progress at all. A brand could not tell how many
 * steps were left, whether they were near the end, or (on native, where they
 * were being dropped straight into the wizard's Social step) that a first phase
 * existed and had been skipped. The steps are numbered here across both pages
 * so "step 2 of 5" means the same thing wherever it is read.
 *
 * Deliberately not clickable. The steps write server state in order and later
 * steps depend on earlier ones, so an indicator that looked navigable would be
 * offering jumps the flow cannot honour — which is the same complaint as Studio
 * rendering every link as active mid-setup.
 */

export const STORE_SETUP_STEPS = [
  { key: 'essentials', label: 'Essentials' },
  { key: 'social', label: 'Social' },
  { key: 'policies', label: 'Policies' },
  { key: 'hours', label: 'Hours' },
  { key: 'review', label: 'Review' },
] as const;

export type StoreSetupStepKey = (typeof STORE_SETUP_STEPS)[number]['key'];

type Props = {
  current: StoreSetupStepKey;
  className?: string;
};

const StoreSetupProgress: React.FC<Props> = ({ current, className }) => {
  const currentIndex = Math.max(
    0,
    STORE_SETUP_STEPS.findIndex((step) => step.key === current),
  );
  const total = STORE_SETUP_STEPS.length;
  // Fill to the CENTRE of the active pip, so the bar reads as "you are here"
  // rather than "this step is finished" — it is not finished, it is open.
  const fillPercent = (currentIndex / (total - 1)) * 100;

  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm font-bold text-[color:var(--text-primary)]">
          Step {currentIndex + 1} of {total}
          <span className="ml-2 font-semibold text-[color:var(--text-secondary)]">
            {STORE_SETUP_STEPS[currentIndex]?.label}
          </span>
        </p>
        <p className="text-xs font-semibold text-[color:var(--text-secondary)]">
          {Math.round(((currentIndex + 1) / total) * 100)}% complete
        </p>
      </div>

      <div
        className="relative"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={currentIndex + 1}
        aria-valuetext={`Step ${currentIndex + 1} of ${total}: ${STORE_SETUP_STEPS[currentIndex]?.label}`}
      >
        <div className="h-1.5 w-full rounded-full bg-[color:var(--surface-tertiary)]">
          <div
            className="h-1.5 rounded-full bg-indigo-600 transition-[width] duration-300 ease-out dark:bg-indigo-500"
            style={{ width: `${fillPercent}%` }}
          />
        </div>

        <ol className="mt-3 flex justify-between">
          {STORE_SETUP_STEPS.map((step, index) => {
            const isDone = index < currentIndex;
            const isCurrent = index === currentIndex;
            return (
              <li key={step.key} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span
                  aria-hidden
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                    isDone
                      ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                      : isCurrent
                        ? 'bg-indigo-600 text-white ring-4 ring-indigo-600/20 dark:bg-indigo-500 dark:ring-indigo-500/25'
                        : 'bg-[color:var(--surface-tertiary)] text-[color:var(--text-secondary)]'
                  }`}
                >
                  {isDone ? '✓' : index + 1}
                </span>
                <span
                  className={`truncate text-center text-[11px] font-semibold ${
                    isCurrent
                      ? 'text-[color:var(--text-primary)]'
                      : 'text-[color:var(--text-secondary)]'
                  }`}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
};

export default StoreSetupProgress;
