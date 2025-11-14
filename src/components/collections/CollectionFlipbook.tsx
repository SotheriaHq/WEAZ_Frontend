import React, { useRef, useEffect, useState, useCallback } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';

export interface FlipbookMediaItem {
  id: string;
  url: string; // resolved (may be signed) URL
  type: 'image' | 'video';
  fileId?: string | null;
  caption?: string | null;
  order?: number;
}

interface CollectionFlipbookProps {
  items: FlipbookMediaItem[];
  initialIndex?: number;
  onFlip?: (index: number, item: FlipbookMediaItem) => void;
  className?: string;
  height?: number; // explicit height hint; responsive width via parent
}

// A single page wrapper – react-pageflip requires forwardRef
// Each page will center the media and provide optional caption.
const Page = React.forwardRef<HTMLDivElement, { item: FlipbookMediaItem; active: boolean }>(
  ({ item, active }, ref) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);

    // Auto play/pause videos based on active state
    useEffect(() => {
      const v = videoRef.current;
      if (!v || item.type !== 'video') return;
      if (active) {
        // Attempt play; ignore promise rejection (autoplay policies)
        v.play().catch(() => void 0);
      } else {
        v.pause();
        v.currentTime = v.currentTime; // keep frame
      }
    }, [active, item.type]);

    return (
      <div ref={ref} className="w-full h-full flex flex-col overflow-hidden">
        <div className="relative flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-950 dark:to-black">
          {item.type === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.url}
              alt={item.caption ?? 'Collection media'}
              className="max-h-full max-w-full object-contain select-none"
              draggable={false}
              loading="lazy"
            />
          ) : (
            <video
              ref={videoRef}
              src={item.url}
              className="max-h-full max-w-full object-contain rounded-lg bg-black"
              controls={false}
              playsInline
              muted
              preload="metadata"
            />
          )}
          {item.type === 'video' && (
            <button
              type="button"
              onClick={() => {
                const v = videoRef.current; if (!v) return; if (v.paused) { v.play().catch(()=>void 0); } else { v.pause(); }
              }}
              className="absolute bottom-3 right-3 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition"
            >
              {videoRef.current?.paused ? <Play size={16}/> : <Pause size={16}/>}
            </button>
          )}
        </div>
        {item.caption && (
          <div className="px-4 py-2 text-xs italic text-gray-600 dark:text-gray-300 line-clamp-2 bg-white/70 dark:bg-white/5 backdrop-blur-sm">
            {item.caption}
          </div>
        )}
      </div>
    );
  },
);
Page.displayName = 'FlipbookPage';

export const CollectionFlipbook: React.FC<CollectionFlipbookProps> = ({
  items,
  initialIndex = 0,
  onFlip,
  className = '',
  height = 640,
}) => {
  const bookRef = useRef<any>(null);
  const [current, setCurrent] = useState(initialIndex);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Responsive width watcher
  useEffect(() => {
    const handle = () => {
      if (containerRef.current) setContainerWidth(containerRef.current.clientWidth);
    };
    handle();
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);

  // Flip callback
  const handleFlip = useCallback((e: any) => {
    const idx = e?.data ?? 0;
    setCurrent(idx);
    if (onFlip && items[idx]) onFlip(idx, items[idx]);
  }, [onFlip, items]);

  const next = () => { try { bookRef.current?.pageFlip()?.flipNext(); } catch {} };
  const prev = () => { try { bookRef.current?.pageFlip()?.flipPrev(); } catch {} };

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { next(); }
      else if (e.key === 'ArrowLeft') { prev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!items.length) {
    return (
      <div className={`flex items-center justify-center text-sm text-gray-500 dark:text-gray-400 ${className}`} style={{ height }}>
        No media in this collection yet.
      </div>
    );
  }

  const bookWidth = Math.min(900, Math.max(320, containerWidth));
  const pageHeight = height;

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>      
      <HTMLFlipBook
        width={bookWidth / 2}
        height={pageHeight}
        size="stretch"
        minWidth={280}
        maxWidth={1000}
        minHeight={400}
        maxHeight={1000}
        maxShadowOpacity={0.25}
        showCover={false}
        mobileScrollSupport
        usePortrait
        drawShadow
        flippingTime={900}
        startPage={current}
        startZIndex={0}
        autoSize
        useMouseEvents
        clickEventForward
        swipeDistance={30}
        showPageCorners
        disableFlipByClick={false}
        style={{}}
        className="rounded-xl shadow-lg overflow-hidden"
        onFlip={handleFlip}
        ref={bookRef}
      >
        {items.map((m, idx) => (
          <Page key={m.id} item={m} active={idx === current} />
        ))}
      </HTMLFlipBook>

      {/* Navigation Controls */}
      <button
        type="button"
        aria-label="Previous"
        onClick={prev}
        disabled={current === 0}
        className="hidden md:flex absolute top-1/2 -translate-y-1/2 left-2 p-2 rounded-full bg-white/80 dark:bg-black/50 text-gray-700 dark:text-gray-200 shadow ring-1 ring-black/10 dark:ring-white/10 hover:bg-white dark:hover:bg-black/70 disabled:opacity-40"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        type="button"
        aria-label="Next"
        onClick={next}
        disabled={current === items.length - 1}
        className="hidden md:flex absolute top-1/2 -translate-y-1/2 right-2 p-2 rounded-full bg-white/80 dark:bg-black/50 text-gray-700 dark:text-gray-200 shadow ring-1 ring-black/10 dark:ring-white/10 hover:bg-white dark:hover:bg-black/70 disabled:opacity-40"
      >
        <ChevronRight size={20} />
      </button>

      {/* Page Indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs font-medium px-3 py-1 rounded-full bg-black/60 text-white backdrop-blur">
        {current + 1} / {items.length}
      </div>
    </div>
  );
};

export default CollectionFlipbook;
