import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';

export interface CarouselMediaItem {
  id: string;
  url: string;
  type: 'image' | 'video';
  fileId?: string | null;
  caption?: string | null;
  order?: number;
}

interface StackedCarouselProps {
  items: CarouselMediaItem[];
  initialIndex?: number;
  onIndexChange?: (index: number, item: CarouselMediaItem) => void;
  className?: string;
  autoplay?: boolean;
  isOwner?: boolean;
  coverMediaId?: string | null;
  onSetCover?: (item: CarouselMediaItem) => void;
  tags?: string[];
  price?: { min?: number | null; max?: number | null; saleMin?: number | null; saleMax?: number | null; saleStartAt?: string | null; saleEndAt?: string | null };
}

// Countdown overlay removed; hook removed to satisfy TS noUnusedLocals

export const StackedCarousel: React.FC<StackedCarouselProps> = ({
  items,
  initialIndex = 0,
  onIndexChange,
  className = '',
  autoplay = false,
  isOwner = false,
  coverMediaId,
  onSetCover,
}) => {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoplayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  // Countdown currently unused after UI simplification; remove to satisfy TS noUnusedLocals

  const itemsLength = items.length;
  const activeItem = items[activeIndex];

  // Autoplay
  useEffect(() => {
    if (autoplay && itemsLength > 1) {
      autoplayIntervalRef.current = setInterval(() => {
        setActiveIndex((prev) => (prev + 1) % itemsLength);
      }, 5000);
    }
    return () => {
      if (autoplayIntervalRef.current) clearInterval(autoplayIntervalRef.current);
    };
  }, [autoplay, itemsLength]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, itemsLength]);

  // Navigation handlers
  const handleNext = useCallback(() => {
    const newIndex = (activeIndex + 1) % itemsLength;
    setActiveIndex(newIndex);
    if (autoplayIntervalRef.current) clearInterval(autoplayIntervalRef.current);
  }, [activeIndex, itemsLength]);

  const handlePrev = useCallback(() => {
    const newIndex = (activeIndex - 1 + itemsLength) % itemsLength;
    setActiveIndex(newIndex);
    if (autoplayIntervalRef.current) clearInterval(autoplayIntervalRef.current);
  }, [activeIndex, itemsLength]);

  useEffect(() => {
    if (!itemsLength) return;
    setActiveIndex((prev) => {
      if (prev < itemsLength) return prev;
      return Math.max(0, itemsLength - 1);
    });
  }, [itemsLength]);

  useEffect(() => {
    if (!itemsLength) return;
    const clamped = Math.max(0, Math.min(initialIndex, itemsLength - 1));
    setActiveIndex(clamped);
  }, [initialIndex, itemsLength]);

  useEffect(() => {
    if (!onIndexChange || !activeItem) return;
    onIndexChange(activeIndex, activeItem);
  }, [activeIndex, activeItem, onIndexChange]);

  // Video playback control
  useEffect(() => {
    videoRefs.current.forEach((video, id) => {
      const item = items.find((i) => i.id === id);
      const isActive = item && items[activeIndex]?.id === id;
      if (video && item?.type === 'video') {
        if (isActive) {
          video.play().catch(() => void 0);
        } else {
          video.pause();
        }
      }
    });
  }, [activeIndex, items]);

  if (!items.length) {
    return (
      <div className={`flex items-center justify-center text-sm text-gray-500 dark:text-gray-400 h-96 ${className}`}>
        No media in this collection yet.
      </div>
    );
  }

  // Tag overlay removed per design. Left here intentionally blank.

  return (
    <div className={`w-full ${className}`}>
      <div
        ref={containerRef}
        className="relative w-full flex items-center justify-center"
        style={{ perspective: '1200px' }}
        onClick={undefined}
      >
        

        {/* Overlay navigation controls to keep them visible without scrolling */}
        {itemsLength > 1 && (
          <>
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-40 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md shadow-lg flex items-center justify-center"
              aria-label="Previous"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-40 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-md shadow-lg flex items-center justify-center"
              aria-label="Next"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
        {activeItem ? (
          <div className="relative w-full max-w-[80%] sm:max-w-[70%] lg:max-w-[55%] rounded-2xl shadow-2xl overflow-hidden mx-auto">
            <div className="relative w-full">
              {activeItem.type === 'image' ? (
                <img
                  src={activeItem.url}
                  alt={activeItem.caption ?? 'Collection media'}
                  className="w-full h-auto block rounded-2xl"
                />
              ) : (
                <video
                  src={activeItem.url}
                  controls
                  muted
                  className="w-full h-auto block rounded-2xl"
                  ref={(el) => {
                    if (el) videoRefs.current.set(activeItem.id, el);
                    else videoRefs.current.delete(activeItem.id);
                  }}
                />
              )}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => onSetCover?.(activeItem)}
                  className={`absolute top-4 left-4 px-3 py-1.5 rounded-full text-xs font-semibold shadow backdrop-blur-md transition
                  ${coverMediaId === activeItem.id ? 'bg-emerald-600 text-white' : 'bg-black/50 text-white hover:bg-black/70'}`}
                >
                  {coverMediaId === activeItem.id ? 'Cover Set' : 'Set As Cover'}
                </button>
              )}
              {activeItem.type === 'video' && (
                <button
                  type="button"
                  onClick={() => {
                    const video = videoRefs.current.get(activeItem.id);
                    if (!video) return;
                    if (video.paused) {
                      video.play().catch(() => void 0);
                    } else {
                      video.pause();
                    }
                  }}
                  className="absolute bottom-4 right-4 p-2.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition backdrop-blur-sm"
                >
                  {videoRefs.current.get(activeItem.id)?.paused ? (
                    <Play size={18} />
                  ) : (
                    <Pause size={18} />
                  )}
                </button>
              )}
            </div>
            {activeItem.caption ? (
              <div className="absolute bottom-0 left-0 right-0 px-4 py-3 text-xs text-white bg-gradient-to-t from-black/70 via-black/50 to-transparent backdrop-blur-sm">
                <p className="line-clamp-2 italic">{activeItem.caption}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Removed bottom navigator & indicators for cleaner view */}
    </div>
  );
};

export default StackedCarousel;
