import React, { useState, useRef, useEffect, useCallback } from 'react';

interface InfoTooltipProps {
  /** The tooltip text to display */
  text: string;
  /** Optional custom className for the wrapper */
  className?: string;
}

/**
 * An inline info icon (ⓘ) that shows a tooltip on hover (desktop) or click (mobile).
 * Designed to sit inline after form labels.
 */
const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, className = '' }) => {
  const [visible, setVisible] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      wrapperRef.current &&
      !wrapperRef.current.contains(e.target as Node)
    ) {
      setVisible(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [visible, handleClickOutside]);

  // Reposition tooltip if it overflows viewport
  useEffect(() => {
    if (!visible || !tooltipRef.current) return;
    const rect = tooltipRef.current.getBoundingClientRect();
    const tooltip = tooltipRef.current;

    // Reset transforms first
    tooltip.style.transform = 'translateX(-50%)';

    if (rect.right > window.innerWidth - 12) {
      tooltip.style.transform = `translateX(calc(-50% - ${rect.right - window.innerWidth + 16}px))`;
    } else if (rect.left < 12) {
      tooltip.style.transform = `translateX(calc(-50% + ${16 - rect.left}px))`;
    }
  }, [visible]);

  return (
    <span
      ref={wrapperRef}
      className={`relative inline-flex items-center ml-1.5 ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setVisible((prev) => !prev);
        }}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold leading-none
          bg-gray-200/80 dark:bg-white/10 text-gray-500 dark:text-gray-400
          hover:bg-purple-100 dark:hover:bg-purple-500/20 hover:text-purple-600 dark:hover:text-purple-300
          transition-all duration-150 cursor-help focus:outline-none focus:ring-1 focus:ring-purple-400/40"
        aria-label="More info"
        tabIndex={-1}
      >
        i
      </button>

      {visible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className="absolute z-50 bottom-full left-1/2 mb-2 w-56 px-3 py-2.5
            text-xs leading-relaxed font-normal text-gray-700 dark:text-gray-200
            bg-white dark:bg-zinc-800 border border-gray-200 dark:border-white/10
            rounded-xl shadow-lg dark:shadow-black/30
            pointer-events-none animate-in fade-in-0 zoom-in-95 duration-150"
          style={{ transform: 'translateX(-50%)' }}
        >
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="w-2 h-2 bg-white dark:bg-zinc-800 border-r border-b border-gray-200 dark:border-white/10 rotate-45 -translate-y-1" />
          </div>
        </div>
      )}
    </span>
  );
};

export default InfoTooltip;
