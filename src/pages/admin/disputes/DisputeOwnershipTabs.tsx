/**
 * The queue's triage rail: one rule that travels to the tab you picked.
 *
 * These were rounded pills, which read as filter chips — a set of independent
 * toggles you might combine. They are not: they are mutually exclusive views of
 * one queue, which is a tab bar. An underline says "you are here, and there is
 * one here"; a pill says "this one is on".
 *
 * The indicator is a single absolutely-positioned element measured against the
 * active tab rather than a border on each button. A per-button border has
 * nothing to animate between, so the active state jumps; one element that
 * moves and resizes gives the transition something continuous to interpolate,
 * which is what makes the change read as a rail rather than as a repaint.
 *
 * It re-measures on resize and when the labels change, because the counts in
 * them change width as the queue does.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface OwnershipTab<T extends string> {
  value: T;
  label: string;
  count: number | null;
}

interface Props<T extends string> {
  tabs: Array<OwnershipTab<T>>;
  value: T;
  onChange: (value: T) => void;
}

function DisputeOwnershipTabs<T extends string>({ tabs, value, onChange }: Props<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(
    null,
  );

  const measure = useCallback(() => {
    const container = containerRef.current;
    const active = tabRefs.current.get(value);
    if (!container || !active) return;
    const containerBox = container.getBoundingClientRect();
    const activeBox = active.getBoundingClientRect();
    setIndicator({
      // Relative to the rail, and scroll-aware: the rail scrolls horizontally
      // on narrow screens and an un-adjusted offset drifts as it does.
      left: activeBox.left - containerBox.left + container.scrollLeft,
      width: activeBox.width,
    });
  }, [value]);

  // Layout effect: measure before paint so the indicator never renders at a
  // stale position for a frame on first mount.
  useLayoutEffect(measure, [measure, tabs]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    // `ResizeObserver` rather than a window listener: the rail can change width
    // without the window doing so — a sidebar collapsing, a count growing a
    // digit — and a window listener misses both.
    const observer = new ResizeObserver(() => measure());
    observer.observe(container);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label="Filter disputes by ownership"
      className="relative flex items-center gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800"
      style={{ scrollbarWidth: 'none' }}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value || 'all'}
            ref={(node) => {
              if (node) tabRefs.current.set(tab.value, node);
              else tabRefs.current.delete(tab.value);
            }}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={`relative whitespace-nowrap px-4 py-3 text-sm transition-colors duration-200 ${
              active
                ? 'font-semibold text-primary'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
            }`}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 ? (
              <span className="ml-1.5 tabular-nums opacity-70">{tab.count}</span>
            ) : null}
          </button>
        );
      })}

      {indicator ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-primary transition-all duration-300 ease-out motion-reduce:transition-none"
          style={{ left: indicator.left, width: indicator.width }}
        />
      ) : null}
    </div>
  );
}

export default DisputeOwnershipTabs;
