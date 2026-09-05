import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiPlay, FiStar, FiPlus, FiMove } from 'react-icons/fi';
import type { MediaItem, MediaItemKind } from '../../types/media';
import LocalMediaPreview from '../media/LocalMediaPreview';
import { getMediaViewSlotLabel, normalizeMediaViewSlot } from '@/utils/contentIntegrity';

interface ThumbnailStripProps {
  items: MediaItem[];
  selectedIndex: number;
  coverIndex: number;
  onSelect: (index: number) => void;
  onDelete: (id: string) => void;
  onSetCover: (index: number) => void;
  onAddMore?: () => void;
  canAddMore?: boolean;
  disabled?: boolean;
  progressById?: Record<string, number>;
  /** Show slot labels (Front, Left, Right…) beneath thumbnails */
  showSlotLabels?: boolean;
  /**
   * Reorder handler. Because view slots are positional, reordering IS slot
   * assignment — dragging an image to position 1 makes it the Front. Omit to
   * render the strip read-only (no grips).
   */
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

/** Movement (px) before a press is treated as a drag rather than a tap. */
const DRAG_ACTIVATION_PX = 6;

/**
 * Touch drags must be held before they arm. With movement alone as the trigger,
 * six pixels of finger travel over a 24px grip was enough to start reordering —
 * so on a phone the images shuffled under the thumb during what the owner
 * intended as a scroll ("the user just touches, and the image is moving").
 * A mouse pointer is precise and is not also the scrolling instrument, so it
 * keeps the immediate movement threshold.
 */
const TOUCH_DRAG_HOLD_MS = 600;
const TOUCH_DRAG_HOLD_TOLERANCE_PX = 10;

interface PreviewFile {
  file?: File;
  url: string;
  id?: string;
  kind: MediaItemKind;
  viewSlot?: string | null;
}

/**
 * ThumbnailStrip
 * 
 * A premium horizontal thumbnail strip with:
 * - Cover image star badge
 * - Selection purple ring
 * - Video play icon overlay
 * - Upload progress circular spinner
 * - Delete button on hover
 * - Add more button at the end
 */
const ThumbnailStrip: React.FC<ThumbnailStripProps> = ({
  items,
  selectedIndex,
  coverIndex,
  onSelect,
  onDelete,
  onSetCover: _onSetCover, // Used by parent for "Set as Cover" functionality
  onAddMore,
  canAddMore = true,
  disabled = false,
  progressById,
  showSlotLabels = false,
  onReorder,
}) => {
  /**
   * Pointer-based reordering.
   *
   * Deliberately NOT the HTML5 drag-and-drop API: `dragstart`/`drop` are never
   * emitted for touch input, so on a phone browser there was no way to reorder
   * at all. Pointer Events cover mouse, touch and pen through one code path.
   *
   * The drag starts from a dedicated grip rather than the whole tile. The strip
   * lives inside a vertically scrolling container, so making the tile itself
   * `touch-action: none` would swallow the scroll gesture; confining that to the
   * grip keeps scrolling and tap-to-select working everywhere else on the tile.
   */
  const dragRef = useRef<{
    pointerId: number;
    id: string;
    startX: number;
    startY: number;
    active: boolean;
    /** Touch only: true once the press has been held long enough to arm. */
    held: boolean;
    holdTimer: ReturnType<typeof setTimeout> | null;
  } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [armedId, setArmedId] = useState<string | null>(null);

  const clearDrag = useCallback(() => {
    if (dragRef.current?.holdTimer) clearTimeout(dragRef.current.holdTimer);
    dragRef.current = null;
    setDraggingId(null);
    setArmedId(null);
  }, []);

  const indexOfId = useCallback(
    (id: string) => items.findIndex((item) => item.id === id),
    [items],
  );

  const handleGripPointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>, id?: string) => {
      if (!onReorder || disabled || !id) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      event.stopPropagation();

      const isTouch = event.pointerType !== 'mouse';
      dragRef.current = {
        pointerId: event.pointerId,
        id,
        startX: event.clientX,
        startY: event.clientY,
        active: false,
        held: !isTouch,
        holdTimer: isTouch
          ? setTimeout(() => {
              if (dragRef.current?.id !== id) return;
              dragRef.current.held = true;
              setArmedId(id);
              navigator.vibrate?.(15);
            }, TOUCH_DRAG_HOLD_MS)
          : null,
      };
    },
    [disabled, onReorder],
  );

  const handleGripPointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId || !onReorder) return;

      const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);

      if (!drag.held) {
        // Still waiting out the hold: any real movement means this was a
        // scroll, so hand the gesture back rather than starting a reorder.
        if (moved > TOUCH_DRAG_HOLD_TOLERANCE_PX) clearDrag();
        return;
      }

      if (!drag.active) {
        if (moved < DRAG_ACTIVATION_PX) return;
        drag.active = true;
        setDraggingId(drag.id);
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          /* capture is an optimisation; hit-testing works without it */
        }
      }

      // Pointer capture keeps events coming to the grip, so resolve the drop
      // target by hit-testing the document instead of relying on event.target.
      const under = document.elementFromPoint(event.clientX, event.clientY);
      const tile = under?.closest('[data-thumb-index]');
      if (!tile) return;
      const toIndex = Number(tile.getAttribute('data-thumb-index'));
      const fromIndex = indexOfId(drag.id);
      if (!Number.isInteger(toIndex) || fromIndex < 0 || toIndex === fromIndex) return;
      onReorder(fromIndex, toIndex);
    },
    [indexOfId, onReorder],
  );

  const handleGripPointerEnd = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (drag.active) {
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          /* already released */
        }
      }
      clearDrag();
    },
    [clearDrag],
  );

  useEffect(() => clearDrag, [clearDrag]);

  const previewFiles: PreviewFile[] = useMemo(() => {
    return items.map((it) => ({
      file: it.file,
      url: it.previewUrl,
      id: it.id,
      kind: it.kind,
      viewSlot: it.viewSlot,
    }));
  }, [items]);

  if (previewFiles.length === 0) return null;

  return (
    <div className="relative min-w-0">
      {/* Fixed 3-column stack so new files wrap instead of expanding the parent layout */}
      <div className="grid grid-cols-3 gap-3 max-h-60 overflow-y-auto py-2 pr-1 scrollbar-hide">
        <AnimatePresence mode="popLayout">
          {previewFiles.map((pf, idx) => {
            const isSelected = selectedIndex === idx;
            const isCover = coverIndex === idx;
            const isVideo = pf.kind === 'video';
            const fileProgress = pf.id ? progressById?.[pf.id] : undefined;
            const isUploading = typeof fileProgress === 'number' && fileProgress < 100;

            return (
              <motion.div
                key={pf.id || idx}
                layout
                data-thumb-index={idx}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className={`
                    relative w-full rounded-xl overflow-hidden
                    border border-gray-200 bg-white shadow-sm transition-all duration-200 group dark:border-white/10 dark:bg-white/[0.03]
                  ${isSelected
                    ? 'thumbnail-selected border-transparent scale-105'
                      : 'hover:border-purple-500/50'
                  }
                  ${draggingId === pf.id ? 'ring-2 ring-purple-500 opacity-80' : ''}
                  ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                `}
                onClick={() => {
                  // A drag ends with a click on most engines; ignore it so
                  // reordering never also changes the selected preview.
                  if (dragRef.current || draggingId) return;
                  if (!disabled && !isUploading) onSelect(idx);
                }}
              >
                {pf.url ? (
                  <LocalMediaPreview
                    kind={isVideo ? 'video' : 'image'}
                    src={pf.url}
                    file={pf.file}
                    alt={pf.file?.name || `Thumbnail ${idx + 1}`}
                    className="w-full h-24 flex items-center justify-center bg-white/70 dark:bg-white/[0.03]"
                    maxHeightClassName="max-h-full"
                    maxWidthClassName="max-w-full"
                    controls={false}
                    muted
                    loadingLabel="Preparing..."
                    unavailableLabel="Preview unavailable"
                    diagnosticScope="create-design-thumbnail-preview"
                  />
                ) : (
                  <div className="flex h-24 w-full items-center justify-center bg-white/70 text-xs font-medium text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
                    Preparing...
                  </div>
                )}

                {/* Cover badge */}
                {isCover && (
                  <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center shadow-lg">
                    <FiStar className="w-3 h-3 text-white fill-white" />
                  </div>
                )}

                {/* Video play icon */}
                {isVideo && !isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                      <FiPlay className="w-4 h-4 text-gray-900 ml-0.5 dark:text-white" />
                    </div>
                  </div>
                )}

                {/* Upload progress overlay */}
                {isUploading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
                    <CircularProgress progress={fileProgress || 0} size={36} />
                    <span className="text-xs text-white mt-1 font-medium">
                      {Math.round(fileProgress || 0)}%
                    </span>
                  </div>
                )}

                {/* Delete button */}
                {!disabled && !isUploading && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (pf.id) onDelete(pf.id);
                    }}
                    className="
                      absolute top-1 right-1 w-6 h-6 rounded-full
                      bg-black/70 hover:bg-red-500
                      flex items-center justify-center
                      opacity-0 group-hover:opacity-100
                      transition-all duration-200
                    "
                    aria-label="Remove"
                  >
                    <FiX className="w-3.5 h-3.5 text-white" />
                  </button>
                )}

                {/* Drag grip — the only surface with touch-action: none, so the
                    strip itself stays scrollable on a phone. */}
                {onReorder && !disabled && !isUploading && previewFiles.length > 1 && (
                  <button
                    type="button"
                    onPointerDown={(event) => handleGripPointerDown(event, pf.id)}
                    onPointerMove={handleGripPointerMove}
                    onPointerUp={handleGripPointerEnd}
                    onPointerCancel={handleGripPointerEnd}
                    onClick={(event) => event.stopPropagation()}
                    className={`
                      absolute bottom-1 left-1 z-10 flex h-6 w-6 touch-none
                      items-center justify-center rounded-full
                      text-white transition-all hover:bg-purple-600
                      cursor-grab active:cursor-grabbing
                      ${
                        armedId === pf.id
                          ? 'scale-125 bg-purple-600 ring-2 ring-purple-300'
                          : 'bg-black/70'
                      }
                    `}
                    aria-label={`Reorder ${getMediaViewSlotLabel(
                      normalizeMediaViewSlot(pf.viewSlot, idx),
                    )} image`}
                    title="Press and hold, then drag to reorder — position sets the view slot"
                  >
                    <FiMove className="h-3.5 w-3.5" />
                  </button>
                )}

                {/* Slot label */}
                {showSlotLabels && (
                  <div className="absolute bottom-0 inset-x-0 bg-black/50 backdrop-blur-sm text-center py-0.5">
                    <span className="text-[9px] font-semibold text-white/90 uppercase tracking-wide">
                      {getMediaViewSlotLabel(normalizeMediaViewSlot(pf.viewSlot, idx))}
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Add More button */}
        {onAddMore && !disabled && canAddMore && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`
              w-full h-24 rounded-xl
              border-2 border-dashed border-white/20
              flex flex-col items-center justify-center gap-1
              text-gray-400 hover:text-purple-400 hover:border-purple-500/50
              transition-all duration-200
            `}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAddMore();
            }}
            aria-label="Add more files"
          >
            <FiPlus className="w-6 h-6" />
            <span className="text-xs">Add</span>
          </motion.button>
        )}
      </div>
    </div>
  );
};

/**
 * CircularProgress - SVG circular progress ring
 */
const CircularProgress: React.FC<{ progress: number; size: number }> = ({ progress, size }) => {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg 
      className="progress-ring" 
      width={size} 
      height={size}
    >
      {/* Background circle */}
      <circle
        className="text-white/20"
        strokeWidth={strokeWidth}
        stroke="currentColor"
        fill="transparent"
        r={radius}
        cx={size / 2}
        cy={size / 2}
      />
      {/* Progress circle */}
      <circle
        className="progress-ring-circle text-purple-500"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        stroke="currentColor"
        fill="transparent"
        r={radius}
        cx={size / 2}
        cy={size / 2}
      />
    </svg>
  );
};

export default ThumbnailStrip;
