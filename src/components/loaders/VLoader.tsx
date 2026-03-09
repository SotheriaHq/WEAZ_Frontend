import React, { useMemo } from 'react';

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
  const derivedProgress = normalized ?? (phase === 'complete' ? 100 : phase === 'finishing' ? 90 : phase === 'starting' ? 12 : 56);
  const completion = Math.round(derivedProgress);
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
            className={`text-[1.45rem] leading-none ${phase === 'complete' ? '' : 'animate-[spin_1.8s_linear_infinite]'}`}
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
