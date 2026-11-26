import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { MarketSignalEvent } from '@/api/MarketApi';
import type { MarketV2Section } from '@/api/MarketV2Api';
import { getMarketSectionEmoji, resolveMarketSectionFormat } from '@/constants/marketSections';
import { RAIL_ITEM_WIDTH, SCROLLER_BASE, SCROLLER_LAYOUT } from '@/components/market/marketRailLayout';
import { useMarketImpressions, type MarketSignalContext } from '@/features/market-v2/marketTelemetry';
import { MarketCardCell, type MarketCardOpen } from './MarketCardCell';
import { prefersReducedMotion } from './marketMotion';

export interface MarketComposedRailProps {
  section: MarketV2Section;
  epoch: string | null;
  onOpen: (section: MarketV2Section) => MarketCardOpen;
  onViewAll: (section: MarketV2Section) => void;
  onTrackSignal: (event: MarketSignalEvent) => void;
  /** Index of the first item to show (the hero may already show item 0). */
  startIndex?: number;
}

/**
 * One server-composed section, items in exactly the order the server sent.
 * Arrow keys move between cards (one tab stop per rail), the title wraps, and
 * "View all" appears only when the server offers it.
 */
function MarketComposedRailImpl({
  section,
  epoch,
  onOpen,
  onViewAll,
  onTrackSignal,
  startIndex = 0,
}: MarketComposedRailProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const items = useMemo(() => section.items.slice(startIndex), [section.items, startIndex]);
  const format = useMemo(
    () => resolveMarketSectionFormat(section.layout, items.map((item) => item.entityType)),
    [items, section.layout],
  );
  const context = useMemo<MarketSignalContext>(
    () => ({ surface: 'MARKET_HOME', sectionKey: section.key, epoch, policyVersion: section.policyVersion }),
    [epoch, section.key, section.policyVersion],
  );
  const observe = useMarketImpressions(context, onTrackSignal);
  const open = useMemo(() => onOpen(section), [onOpen, section]);

  const checkScroll = useCallback(() => {
    const node = scrollerRef.current;
    if (!node) return;
    setCanScrollLeft(node.scrollLeft > 10);
    setCanScrollRight(node.scrollLeft < node.scrollWidth - node.clientWidth - 10);
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll, { passive: true });
    return () => window.removeEventListener('resize', checkScroll);
  }, [checkScroll, items.length]);

  const scrollBy = (direction: -1 | 1) => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollBy({
      left: direction * Math.round(node.clientWidth * 0.8),
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys: Record<string, (current: number, last: number) => number> = {
      ArrowRight: (current, last) => Math.min(last, current + 1),
      ArrowLeft: (current) => Math.max(0, current - 1),
      Home: () => 0,
      End: (_current, last) => last,
    };
    const move = keys[event.key];
    if (!move) return;
    const targets = Array.from(
      scrollerRef.current?.querySelectorAll<HTMLElement>('[data-market-cell]') ?? [],
    ).map((cell) => cell.querySelector<HTMLElement>('a[data-market-card]') ?? cell.querySelector<HTMLElement>('button'));
    const current = targets.findIndex((target) => target === document.activeElement);
    if (current < 0) return;
    event.preventDefault();
    const next = move(current, targets.length - 1);
    targets[next]?.focus();
    targets[next]?.closest('[data-market-cell]')?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };

  const trackViewAll = () => {
    onTrackSignal({
      targetType: 'SECTION',
      targetId: section.key,
      signalType: 'VIEW_ALL_CLICK',
      surface: 'MARKET_HOME',
      sectionKey: section.key,
    });
    onViewAll(section);
  };

  if (items.length === 0) return null;
  const headingId = `market-section-${section.key}`;
  const secondary = section.reason ?? section.subtitle;
  const widthClass =
    format === 'product-grid' || format === 'category-grid'
      ? 'snap-start'
      : `shrink-0 snap-start ${RAIL_ITEM_WIDTH[format] ?? ''}`;
  const viewAllHref = `/market/sections/${encodeURIComponent(section.key)}`;

  return (
    <section className="w-full space-y-4" aria-labelledby={headingId}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2
            id={headingId}
            className="flex min-w-0 items-start gap-2 break-words text-lg font-extrabold leading-tight tracking-tight text-[color:var(--wiez-text-primary)] [overflow-wrap:anywhere] sm:text-2xl"
          >
            <span aria-hidden="true" className="shrink-0">{getMarketSectionEmoji(section.key, format)}</span>
            <span className="min-w-0">{section.title}</span>
          </h2>
          {section.personalization === 'personal' || secondary ? (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-[color:var(--wiez-text-secondary)] sm:text-sm">
              {section.personalization === 'personal' ? (
                <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[11px] font-bold text-purple-700 dark:text-purple-200">
                  For you
                </span>
              ) : null}
              {secondary ? <span className="break-words">{secondary}</span> : null}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {section.viewAll.enabled ? (
            <Link
              to={viewAllHref}
              onClick={trackViewAll}
              aria-label={`${section.viewAll.label}: ${section.title}`}
              className="rounded-full px-1 text-xs font-bold text-purple-700 underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:text-purple-300 sm:text-sm"
            >
              {section.viewAll.label} ›
            </Link>
          ) : null}
          {canScrollLeft || canScrollRight ? (
            <div className="hidden items-center gap-1.5 md:flex">
              <button
                type="button"
                disabled={!canScrollLeft}
                onClick={() => scrollBy(-1)}
                aria-label={`Scroll ${section.title} left`}
                className="wiez-lg-surface wiez-lg-subtle wiez-lg-borderless wiez-lg-interactive flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold disabled:cursor-not-allowed disabled:opacity-30"
              >
                ‹
              </button>
              <button
                type="button"
                disabled={!canScrollRight}
                onClick={() => scrollBy(1)}
                aria-label={`Scroll ${section.title} right`}
                className="wiez-lg-surface wiez-lg-subtle wiez-lg-borderless wiez-lg-interactive flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold disabled:cursor-not-allowed disabled:opacity-30"
              >
                ›
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div
        ref={scrollerRef}
        role="list"
        aria-labelledby={headingId}
        onScroll={checkScroll}
        onKeyDown={handleKeyDown}
        className={`${SCROLLER_BASE} motion-reduce:scroll-auto ${SCROLLER_LAYOUT[format]}`}
      >
        {items.map((item, offset) => {
          const index = startIndex + offset;
          return (
            <div role="listitem" key={`${item.entityType}:${item.id}`} className={widthClass}>
              <MarketCardCell
                item={item}
                index={index}
                format={format}
                observe={observe}
                onOpen={open}
                tabIndex={index === activeIndex ? 0 : -1}
                onCardFocus={setActiveIndex}
                priority={offset < 2}
              />
            </div>
          );
        })}
        {section.viewAll.enabled ? (
          <div role="listitem" className={`${format === 'product-grid' || format === 'category-grid' ? 'row-span-2' : ''} flex shrink-0 snap-start`}>
            <Link
              to={viewAllHref}
              onClick={trackViewAll}
              tabIndex={-1}
              className="group flex w-[132px] flex-col items-center justify-center gap-2 rounded-2xl bg-gray-50 p-4 text-center outline-none transition-colors hover:bg-purple-50 dark:bg-white/[0.04] dark:hover:bg-purple-950/30 sm:w-[168px]"
            >
              <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-900 text-lg font-bold text-white transition-transform group-hover:scale-105 motion-reduce:transition-none dark:bg-white dark:text-gray-900">
                →
              </span>
              <span className="text-xs font-bold text-gray-900 dark:text-white">{section.viewAll.label}</span>
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export const MarketComposedRail = memo(MarketComposedRailImpl);
export default MarketComposedRail;
