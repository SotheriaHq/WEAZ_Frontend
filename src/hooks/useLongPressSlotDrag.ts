/**
 * Touch drag-to-swap for a grid of `[data-slot]` tiles, armed by a long press.
 *
 * The media grids used to start dragging on `touchstart`, with the tiles held
 * at `touch-action: none`. On a phone that meant two things at once: the page
 * could not be scrolled by starting the gesture on an image, and any scroll
 * attempt that did begin there was read as a drag — so photos swapped places
 * while the brand was only trying to scroll past them. The reported feel was
 * "very sharp… the user just touches, and the image is moving".
 *
 * Here the gesture has to be earned. A press must stay within
 * `moveTolerancePx` for `holdMs` before the drag arms; any earlier movement
 * hands the gesture back to the browser as an ordinary scroll. Tiles therefore
 * keep `touch-action: pan-y` (see `longPressSlotDragTileClass`) instead of
 * `none`, so scrolling works normally right up until the drag is deliberate.
 *
 * Listeners are attached imperatively and **non-passively** — that is the whole
 * reason for the ref-based container rather than React `onTouch*` props. React
 * registers its touch listeners as passive, so `preventDefault()` from a JSX
 * handler is ignored and the page keeps scrolling underneath an active drag.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Long enough to be unmistakably deliberate, short enough not to feel broken.
 * Platform long-press is 400–500ms; the extra margin here is because a
 * mis-fire reorders someone's product photos rather than opening a menu.
 */
export const LONG_PRESS_HOLD_MS = 600;

/** Movement above this before the timer fires means "this was a scroll". */
export const LONG_PRESS_MOVE_TOLERANCE_PX = 10;

/**
 * `pan-y` keeps vertical scrolling with the browser while the press is still
 * being judged; once armed, the hook calls `preventDefault()` itself.
 */
export const longPressSlotDragTileClass =
  'touch-pan-y select-none [-webkit-touch-callout:none] [-webkit-user-select:none]';

export interface UseLongPressSlotDragOptions {
  /** False disables the whole gesture (e.g. while saving). */
  enabled?: boolean;
  /** Whether this particular slot currently holds something draggable. */
  canDragSlot: (slot: string) => boolean;
  onSwap: (fromSlot: string, toSlot: string) => void;
  holdMs?: number;
  moveTolerancePx?: number;
}

export interface UseLongPressSlotDragResult<T extends HTMLElement = HTMLDivElement> {
  containerRef: React.RefObject<T | null>;
  /** Slot being dragged, once the press has been held long enough. */
  draggingSlot: string | null;
  /** Slot the finger is currently over. */
  overSlot: string | null;
}

const slotAtPoint = (x: number, y: number): string | null => {
  const element = document.elementFromPoint(x, y);
  const slotEl = element?.closest('[data-slot]');
  return slotEl?.getAttribute('data-slot') ?? null;
};

export function useLongPressSlotDrag<T extends HTMLElement = HTMLDivElement>({
  enabled = true,
  canDragSlot,
  onSwap,
  holdMs = LONG_PRESS_HOLD_MS,
  moveTolerancePx = LONG_PRESS_MOVE_TOLERANCE_PX,
}: UseLongPressSlotDragOptions): UseLongPressSlotDragResult<T> {
  const containerRef = useRef<T | null>(null);
  const [draggingSlot, setDraggingSlot] = useState<string | null>(null);
  const [overSlot, setOverSlot] = useState<string | null>(null);

  // The listeners are bound once, so everything they read has to come through
  // a ref or the gesture would run against the first render's closure.
  const canDragSlotRef = useRef(canDragSlot);
  const onSwapRef = useRef(onSwap);
  const enabledRef = useRef(enabled);
  canDragSlotRef.current = canDragSlot;
  onSwapRef.current = onSwap;
  enabledRef.current = enabled;

  const gesture = useRef<{
    slot: string | null;
    startX: number;
    startY: number;
    armed: boolean;
    timer: ReturnType<typeof setTimeout> | null;
  }>({ slot: null, startX: 0, startY: 0, armed: false, timer: null });

  const reset = useCallback(() => {
    if (gesture.current.timer) clearTimeout(gesture.current.timer);
    gesture.current = {
      slot: null,
      startX: 0,
      startY: 0,
      armed: false,
      timer: null,
    };
    setDraggingSlot(null);
    setOverSlot(null);
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const handleTouchStart = (event: TouchEvent) => {
      if (!enabledRef.current) return;
      const touch = event.touches[0];
      if (!touch || event.touches.length > 1) return reset();

      const slot = slotAtPoint(touch.clientX, touch.clientY);
      if (!slot || !canDragSlotRef.current(slot)) return;

      if (gesture.current.timer) clearTimeout(gesture.current.timer);
      gesture.current = {
        slot,
        startX: touch.clientX,
        startY: touch.clientY,
        armed: false,
        timer: setTimeout(() => {
          gesture.current.armed = true;
          setDraggingSlot(slot);
          // A short buzz is the only signal that the tile is now "picked up";
          // without it the transition from scrolling to dragging is invisible.
          navigator.vibrate?.(15);
        }, holdMs),
      };
    };

    const handleTouchMove = (event: TouchEvent) => {
      const state = gesture.current;
      if (!state.slot) return;

      const touch = event.touches[0];
      if (!touch) return;

      if (!state.armed) {
        const travelled = Math.hypot(
          touch.clientX - state.startX,
          touch.clientY - state.startY,
        );
        // Moved before the hold completed — this was a scroll, not a pick-up.
        if (travelled > moveTolerancePx) reset();
        return;
      }

      // Armed: the gesture is ours, so stop the page scrolling under it. This
      // only works because the listener is registered non-passively below.
      if (event.cancelable) event.preventDefault();

      const target = slotAtPoint(touch.clientX, touch.clientY);
      setOverSlot(target && target !== state.slot ? target : null);
    };

    const handleTouchEnd = () => {
      const state = gesture.current;
      if (state.armed && state.slot) {
        // Read the hover target from state at drop time rather than trusting a
        // React state read, which may not have flushed yet.
        setOverSlot((current) => {
          if (current && current !== state.slot) {
            onSwapRef.current(state.slot as string, current);
          }
          return null;
        });
      }
      reset();
    };

    /**
     * A long press is exactly the gesture every mobile browser uses to open its
     * own menu ("Open image in new tab", "Copy image", the iOS share callout).
     * That menu was stealing the gesture at ~500ms — just before this hook arms
     * at 600ms — so the drag could never start on a phone.
     *
     * Suppressing `contextmenu` on the grid is safe because the tiles have their
     * own delete / set-cover controls; there is nothing in the browser menu an
     * owner needs here. It is suppressed for any press that began on a
     * draggable tile, not only armed ones, because the menu fires BEFORE the
     * hold completes — waiting for `armed` would be waiting for an event that
     * has already been pre-empted.
     */
    const handleContextMenu = (event: Event) => {
      if (!enabledRef.current) return;
      const target = event.target as HTMLElement | null;
      const slot = target?.closest('[data-slot]')?.getAttribute('data-slot');
      if (!slot || !canDragSlotRef.current(slot)) return;
      event.preventDefault();
    };

    // iOS Safari starts a text/image selection under a held finger, which drags
    // a selection highlight around instead of the tile.
    const handleSelectStart = (event: Event) => {
      if (gesture.current.slot) event.preventDefault();
    };

    node.addEventListener('touchstart', handleTouchStart, { passive: true });
    node.addEventListener('touchmove', handleTouchMove, { passive: false });
    node.addEventListener('touchend', handleTouchEnd);
    node.addEventListener('touchcancel', reset);
    node.addEventListener('contextmenu', handleContextMenu);
    node.addEventListener('selectstart', handleSelectStart);

    return () => {
      node.removeEventListener('touchstart', handleTouchStart);
      node.removeEventListener('touchmove', handleTouchMove);
      node.removeEventListener('touchend', handleTouchEnd);
      node.removeEventListener('touchcancel', reset);
      node.removeEventListener('contextmenu', handleContextMenu);
      node.removeEventListener('selectstart', handleSelectStart);
      if (gesture.current.timer) clearTimeout(gesture.current.timer);
    };
  }, [holdMs, moveTolerancePx, reset]);

  return { containerRef, draggingSlot, overSlot };
}

export default useLongPressSlotDrag;
