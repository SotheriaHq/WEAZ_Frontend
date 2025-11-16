import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import uiDebug from '@/utils/uiDebug';

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

// Countdown timer hook
function useCountdown(endDate: string | null) {
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (!endDate) {
      setTimeLeft('');
      return;
    }

    const calculateTimeLeft = () => {
      const end = new Date(endDate).getTime();
      const now = Date.now();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft('Ended');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [endDate]);

  return timeLeft;
}

export const StackedCarousel: React.FC<StackedCarouselProps> = ({
  items,
  initialIndex = 0,
  onIndexChange,
  className = '',
  autoplay = false,
  isOwner = false,
  coverMediaId,
  onSetCover,
  tags = [],
  price,
}) => {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [containerWidth, setContainerWidth] = useState(800);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoplayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const countdown = useCountdown(price?.saleEndAt || null);
  const debug = uiDebug();

  const itemsLength = items.length;
  const hasActiveSale = price?.saleMin && price?.saleMax;
  if (debug) {
    console.log('[StackedCarousel] debug render', { items: items.length, hasActiveSale, price });
  }

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

  // Tag overlay removed per design. Left here intentionally blank.

  return (
    <div className={`w-full ${className}`}>
      <div
        ref={containerRef}
        className="relative w-full h-[500px] sm:h-[600px] lg:h-[700px] flex items-center justify-center"
        style={{ perspective: '1200px' }}
        onClick={(e) => {
          // Collapse tags when clicking on the carousel itself
          if (e.target === containerRef.current || (e.target as HTMLElement).tagName === 'IMG' || (e.target as HTMLElement).tagName === 'VIDEO') {
            console.log('[StackedCarousel] Clicked on carousel, collapsing tags');
            setShowTags(false);
          }
        }}
      >
        {/* Tags overlay removed. Show a debug outline box if UI debug is on. */}
        {debug && (
          <div className="absolute top-4 left-4 z-50 px-2 py-1 border border-dashed border-red-400 text-[10px] bg-white/40 text-red-700 rounded">
            tags overlay removed
          </div>
        )}

        {/* Price overlay removed. Debug box if enabled. */}
        {debug && (
          <div className="absolute top-4 right-4 z-50 px-2 py-1 border border-dashed border-blue-400 text-[10px] bg-white/40 text-blue-700 rounded">
            price overlay removed
          </div>
        )}

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
            className="absolute w-full max-w-[95%] sm:max-w-[85%] lg:max-w-[75%] h-[90%] rounded-2xl overflow-hidden shadow-2xl"
            style={getItemStyle(index)}
          >
            <div className="relative w-full h-full flex items-center justify-center">
              {item.type === 'image' ? (
                <img
                  src={item.url}
                  alt={item.caption ?? 'Collection media'}
                  className="w-full h-full object-contain select-none bg-black"
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
                  className="w-full h-full object-contain bg-black"
                  controls={false}
                  playsInline
                  muted
                  preload="metadata"
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
