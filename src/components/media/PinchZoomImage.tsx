import React from 'react';

/**
 * PinchZoomImage — lightweight pinch + double-tap zoom for a single inline
 * image. Designed for the mobile design modal: the image keeps its natural
 * aspect ratio (`w-full h-auto object-contain`, no letterbox background) and
 * only transforms on gesture.
 *
 * PERFORMANCE / GESTURE NOTES:
 * - Gestures mutate `transform` imperatively (no per-frame setState) → 60fps,
 *   and the underlying <img> is never re-decoded.
 * - `touch-action` is `pan-y` at 1x so the parent card still scrolls vertically
 *   and a one-finger drag never hijacks scroll; it flips to `none` only while
 *   zoomed so panning the enlarged image works. Two-finger pinch is captured at
 *   any zoom level.
 * - Resets to identity when the source changes.
 */

export interface PinchZoomImageProps {
  src: string;
  alt: string;
  className?: string;
  onZoomChange?: (zoomed: boolean) => void;
}

const MAX_SCALE = 4;
const MIN_SCALE = 1;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;

const PinchZoomImage: React.FC<PinchZoomImageProps> = ({
  src,
  alt,
  className,
  onZoomChange,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);

  const view = React.useRef({ scale: 1, tx: 0, ty: 0 });
  const pointers = React.useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = React.useRef<{ startDist: number; startScale: number } | null>(null);
  const pan = React.useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(null);
  const lastTap = React.useRef(0);

  const syncTouchAction = () => {
    const el = containerRef.current;
    if (!el) return;
    // At 1x let the parent scroll (pan-y). Zoomed → take over for free panning.
    el.style.touchAction = view.current.scale > 1.01 ? 'none' : 'pan-y';
  };

  const apply = (withTransition: boolean) => {
    const el = imgRef.current;
    if (!el) return;
    el.style.transition = withTransition
      ? 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)'
      : 'none';
    const { scale, tx, ty } = view.current;
    el.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
    syncTouchAction();
  };

  const clampPan = () => {
    const container = containerRef.current;
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const { scale } = view.current;
    const maxX = Math.max(0, (cw * scale - cw) / 2);
    const maxY = Math.max(0, (ch * scale - ch) / 2);
    view.current.tx = Math.min(maxX, Math.max(-maxX, view.current.tx));
    view.current.ty = Math.min(maxY, Math.max(-maxY, view.current.ty));
  };

  const reset = React.useCallback(
    (withTransition: boolean) => {
      view.current = { scale: 1, tx: 0, ty: 0 };
      apply(withTransition);
      onZoomChange?.(false);
    },
    [onZoomChange],
  );

  React.useEffect(() => {
    reset(false);
  }, [src, reset]);

  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const onPointerDown = (event: React.PointerEvent) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinch.current = { startDist: distance(a, b), startScale: view.current.scale };
      pan.current = null;
      try {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      } catch {
        /* no-op */
      }
    } else if (pointers.current.size === 1 && view.current.scale > 1) {
      pan.current = {
        startX: event.clientX,
        startY: event.clientY,
        tx: view.current.tx,
        ty: view.current.ty,
      };
      try {
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      } catch {
        /* no-op */
      }
    }
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const tracked = pointers.current.get(event.pointerId);
    if (!tracked) return;
    tracked.x = event.clientX;
    tracked.y = event.clientY;

    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const ratio = distance(a, b) / (pinch.current.startDist || 1);
      view.current.scale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, pinch.current.startScale * ratio),
      );
      clampPan();
      apply(false);
      onZoomChange?.(view.current.scale > 1.02);
      return;
    }

    if (pan.current && pointers.current.size === 1 && view.current.scale > 1) {
      view.current.tx = pan.current.tx + (event.clientX - pan.current.startX);
      view.current.ty = pan.current.ty + (event.clientY - pan.current.startY);
      clampPan();
      apply(false);
    }
  };

  const onPointerUp = (event: React.PointerEvent) => {
    const hadTwo = pointers.current.size === 2;
    pointers.current.delete(event.pointerId);
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      /* no-op */
    }

    if (hadTwo) {
      pinch.current = null;
      if (view.current.scale <= 1.05) reset(true);
      return;
    }

    if (pointers.current.size === 0) {
      pan.current = null;
      const now = performance.now();
      if (now - lastTap.current < DOUBLE_TAP_MS) {
        lastTap.current = 0;
        toggleDoubleTap(event);
      } else {
        lastTap.current = now;
      }
    }
  };

  const toggleDoubleTap = (event: React.PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;
    if (view.current.scale > 1.05) {
      reset(true);
      return;
    }
    const rect = container.getBoundingClientRect();
    const px = event.clientX - rect.left - rect.width / 2;
    const py = event.clientY - rect.top - rect.height / 2;
    view.current.scale = DOUBLE_TAP_SCALE;
    view.current.tx = -px * (DOUBLE_TAP_SCALE - 1);
    view.current.ty = -py * (DOUBLE_TAP_SCALE - 1);
    clampPan();
    apply(true);
    onZoomChange?.(true);
  };

  return (
    <div
      ref={containerRef}
      className={['relative w-full overflow-hidden', className || ''].join(' ')}
      style={{ touchAction: 'pan-y' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={(e) => toggleDoubleTap(e as unknown as React.PointerEvent)}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        className="block h-auto w-full select-none object-contain will-change-transform"
        style={{ transformOrigin: 'center center' }}
      />
    </div>
  );
};

export default PinchZoomImage;
