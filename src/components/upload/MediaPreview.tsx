import React, { useEffect, useMemo, useState, useRef } from 'react';
import type { MediaItem } from '../../types/media';
import { FiX, FiPlay } from 'react-icons/fi';

interface MediaPreviewProps {
  items: MediaItem[];
  onDeleteItem: (id: string) => void;
  onAddMore?: () => void;
  disabled?: boolean;
  progressById?: Record<string, number>;
}

interface PreviewFile { file: File; url: string; id?: string }

/**
 * MediaPreview
 * Shows thumbnails for selected files and a main preview area. Object URLs
 * are created for File objects and cached in a ref so the same blob URL is
 * reused across renders. We revoke URLs for files that are removed and on
 * unmount to prevent memory leaks.
 */
const MediaPreview: React.FC<MediaPreviewProps> = ({ items, onDeleteItem, onAddMore, disabled = false, progressById }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Cache of object URLs keyed by a stable fingerprint
  const urlMap = useRef<Map<string, string>>(new Map());

  const previewFiles: PreviewFile[] = useMemo(() => {
    const arr: PreviewFile[] = [];
    for (const it of items) {
      // prefer provided previewUrl
      const url = it.previewUrl ?? (() => {
        const u = URL.createObjectURL(it.file);
        urlMap.current.set(it.id, u);
        return u;
      })();
      arr.push({ file: it.file, url, id: it.id });
    }
    return arr;
  }, [items]);

  // Revoke any object URLs that are no longer present in `previewFiles` so
  // we don't leak memory. Also, on unmount revoke everything and clear the
  // cache.
  useEffect(() => {
    const keep = new Set(previewFiles.map((pf) => pf.id));
    const map = urlMap.current;
    for (const key of Array.from(map.keys())) {
      if (!keep.has(key)) {
        const url = map.get(key);
        if (url) {
          URL.revokeObjectURL(url);
          map.delete(key);
        }
      }
    }
  }, [previewFiles]);

  useEffect(() => () => {
    const map = urlMap.current;
    for (const url of map.values()) {
      URL.revokeObjectURL(url);
    }
    map.clear();
  }, []);

  useEffect(() => {
    if (selectedIndex >= previewFiles.length) setSelectedIndex(Math.max(0, previewFiles.length - 1));
  }, [previewFiles.length, selectedIndex]);

  if (!previewFiles || previewFiles.length === 0) return null;

  const selected = previewFiles[selectedIndex];
  const isVideo = selected.file.type.startsWith('video/');

  return (
    <div className="w-full">
      <div className="mb-4 rounded-lg  dark:bg-gray-900/50 dark:border-gray-700 overflow-hidden relative" style={{ height: '500px' }}>
        {isVideo ? (
          <video src={selected.url} controls className="h-full w-full object-contain" />
        ) : (
          <img src={selected.url} alt={selected.file.name} className="h-full w-full object-contain" />
        )}
      </div>

      <div className="flex space-x-3 overflow-x-auto py-2">
        {previewFiles.map((pf, idx) => {
          const fileProgress = pf.id ? progressById?.[pf.id] : undefined;
          const normalizedProgress = typeof fileProgress === 'number' ? Math.max(0, Math.min(100, fileProgress)) : undefined;
          return (
            <div
              key={(pf.id ?? pf.url) + idx}
              className={`relative h-28 w-28 flex-shrink-0 rounded-md overflow-hidden border ${
                selectedIndex === idx
                  ? 'ring-2 ring-purple-200 dark:ring-purple-300'
                  : 'border-gray-200 dark:border-gray-700'
              } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-purple-400/60 dark:hover:border-purple-300/60'}`}
              onClick={() => {
                if (!disabled) setSelectedIndex(idx);
              }}
            >
              <img src={pf.url} alt={pf.file.name} className="h-full w-full object-cover" />
              {pf.file.type.startsWith('video/') && <FiPlay className="absolute top-1 left-1 text-white" />}
              {!disabled && (
                <button
                  type="button"
                  title="Remove"
                  aria-label="Remove media"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (pf.id) onDeleteItem(pf.id);
                  }}
                  className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-red-500/90 text-white hover:bg-red-600 shadow-sm transition-colors"
                >
                  <FiX size={14} />
                </button>
              )}
              {typeof normalizedProgress === 'number' && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-black/20 dark:bg-white/15">
                  <div
                    className="h-full bg-purple-500 transition-all dark:bg-purple-300"
                    style={{ width: `${normalizedProgress}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          className={`flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-md border-2 border-dashed text-gray-400 dark:text-gray-500 ${
            disabled
              ? 'cursor-not-allowed opacity-60'
              : 'cursor-pointer hover:text-purple-500 hover:border-purple-500 dark:hover:text-purple-300 dark:hover:border-purple-300 transition-colors'
          }`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled && onAddMore) {
              onAddMore();
            }
          }}
          disabled={disabled}
          aria-label="Add more files"
        >
          <span className="text-3xl font-light">+</span>
        </button>
      </div>
    </div>
  );
};

export default MediaPreview;
