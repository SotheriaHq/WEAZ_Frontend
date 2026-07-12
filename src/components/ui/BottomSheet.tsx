import React from 'react';

/**
 * BottomSheet — a gesture-driven bottom sheet with three snap points
 * (collapsed / half / full), modelled on the iOS/Apple-Maps sheet.
 *
 * PERFORMANCE CONTRACT (important — this is used over the media-first design
 * viewer on low-end Android):
 * - Dragging mutates `transform: translateY()` imperatively via a ref. It does
 *   NOT call setState per frame, so React never re-renders mid-drag and the
 *   image behind the sheet is never repainted or re-decoded.
 * - Transitions are only attached on release / programmatic snap, never during
 *   an active drag, so the finger tracks 1:1 with no easing lag.
 * - Only the peek/handle region is draggable; the scrollable content scrolls
 *   independently. This removes drag-vs-scroll gesture ambiguity entirely.
 */

export type SheetState = 'collapsed' | 'half' | 'full';

export interface BottomSheetProps {
  open: boolean;
  state: SheetState;
  onStateChange: (next: SheetState) => void;
  /** Called when the user swipes the sheet down while already collapsed. */
  onDismiss?: () => void;
  /** Always-visible drag handle / peek row rendered at the top of the sheet. */
  peek: React.ReactNode;
  /** Scrollable sheet body. */
  children: React.ReactNode;
  /** Total sheet height as a fraction of the viewport height (0–1). */
  heightRatio?: number;
  /** Visible height in the half state as a fraction of the viewport (0–1). */
  halfVisibleRatio?: number;
  /** Visible height in the collapsed state, in px (the peek row height). */
  collapsedVisiblePx?: number;
  ariaLabel?: string;
  className?: string;
  /** ARIA role for the sheet container. Use 'group' when nested inside another
   *  dialog to avoid redundant modal semantics. Defaults to 'dialog'. */
  role?: 'dialog' | 'group' | 'region';
}

const SNAP_TRANSITION = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)';
const SNAP_ORDER: SheetState[] = ['collapsed', 'half', 'full'];

const BottomSheet: React.FC<BottomSheetProps> = ({
  open,
  state,
  onStateChange,
  onDismiss,
  peek,
  children,
  heightRatio = 0.9,
  halfVisibleRatio = 0.48,
  collapsedVisiblePx = 88,
  ariaLabel = 'Details',
  className,
  role = 'dialog',
}) => {
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const dragState = React.useRef<{
    pointerId: number | null;
    startY: number;
    startTranslate: number;
    lastY: number;
    lastT: number;
    velocity: number;
    dragging: boolean;
    moved: boolean;
  }>({
    pointerId: null,
    startY: 0,
    startTranslate: 0,
    lastY: 0,
    lastT: 0,
    velocity: 0,
    dragging: false,
    moved: false,
  });

  // Snap offsets are the translateY (in px, measured from the fully-open
  // position of 0) for each state. Larger translateY = more hidden below the
  // viewport. Recomputed on resize so it stays correct across orientation.
  const getViewportHeight = () =>
    typeof window === 'undefined' ? 800 : window.innerHeight;

  const computeOffsets = React.useCallback(() => {
    const vh = getViewportHeight();
    const sheetHeight = vh * heightRatio;
    const halfVisible = vh * halfVisibleRatio;
    return {
      full: 0,
      half: Math.max(0, sheetHeight - halfVisible),
      collapsed: Math.max(0, sheetHeight - collapsedVisiblePx),
    };
  }, [heightRatio, halfVisibleRatio, collapsedVisiblePx]);

  const offsetsRef = React.useRef(computeOffsets());
  React.useEffect(() => {
    const onResize = () => {
      offsetsRef.current = computeOffsets();
      applySnap(state, true);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computeOffsets, state]);

  const applyTransform = (translateY: number, withTransition: boolean) => {
    const el = sheetRef.current;
    if (!el) return;
    el.style.transition = withTransition ? SNAP_TRANSITION : 'none';
    el.style.transform = `translate3d(0, ${translateY}px, 0)`;
  };

  const applySnap = React.useCallback(
    (target: SheetState, withTransition: boolean) => {
      const offsets = offsetsRef.current;
      applyTransform(offsets[target], withTransition);
    },
    [],
  );

  // Reflect external state changes (tap toggles, resize) with an animation.
  React.useEffect(() => {
    offsetsRef.current = computeOffsets();
    applySnap(state, true);
  }, [state, open, computeOffsets, applySnap]);

  const nearestState = (translateY: number): SheetState => {
    const offsets = offsetsRef.current;
    const entries: Array<[SheetState, number]> = [
      ['full', offsets.full],
      ['half', offsets.half],
      ['collapsed', offsets.collapsed],
    ];
    let best: SheetState = 'collapsed';
    let bestDist = Infinity;
    for (const [name, value] of entries) {
      const dist = Math.abs(value - translateY);
      if (dist < bestDist) {
        bestDist = dist;
        best = name;
      }
    }
    return best;
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    const offsets = offsetsRef.current;
    const ds = dragState.current;
    ds.pointerId = event.pointerId;
    ds.startY = event.clientY;
    ds.startTranslate = offsets[state];
    ds.lastY = event.clientY;
    ds.lastT = performance.now();
    ds.velocity = 0;
    ds.dragging = true;
    ds.moved = false;
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      /* setPointerCapture can throw if the pointer is already gone */
    }
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds.dragging || ds.pointerId !== event.pointerId) return;
    const offsets = offsetsRef.current;
    const dy = event.clientY - ds.startY;
    if (Math.abs(dy) > 3) ds.moved = true;
    const next = Math.min(
      offsets.collapsed + 64, // allow a little overscroll past collapsed for dismiss
      Math.max(offsets.full, ds.startTranslate + dy),
    );
    const now = performance.now();
    const dt = now - ds.lastT;
    if (dt > 0) {
      ds.velocity = (event.clientY - ds.lastY) / dt; // px per ms, +down
    }
    ds.lastY = event.clientY;
    ds.lastT = now;
    applyTransform(next, false);
  };

  const endDrag = (event: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds.dragging || ds.pointerId !== event.pointerId) return;
    ds.dragging = false;
    ds.pointerId = null;
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(
        event.pointerId,
      );
    } catch {
      /* no-op */
    }

    const offsets = offsetsRef.current;
    const dy = event.clientY - ds.startY;
    const currentTranslate = Math.min(
      offsets.collapsed + 64,
      Math.max(offsets.full, ds.startTranslate + dy),
    );

    // Tap (no meaningful movement) cycles the sheet forward through snaps.
    if (!ds.moved) {
      const idx = SNAP_ORDER.indexOf(state);
      const nextState =
        state === 'full' ? 'collapsed' : SNAP_ORDER[Math.min(idx + 1, 2)];
      applySnap(nextState, true);
      if (nextState !== state) onStateChange(nextState);
      return;
    }

    // Swipe down past collapsed (or fast downward flick while collapsed) closes.
    const fastDown = ds.velocity > 0.55;
    if (
      onDismiss &&
      (currentTranslate > offsets.collapsed + 24 ||
        (state === 'collapsed' && fastDown))
    ) {
      onDismiss();
      return;
    }

    // Velocity-biased snap: a fast flick advances one snap in its direction.
    let target = nearestState(currentTranslate);
    if (ds.velocity < -0.55) {
      const idx = SNAP_ORDER.indexOf(target);
      target = SNAP_ORDER[Math.min(idx + 1, 2)];
    } else if (fastDown) {
      const idx = SNAP_ORDER.indexOf(target);
      target = SNAP_ORDER[Math.max(idx - 1, 0)];
    }

    applySnap(target, true);
    if (target !== state) onStateChange(target);
  };

  const heightStyle = `${Math.round(heightRatio * 100)}vh`;

  return (
    <div
      ref={sheetRef}
      role={role}
      aria-label={ariaLabel}
      className={[
        'pointer-events-auto absolute inset-x-0 bottom-0 z-30 flex flex-col',
        'rounded-t-3xl border-t border-white/15 bg-white/95 text-slate-900 shadow-[0_-8px_40px_rgba(0,0,0,0.35)]',
        'backdrop-blur-xl dark:bg-[#0f0b11]/95 dark:text-white',
        'will-change-transform',
        className || '',
      ].join(' ')}
      // No touch-action:none here — it would propagate to the scrollable body
      // and block touch scrolling. The draggable handle sets its own below.
      style={{ height: heightStyle }}
    >
      {/* Draggable peek / handle region */}
      <div
        className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="flex justify-center pt-2.5">
          <span
            aria-hidden="true"
            className="h-1.5 w-11 rounded-full bg-slate-300 dark:bg-white/25"
          />
        </div>
        {peek}
      </div>

      {/* Scrollable content — scrolls independently of the drag handle */}
      <div
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        style={{ touchAction: 'pan-y' }}
      >
        {children}
      </div>
    </div>
  );
};

export default BottomSheet;
