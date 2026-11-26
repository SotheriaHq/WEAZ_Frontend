import { useEffect, useId, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import type { MarketFacets } from '@/api/MarketV2Api';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import Button from '@/components/ui/Button';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useOverlayBackClose } from '@/hooks/useOverlayBackClose';
import { useScrollLock } from '@/hooks/useScrollLock';
import { selectIsMobile } from '@/features/uiSlice';
import {
  countActiveMarketFilters,
  EMPTY_MARKET_FILTERS,
  type MarketFilters,
} from '@/features/market-v2/marketFilterState';
import { MarketFilterControls } from './MarketFilterControls';

export interface MarketFilterSheetProps {
  open: boolean;
  filters: MarketFilters;
  facets: MarketFacets | null;
  onApply: (next: MarketFilters) => void;
  onClose: () => void;
  showAudience?: boolean;
}

/**
 * Phone and tablet filter sheet. Choices are a draft until "Show results", so
 * no request fires while the shopper adjusts; "Reset" returns the draft to
 * what is applied. Back, Escape and the backdrop close it, and focus returns
 * to the button that opened it.
 */
export function MarketFilterSheet({ open, filters, facets, onApply, onClose, showAudience = false }: MarketFilterSheetProps) {
  const isMobile = useSelector(selectIsMobile);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const [draft, setDraft] = useState(filters);
  useEffect(() => {
    if (open) setDraft(filters);
  }, [filters, open]);

  useScrollLock(open);
  useOverlayBackClose(open, onClose, isMobile);
  useFocusTrap({ active: open, containerRef: panelRef, onEscape: onClose });

  if (!open) return null;
  const draftCount = countActiveMarketFilters(draft);

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-layer-modal flex items-end justify-center sm:items-center">
        <button
          type="button"
          aria-label="Close filters"
          tabIndex={-1}
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm dark:bg-black/60"
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          className="relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl bg-[color:var(--surface-primary)] shadow-2xl outline-none motion-safe:animate-slideDown sm:max-w-lg sm:rounded-3xl"
        >
          <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-5">
            <h2 id={titleId} className="text-lg font-extrabold text-[color:var(--wiez-text-primary)]">
              Sort &amp; filter
            </h2>
            <button
              type="button"
              onClick={() => setDraft(filters)}
              className="rounded-full px-2 py-1 text-xs font-bold text-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--wiez-border-focus)] dark:text-purple-300"
            >
              Reset
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
            <MarketFilterControls filters={draft} facets={facets} onChange={setDraft} showAudience={showAudience} />
          </div>
          <div className="flex items-center gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.25)]">
            <Button
              type="button"
              variant="secondary"
              size="md"
              disabled={draftCount === 0}
              onClick={() => setDraft(EMPTY_MARKET_FILTERS)}
            >
              Clear all
            </Button>
            <Button
              type="button"
              variant="brand"
              size="md"
              fullWidth
              onClick={() => {
                onApply(draft);
                onClose();
              }}
            >
              Show results
            </Button>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}

export default MarketFilterSheet;
