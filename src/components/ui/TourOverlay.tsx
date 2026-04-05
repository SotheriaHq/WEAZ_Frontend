import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { OverlayPortal } from './OverlayPortal';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TourStep {
  /** ID of the DOM element to spotlight */
  targetId: string;
  /** Tooltip title */
  title: string;
  /** Tooltip body text */
  description: string;
  /** Emoji shown alongside the title */
  emoji?: string;
  /**
   * Optional callback fired when this step becomes active.
   * Use to expand collapsed sections before measuring.
   */
  onEnter?: () => void;
  /**
   * Extra ms to wait after `onEnter` before scrolling + measuring.
   * Defaults to 350 when `onEnter` is provided, otherwise 0.
   */
  enterDelay?: number;
}

export interface TourOverlayProps {
  steps: TourStep[];
  /** Controls whether the tour is visible */
  isActive: boolean;
  /** Called when the user clicks Skip, Done, or the ✕ button */
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal types & constants
// ─────────────────────────────────────────────────────────────────────────────

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TooltipPos {
  top: number;
  left: number;
  arrowLeft: number;
  placement: 'top' | 'bottom';
}

const SPOTLIGHT_PAD = 10;
const TOOLTIP_WIDTH = 340;
const TOOLTIP_EST_HEIGHT = 210;
const TOOLTIP_GAP = 14;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function computeTooltipPos(rect: TargetRect): TooltipPos {
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;

  const spotBottom = rect.top + rect.height + SPOTLIGHT_PAD;
  const spotTop = rect.top - SPOTLIGHT_PAD;

  const spaceBelow = vpH - spotBottom;
  const placement: 'top' | 'bottom' =
    spaceBelow >= TOOLTIP_EST_HEIGHT + TOOLTIP_GAP ? 'bottom' : 'top';

  let top: number;
  if (placement === 'bottom') {
    top = spotBottom + TOOLTIP_GAP;
  } else {
    top = spotTop - TOOLTIP_GAP - TOOLTIP_EST_HEIGHT;
  }
  top = Math.max(12, Math.min(top, vpH - TOOLTIP_EST_HEIGHT - 12));

  // Center the tooltip horizontally over the target, clamped to viewport
  const targetCenterX = rect.left + rect.width / 2;
  let left = targetCenterX - TOOLTIP_WIDTH / 2;
  left = Math.max(12, Math.min(left, vpW - TOOLTIP_WIDTH - 12));

  // Arrow position relative to tooltip left edge (pointing at target center)
  let arrowLeft = targetCenterX - left - 8; // 8 = half of the 16px rotated square
  arrowLeft = Math.max(16, Math.min(arrowLeft, TOOLTIP_WIDTH - 32));

  return { top, left, arrowLeft, placement };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export const TourOverlay: React.FC<TourOverlayProps> = ({
  steps,
  isActive,
  onClose,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [isLocating, setIsLocating] = useState(true);

  const measureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);

  const currentStep = steps[stepIndex] ?? null;
  const isLastStep = stepIndex === steps.length - 1;

  // ── Locate + scroll + measure the target element ────────────────────────────
  const measureTarget = useCallback((step: TourStep) => {
    setIsLocating(true);
    setTargetRect(null);

    if (step.onEnter) step.onEnter();

    const delay = step.enterDelay ?? (step.onEnter ? 350 : 0);

    measureTimerRef.current = window.setTimeout(() => {
      const el = document.getElementById(step.targetId);
      if (!el) {
        setIsLocating(false);
        return;
      }

      el.scrollIntoView({ behavior: 'smooth', block: 'center' });

      scrollTimerRef.current = window.setTimeout(() => {
        const r = el.getBoundingClientRect();
        setTargetRect({
          top: r.top,
          left: r.left,
          width: r.width,
          height: r.height,
        });
        setIsLocating(false);
      }, 500);
    }, delay);
  }, []);

  // ── Reposition on scroll / resize ────────────────────────────────────────
  const reposition = useCallback(() => {
    if (!currentStep) return;
    const el = document.getElementById(currentStep.targetId);
    if (!el) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      setTargetRect({
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      });
    });
  }, [currentStep]);

  // ── Fire measurement when step index changes ─────────────────────────────
  useEffect(() => {
    if (!isActive || !currentStep) return;
    measureTarget(currentStep);
    return () => {
      if (measureTimerRef.current) clearTimeout(measureTimerRef.current);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
    // stepIndex as dep drives re-run on step change; measureTarget is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, stepIndex]);

  // ── Attach scroll / resize listeners while active ────────────────────────
  useEffect(() => {
    if (!isActive) return;
    window.addEventListener('scroll', reposition, { passive: true, capture: true });
    window.addEventListener('resize', reposition, { passive: true });
    return () => {
      window.removeEventListener('scroll', reposition, { capture: true });
      window.removeEventListener('resize', reposition);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isActive, reposition]);

  // ── Reset to step 0 whenever the tour is (re-)opened ─────────────────────
  useEffect(() => {
    if (isActive) setStepIndex(0);
  }, [isActive]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    if (!isLastStep) {
      setStepIndex((s) => s + 1);
    } else {
      onClose();
    }
  }, [isLastStep, onClose]);

  const handlePrev = useCallback(() => {
    if (stepIndex > 0) setStepIndex((s) => s - 1);
  }, [stepIndex]);

  // ── Derived positions ─────────────────────────────────────────────────────
  const spotlightRect = useMemo(() => {
    if (!targetRect) return null;
    return {
      x: targetRect.left - SPOTLIGHT_PAD,
      y: targetRect.top - SPOTLIGHT_PAD,
      w: targetRect.width + SPOTLIGHT_PAD * 2,
      h: targetRect.height + SPOTLIGHT_PAD * 2,
    };
  }, [targetRect]);

  const tooltipPos = useMemo<TooltipPos | null>(() => {
    if (!targetRect || isLocating) return null;
    return computeTooltipPos(targetRect);
  }, [targetRect, isLocating]);

  if (!isActive) return null;

  return (
    <OverlayPortal>
      <AnimatePresence>
        {isActive && (
          <motion.div
            key="threadly-tour-root"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9998,
              pointerEvents: 'none',
            }}
          >
            {/* ── SVG spotlight overlay ─────────────────────────────────── */}
            <svg
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                overflow: 'visible',
              }}
              aria-hidden="true"
            >
              <defs>
                <mask id="threadly-tour-spotlight-mask">
                  <rect width="100%" height="100%" fill="white" />
                  {spotlightRect && (
                    <rect
                      style={{
                        transition:
                          'x 0.35s ease, y 0.35s ease, width 0.35s ease, height 0.35s ease',
                      }}
                      x={spotlightRect.x}
                      y={spotlightRect.y}
                      width={spotlightRect.w}
                      height={spotlightRect.h}
                      rx={10}
                      ry={10}
                      fill="black"
                    />
                  )}
                </mask>
              </defs>

              {/* Dark backdrop with cutout */}
              <rect
                width="100%"
                height="100%"
                fill="rgba(0,0,0,0.72)"
                mask="url(#threadly-tour-spotlight-mask)"
              />

              {/* Glowing border ring around spotlight */}
              {spotlightRect && (
                <rect
                  style={{
                    transition:
                      'x 0.35s ease, y 0.35s ease, width 0.35s ease, height 0.35s ease',
                  }}
                  x={spotlightRect.x}
                  y={spotlightRect.y}
                  width={spotlightRect.w}
                  height={spotlightRect.h}
                  rx={10}
                  ry={10}
                  fill="none"
                  stroke="rgba(99,179,237,0.75)"
                  strokeWidth={2}
                />
              )}
            </svg>

            {/* ── Tooltip card ─────────────────────────────────────────── */}
            <AnimatePresence mode="wait">
              {tooltipPos && currentStep && (
                <motion.div
                  key={`tour-tooltip-${stepIndex}`}
                  initial={{
                    opacity: 0,
                    scale: 0.92,
                    y: tooltipPos.placement === 'bottom' ? -8 : 8,
                  }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{
                    opacity: 0,
                    scale: 0.92,
                    y: tooltipPos.placement === 'bottom' ? -8 : 8,
                  }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  style={{
                    position: 'fixed',
                    top: tooltipPos.top,
                    left: tooltipPos.left,
                    width: TOOLTIP_WIDTH,
                    zIndex: 10000,
                    pointerEvents: 'auto',
                  }}
                  className="rounded-2xl bg-white dark:bg-slate-900 shadow-[0_12px_50px_rgba(0,0,0,0.45)] border border-slate-200 dark:border-white/10"
                >
                  {/* Arrow pointer (rotated square) */}
                  <div
                    className={clsx(
                      'absolute w-4 h-4 rotate-45 bg-white dark:bg-slate-900',
                      tooltipPos.placement === 'bottom'
                        ? 'border-t border-l border-slate-200 dark:border-white/10 -top-2'
                        : 'border-b border-r border-slate-200 dark:border-white/10 -bottom-2',
                    )}
                    style={{ left: tooltipPos.arrowLeft }}
                  />

                  <div className="p-5">
                    {/* Header row: step counter + close */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-400">
                        Step {stepIndex + 1} of {steps.length}
                      </span>
                      <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close tour"
                        className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-sm leading-none p-1 rounded"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Content */}
                    <div className="flex items-start gap-3">
                      {currentStep.emoji && (
                        <span className="text-[22px] flex-shrink-0 leading-none mt-0.5">
                          {currentStep.emoji}
                        </span>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
                          {currentStep.title}
                        </p>
                        <p className="mt-1.5 text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed">
                          {currentStep.description}
                        </p>
                      </div>
                    </div>

                    {/* Footer: dots + navigation */}
                    <div className="mt-4 flex items-center justify-between">
                      {/* Progress dots */}
                      <div className="flex items-center gap-1.5">
                        {steps.map((_, i) => (
                          <div
                            key={i}
                            className={clsx(
                              'rounded-full transition-all duration-200',
                              i === stepIndex
                                ? 'w-5 h-2 bg-sky-600'
                                : i < stepIndex
                                  ? 'w-2 h-2 bg-sky-300 dark:bg-sky-500'
                                  : 'w-2 h-2 bg-slate-200 dark:bg-slate-700',
                            )}
                          />
                        ))}
                      </div>

                      {/* Back / Next buttons */}
                      <div className="flex items-center gap-2">
                        {stepIndex > 0 && (
                          <button
                            type="button"
                            onClick={handlePrev}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            ← Back
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleNext}
                          className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-sky-600 text-white hover:bg-sky-700 active:bg-sky-800 transition-colors shadow-sm"
                        >
                          {isLastStep ? 'Done ✓' : 'Next →'}
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Skip button (top-right corner) ───────────────────────── */}
            <button
              type="button"
              onClick={onClose}
              style={{
                position: 'fixed',
                top: 20,
                right: 20,
                zIndex: 10001,
                pointerEvents: 'auto',
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-full bg-white/15 backdrop-blur-sm border border-white/25 text-white hover:bg-white/25 transition-colors shadow-lg"
            >
              Skip tour ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </OverlayPortal>
  );
};
