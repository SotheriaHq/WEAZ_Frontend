import React, { useEffect, useMemo, useRef, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../Button';
import VLoader from '../loaders/VLoader';
import { cropImageFromFile } from '../../utils/cropImage';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 6;
const ZOOM_STEP = 0.2;
const INITIAL_ZOOM = 1;

interface ImageCropModalProps {
  open: boolean;
  file: File | null;
  aspect: number;
  title: string;
  enforceAspect?: boolean;
  allowUseOriginal?: boolean;
  onConfirm: (result: { file: File; previewUrl: string; disposePreview: () => void }) => void | Promise<void>;
  onUseOriginal?: (result: { file: File; previewUrl: string; disposePreview: () => void }) => void | Promise<void>;
  onClose: () => void;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const ImageCropModal: React.FC<ImageCropModalProps> = ({
  open,
  file,
  aspect,
  title,
  enforceAspect = false,
  allowUseOriginal = false,
  onConfirm,
  onUseOriginal,
  onClose,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(INITIAL_ZOOM);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const objectUrlRef = useRef<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);

  useEffect(() => { return () => { isMountedRef.current = false; }; }, []);

  const setProcessing = (value: boolean) => {
    if (!isMountedRef.current) return;
    setIsProcessing(value);
  };

  useFocusTrap({
    containerRef: dialogRef,
    active: open,
    onEscape: () => { if (!isProcessing) onClose(); },
  });

  useEffect(() => {
    if (!file) { setImageSrc(null); return; }
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setImageSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(INITIAL_ZOOM);
    setRotation(0);
    setCroppedAreaPixels(null);
    return () => {
      if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
    };
  }, [file]);

  const showModal = open && file && imageSrc;

  const handleCropComplete = (_: Area, areaPixels: Area) => setCroppedAreaPixels(areaPixels);

  const handleConfirm = async () => {
    if (!file || !croppedAreaPixels) return;
    setProcessing(true);
    try {
      const result = await cropImageFromFile(file, {
        areaPixels: croppedAreaPixels,
        fileName: enforceAspect ? `banner-${file.name}` : `avatar-${file.name}`,
      });
      await Promise.resolve(onConfirm(result));
      setProcessing(false);
    } catch (error) {
      console.error('Unable to crop image', error);
      setProcessing(false);
    }
  };

  const handleUseOriginal = async () => {
    if (!file || !allowUseOriginal || !onUseOriginal) return;
    const url = URL.createObjectURL(file);
    let disposed = false;
    const disposePreview = () => { if (disposed) return; disposed = true; URL.revokeObjectURL(url); };
    await Promise.resolve(onUseOriginal({ file, previewUrl: url, disposePreview }));
  };

  const zoomFraction = useMemo(() => (zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM), [zoom]);
  const zoomPercent = useMemo(() => `${Math.round(zoom * 100)}%`, [zoom]);

  if (!showModal) return null;

  return (
    <OverlayPortal>
      <AnimatePresence>
        <motion.div
          key="crop-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-layer-modal flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            key="crop-panel"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            ref={dialogRef}
            tabIndex={-1}
            className="w-full max-w-lg glass-panel neu-modal-surface flex flex-col overflow-hidden rounded-2xl"
          >
            {/* Header */}
            <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0" aria-hidden="true">✂️</span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{title}</h2>
                  <p className="text-[10px] text-gray-400 dark:text-white/35 leading-tight">Drag · scroll to zoom</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {allowUseOriginal && onUseOriginal && (
                  <button
                    type="button"
                    className="btn-frost-ghost btn-tight-xs"
                    onClick={handleUseOriginal}
                    disabled={isProcessing}
                  >
                    Use original
                  </button>
                )}
                <button
                  type="button"
                  className="btn-frost-ghost btn-tight-sm"
                  onClick={() => { if (!isProcessing) onClose(); }}
                  disabled={isProcessing}
                >
                  Cancel
                </button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleConfirm}
                  disabled={isProcessing}
                  className="btn-tight-sm"
                >
                  {isProcessing ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </header>

            {/* Crop canvas — compact fixed height */}
            <div className="relative h-52 w-full bg-[#0e0e0e] overflow-hidden">
              {isProcessing ? (
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50">
                  <VLoader size={36} />
                  <span className="text-xs text-white/50">Processing…</span>
                </div>
              ) : (
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  minZoom={MIN_ZOOM}
                  maxZoom={MAX_ZOOM}
                  aspect={aspect}
                  rotation={rotation}
                  onCropChange={setCrop}
                  onZoomChange={(v) => setZoom(clamp(v, MIN_ZOOM, MAX_ZOOM))}
                  onCropComplete={handleCropComplete}
                  restrictPosition={false}
                  cropShape="rect"
                  showGrid
                  zoomWithScroll
                  style={{
                    containerStyle: { background: '#0e0e0e' },
                    cropAreaStyle: {
                      border: '2px solid rgba(168,85,247,0.85)',
                      boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                    },
                  }}
                />
              )}
            </div>

            {/* Controls — single compact row */}
            <div className="flex items-center gap-3 px-4 py-3 border-t border-white/10">
              {/* Zoom − */}
              <button
                type="button"
                className="w-6 h-6 rounded-md border border-gray-200 dark:border-white/15 bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 text-sm font-bold flex items-center justify-center hover:border-purple-400 hover:text-purple-600 transition-colors disabled:opacity-40 shrink-0"
                onClick={() => setZoom((z) => clamp(z - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
                disabled={isProcessing || zoom <= MIN_ZOOM}
                aria-label="Zoom out"
              >−</button>

              {/* Slider */}
              <div className="relative flex-1 h-4 flex items-center">
                <div className="absolute inset-x-0 h-1 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all"
                    style={{ width: `${zoomFraction * 100}%` }}
                  />
                </div>
                <input
                  type="range"
                  min={MIN_ZOOM}
                  max={MAX_ZOOM}
                  step={0.01}
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="relative w-full h-4 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  disabled={isProcessing}
                  aria-label="Zoom"
                />
                <div
                  className="pointer-events-none absolute w-3.5 h-3.5 rounded-full bg-white border-2 border-purple-500 shadow -translate-x-1/2"
                  style={{ left: `${zoomFraction * 100}%` }}
                />
              </div>

              {/* Zoom + */}
              <button
                type="button"
                className="w-6 h-6 rounded-md border border-gray-200 dark:border-white/15 bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 text-sm font-bold flex items-center justify-center hover:border-purple-400 hover:text-purple-600 transition-colors disabled:opacity-40 shrink-0"
                onClick={() => setZoom((z) => clamp(z + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
                disabled={isProcessing || zoom >= MAX_ZOOM}
                aria-label="Zoom in"
              >+</button>

              {/* Zoom label */}
              <span className="text-[10px] font-mono text-purple-500 dark:text-purple-400 tabular-nums w-9 text-center shrink-0">
                {zoomPercent}
              </span>

              {/* Divider */}
              <div className="w-px h-4 bg-gray-200 dark:bg-white/10 shrink-0" />

              {/* Rotate buttons */}
              <button
                type="button"
                className="w-6 h-6 rounded-md border border-gray-200 dark:border-white/15 bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 flex items-center justify-center hover:border-purple-400 hover:text-purple-600 transition-colors disabled:opacity-40 text-sm shrink-0"
                onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                disabled={isProcessing}
                title="Rotate left 90°"
              >↺</button>
              <button
                type="button"
                className="w-6 h-6 rounded-md border border-gray-200 dark:border-white/15 bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 flex items-center justify-center hover:border-purple-400 hover:text-purple-600 transition-colors disabled:opacity-40 text-sm shrink-0"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                disabled={isProcessing}
                title="Rotate right 90°"
              >↻</button>

              {/* Reset */}
              <button
                type="button"
                className="text-[10px] text-gray-400 dark:text-white/30 hover:text-purple-500 dark:hover:text-purple-400 transition-colors disabled:opacity-40 shrink-0"
                onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(INITIAL_ZOOM); setRotation(0); }}
                disabled={isProcessing}
              >
                Reset
              </button>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </OverlayPortal>
  );
};

export default ImageCropModal;
