import React from 'react';

export interface TabsProps {
  tabs: string[];
  /** Optional display labels; tab keys stay stable for routing/state. */
  labels?: Record<string, string | React.ReactNode>;
  /** Optional icons for each tab. */
  icons?: Record<string, React.ReactNode>;
  /** Optional badges / counts for each tab. */
  badges?: Record<string, number | string | React.ReactNode>;
  activeTab: string;
  onTabChange: (tab: string) => void;
  className?: string;
  compact?: boolean;
  size?: 'sm' | 'md' | 'lg';
  ariaLabel?: string;
}

/**
 * Tab strip with an exact subpixel-measured, smooth sliding indicator.
 *
 * Measurements calculate the precise bounding geometry of the active tab's
 * inner label relative to the scrolling navigation container.
 * This guarantees the indicator line aligns strictly with the visible label
 * without bleeding into flex gaps or overflowing into adjacent tabs.
 *
 * Transitions use GPU-composited `transform: translateX(...)` and `width: ...px`
 * with a natural iOS/macOS spring curve (`cubic-bezier(0.25, 1, 0.5, 1)`).
 */
const Tabs: React.FC<TabsProps> = ({
  tabs,
  labels,
  icons,
  badges,
  activeTab,
  onTabChange,
  className = '',
  compact = false,
  size = 'md',
  ariaLabel = 'Tabs',
}) => {
  const navRef = React.useRef<HTMLElement | null>(null);
  const tabRefs = React.useRef(new Map<string, HTMLButtonElement>());
  const labelRefs = React.useRef(new Map<string, HTMLSpanElement>());
  const [indicator, setIndicator] = React.useState({
    left: 0,
    width: 0,
    ready: false,
  });

  const isSmall = compact || size === 'sm';

  const measure = React.useCallback(() => {
    const nav = navRef.current;
    const activeBtn = tabRefs.current.get(activeTab);
    if (!nav || !activeBtn) return;

    const activeLabel = labelRefs.current.get(activeTab);
    const navRect = nav.getBoundingClientRect();

    let left = 0;
    let width = 0;

    if (activeLabel) {
      const labelRect = activeLabel.getBoundingClientRect();
      left = labelRect.left - navRect.left + nav.scrollLeft;
      width = Math.max(12, labelRect.width);
    } else {
      const btnRect = activeBtn.getBoundingClientRect();
      left = btnRect.left - navRect.left + nav.scrollLeft + 6;
      width = Math.max(12, btnRect.width - 12);
    }

    setIndicator((current) => {
      const next = {
        left: Math.round(left * 10) / 10,
        width: Math.round(width * 10) / 10,
        ready: true,
      };

      if (
        current.ready &&
        Math.abs(current.left - next.left) < 0.5 &&
        Math.abs(current.width - next.width) < 0.5
      ) {
        return current;
      }
      return next;
    });
  }, [activeTab]);

  React.useLayoutEffect(() => {
    measure();
  }, [measure, tabs, labels, compact, size]);

  React.useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const handleMeasure = () => {
      window.requestAnimationFrame(() => measure());
    };

    const observer = new ResizeObserver(handleMeasure);
    observer.observe(nav);
    tabRefs.current.forEach((node) => observer.observe(node));
    labelRefs.current.forEach((node) => observer.observe(node));

    window.addEventListener('resize', handleMeasure);
    document.fonts?.ready.then(handleMeasure).catch(() => undefined);

    // Initial rAF to ensure layout is settled
    const rafId = window.requestAnimationFrame(measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', handleMeasure);
      window.cancelAnimationFrame(rafId);
    };
  }, [measure, tabs]);

  // Keep the selected tab reachable when the strip overflows on small screens
  React.useEffect(() => {
    const active = tabRefs.current.get(activeTab);
    active?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    });
  }, [activeTab]);

  return (
    <div className={`border-b border-gray-200/80 dark:border-white/10 ${className}`}>
      <nav
        ref={navRef}
        role="tablist"
        aria-label={ariaLabel}
        className={`no-scrollbar relative flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          isSmall ? 'gap-3 sm:gap-4' : 'gap-5 sm:gap-7'
        }`}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          const icon = icons?.[tab];
          const badge = badges?.[tab];
          const label = labels?.[tab] ?? tab;

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
              className={`group relative inline-flex shrink-0 items-center justify-center whitespace-nowrap px-2 pb-3 pt-2 text-left transition-colors duration-150 touch-manipulation ${
                isSmall ? 'text-xs' : 'text-sm'
              } ${
                isActive
                  ? 'font-semibold text-purple-700 dark:text-purple-300'
                  : 'font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
              }`}
            >
              <span
                ref={(node) => {
                  if (node) labelRefs.current.set(tab, node);
                  else labelRefs.current.delete(tab);
                }}
                className="relative z-10 inline-flex items-center gap-1.5"
              >
                {icon ? (
                  <span
                    aria-hidden="true"
                    className={`inline-flex shrink-0 items-center justify-center transition-transform duration-150 group-hover:scale-105 ${
                      isActive
                        ? 'text-purple-700 dark:text-purple-300'
                        : 'text-gray-400 dark:text-gray-400'
                    }`}
                  >
                    {icon}
                  </span>
                ) : null}

                <span>{label}</span>

                {badge !== undefined && badge !== null ? (
                  <span
                    className={`ml-1 inline-flex items-center justify-center rounded-full px-1.5 py-0.2 text-[10px] font-bold leading-none ${
                      isActive
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200'
                        : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300'
                    }`}
                  >
                    {badge}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}

        {/* Sliding Active Underline Indicator */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 h-[2.5px] rounded-full bg-gradient-to-r from-purple-600 via-fuchsia-600 to-purple-600 shadow-xs will-change-[transform,width] motion-safe:transition-[transform,width,opacity] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.25,1,0.5,1)] dark:from-purple-400 dark:via-fuchsia-400 dark:to-purple-300"
          style={{
            left: 0,
            width: `${indicator.width}px`,
            transform: `translateX(${indicator.left}px) translateZ(0)`,
            opacity: indicator.ready ? 1 : 0,
          }}
        />
      </nav>
    </div>
  );
};

export default Tabs;
