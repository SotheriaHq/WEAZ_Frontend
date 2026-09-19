import React, { useCallback, useEffect, useRef, useState } from 'react';
import CommentThread from '@/components/comments/CommentThread';

/**
 * Comments over the live reel, as a draggable bottom sheet.
 *
 * The 💬 button used to open the full `DesignViewModal`: the whole screen was
 * replaced, the design was squeezed into a strip at the top of a document, and
 * closing meant leaving and re-entering the feed. Nothing about that read as
 * "look at this and talk about it".
 *
 * Here the reel stays on screen and keeps playing. The sheet takes the bottom
 * portion, the design scales into the band above it, and a downward drag
 * hands the whole screen back.
 *
 * ── Why it does not judder ────────────────────────────────────────────────
 * Everything that moves is a `transform`. Height, `top` and `bottom` are never
 * animated: each of those relayouts the sheet AND the comment list inside it
 * on every frame, which on a phone browser is the "cracking" that was
 * reported. The sheet is laid out ONCE at full open height and then translated
 * up and down over it, so the browser can keep it on the compositor.
 *
 * During a drag the transition is removed entirely and `translateY` tracks the
 * finger exactly; it is restored on release so the settle is animated. Mixing
 * the two is what makes a sheet feel like it is fighting the hand.
 */

/** Fraction of the viewport the open sheet covers. */
export const RUNWAY_COMMENTS_SHEET_HEIGHT_RATIO = 0.72;

/** Past this fraction of its own height, a release closes instead of resettling. */
const CLOSE_DRAG_THRESHOLD_RATIO = 0.3;

/** A fast downward flick closes regardless of distance. */
const CLOSE_VELOCITY_PX_PER_MS = 0.5;

const SETTLE_TRANSITION = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)';

export type RunwayCommentsSheetProps = {
  open: boolean;
  onClose: () => void;
  collectionId: string | null;
  title?: string | null;
  commentCount?: number;
};

export const RunwayCommentsSheet: React.FC<RunwayCommentsSheetProps> = ({
  open,
  onClose,
  collectionId,
  title,
  commentCount = 0,
}) => {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragStartAtRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  // Reset any residual drag when the sheet is dismissed, so reopening starts
  // from rest rather than from wherever the last gesture ended.
  useEffect(() => {
    if (!open) {
      setDragOffset(0);
      setDragging(false);
      dragStartYRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const endDrag = useCallback(
    (offset: number) => {
      const sheetHeight = sheetRef.current?.offsetHeight ?? 1;
      const elapsed = Math.max(1, Date.now() - dragStartAtRef.current);
      const velocity = offset / elapsed;

      const draggedFarEnough = offset > sheetHeight * CLOSE_DRAG_THRESHOLD_RATIO;
      const flickedDown = velocity > CLOSE_VELOCITY_PX_PER_MS;

      dragStartYRef.current = null;
      setDragging(false);
      setDragOffset(0);
      if (draggedFarEnough || flickedDown) onClose();
    },
    [onClose],
  );

  /*
    Pointer events rather than touch events: one code path covers finger, mouse
    and stylus, and `setPointerCapture` keeps the gesture attached to the
    handle even when the finger slides outside it — without capture, a fast
    drag silently stops tracking partway down.
  */
  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    dragStartYRef.current = event.clientY;
    dragStartAtRef.current = Date.now();
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    const startY = dragStartYRef.current;
    if (startY == null) return;
    // Downward only. An upward drag on an already-open sheet has nowhere to go,
    // and letting it translate negative lifts the sheet off the bottom edge.
    setDragOffset(Math.max(0, event.clientY - startY));
  }, []);

  const handlePointerUp = useCallback(
    (event: React.PointerEvent) => {
      const startY = dragStartYRef.current;
      if (startY == null) return;
      endDrag(Math.max(0, event.clientY - startY));
    },
    [endDrag],
  );

  const translateY = open ? dragOffset : sheetRef.current?.offsetHeight ?? 9999;

  return (
    <>
      {/*
        Scrim. Deliberately light: the design above stays the subject, and the
        point of this sheet is that you can still see what you are commenting
        on. It only covers the area ABOVE the sheet, so a tap there closes.
      */}
      <div
        className={`fixed inset-0 z-30 bg-black/30 transition-opacity duration-200 sm:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Comments"
        className="fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-2xl bg-[color:var(--surface-base)] shadow-2xl sm:hidden"
        style={{
          height: `${Math.round(RUNWAY_COMMENTS_SHEET_HEIGHT_RATIO * 100)}dvh`,
          transform: `translate3d(0, ${translateY}px, 0)`,
          transition: dragging ? 'none' : SETTLE_TRANSITION,
          // Keeps the sheet on its own compositor layer for the whole gesture.
          willChange: 'transform',
          visibility: open || dragOffset > 0 ? 'visible' : 'hidden',
        }}
      >
        {/*
          The grab area. `touch-action: none` is required, not decorative:
          without it the browser claims the vertical gesture for page scrolling
          and the drag never reaches this handler.
        */}
        <div
          className="flex shrink-0 cursor-grab touch-none flex-col items-center gap-2 px-4 pb-2 pt-3 active:cursor-grabbing"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <span className="h-1 w-10 rounded-full bg-theme-secondary/40" aria-hidden />
          <div className="flex w-full items-center justify-between">
            <span className="text-sm font-semibold text-theme">
              {commentCount > 0 ? `${commentCount} comments` : 'Comments'}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-3 py-1 text-xs font-semibold text-theme-secondary"
              aria-label="Close comments"
            >
              Close
            </button>
          </div>
          {title ? (
            <span className="w-full truncate text-left text-xs text-theme-secondary">
              {title}
            </span>
          ) : null}
        </div>

        {/*
          The list owns the remaining space and scrolls inside it. `min-h-0` is
          load-bearing in a flex column — without it the list claims its full
          content height, the sheet grows past the viewport, and the composer
          at the bottom becomes unreachable.
        */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[env(safe-area-inset-bottom,0px)] scrollbar-wiez">
          {open && collectionId ? (
            <CommentThread targetType="COLLECTION" targetId={collectionId} />
          ) : null}
        </div>
      </div>
    </>
  );
};

export default RunwayCommentsSheet;
