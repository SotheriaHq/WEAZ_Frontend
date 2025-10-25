import React, { useId, useMemo } from 'react';

export interface VLoaderProps {
  size?: number;
  progress?: number | null;
  showCheckOnComplete?: boolean;
  className?: string;
}

const clampProgress = (value?: number | null): number | null => {
  if (value === null || value === undefined) return null;
  if (Number.isNaN(value)) return null;
  return Math.min(100, Math.max(0, value));
};

const VLoader: React.FC<VLoaderProps> = ({
  size = 56,
  progress = null,
  showCheckOnComplete = true,
  className = '',
}) => {
  const clipId = useId().replace(/:/g, '');
  const normalized = useMemo(() => clampProgress(progress), [progress]);
  const isComplete = normalized !== null && normalized >= 100;
  const fillHeight = normalized !== null ? (normalized / 100) * 96 : 96;
  const fillY = 108 - fillHeight;

  return (
    <div
      className={`inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        role="status"
        aria-live="polite"
        className="overflow-visible"
      >
        <defs>
          <clipPath id={`${clipId}-clip`}>
            <path d="M12 12 L60 108 L108 12 L88 12 L60 72 L32 12 Z" />
          </clipPath>
          <linearGradient id={`${clipId}-gradient`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="45%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
          <linearGradient
            id={`${clipId}-shine`}
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        {normalized === null ? (
          <g clipPath={`url(#${clipId}-clip)`}>
            <rect
              className="v-loader__fillLoop"
              width="96"
              height="96"
              x="12"
              y="12"
              fill={`url(#${clipId}-gradient)`}
            />
          </g>
        ) : (
          <rect
            width="96"
            height={fillHeight}
            x="12"
            y={fillY}
            clipPath={`url(#${clipId}-clip)`}
            fill={`url(#${clipId}-gradient)`}
            style={{
              transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1), y 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        )}

        <path
          d="M12 12 L60 108 L108 12"
          stroke="rgba(15, 23, 42, 0.65)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M18 12 L60 100 L102 12"
          stroke="rgba(148, 163, 184, 0.35)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        <path
          d="M24 18 L60 88 L96 18"
          stroke={`url(#${clipId}-shine)`}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {isComplete && showCheckOnComplete ? (
          <path
            d="M40 66 L55 82 L82 50"
            stroke="#34d399"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ) : null}
      </svg>
    </div>
  );
};

export default VLoader;
