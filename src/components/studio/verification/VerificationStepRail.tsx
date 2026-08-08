/**
 * Compact horizontal step rail for the verification wizard on narrow screens.
 *
 * The wizard's step list is a vertical sidebar — correct at `lg` and up, where
 * it sits beside the form. Below `lg` that same sidebar stretched to full width
 * and rendered all five steps with their descriptions stacked, which pushed the
 * actual form a whole screen down: on a phone the user saw a title card, then a
 * progress card, then a path card, and had to scroll past all of it before
 * reaching the first input.
 *
 * This replaces it under `lg` with a single sticky row: five tappable nodes on
 * a connecting line, plus the active step's name. It stays pinned while the
 * form scrolls, so the "where am I" signal is MORE present than the old list
 * was, not less — the old one scrolled away the moment you started typing.
 */
import React, { useEffect, useRef } from 'react';

export type VerificationStepRailItem = {
  id: string;
  title: string;
  summary: string;
};

type Props = {
  steps: readonly VerificationStepRailItem[];
  currentIndex: number;
  /** Percent of required fields filled, shown alongside the step count. */
  completionPercent: number;
  onSelect: (index: number) => void;
  className?: string;
};

export const VerificationStepRail: React.FC<Props> = ({
  steps,
  currentIndex,
  completionPercent,
  onSelect,
  className,
}) => {
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // Five nodes fit a 360px viewport, but the row scrolls rather than shrinking
  // the tap targets below 44px. Keep the active node in view when the step
  // changes from the Continue/Back buttons rather than from a tap here.
  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [currentIndex]);

  const activeStep = steps[currentIndex];

  return (
    <div
      className={`sticky top-16 z-10 -mx-3 border-b border-outline-variant/20 bg-surface/95 px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-surface/80 sm:-mx-4 sm:px-4 ${className ?? ''}`}
    >
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="truncate text-sm font-bold text-on-surface">
          {activeStep?.title}
        </p>
        <p className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant tabular-nums">
          Step {currentIndex + 1}/{steps.length} · {completionPercent}%
        </p>
      </div>

      <ol
        className="no-scrollbar flex items-center gap-1 overflow-x-auto"
        aria-label="Verification steps"
      >
        {steps.map((item, index) => {
          const isComplete = index < currentIndex;
          const isActive = index === currentIndex;

          return (
            <li key={item.id} className="flex min-w-0 flex-1 items-center gap-1">
              <button
                ref={isActive ? activeRef : undefined}
                type="button"
                onClick={() => onSelect(index)}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`Step ${index + 1} of ${steps.length}: ${item.title}${
                  isComplete ? ', completed' : isActive ? ', current' : ''
                }`}
                // 44px tap target via padding, while the visible node stays 24px.
                className="flex shrink-0 items-center justify-center p-2.5 -m-1 transition-transform active:scale-95"
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                    isComplete
                      ? 'bg-primary text-on-primary'
                      : isActive
                        ? 'bg-surface-container-lowest text-primary ring-2 ring-primary'
                        : 'border border-outline-variant/40 bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {isComplete ? '✓' : index + 1}
                </span>
              </button>
              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={`h-0.5 min-w-2 flex-1 rounded-full transition-colors ${
                    index < currentIndex ? 'bg-primary' : 'bg-outline-variant/30'
                  }`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default VerificationStepRail;
