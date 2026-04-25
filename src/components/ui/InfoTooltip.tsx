import React, { useState, useRef, useEffect, useCallback } from 'react';
import { OverlayPortal } from './OverlayPortal';

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
  const [tooltipPosition, setTooltipPosition] = useState({
    top: 0,
    left: 0,
    placement: 'top' as 'top' | 'bottom',
  });
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    if (!visible || !wrapperRef.current || !tooltipRef.current) return;

    const triggerRect = wrapperRef.current.getBoundingClientRect();
    const bubbleRect = tooltipRef.current.getBoundingClientRect();
    const margin = 12;

    let left = triggerRect.left + triggerRect.width / 2 - bubbleRect.width / 2;
    left = Math.min(
      Math.max(margin, left),
      Math.max(margin, window.innerWidth - bubbleRect.width - margin),
    );

    let top = triggerRect.top - bubbleRect.height - 10;
    let placement: 'top' | 'bottom' = 'top';

    if (top < margin) {
      top = triggerRect.bottom + 10;
      placement = 'bottom';
    }

    setTooltipPosition({
      top,
      left,
      placement,
    });
  }, [visible]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    const target = e.target as Node;
    if (
      wrapperRef.current &&
      !wrapperRef.current.contains(target) &&
      !(tooltipRef.current && tooltipRef.current.contains(target))
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

  useEffect(() => {
    if (!visible) return;

    const raf = window.requestAnimationFrame(() => {
      updatePosition();
    });

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [updatePosition, visible]);

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

      {visible ? (
        <OverlayPortal>
          <div
            ref={tooltipRef}
            role="tooltip"
            className="fixed z-[2147483646] w-56 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs font-normal leading-relaxed text-gray-700 shadow-lg pointer-events-none animate-in fade-in-0 zoom-in-95 duration-150 dark:border-white/10 dark:bg-zinc-800 dark:text-gray-200 dark:shadow-black/30"
            style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
          >
            {text}
            {tooltipPosition.placement === 'top' ? (
              <div className="absolute left-1/2 top-full -translate-x-1/2 -mt-px">
                <div className="h-2 w-2 -translate-y-1 rotate-45 border-b border-r border-gray-200 bg-white dark:border-white/10 dark:bg-zinc-800" />
              </div>
            ) : (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mt-px">
                <div className="h-2 w-2 translate-y-1 rotate-45 border-l border-t border-gray-200 bg-white dark:border-white/10 dark:bg-zinc-800" />
              </div>
            )}
          </div>
        </OverlayPortal>
      ) : null}
    </span>
  );
};

export default InfoTooltip;
