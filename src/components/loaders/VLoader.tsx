import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface VLoaderProps {
  size?: number;
  progress?: number | null;
  phase?: 'idle' | 'starting' | 'loading' | 'finishing' | 'complete';
  showLabel?: boolean;
  className?: string;
}

const clampProgress = (value?: number | null): number | null => {
  if (value === null || value === undefined) return null;
  if (Number.isNaN(value)) return null;
  return Math.min(100, Math.max(0, value));
};

const VLoader: React.FC<VLoaderProps> = ({
  size = 64,
  progress = null,
  phase = 'loading',
  showLabel = true,
  className = '',
}) => {
  const normalized = useMemo(() => clampProgress(progress), [progress]);
  const [animatedProgress, setAnimatedProgress] = useState(phase === 'starting' ? 12 : 8);
  const [displayProgress, setDisplayProgress] = useState(animatedProgress);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (normalized !== null) {
      setAnimatedProgress(normalized);
      return;
    }
    if (phase === 'complete') {
      setAnimatedProgress(100);
      return;
    }
    if (phase === 'finishing') {
      setAnimatedProgress(94);
      return;
    }
    if (phase === 'starting') {
      setAnimatedProgress(12);
      return;
    }

    const timer = window.setInterval(() => {
      setAnimatedProgress((current) => {
        if (current >= 92) return 92;
        const nextStep = current < 35 ? 4 : current < 70 ? 2 : 1;
        return Math.min(92, current + nextStep);
      });
    }, 320);

    return () => window.clearInterval(timer);
  }, [normalized, phase]);

  // Smoothly animate the display progress toward the target
  const target = normalized ?? animatedProgress;
  useEffect(() => {
    let active = true;
    const animate = () => {
      if (!active) return;
      setDisplayProgress((current) => {
        const diff = target - current;
        if (Math.abs(diff) < 0.5) return target;
        // Ease toward target: move ~12% of the remaining distance per frame
        return current + diff * 0.12;
      });
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  const completion = Math.round(displayProgress);
  const isActive = phase !== 'complete' && phase !== 'idle';
  const phaseLabel =
    phase === 'complete'
      ? 'Thread complete'
      : phase === 'finishing'
        ? 'Sealing thread'
        : phase === 'starting'
          ? 'Starting thread'
          : 'Winding thread';
  const ringStyle = {
    background: `conic-gradient(rgba(147,51,234,0.95) ${completion * 3.6}deg, rgba(255,255,255,0.1) 0deg)`,
  };

  return (
    <div className={`inline-flex flex-col items-center justify-center ${className}`} role="status" aria-live="polite">
      <div
        className="relative rounded-full p-[3px]"
        style={{ width: size, height: size, ...ringStyle }}
        aria-label={`${phaseLabel} ${completion}%`}
      >
        <div className="relative flex h-full w-full items-center justify-center rounded-full bg-[#0f0f0f] text-white">
          <span
            className={`text-[1.45rem] leading-none ${isActive ? 'animate-[spin_1.8s_linear_infinite]' : ''}`}
            aria-hidden="true"
          >
            {phase === 'complete' ? '✅' : '🧵'}
          </span>
        </div>
      </div>
      {showLabel ? (
        <div className="mt-2 text-center">
          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{phaseLabel}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">{completion}% complete</p>
        </div>
      ) : null}
    </div>
  );
};

export default VLoader;
