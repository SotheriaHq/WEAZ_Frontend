import React from 'react';

/**
 * CollapsibleMetaSheet — bottom metadata panel for the mobile design modal.
 *
 * Smoothness strategy (no freezes):
 * - Drag mutates `transform` imperatively (no setState per frame).
 * - Snap transitions use CSS transition + one state write on release.
 * - Content stays mounted; height is fixed to the expanded height so layout
 *   does not reflow mid-gesture.
 *
 * Snap points:
 * - collapsed: peek bar only (handle + brand/price row)
 * - expanded: full metadata (details, tags, comments)
 */

export type MetaSheetSnap = 'collapsed' | 'expanded';

export type CollapsibleMetaSheetProps = {
  snap: MetaSheetSnap;
  onSnapChange: (snap: MetaSheetSnap) => void;
  /** Peek content always visible (brand, price, actions, toggle). */
  peek: React.ReactNode;
  /** Expandable body (description, tags, comments). */
  body: React.ReactNode;
  className?: string;
};

const EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const TRANSITION_MS = 280;
const VELOCITY_THRESHOLD = 0.35; // px/ms

export const CollapsibleMetaSheet: React.FC<CollapsibleMetaSheetProps> = ({
  snap,
  onSnapChange,
  peek,
  body,
  className,
}) => {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const collapsedHRef = React.useRef(0);
  const expandedHRef = React.useRef(0);
  const dragRef = React.useRef<{
    pointerId: number;
    startY: number;
    startOffset: number;
    lastY: number;
    lastT: number;
    velocity: number;
  } | null>(null);
  const offsetRef = React.useRef(0); // how much of the body is hidden (px)

  const measure = React.useCallback(() => {
    const root = rootRef.current;
    const bodyEl = bodyRef.current;
    if (!root || !bodyEl) return;
    const peekH = root.offsetHeight - bodyEl.offsetHeight;
    const bodyH = bodyEl.scrollHeight;
    collapsedHRef.current = Math.max(0, peekH);
    expandedHRef.current = Math.max(0, peekH + bodyH);
    // When collapsed, hide the full body height via translateY.
    const target = snap === 'collapsed' ? bodyH : 0;
    offsetRef.current = target;
    root.style.transition = 'none';
    root.style.transform = `translate3d(0, ${target}px, 0)`;
  }, [snap]);

  React.useLayoutEffect(() => {
    measure();
  }, [measure, peek, body]);

  React.useEffect(() => {
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measure]);

  // Animate to target snap when snap prop changes outside of drag.
  React.useEffect(() => {
    const root = rootRef.current;
    const bodyEl = bodyRef.current;
    if (!root || !bodyEl || dragRef.current) return;
    const bodyH = bodyEl.scrollHeight;
    const target = snap === 'collapsed' ? bodyH : 0;
    offsetRef.current = target;
    root.style.transition = `transform ${TRANSITION_MS}ms ${EASING}`;
    root.style.transform = `translate3d(0, ${target}px, 0)`;
  }, [snap]);

  const applyOffset = (offset: number, withTransition: boolean) => {
    const root = rootRef.current;
    const bodyEl = bodyRef.current;
    if (!root || !bodyEl) return;
    const max = bodyEl.scrollHeight;
    const clamped = Math.min(max, Math.max(0, offset));
    offsetRef.current = clamped;
    root.style.transition = withTransition
      ? `transform ${TRANSITION_MS}ms ${EASING}`
      : 'none';
    root.style.transform = `translate3d(0, ${clamped}px, 0)`;
  };

  const onPointerDown = (event: React.PointerEvent) => {
    // Only the handle / peek header starts a drag — body content can scroll.
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-meta-sheet-scroll]')) return;

    const bodyEl = bodyRef.current;
    if (!bodyEl) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startOffset: offsetRef.current,
      lastY: event.clientY,
      lastT: performance.now(),
      velocity: 0,
    };
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      /* no-op */
    }
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dy = event.clientY - drag.startY;
    // Dragging down increases offset (collapses); up decreases (expands).
    applyOffset(drag.startOffset + dy, false);
    const now = performance.now();
    const dt = Math.max(1, now - drag.lastT);
    drag.velocity = (event.clientY - drag.lastY) / dt;
    drag.lastY = event.clientY;
    drag.lastT = now;
  };

  const endDrag = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      /* no-op */
    }

    const bodyEl = bodyRef.current;
    if (!bodyEl) return;
    const bodyH = bodyEl.scrollHeight || 1;
    const progress = offsetRef.current / bodyH; // 0 = expanded, 1 = collapsed
    let next: MetaSheetSnap = snap;

    if (drag.velocity > VELOCITY_THRESHOLD) {
      next = 'collapsed';
    } else if (drag.velocity < -VELOCITY_THRESHOLD) {
      next = 'expanded';
    } else {
      next = progress > 0.45 ? 'collapsed' : 'expanded';
    }

    const target = next === 'collapsed' ? bodyH : 0;
    applyOffset(target, true);
    if (next !== snap) onSnapChange(next);
  };

  return (
    <div
      ref={rootRef}
      className={[
        'absolute inset-x-0 bottom-0 z-20 will-change-transform touch-none',
        className || '',
      ].join(' ')}
      style={{ transform: 'translate3d(0, 0, 0)' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className="rounded-t-3xl border-t border-white/10 bg-white/95 shadow-[0_-8px_40px_rgba(0,0,0,0.35)] backdrop-blur-md dark:bg-[#0f0b11]/95">
        {/* Drag handle */}
        <div
          className="flex cursor-grab items-center justify-center pb-1 pt-2 active:cursor-grabbing"
          data-meta-sheet-handle
          aria-hidden="true"
        >
          <span className="h-1 w-10 rounded-full bg-slate-300 dark:bg-white/25" />
        </div>

        <div className="px-4 pb-3">{peek}</div>

        <div ref={bodyRef} data-meta-sheet-scroll className="overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]" style={{ maxHeight: '46vh', touchAction: 'pan-y' }}>
          {body}
        </div>
      </div>
    </div>
  );
};

export default CollapsibleMetaSheet;
