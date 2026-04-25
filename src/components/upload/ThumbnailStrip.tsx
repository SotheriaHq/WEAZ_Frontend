import React, { useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiPlay, FiStar, FiPlus } from 'react-icons/fi';
import type { MediaItem, MediaItemKind } from '../../types/media';
import MediaRenderer from '../media/MediaRenderer';

/** Slot labels shown beneath each thumbnail to guide upload ordering */
const SLOT_LABELS = ['Front', 'Left', 'Right', 'Back', 'Cover', 'Extra'];

interface ThumbnailStripProps {
  items: MediaItem[];
  selectedIndex: number;
  coverIndex: number;
  onSelect: (index: number) => void;
  onDelete: (id: string) => void;
  onSetCover: (index: number) => void;
  onAddMore?: () => void;
  disabled?: boolean;
  progressById?: Record<string, number>;
  /** Show slot labels (Front, Left, Right…) beneath thumbnails */
  showSlotLabels?: boolean;
}

interface PreviewFile {
  file?: File;
  url: string;
  id?: string;
  kind: MediaItemKind;
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
  disabled = false,
  progressById,
  showSlotLabels = false,
}) => {
  const urlMap = useRef<Map<string, string>>(new Map());

  // Build preview files with object URLs
  const previewFiles: PreviewFile[] = useMemo(() => {
    const arr: PreviewFile[] = [];
    for (const it of items) {
      let url = it.previewUrl;
      if (!url && it.file) {
        const existing = urlMap.current.get(it.id);
        if (existing) {
          url = existing;
        } else {
          url = URL.createObjectURL(it.file);
          urlMap.current.set(it.id, url);
        }
      }
      arr.push({ file: it.file, url: url!, id: it.id, kind: it.kind });
    }
    return arr;
  }, [items]);

  // Cleanup object URLs
  useEffect(() => {
    const keep = new Set(previewFiles.map((pf) => pf.id));
    const map = urlMap.current;
    for (const key of Array.from(map.keys())) {
      if (!keep.has(key)) {
        const url = map.get(key);
        if (url && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
        map.delete(key);
      }
    }
  }, [previewFiles]);

  useEffect(() => {
    const map = urlMap.current;
    return () => {
      for (const url of map.values()) {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      }
      map.clear();
    };
  }, []);

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
                  ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
                `}
                onClick={() => {
                  if (!disabled && !isUploading) onSelect(idx);
                }}
              >
                {/* Thumbnail image/video (intrinsic size; capped height with internal scroll) */}
                <MediaRenderer
                  kind={isVideo ? 'video' : 'image'}
                  src={pf.url}
                  alt={pf.file?.name || `Thumbnail ${idx + 1}`}
                  className="w-full h-24 flex items-center justify-center bg-white/70 dark:bg-white/[0.03]"
                  maxHeightClassName="max-h-full"
                  maxWidthClassName="max-w-full"
                  controls={false}
                  muted
                />

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
                      <FiPlay className="w-4 h-4 text-gray-900 ml-0.5" />
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

                {/* Slot label */}
                {showSlotLabels && idx < SLOT_LABELS.length && (
                  <div className="absolute bottom-0 inset-x-0 bg-black/50 backdrop-blur-sm text-center py-0.5">
                    <span className="text-[9px] font-semibold text-white/90 uppercase tracking-wide">
                      {SLOT_LABELS[idx]}
                    </span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Add More button */}
        {onAddMore && !disabled && (
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
