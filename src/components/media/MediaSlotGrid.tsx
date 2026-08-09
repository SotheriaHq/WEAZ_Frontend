/**
 * The slot grid used to attach media to a product or a design.
 *
 * Both flows model the same thing — four required views (Front, Back, Left,
 * Right) plus optional extras, capped at six — but they used to present it two
 * different ways. Product creation had this grid: every slot visible as its own
 * tile, so what is missing is obvious before you upload anything. Design
 * creation had a large drop zone with a paragraph of instructions, a legend of
 * numbered slot names, and a separate thumbnail strip where the slot was
 * implied by *position* and only discoverable by dragging a grip. Owners
 * learned one mental model and then had to learn another.
 *
 * This is the product grid, extracted. Positional slotting still works — a
 * caller whose store derives slots from order (design) passes `onSlotDrop`
 * that maps back to a reorder — but the reader is now told which slot they are
 * filling in both flows.
 *
 * Reordering is long-press armed on touch (`useLongPressSlotDrag`) and HTML5
 * drag-and-drop on a mouse, since `dragstart` never fires for touch input.
 */
import React, { useCallback, useState } from 'react';
import { Plus, Star, X } from 'lucide-react';
import MediaRenderer from './MediaRenderer';
import LocalMediaPreview from './LocalMediaPreview';
import useLongPressSlotDrag, {
  longPressSlotDragTileClass,
} from '@/hooks/useLongPressSlotDrag';
import {
  MEDIA_VIEW_SLOT_OPTIONS,
  normalizeMediaViewSlot,
  type MediaViewSlot,
} from '@/utils/contentIntegrity';

export interface MediaSlotGridItem {
  id: string;
  url: string;
  kind?: 'image' | 'video';
  isCover?: boolean;
  /**
   * Local file behind the preview, when there is one. Its presence is what
   * selects the local preview pipeline (blob/HEIC handling) over a plain
   * remote render — passing an uploaded URL through the local pipeline would
   * add a probe round trip per tile for nothing.
   */
  file?: File;
  /** 0–100 while uploading. Omit once settled. */
  progress?: number;
}

/**
 * Places an ordered media list onto the slots this grid renders.
 *
 * An item's own `viewSlot` wins; position is the fallback. Two items claiming
 * the same slot would collide in a Map and one would simply vanish from the
 * grid, so a duplicate spills to the next free slot instead. That keeps what
 * the reader sees consistent with drag-and-drop, which identifies media by the
 * slot it is DISPLAYED in rather than the slot it was stored with.
 */
export function buildMediaSlotMap(
  items: readonly (MediaSlotGridItem & { viewSlot?: string | null })[],
  maxSlots = 6,
): Map<MediaViewSlot, MediaSlotGridItem> {
  const renderable = MEDIA_VIEW_SLOT_OPTIONS.slice(0, maxSlots).map((option) => option.value);
  const bySlot = new Map<MediaViewSlot, MediaSlotGridItem>();
  const used = new Set<MediaViewSlot>();

  items.forEach((item, index) => {
    let slot = normalizeMediaViewSlot(item.viewSlot, index) as MediaViewSlot;
    if (!renderable.includes(slot) || used.has(slot)) {
      slot = renderable.find((candidate) => !used.has(candidate)) ?? slot;
    }
    used.add(slot);
    bySlot.set(slot, item);
  });

  return bySlot;
}

/** The slots this grid renders, in order. */
export const renderableMediaSlots = (maxSlots = 6): MediaViewSlot[] =>
  MEDIA_VIEW_SLOT_OPTIONS.slice(0, maxSlots).map((option) => option.value);

export interface MediaSlotGridProps {
  /** Media keyed by the slot it occupies. */
  mediaBySlot: Map<MediaViewSlot, MediaSlotGridItem>;
  /** How many slots to show. Six is the platform cap. */
  maxSlots?: number;
  /** Slots to mark as unfilled-but-required. */
  missingRequiredSlots?: MediaViewSlot[];
  selectedId?: string | null;
  disabled?: boolean;
  /** False greys the empty tiles (e.g. the media cap is reached). */
  canAddMore?: boolean;
  onPickForSlot: (slot: MediaViewSlot) => void;
  onSelect?: (item: MediaSlotGridItem, slot: MediaViewSlot) => void;
  onDelete?: (item: MediaSlotGridItem, slot: MediaViewSlot) => void;
  /** Omit to hide the per-tile cover control. */
  onSetCover?: (item: MediaSlotGridItem, slot: MediaViewSlot) => void;
  /**
   * The reader dragged the tile in `from` onto the tile in `to`. What that
   * means is the caller's to decide: product media swaps the two slots, design
   * media moves the item and lets every slot below it shift up, because there
   * slots are strictly positional. Omit to make the grid non-reorderable.
   */
  onSlotDrop?: (from: MediaViewSlot, to: MediaViewSlot) => void;
  /**
   * When set, only these empty tiles can be filled; the rest render inert.
   * Callers whose slots are positional pass just the next free slot — offering
   * "Right" while "Left" is still empty would promise a placement the store
   * cannot honour, and the file would silently land somewhere else.
   */
  enabledEmptySlots?: MediaViewSlot[];
  /**
   * Files dropped onto a slot from outside the page. Omit to ignore external
   * drops — but note that dropping a photo straight onto "Back" is the fastest
   * way to fill a slot on a desktop, so both callers wire it.
   */
  onDropFiles?: (slot: MediaViewSlot, files: File[]) => void;
  className?: string;
  'data-testid'?: string;
}

export const MediaSlotGrid: React.FC<MediaSlotGridProps> = ({
  mediaBySlot,
  maxSlots = 6,
  missingRequiredSlots = [],
  selectedId,
  disabled = false,
  canAddMore = true,
  onPickForSlot,
  onSelect,
  onDelete,
  onSetCover,
  onSlotDrop,
  enabledEmptySlots,
  onDropFiles,
  className,
  'data-testid': dataTestId,
}) => {
  const slots = MEDIA_VIEW_SLOT_OPTIONS.slice(0, maxSlots);
  const reorderable = Boolean(onSlotDrop) && !disabled;
  const acceptsDrops = (reorderable || Boolean(onDropFiles)) && !disabled;

  const [pointerDragSlot, setPointerDragSlot] = useState<MediaViewSlot | null>(null);
  const [pointerOverSlot, setPointerOverSlot] = useState<MediaViewSlot | null>(null);

  const swap = useCallback(
    (from: string, to: string) => {
      if (from === to) return;
      onSlotDrop?.(from as MediaViewSlot, to as MediaViewSlot);
    },
    [onSlotDrop],
  );

  const {
    containerRef,
    draggingSlot: touchDraggingSlot,
    overSlot: touchOverSlot,
  } = useLongPressSlotDrag({
    enabled: reorderable,
    canDragSlot: (slot) => mediaBySlot.has(slot as MediaViewSlot),
    onSwap: swap,
  });

  return (
    <div
      ref={containerRef}
      data-testid={dataTestId}
      className={`grid grid-cols-2 gap-3 ${className ?? ''}`}
    >
      {slots.map((slotOption) => {
        const item = mediaBySlot.get(slotOption.value);
        const isMissing =
          slotOption.required && missingRequiredSlots.includes(slotOption.value);
        const isDragging =
          pointerDragSlot === slotOption.value || touchDraggingSlot === slotOption.value;
        const isDragOver =
          pointerOverSlot === slotOption.value || touchOverSlot === slotOption.value;
        const isSelected = Boolean(item && selectedId && item.id === selectedId);
        const isUploading =
          typeof item?.progress === 'number' && item.progress < 100;

        return (
          <div
            key={slotOption.value}
            data-slot={slotOption.value}
            draggable={Boolean(item) && reorderable}
            onDragStart={(event) => {
              if (!reorderable || !item) return;
              event.dataTransfer.setData('text/plain', slotOption.value);
              setPointerDragSlot(slotOption.value);
            }}
            onDragOver={(event) => {
              if (!acceptsDrops) return;
              event.preventDefault();
              if (pointerDragSlot !== slotOption.value) {
                setPointerOverSlot(slotOption.value);
              }
            }}
            onDragLeave={() => setPointerOverSlot(null)}
            onDragEnd={() => {
              setPointerDragSlot(null);
              setPointerOverSlot(null);
            }}
            onDrop={(event) => {
              if (!acceptsDrops) return;
              event.preventDefault();
              setPointerDragSlot(null);
              setPointerOverSlot(null);

              // Files dropped from the desktop take precedence — a drop that
              // carries files was never a slot-to-slot reorder.
              const droppedFiles = Array.from(event.dataTransfer.files ?? []).filter(
                (file) => file.type.startsWith('image/') || file.type.startsWith('video/'),
              );
              if (droppedFiles.length > 0) {
                onDropFiles?.(slotOption.value, droppedFiles);
                return;
              }

              const from = event.dataTransfer.getData('text/plain');
              if (from && reorderable) swap(from, slotOption.value);
            }}
            className={`relative rounded-xl overflow-hidden aspect-[4/3] w-full border transition-all duration-200 group ${
              item && reorderable ? longPressSlotDragTileClass : ''
            } ${
              isDragging
                ? 'border-dashed border-purple-400 opacity-50 scale-95'
                : isDragOver
                  ? 'border-purple-500 bg-purple-500/5 scale-[1.02] shadow-md shadow-purple-500/5'
                  : isSelected
                    ? 'border-purple-600 ring-2 ring-purple-600/30'
                    : isMissing
                      ? 'border-amber-400 bg-amber-500/5'
                      : 'border-gray-200 dark:border-white/10 surface-subtle hover:border-purple-500/40'
            } ${
              disabled
                ? 'opacity-60 cursor-not-allowed'
                : item
                  ? 'cursor-grab active:cursor-grabbing'
                  : 'cursor-pointer'
            }`}
          >
            {item ? (
              <div
                className="relative h-full w-full"
                onClick={() => onSelect?.(item, slotOption.value)}
              >
                {item.file ? (
                  <LocalMediaPreview
                    kind={item.kind === 'video' ? 'video' : 'image'}
                    src={item.url}
                    file={item.file}
                    alt={`${slotOption.label} media`}
                    className="h-full w-full flex items-center justify-center"
                    mediaClassName="h-full w-full object-cover"
                    maxHeightClassName="max-h-full"
                    maxWidthClassName="max-w-full"
                    controls={false}
                    muted
                    loadingLabel="Preparing..."
                    unavailableLabel="Preview unavailable"
                    diagnosticScope="media-slot-grid"
                  />
                ) : (
                  <MediaRenderer
                    kind={item.kind === 'video' ? 'video' : 'image'}
                    src={item.url}
                    alt={`${slotOption.label} media`}
                    fit="cover"
                    className="h-full w-full"
                    mediaClassName="h-full w-full object-cover"
                  />
                )}

                {isUploading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
                    <span className="text-xs font-semibold text-white">
                      {Math.round(item.progress ?? 0)}%
                    </span>
                  </div>
                ) : null}

                <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-lg bg-black/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm backdrop-blur-md select-none">
                  {item.isCover && (
                    <span className="font-bold text-amber-300">★ Cover •</span>
                  )}
                  <span>{slotOption.label}</span>
                  {slotOption.required && <span className="text-amber-400">*</span>}
                </div>

                {!disabled && !isUploading ? (
                  <div className="absolute top-2 right-2 flex items-center gap-1.5">
                    {onSetCover && !item.isCover ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSetCover(item, slotOption.value);
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white shadow-sm backdrop-blur-md transition-colors hover:bg-amber-500"
                        aria-label={`Set ${slotOption.label} as cover`}
                        title="Set as cover"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    {onDelete ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(item, slotOption.value);
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white shadow-sm backdrop-blur-md transition-colors hover:bg-red-500"
                        aria-label={`Remove ${slotOption.label} media`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onPickForSlot(slotOption.value)}
                disabled={
                  !canAddMore ||
                  disabled ||
                  (enabledEmptySlots
                    ? !enabledEmptySlots.includes(slotOption.value)
                    : false)
                }
                className="flex h-full w-full flex-col items-center justify-center p-3 text-center transition-all hover:bg-purple-50/10 disabled:cursor-not-allowed disabled:opacity-50 group-hover:scale-105 dark:hover:bg-purple-500/10"
              >
                <div className="mb-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/10 text-purple-600 transition-transform group-hover:scale-110 dark:text-purple-400">
                  <Plus className="h-4 w-4" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-theme">
                  {slotOption.label}{' '}
                  {slotOption.required && <span className="text-amber-500">*</span>}
                </span>
                <span className="mt-0.5 text-[10px] text-theme-secondary">
                  Tap to upload
                </span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MediaSlotGrid;
