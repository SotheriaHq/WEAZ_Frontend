import React, { useLayoutEffect, useRef } from 'react';

interface FitTextProps {
  text: string;
  /** Preferred font size in px — used whenever the text fits. */
  maxPx: number;
  /** Hard floor so extreme content stays legible. Default 8. */
  minPx?: number;
  /** Classes for the inner text span (font family/weight/color etc.). */
  className?: string;
}

/**
 * Single-line text that SCALES DOWN to fit its container instead of wrapping
 * or truncating — profile names, locations, and tag chips must always render
 * in full on one line at any viewport width.
 *
 * Works as a flex child (outer span is min-w-0 + overflow-hidden, so flexbox
 * clamps it to the available space); a ResizeObserver refits on any container
 * resize. Measurement sets font-size directly on the inner span, so the
 * container's own layout never oscillates.
 */
const FitText: React.FC<FitTextProps> = ({ text, maxPx, minPx = 8, className }) => {
  const boxRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const el = textRef.current;
    if (!box || !el) return undefined;

    const fit = () => {
      // Measure at the preferred size first, then scale down proportionally.
      el.style.fontSize = `${maxPx}px`;
      const available = box.clientWidth;
      if (!available) return;
      const needed = el.scrollWidth;
      if (needed > available) {
        el.style.fontSize = `${Math.max(minPx, Math.floor((maxPx * available) / needed))}px`;
      }
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [text, maxPx, minPx]);

  return (
    <span ref={boxRef} className="block min-w-0 max-w-full overflow-hidden">
      <span ref={textRef} className={`inline-block whitespace-nowrap align-middle ${className ?? ''}`}>
        {text}
      </span>
    </span>
  );
};

export default FitText;
