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
  /**
   * Each step is an equal share, and being ON a step counts it as reached:
   * Essentials 20 · Social 40 · Policies 60 · Hours 80 · Review 100.
   *
   * The bar and the label are the same number by construction, so they cannot
   * drift out of sync — which is the whole point of them sitting together.
   */
  const percentComplete = Math.round(((currentIndex + 1) / total) * 100);

  return (
    <div className={className}>
      {/*
        Just the filler and where you are.
        The step pips and a "Step 2 of 5" counter said the same thing three
        times over; the percentage now carries the step name, so one line
        answers both "how far" and "where".
      */}
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-sm font-bold text-[color:var(--text-primary)]">
          {percentComplete}%
          <span className="ml-2 font-semibold text-[color:var(--text-secondary)]">
            {STORE_SETUP_STEPS[currentIndex]?.label}
          </span>
        </p>
        <p className="shrink-0 text-xs font-semibold text-[color:var(--text-secondary)]">
          Store setup
        </p>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--surface-muted)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentComplete}
        aria-valuetext={`${percentComplete}% complete — ${STORE_SETUP_STEPS[currentIndex]?.label}`}
      >
        <div
          className="h-full rounded-full bg-indigo-600 transition-[width] duration-300 ease-out dark:bg-indigo-500"
          style={{ width: `${percentComplete}%` }}
        />
      </div>
    </div>
  );
};

export default StoreSetupProgress;
