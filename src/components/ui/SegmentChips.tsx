import React from 'react';

type Option = { key: string; label: string; title?: string };

interface SegmentChipsProps {
  options: Option[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
  size?: 'sm' | 'md';
  ariaLabel?: string;
}

const sizeClasses: Record<'sm' | 'md', { container: string; chip: string }> = {
  sm: { container: 'p-1', chip: 'px-2 py-1 text-xs min-w-[60px]' },
  md: { container: 'p-1.5', chip: 'px-3 py-2 text-xs min-w-[72px]' },
};

const SegmentChips: React.FC<SegmentChipsProps> = ({ options, value, onChange, className = '', size = 'md', ariaLabel }) => {
  const sizes = sizeClasses[size];
  return (
    <div
      className={`inline-flex items-center rounded-full border border-slate-300/70 dark:border-white/15 bg-white/60 dark:bg-white/5 backdrop-blur-md shadow-sm ${sizes.container} ${className}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const selected = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            title={opt.title ?? opt.label}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(opt.key)}
            className={`rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 ${sizes.chip} ` +
              (selected
                ? 'bg-black/10 text-gray-900 dark:bg-white/20 dark:text-white'
                : 'text-gray-700 dark:text-white/80 hover:text-gray-900 dark:hover:text-white')}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};

export default SegmentChips;
