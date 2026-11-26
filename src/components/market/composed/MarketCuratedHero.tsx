import { memo, useMemo } from 'react';
import type { MarketSignalEvent } from '@/api/MarketApi';
import type { MarketV2Section } from '@/api/MarketV2Api';
import { formatMarketItemPrice } from '@/components/market/MarketEntityCards';
import { useMarketImpressions, type MarketSignalContext } from '@/features/market-v2/marketTelemetry';
import { MarketCardCell, type MarketCardOpen } from './MarketCardCell';

export interface MarketCuratedHeroProps {
  section: MarketV2Section;
  epoch: string | null;
  onOpen: (section: MarketV2Section) => MarketCardOpen;
  onTrackSignal: (event: MarketSignalEvent) => void;
}

/**
 * The curated lead: shown only when the server's first section is a curated
 * list, with its first item. The card keeps the shared frame and Bag It; the
 * editorial copy sits beside it on wide screens and under it on phones.
 */
function MarketCuratedHeroImpl({ section, epoch, onOpen, onTrackSignal }: MarketCuratedHeroProps) {
  const item = section.items[0];
  const context = useMemo<MarketSignalContext>(
    () => ({ surface: 'MARKET_HOME', sectionKey: section.key, epoch, policyVersion: section.policyVersion }),
    [epoch, section.key, section.policyVersion],
  );
  const observe = useMarketImpressions(context, onTrackSignal);
  const open = useMemo(() => onOpen(section), [onOpen, section]);
  if (!item) return null;
  const headingId = `market-hero-${section.key}`;
  const price = formatMarketItemPrice(item);

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-5 rounded-3xl bg-purple-50/70 p-4 dark:bg-white/[0.04] sm:flex-row sm:items-center sm:gap-8 sm:p-6"
    >
      <div className="w-[62%] max-w-[260px] shrink-0 self-center sm:w-[240px] lg:w-[260px]">
        <MarketCardCell item={item} index={0} format="product-rail" observe={observe} onOpen={open} priority />
      </div>
      <div className="min-w-0 space-y-2">
        <h2
          id={headingId}
          className="break-words text-2xl font-extrabold leading-tight tracking-tight text-[color:var(--wiez-text-primary)] sm:text-3xl"
        >
          {section.title}
        </h2>
        {section.reason ?? section.subtitle ? (
          <p className="break-words text-sm font-semibold text-[color:var(--wiez-text-secondary)] sm:text-base">
            {section.reason ?? section.subtitle}
          </p>
        ) : null}
        <p className="break-words text-base font-bold text-[color:var(--wiez-text-primary)]">
          {item.title}
          {item.brand?.name ? <span className="font-semibold text-[color:var(--wiez-text-secondary)]"> · {item.brand.name}</span> : null}
        </p>
        {price ? <p className="text-lg font-extrabold text-purple-700 dark:text-purple-300">{price}</p> : null}
      </div>
    </section>
  );
}

export const MarketCuratedHero = memo(MarketCuratedHeroImpl);
export default MarketCuratedHero;
