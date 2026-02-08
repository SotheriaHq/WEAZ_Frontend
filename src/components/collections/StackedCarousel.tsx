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

function calculateGap(width: number) {
  const minWidth = 768;
  const maxWidth = 1200;
  const minGap = 40;
  const maxGap = 80;
  if (width <= minWidth) return minGap;
  if (width >= maxWidth) return Math.max(minGap, maxGap + 0.05 * (width - maxWidth));
  return minGap + (maxGap - minGap) * ((width - minWidth) / (maxWidth - minWidth));
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
  const [containerWidth, setContainerWidth] = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoplayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  // Countdown currently unused after UI simplification; remove to satisfy TS noUnusedLocals

  const itemsLength = items.length;

  // Responsive width tracking
  useEffect(() => {
    function handleResize() {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    }
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
    if (onIndexChange && items[newIndex]) onIndexChange(newIndex, items[newIndex]);
    if (autoplayIntervalRef.current) clearInterval(autoplayIntervalRef.current);
  }, [activeIndex, itemsLength, items, onIndexChange]);

  const handlePrev = useCallback(() => {
    const newIndex = (activeIndex - 1 + itemsLength) % itemsLength;
    setActiveIndex(newIndex);
    if (onIndexChange && items[newIndex]) onIndexChange(newIndex, items[newIndex]);
    if (autoplayIntervalRef.current) clearInterval(autoplayIntervalRef.current);
  }, [activeIndex, itemsLength, items, onIndexChange]);

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

  // Compute transforms for stacked effect
  function getItemStyle(index: number): React.CSSProperties {
    const gap = calculateGap(containerWidth);
    // const maxStickUp = gap * 0.7; // Removed for cleaner cover-flow look
    const isActive = index === activeIndex;
    const isLeft = (activeIndex - 1 + itemsLength) % itemsLength === index;
    const isRight = (activeIndex + 1) % itemsLength === index;

    if (isActive) {
      return {
        zIndex: 10,
        opacity: 1,
        pointerEvents: 'auto',
        transform: `translateX(0px) translateZ(0px) rotateY(0deg) scale(1)`,
        filter: 'brightness(100%)',
        transition: 'all 0.6s cubic-bezier(0.23, 1, 0.32, 1)', // Ease-out-quint for smoother snap
        boxShadow: '0 20px 50px -12px rgba(0, 0, 0, 0.5)',
      };
    }
    if (isLeft) {
      return {
        zIndex: 5,
        opacity: 0.6,
        pointerEvents: 'auto',
        transform: `translateX(-${gap * 1.2}px) translateZ(-100px) rotateY(25deg) scale(0.85)`,
        filter: 'brightness(60%)',
        transition: 'all 0.6s cubic-bezier(0.23, 1, 0.32, 1)',
      };
    }
    if (isRight) {
      return {
        zIndex: 5,
        opacity: 0.6,
        pointerEvents: 'auto',
        transform: `translateX(${gap * 1.2}px) translateZ(-100px) rotateY(-25deg) scale(0.85)`,
        filter: 'brightness(60%)',
        transition: 'all 0.6s cubic-bezier(0.23, 1, 0.32, 1)',
      };
    }
    return {
      zIndex: 0,
      opacity: 0,
      pointerEvents: 'none',
      transform: `translateX(0px) translateZ(-200px) scale(0.5)`,
      transition: 'all 0.6s cubic-bezier(0.23, 1, 0.32, 1)',
    };
  }

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
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`w-full max-w-[80%] sm:max-w-[70%] lg:max-w-[55%] rounded-2xl shadow-2xl overflow-hidden mx-auto ${index === activeIndex ? 'relative' : 'absolute opacity-0 pointer-events-none'}`}
            style={index === activeIndex ? {} : getItemStyle(index)}
          >
            <div className="relative w-full">
              {item.type === 'image' ? (
                <img
                  src={item.url}
                  alt={item.caption ?? 'Collection media'}
                  className="w-full h-auto block rounded-2xl"
                />
              ) : (
                <video
                  src={item.url}
                  controls
                  muted
                  className="w-full h-auto block rounded-2xl"
                  ref={(el) => {
                    if (el) videoRefs.current.set(item.id, el);
                    else videoRefs.current.delete(item.id);
                  }}
                />
              )}
              {isOwner && index === activeIndex && (
                <button
                  type="button"
                  onClick={() => onSetCover?.(item)}
                  className={`absolute top-4 left-4 px-3 py-1.5 rounded-full text-xs font-semibold shadow backdrop-blur-md transition
                  ${coverMediaId === item.id ? 'bg-emerald-600 text-white' : 'bg-black/50 text-white hover:bg-black/70'}`}
                >
                  {coverMediaId === item.id ? 'Cover Set' : 'Set As Cover'}
                </button>
              )}
              {item.type === 'video' && index === activeIndex && (
                <button
                  type="button"
                  onClick={() => {
                    const video = videoRefs.current.get(item.id);
                    if (!video) return;
                    if (video.paused) {
                      video.play().catch(() => void 0);
                    } else {
                      video.pause();
                    }
                  }}
                  className="absolute bottom-4 right-4 p-2.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition backdrop-blur-sm"
                >
                  {videoRefs.current.get(item.id)?.paused ? (
                    <Play size={18} />
                  ) : (
                    <Pause size={18} />
                  )}
                </button>
              )}
            </div>
            {item.caption && index === activeIndex && (
              <div className="absolute bottom-0 left-0 right-0 px-4 py-3 text-xs text-white bg-gradient-to-t from-black/70 via-black/50 to-transparent backdrop-blur-sm">
                <p className="line-clamp-2 italic">{item.caption}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Removed bottom navigator & indicators for cleaner view */}
    </div>
  );
};

export default StackedCarousel;
