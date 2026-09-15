import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../Button';
import { MuseLoader } from '@/components/loaders/MuseLoader';
import { cropImageFromFile } from '../../utils/cropImage';
import {
  isBrowserDisplayableSniff,
  isUnreadableSniff,
  sniffImageFormat,
  type SniffedImageFormat,
} from '../../utils/imageByteSniff';
import { OverlayPortal } from '@/components/ui/OverlayPortal';
import { useFocusTrap } from '@/hooks/useFocusTrap';

const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const ZOOM_STEP = 0.2;
const INITIAL_ZOOM = 1;

/**
 * Corner radius of the crop window for avatars, in px.
 *
 * Avatars render as `rounded-xl` everywhere in this app (Rule 6 — never
 * circles), so the crop window is rounded to match. A cropper whose mask shape
 * disagrees with the final render is the reason people are surprised by their
 * own avatar: they frame to a square and get rounded corners taken off.
 */
const AVATAR_CROP_RADIUS = 14;

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

/**
 * Why the browser could not paint this file. The picker's `type` cannot be
 * trusted (Android hands over HEIC bytes labelled `image/jpeg`), so the message
 * comes from sniffing the actual container.
 */
const describeUndecodable = (
  format: SniffedImageFormat,
  // "Use original" is only offered for avatars, so the HEIC advice must not
  // point at a button this instance does not render.
  canUseOriginal: boolean,
): string => {
  if (format === 'heic') {
    return canUseOriginal
      ? 'This is a HEIC photo. Browsers cannot preview HEIC, so it cannot be cropped here — choose “Use original” and we will convert it on upload, or export it as JPEG first.'
      : 'This is a HEIC photo. Browsers cannot preview HEIC, so it cannot be cropped here. Export it as JPEG or PNG and try again.';
  }
  if (format === 'empty') {
    return 'This file is empty. It may still be syncing from cloud storage — open it once in your photos app, then try again.';
  }
  if (format === 'unreadable') {
    return 'This file could not be read. If it lives in cloud storage, download it to this device first.';
  }
  return 'This image could not be decoded. It may be corrupt or in a format this browser does not support.';
};

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
  // The cropper renders a black void until the image decodes. Without these two
  // the modal was indistinguishable from a broken one: no spinner while loading,
  // and total silence when the decode failed.
  const [isImageLoading, setIsImageLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const objectUrlRef = useRef<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);

  const isAvatar = !enforceAspect && aspect === 1;
  const canOfferOriginal = allowUseOriginal && Boolean(onUseOriginal);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

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
    setIsImageLoading(true);
    setLoadError(null);

    return () => {
      if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
    };
  }, [file]);

  const handleMediaLoaded = useCallback(() => {
    if (!isMountedRef.current) return;
    setIsImageLoading(false);
    setLoadError(null);
  }, []);

  /**
   * Decide up front whether this file can be painted at all.
   *
   * The picker's MIME type is not evidence — Android gallery apps hand over HEIC
   * bytes labelled `image/jpeg` — so the container is sniffed from the bytes. An
   * undecodable file is reported immediately rather than after a failed decode,
   * which is the difference between an explanation and a black rectangle.
   *
   * `react-easy-crop` swallows the underlying <img> error event, so a decodable
   * format still gets a parallel probe to catch corrupt files.
   */
  useEffect(() => {
    if (!file || !imageSrc) return;
    let cancelled = false;
    let probe: HTMLImageElement | null = null;

    void (async () => {
      const format = await sniffImageFormat(file);
      if (cancelled || !isMountedRef.current) return;

      if (isUnreadableSniff(format) || !isBrowserDisplayableSniff(format)) {
        setIsImageLoading(false);
        setLoadError(describeUndecodable(format, canOfferOriginal));
        return;
      }

      probe = new Image();
      probe.onload = () => {
        if (cancelled || !isMountedRef.current) return;
        setIsImageLoading(false);
      };
      probe.onerror = () => {
        if (cancelled || !isMountedRef.current) return;
        setIsImageLoading(false);
        setLoadError(describeUndecodable('unknown', canOfferOriginal));
      };
      probe.src = imageSrc;
    })();

    return () => {
      cancelled = true;
      if (probe) { probe.onload = null; probe.onerror = null; }
    };
  }, [file, imageSrc]);

  const showModal = open && file && imageSrc;

  const handleCropComplete = (_: Area, areaPixels: Area) => setCroppedAreaPixels(areaPixels);

  const handleConfirm = async () => {
    if (!file || !croppedAreaPixels) return;
    setProcessing(true);
    try {
      const result = await cropImageFromFile(file, {
        areaPixels: croppedAreaPixels,
        rotation,
        fileName: enforceAspect ? `banner-${file.name}` : `avatar-${file.name}`,
      });
      await Promise.resolve(onConfirm(result));
      setProcessing(false);
    } catch (error) {
      console.error('Unable to crop image', error);
      setProcessing(false);
      if (isMountedRef.current) {
        setLoadError('Cropping failed. Try “Use original”, or pick a different image.');
      }
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

  const canSave = !isProcessing && !loadError && !isImageLoading && Boolean(croppedAreaPixels);
  const controlsDisabled = isProcessing || Boolean(loadError) || isImageLoading;

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
            className="w-full max-w-2xl glass-panel neu-modal-surface flex flex-col overflow-hidden rounded-2xl"
          >
            {/* Header */}
            <header className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-white/10">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{title}</h2>
                <p className="text-[11px] text-gray-500 dark:text-white/40 leading-tight">
                  {loadError ? 'Cannot preview this file' : 'Drag to reposition · scroll or use the slider to zoom'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {canOfferOriginal && (
                  <button
                    type="button"
                    className="btn-frost-ghost btn-tight-sm"
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
                  disabled={!canSave}
                  className="btn-tight-sm"
                >
                  {isProcessing ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </header>

            {/* Crop stage — tall enough to actually frame a face. The old 208px
                strip made precise positioning impossible on a portrait photo. */}
            <div className="relative w-full bg-[#0b0b0b] overflow-hidden h-[min(56vh,440px)]">
              {loadError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
                  <span className="text-3xl" aria-hidden="true">🖼️</span>
                  <p className="text-sm font-medium text-white/85">Preview unavailable</p>
                  <p className="text-xs leading-relaxed text-white/50 max-w-md">{loadError}</p>
                </div>
              ) : (
                <>
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
                    onMediaLoaded={handleMediaLoaded}
                    // Keep the crop window filled: letting it drift off the image
                    // produces avatars with transparent wedges down one side.
                    restrictPosition
                    cropShape="rect"
                    showGrid={!isAvatar}
                    zoomWithScroll
                    style={{
                      containerStyle: { background: '#0b0b0b' },
                      cropAreaStyle: {
                        border: '2px solid rgba(255,255,255,0.9)',
                        borderRadius: isAvatar ? `${AVATAR_CROP_RADIUS}px` : '4px',
                        // Heavier scrim than before so the framed region reads as
                        // the subject rather than one panel among equals.
                        boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)',
                      },
                    }}
                  />
                  {isImageLoading && (
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-[#0b0b0b]">
                      <MuseLoader size={36} />
                      <span className="text-xs text-white/50">Loading image…</span>
                    </div>
                  )}
                  {isProcessing && (
                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/60">
                      <MuseLoader size={36} />
                      <span className="text-xs text-white/70">Processing…</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 px-5 py-3 border-t border-white/10">
              <button
                type="button"
                className="w-7 h-7 rounded-md border border-gray-200 dark:border-white/15 bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 text-sm font-bold flex items-center justify-center hover:border-purple-400 hover:text-purple-600 transition-colors disabled:opacity-40 shrink-0"
                onClick={() => setZoom((z) => clamp(z - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
                disabled={controlsDisabled || zoom <= MIN_ZOOM}
                aria-label="Zoom out"
              >−</button>

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
                  disabled={controlsDisabled}
                  aria-label="Zoom"
                />
                <div
                  className="pointer-events-none absolute w-3.5 h-3.5 rounded-full bg-white border-2 border-purple-500 shadow -translate-x-1/2"
                  style={{ left: `${zoomFraction * 100}%` }}
                />
              </div>

              <button
                type="button"
                className="w-7 h-7 rounded-md border border-gray-200 dark:border-white/15 bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 text-sm font-bold flex items-center justify-center hover:border-purple-400 hover:text-purple-600 transition-colors disabled:opacity-40 shrink-0"
                onClick={() => setZoom((z) => clamp(z + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
                disabled={controlsDisabled || zoom >= MAX_ZOOM}
                aria-label="Zoom in"
              >+</button>

              <span className="text-[10px] font-mono text-purple-500 dark:text-purple-400 tabular-nums w-10 text-center shrink-0">
                {zoomPercent}
              </span>

              <div className="w-px h-4 bg-gray-200 dark:bg-white/10 shrink-0" />

              <button
                type="button"
                className="w-7 h-7 rounded-md border border-gray-200 dark:border-white/15 bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 flex items-center justify-center hover:border-purple-400 hover:text-purple-600 transition-colors disabled:opacity-40 text-sm shrink-0"
                onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                disabled={controlsDisabled}
                aria-label="Rotate left 90 degrees"
                title="Rotate left 90°"
              >↺</button>
              <button
                type="button"
                className="w-7 h-7 rounded-md border border-gray-200 dark:border-white/15 bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 flex items-center justify-center hover:border-purple-400 hover:text-purple-600 transition-colors disabled:opacity-40 text-sm shrink-0"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                disabled={controlsDisabled}
                aria-label="Rotate right 90 degrees"
                title="Rotate right 90°"
              >↻</button>

              <button
                type="button"
                className="text-[11px] text-gray-400 dark:text-white/35 hover:text-purple-500 dark:hover:text-purple-400 transition-colors disabled:opacity-40 shrink-0"
                onClick={() => { setCrop({ x: 0, y: 0 }); setZoom(INITIAL_ZOOM); setRotation(0); }}
                disabled={controlsDisabled}
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
