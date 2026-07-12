import React from 'react';

/**
 * PinchZoomImage — mobile pinch-to-zoom + double-tap-zoom for a single image.
 *
 * DESIGN NOTES:
 * - Gestures mutate `transform` imperatively (no per-frame setState) so zoom
 *   stays at 60fps and never re-decodes the underlying <img>.
 * - `enabled` gates all gesture handling. When it flips to false (e.g. the
 *   metadata drawer expands), the transform resets to identity so the image is
 *   never left zoomed behind other UI. This is how the caller keeps zoom and
 *   the bottom-sheet gesture from fighting each other.
 * - object-contain preserves the original aspect ratio; the image is centered.
 */

export interface PinchZoomImageProps {
  src: string;
  alt: string;
  enabled: boolean;
  className?: string;
  onZoomChange?: (zoomed: boolean) => void;
  onLoad?: () => void;
  onError?: () => void;
}

const MAX_SCALE = 4;
const MIN_SCALE = 1;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;

const PinchZoomImage: React.FC<PinchZoomImageProps> = ({
  src,
  alt,
  enabled,
  className,
  onZoomChange,
  onLoad,
  onError,
}) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);

  const view = React.useRef({ scale: 1, tx: 0, ty: 0 });
  const pointers = React.useRef<Map<number, { x: number; y: number }>>(
    new Map(),
  );
  const pinch = React.useRef<{ startDist: number; startScale: number } | null>(
    null,
  );
  const pan = React.useRef<{ startX: number; startY: number; tx: number; ty: number } | null>(
    null,
  );
  const lastTap = React.useRef(0);

  const apply = (withTransition: boolean) => {
    const el = imgRef.current;
    if (!el) return;
    el.style.transition = withTransition
      ? 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)'
      : 'none';
    const { scale, tx, ty } = view.current;
    el.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
  };

  const clampPan = () => {
    const container = containerRef.current;
    const el = imgRef.current;
    if (!container || !el) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const { scale } = view.current;
    // Allowed pan is half the overflow in each axis.
    const maxX = Math.max(0, (cw * scale - cw) / 2);
    const maxY = Math.max(0, (ch * scale - ch) / 2);
    view.current.tx = Math.min(maxX, Math.max(-maxX, view.current.tx));
    view.current.ty = Math.min(maxY, Math.max(-maxY, view.current.ty));
  };

  const reset = React.useCallback((withTransition: boolean) => {
    view.current = { scale: 1, tx: 0, ty: 0 };
    apply(withTransition);
    onZoomChange?.(false);
  }, [onZoomChange]);

  // Reset when disabled (drawer expanded) or the media source changes.
  React.useEffect(() => {
    if (!enabled) {
      pointers.current.clear();
      pinch.current = null;
      pan.current = null;
      reset(true);
    }
  }, [enabled, reset]);

  React.useEffect(() => {
    reset(false);
  }, [src, reset]);

  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  const onPointerDown = (event: React.PointerEvent) => {
    if (!enabled) return;
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      /* no-op */
    }

    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinch.current = {
        startDist: distance(a, b),
        startScale: view.current.scale,
      };
      pan.current = null;
    } else if (pointers.current.size === 1) {
      if (view.current.scale > 1) {
        pan.current = {
          startX: event.clientX,
          startY: event.clientY,
          tx: view.current.tx,
          ty: view.current.ty,
        };
      }
    }
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!enabled) return;
    const tracked = pointers.current.get(event.pointerId);
    if (!tracked) return;
    tracked.x = event.clientX;
    tracked.y = event.clientY;

    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = distance(a, b);
      const ratio = dist / (pinch.current.startDist || dist);
      const nextScale = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, pinch.current.startScale * ratio),
      );
      view.current.scale = nextScale;
      clampPan();
      apply(false);
      if (nextScale > 1.02) onZoomChange?.(true);
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
    if (!enabled) return;
    const hadTwo = pointers.current.size === 2;
    pointers.current.delete(event.pointerId);
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(
        event.pointerId,
      );
    } catch {
      /* no-op */
    }

    if (hadTwo) {
      pinch.current = null;
      // Snap back to identity if the pinch settled near 1x.
      if (view.current.scale <= 1.05) {
        reset(true);
      }
    }

    if (pointers.current.size === 0) {
      pan.current = null;
      // Double-tap detection (only meaningful for single-finger taps).
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
    // Zoom toward the tap point.
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
      className={['relative flex h-full w-full items-center justify-center overflow-hidden', className || ''].join(' ')}
      style={{ touchAction: enabled ? 'none' : 'auto' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        onLoad={onLoad}
        onError={onError}
        className="max-h-full max-w-full select-none object-contain will-change-transform"
        style={{ transformOrigin: 'center center' }}
      />
    </div>
  );
};

export default PinchZoomImage;
