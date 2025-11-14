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

export const StackedCarousel: React.FC<StackedCarouselProps> = ({
  items,
  initialIndex = 0,
  onIndexChange,
  className = '',
  autoplay = false,
}) => {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [containerWidth, setContainerWidth] = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoplayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

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
    const maxStickUp = gap * 0.7;
    const isActive = index === activeIndex;
    const isLeft = (activeIndex - 1 + itemsLength) % itemsLength === index;
    const isRight = (activeIndex + 1) % itemsLength === index;

    if (isActive) {
      return {
        zIndex: 3,
        opacity: 1,
        pointerEvents: 'auto',
        transform: `translateX(0px) translateY(0px) scale(1) rotateY(0deg)`,
        transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
      };
    }
    if (isLeft) {
      return {
        zIndex: 2,
        opacity: 0.7,
        pointerEvents: 'auto',
        transform: `translateX(-${gap}px) translateY(-${maxStickUp}px) scale(0.88) rotateY(12deg)`,
        transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
      };
    }
    if (isRight) {
      return {
        zIndex: 2,
        opacity: 0.7,
        pointerEvents: 'auto',
        transform: `translateX(${gap}px) translateY(-${maxStickUp}px) scale(0.88) rotateY(-12deg)`,
        transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
      };
    }
    return {
      zIndex: 1,
      opacity: 0,
      pointerEvents: 'none',
      transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
    };
  }

  if (!items.length) {
    return (
      <div className={`flex items-center justify-center text-sm text-gray-500 dark:text-gray-400 h-96 ${className}`}>
        No media in this collection yet.
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <div
        ref={containerRef}
        className="relative w-full h-[500px] sm:h-[600px] lg:h-[700px] flex items-center justify-center"
        style={{ perspective: '1200px' }}
      >
        {items.map((item, index) => (
          <div
            key={item.id}
            className="absolute w-full max-w-[85%] sm:max-w-[75%] lg:max-w-[65%] h-[90%] rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-gray-100 via-white to-gray-50 dark:from-gray-900 dark:via-gray-950 dark:to-black"
            style={getItemStyle(index)}
          >
            <div className="relative w-full h-full flex items-center justify-center p-2 sm:p-4">
              {item.type === 'image' ? (
                <img
                  src={item.url}
                  alt={item.caption ?? 'Collection media'}
                  className="w-full h-full object-contain select-none rounded-lg"
                  draggable={false}
                  loading="lazy"
                />
              ) : (
                <video
                  ref={(el) => {
                    if (el) videoRefs.current.set(item.id, el);
                    else videoRefs.current.delete(item.id);
                  }}
                  src={item.url}
                  className="w-full h-full object-contain rounded-lg bg-black"
                  controls={false}
                  playsInline
                  muted
                  preload="metadata"
                />
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

      {/* Navigation Controls */}
      <div className="flex items-center justify-center gap-4 mt-6">
        <button
          type="button"
          onClick={handlePrev}
          className="w-11 h-11 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 dark:from-gray-700 dark:to-gray-800 text-white hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg flex items-center justify-center"
          aria-label="Previous"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-xs font-medium text-gray-600 dark:text-gray-400 min-w-[60px] text-center">
          {activeIndex + 1} / {itemsLength}
        </div>
        <button
          type="button"
          onClick={handleNext}
          className="w-11 h-11 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 dark:from-gray-700 dark:to-gray-800 text-white hover:from-purple-600 hover:to-purple-700 transition-all shadow-lg flex items-center justify-center"
          aria-label="Next"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Position Indicators */}
      <div className="flex items-center justify-center gap-2 mt-4">
        {items.map((_, idx) => (
          <button
            key={idx}
            onClick={() => {
              setActiveIndex(idx);
              if (onIndexChange && items[idx]) onIndexChange(idx, items[idx]);
            }}
            className={`h-1.5 rounded-full transition-all ${
              idx === activeIndex
                ? 'w-8 bg-purple-600 dark:bg-purple-500'
                : 'w-1.5 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
            }`}
            aria-label={`Go to item ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default StackedCarousel;
