import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { MarketSignalEvent } from '@/api/MarketApi';
import type { MarketV2Item } from '@/api/MarketV2Api';
import { DeferredOverlay } from '@/components/ui/DeferredOverlay';
import { selectIsMobile } from '@/features/uiSlice';
import { useOverlayBackClose } from '@/hooks/useOverlayBackClose';
import { useScrollLock } from '@/hooks/useScrollLock';
import type { MarketplaceProduct } from '@/utils/marketProductMapper';
import { marketItemHref } from './marketItemRoutes';
import { marketCardSignal, type MarketSignalContext } from './marketTelemetry';

const MarketProductOverlay = React.lazy(() => import('@/components/market/MarketProductOverlay'));

/**
 * Opening a Market card: products open in the quick-view overlay (Back closes
 * it in place, focus returns to the card), everything else navigates to its
 * web route. The OPEN signal carries the card's telemetry.
 */
export function useMarketItemOpener({
  track,
  flush,
  beforeNavigate,
}: {
  track: (event: MarketSignalEvent) => void;
  flush: () => void;
  beforeNavigate: () => void;
}) {
  const navigate = useNavigate();
  const isMobile = useSelector(selectIsMobile);
  const [selected, setSelected] = useState<MarketplaceProduct | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => {
    setSelected(null);
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    requestAnimationFrame(() => target?.focus());
  }, []);
  useScrollLock(Boolean(selected));
  useOverlayBackClose(Boolean(selected), close, isMobile);

  const openFor = useCallback(
    (context: MarketSignalContext) =>
      (item: MarketV2Item, index: number, product: MarketplaceProduct | null) => {
        const event = marketCardSignal(item, index, context, 'OPEN');
        if (event) track(event);
        flush();
        beforeNavigate();
        if (product) {
          returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          setSelected(product);
          return;
        }
        const href = marketItemHref(item);
        if (href) navigate(href);
      },
    [beforeNavigate, flush, navigate, track],
  );

  const overlay = (
    <DeferredOverlay open={Boolean(selected)}>
      <MarketProductOverlay product={selected} onClose={close} />
    </DeferredOverlay>
  );

  return { openFor, overlay };
}
