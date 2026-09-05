import { memo } from 'react';
import type { BagPulseStatus } from '@/api/StoreApi';
import { BAG_IT_EMOJI } from '@/constants/bagging';

export type BagPulseContext = 'single' | 'multi_card' | 'rail' | 'detail';

interface BagPulseIconProps {
  status: BagPulseStatus;
  context?: BagPulseContext;
  size?: number;
  count?: number;
  disabled?: boolean;
  className?: string;
}

const contextClass: Record<BagPulseContext, string> = {
  single: 'bag-pulse-single',
  detail: 'bag-pulse-detail',
  rail: 'bag-pulse-rail',
  multi_card: 'bag-pulse-multi',
};

const statusClass: Record<BagPulseStatus, string> = {
  not_bagged: 'bag-pulse-not-bagged',
  previously_bagged: 'bag-pulse-previously-bagged',
  currently_bagged: 'bag-pulse-currently-bagged',
  bagging: 'bag-pulse-bagging',
  disabled: 'bag-pulse-disabled',
};

export const BagPulseIcon = memo(function BagPulseIcon({
  status,
  context = 'single',
  size = 34,
  count,
  disabled = false,
  className = '',
}: BagPulseIconProps) {
  const resolvedStatus = disabled ? 'disabled' : status;

  return (
    /*
      The glyph is sized from `size`, never inherited.

      `.bag-pulse-core` declared no font-size, so the emoji rendered at whatever
      the surrounding card happened to set — 11px inside a 28px chip on the
      market panels. Deriving it here keeps the emoji proportional to the icon
      at every call site.
    */
    <span
      className={`bag-pulse-icon ${contextClass[context]} ${statusClass[resolvedStatus]} ${className}`}
      style={{
        width: size,
        height: size,
        ['--bag-glyph-size' as string]: `${Math.round(size * 0.6)}px`,
      }}
      aria-hidden="true"
    >
      <span className="bag-pulse-ring" />
      <span className="bag-pulse-core">{BAG_IT_EMOJI}</span>
      {typeof count === 'number' && count > 0 ? (
        <span className="bag-pulse-count">{count > 99 ? '99+' : count}</span>
      ) : null}
    </span>
  );
});

export default BagPulseIcon;
