import React from 'react';

export interface CustomOrderIndicatorProps {
  pointsCount?: number | null;
  className?: string;
  title?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  onClick?: (event: React.MouseEvent<HTMLButtonElement | HTMLSpanElement>) => void;
  interactive?: boolean;
}

const SCISSORS_EMOJI = '✂️';

export const CustomOrderIndicator: React.FC<CustomOrderIndicatorProps> = ({
  pointsCount,
  className = '',
  title,
  size = 'md',
  onClick,
  interactive = false,
}) => {
  const count = typeof pointsCount === 'number' && Number.isFinite(pointsCount) && pointsCount > 0 ? pointsCount : null;

  const tooltip =
    title ||
    (count !== null
      ? `Custom Order available (${count} measurement point${count === 1 ? '' : 's'} required)`
      : 'Custom Order available');

  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }[size];

  const badgeSizeClasses = {
    xs: '-top-1 -right-2 text-[8px] min-w-[12px] h-[12px] px-0.5',
    sm: '-top-1.5 -right-2.5 text-[9px] min-w-[13px] h-[13px] px-0.5',
    md: '-top-2 -right-3 text-[10px] min-w-[15px] h-[15px] px-1',
    lg: '-top-2.5 -right-3.5 text-[11px] min-w-[17px] h-[17px] px-1',
  }[size];

  const content = (
    <span className={`relative inline-flex items-center justify-center select-none ${className}`} title={tooltip}>
      <span
        role="img"
        aria-label="Custom Order"
        className={`${sizeClasses} leading-none transition-transform ${interactive ? 'hover:scale-110' : ''}`}
      >
        {SCISSORS_EMOJI}
      </span>
      {count !== null && (
        <span
          aria-label={`${count} measurement points required`}
          className={`absolute ${badgeSizeClasses} rounded-full bg-fuchsia-600 text-white font-bold leading-none flex items-center justify-center shadow-sm pointer-events-none transform translate-x-0.5 -translate-y-0.5`}
        >
          {count}
        </span>
      )}
    </span>
  );

  if (interactive && onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center justify-center p-0.5 bg-transparent border-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500 rounded"
        title={tooltip}
        aria-label={tooltip}
      >
        {content}
      </button>
    );
  }

  return content;
};

export default CustomOrderIndicator;
