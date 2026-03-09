import { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { createPortal } from 'react-dom';
import useSignedFileUrl from '@/hooks/useSignedFileUrl';

interface MediaItem {
  id: string;
  url: string;
  type?: string;
}

interface ImageLightboxProps {
  images: MediaItem[];
  currentIndex: number;
  productName: string;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSelectIndex: (index: number) => void;
}

function LightboxImage({ media, alt }: { media: MediaItem; alt: string }) {
  const fileId = typeof media.id === 'string' && 
    !media.id.startsWith('img-') && 
    !media.id.startsWith('thumb-') && 
    !media.url?.startsWith('http') 
    ? media.id 
    : undefined;
  const { url: signedUrl } = useSignedFileUrl(fileId, media.url);

  return (
    <img
      src={signedUrl || ''}
      alt={alt}
      className="max-w-full max-h-full object-contain pointer-events-none select-none"
    />
  );
}

function LightboxThumbnail({ 
  media, 
  alt, 
  isActive, 
  onClick 
}: { 
  media: MediaItem; 
  alt: string; 
  isActive: boolean;
  onClick: () => void;
}) {
  const fileId = typeof media.id === 'string' && 
    !media.id.startsWith('img-') && 
    !media.id.startsWith('thumb-') && 
    !media.url?.startsWith('http') 
    ? media.id 
    : undefined;
  const { url: signedUrl } = useSignedFileUrl(fileId, media.url);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        relative min-w-[70px] h-[70px] md:min-w-[80px] md:h-[80px] rounded-lg overflow-hidden border-2 transition-all
        ${isActive 
          ? 'border-purple-600 shadow-[0_0_12px_rgba(146,52,234,0.4)]' 
          : 'border-transparent hover:border-white/30'}
      `}
    >
      <img 
        src={signedUrl || ''} 
        alt={alt} 
        className="w-full h-full object-cover" 
      />
      {isActive && <div className="absolute inset-0 bg-purple-600/10" />}
    </button>
  );
}

export default function ImageLightbox({
  images,
  currentIndex,
  productName,
  onClose,
  onPrevious,
  onNext,
  onSelectIndex,
}: ImageLightboxProps) {
  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        onClose();
        break;
      case 'ArrowLeft':
        onPrevious();
        break;
      case 'ArrowRight':
        onNext();
        break;
    }
  }, [onClose, onPrevious, onNext]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  const currentImage = images[currentIndex];
  if (!currentImage) return null;

  const lightboxContent = (
    <div 
      className="fixed inset-0 z-layer-modal flex flex-col items-center justify-between bg-black/95 backdrop-blur-md p-4 md:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Image lightbox"
    >
      {/* Top Navigation Bar */}
      <div className="w-full flex items-center justify-between z-50">
        <div className="flex items-center gap-4 bg-white/5 px-4 py-2 rounded-full border border-white/10 backdrop-blur-sm">
          <span className="text-white/60 text-sm font-medium tracking-wider">
            {currentIndex + 1} / {images.length}
          </span>
          <div className="h-4 w-[1px] bg-white/20" />
          <h2 className="text-white text-sm font-semibold truncate max-w-[200px] md:max-w-[300px]">
            {productName}
          </h2>
        </div>
        <button 
          type="button"
          onClick={onClose}
          className="size-12 rounded-full flex items-center justify-center bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/20 transition-all active:scale-95 group"
          aria-label="Close lightbox"
        >
          <X className="text-white transition-transform group-hover:rotate-90" size={20} />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="relative flex flex-1 items-center justify-center w-full max-w-7xl mx-auto my-6 group">
        {/* Left Arrow */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={onPrevious}
            className="absolute left-0 z-10 size-12 md:size-14 rounded-full flex items-center justify-center bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-purple-600/20 hover:border-purple-600/50 transition-all -translate-x-2 md:-translate-x-8 opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label="Previous image"
          >
            <ChevronLeft className="text-white" size={28} />
          </button>
        )}

        {/* Main Image Container */}
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-xl max-h-[60vh] md:max-h-[70vh]">
          <LightboxImage media={currentImage} alt={`${productName} - Image ${currentIndex + 1}`} />
        </div>

        {/* Right Arrow */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={onNext}
            className="absolute right-0 z-10 size-12 md:size-14 rounded-full flex items-center justify-center bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-purple-600/20 hover:border-purple-600/50 transition-all translate-x-2 md:translate-x-8 opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label="Next image"
          >
            <ChevronRight className="text-white" size={28} />
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Strip */}
      <div className="w-full max-w-4xl">
        <div className="flex flex-col items-center gap-4 md:gap-6">
          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-3 md:gap-4 p-2 bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl overflow-x-auto scrollbar-none scroll-smooth">
              {images.map((img, idx) => (
                <LightboxThumbnail
                  key={img.id || idx}
                  media={img}
                  alt={`Thumbnail ${idx + 1}`}
                  isActive={idx === currentIndex}
                  onClick={() => onSelectIndex(idx)}
                />
              ))}
            </div>
          )}

          {/* Footer Hint */}
          <div className="hidden md:flex items-center gap-3 text-white/40 text-[10px] tracking-[0.2em] uppercase font-bold">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-[9px]">ESC</kbd>
              <span>to close</span>
            </span>
            <span className="size-1 bg-white/20 rounded-full" />
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-white/10 rounded text-[9px]">←</kbd>
              <kbd className="px-1 py-0.5 bg-white/10 rounded text-[9px]">→</kbd>
              <span>navigate</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  // Use portal to render at document root
  return createPortal(lightboxContent, document.body);
}
