import React from 'react';

interface TabsProps {
  tabs: string[];
  /** Optional display labels; tab keys stay stable for routing/state. */
  labels?: Record<string, string>;
  activeTab: string;
  onTabChange: (tab: string) => void;
  className?: string;
  compact?: boolean;
}

/**
 * Tab strip with a single sliding underline.
 *
 * The previous version gave EVERY tab its own `border-b-2` and swapped it
 * between `border-purple-500` and `border-transparent` under `transition-colors`.
 * That has no motion in it at all: the old underline fades out where it was
 * while the new one fades in somewhere else, which reads as the indicator
 * blinking out and reappearing rather than travelling. It was worst on mobile
 * browsers, where `-mb-px` pulled a 2px border onto a fractional device-pixel
 * boundary and the fade could land on a frame where neither underline was
 * fully painted — the bar simply vanished mid-tap.
 *
 * Now there is exactly one indicator element, positioned from the measured
 * geometry of the active tab and moved with a `transform`/`width` transition.
 * Transforms are composited, so the travel stays smooth on low-end phones, and
 * because the element never unmounts there is no frame where it does not exist.
 */
const Tabs: React.FC<TabsProps> = ({
  tabs,
  labels,
  activeTab,
  onTabChange,
  className = '',
  compact = false,
}) => {
  const navRef = React.useRef<HTMLElement | null>(null);
  const tabRefs = React.useRef(new Map<string, HTMLButtonElement>());
  const [indicator, setIndicator] = React.useState({
    left: 0,
    width: 0,
    ready: false,
  });

  const measure = React.useCallback(() => {
    const nav = navRef.current;
    const active = tabRefs.current.get(activeTab);
    if (!nav || !active) return;

    // offsetLeft is relative to the scrolling nav, so the indicator stays
    // correct when the strip is scrolled horizontally on a narrow screen.
    setIndicator((current) => {
      const next = {
        left: active.offsetLeft,
        width: active.offsetWidth,
        ready: true,
      };
      return current.left === next.left &&
        current.width === next.width &&
        current.ready
        ? current
        : next;
    });
  }, [activeTab]);

  React.useLayoutEffect(() => {
    measure();
  }, [measure, tabs, labels, compact]);

  React.useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    // Labels change width when webfonts land and when the container resizes;
    // a stale measurement leaves the bar under the wrong tab.
    const observer = new ResizeObserver(() => measure());
    observer.observe(nav);
    tabRefs.current.forEach((node) => observer.observe(node));

    window.addEventListener('resize', measure);
    document.fonts?.ready.then(() => measure()).catch(() => undefined);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure, tabs]);

  // Keep the selected tab reachable when the strip overflows on a phone.
  React.useEffect(() => {
    const active = tabRefs.current.get(activeTab);
    active?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }, [activeTab]);

  return (
    <div
      className={`border-b border-gray-200 dark:border-gray-700 ${className}`}
    >
      <nav
        ref={navRef}
        role="tablist"
        aria-label="Tabs"
        // `gap`, not `space-x`. Tailwind's `space-x-*` compiles to
        // `> * + * { margin-left: … }`, which matches EVERY subsequent child —
        // including the absolutely-positioned indicator below. An abspos element
        // still honours its own margin, so `left: 0` became `left: 24px` and the
        // bar sat exactly one gap to the right of the tab it belonged to. `gap`
        // only affects flex items, and an abspos child is not one.
        className={`no-scrollbar relative flex overflow-x-auto ${
          compact ? 'gap-4' : 'gap-6'
        }`}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              ref={(node) => {
                if (node) tabRefs.current.set(tab, node);
                else tabRefs.current.delete(tab);
              }}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onTabChange(tab)}
              className={`relative whitespace-nowrap px-1 transition-colors ${
                compact ? 'py-2.5 text-xs' : 'py-3 text-sm'
              } ${
                isActive
                  ? 'font-semibold text-purple-700 dark:text-purple-300'
                  : 'font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {labels?.[tab] ?? tab}
            </button>
          );
        })}

        {/* One indicator for the whole strip. `scaleX` off a fixed 1px base
            keeps the animation on the compositor; animating `width` directly
            re-lays out the strip on every frame. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-px origin-left rounded-full bg-purple-500 will-change-transform motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out dark:bg-purple-300"
          style={{
            transform: `translateX(${indicator.left}px) scaleX(${indicator.width})`,
            opacity: indicator.ready ? 1 : 0,
          }}
        />
      </nav>
    </div>
  );
};

export default Tabs;
