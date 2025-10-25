import React, { useEffect, useMemo, useRef, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import Button from '../Button';
import VLoader from '../loaders/VLoader';
import { cropImageFromFile } from '../../utils/cropImage';

interface ImageCropModalProps {
  open: boolean;
  file: File | null;
  aspect: number;
  title: string;
  enforceAspect?: boolean;
  allowUseOriginal?: boolean;
  onConfirm: (result: { file: File; previewUrl: string }) => void;
  onUseOriginal?: (result: { file: File; previewUrl: string }) => void;
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
  const [zoom, setZoom] = useState(1.1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!file) {
      setImageSrc(null);
      return;
    }
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setImageSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1.1);
    setCroppedAreaPixels(null);

    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [file]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, isProcessing, onClose]);

  const showModal = open && file && imageSrc;

  const handleCropComplete = (_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  };

  const handleConfirm = async () => {
    if (!file || !croppedAreaPixels) {
      return;
    }
    setIsProcessing(true);
    try {
      const result = await cropImageFromFile(file, {
        areaPixels: croppedAreaPixels,
        fileName: enforceAspect ? `banner-${file.name}` : `avatar-${file.name}`,
      });
      onConfirm(result);
      setIsProcessing(false);
    } catch (error) {
      console.error('Unable to crop image', error);
      setIsProcessing(false);
    }
  };

  const handleUseOriginal = async () => {
    if (!file || !allowUseOriginal || !onUseOriginal) {
      return;
    }
    const url = URL.createObjectURL(file);
    onUseOriginal({ file, previewUrl: url });
  };

  const zoomLabel = useMemo(() => `${Math.round(zoom * 100)}%`, [zoom]);

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl glass-panel p-4">
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-frost-ghost btn-tight-sm"
              onClick={() => {
                if (isProcessing) return;
                onClose();
              }}
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
              {isProcessing ? 'Processing…' : 'Save'}
            </Button>
          </div>
        </header>

        <div className="relative mt-3 h-[320px] w-full overflow-hidden rounded-xl bg-white/10">
          {isProcessing ? (
            <div className="flex h-full w-full items-center justify-center">
              <VLoader size={72} />
            </div>
          ) : (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              rotation={rotation}
              onCropChange={setCrop}
              onZoomChange={(value) => setZoom(clamp(value, 1, 4))}
              onCropComplete={handleCropComplete}
              restrictPosition={false}
              cropShape={1 === aspect ? 'rect' : 'rect'}
              showGrid={false}
              zoomWithScroll
            />
          )}
        </div>

        <div className="mt-3 glass-chip p-3">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="flex items-center justify-between text-xs text-gray-700 dark:text-white/80">
                <span>Zoom</span>
                <span>{zoomLabel}</span>
              </label>
              <div className="flex items-center gap-2 mt-1">
                <button
                  type="button"
                  className="btn-frost-ghost btn-tight-xs"
                  onClick={() => setZoom((z) => clamp(z - 0.1, 1, 4))}
                  disabled={isProcessing}
                >
                  −
                </button>
                <input
                  type="range"
                  min={1}
                  max={4}
                  step={0.01}
                  value={zoom}
                  onChange={(event) => setZoom(parseFloat(event.target.value))}
                  className="w-full accent-purple-500"
                  disabled={isProcessing}
                />
                <button
                  type="button"
                  className="btn-frost-ghost btn-tight-xs"
                  onClick={() => setZoom((z) => clamp(z + 0.1, 1, 4))}
                  disabled={isProcessing}
                >
                  +
                </button>
              </div>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-700 dark:text-white/80">Rotate</label>
              <button
                type="button"
                className="btn-frost-ghost btn-tight-xs"
                onClick={() => setRotation((r) => (r - 90) % 360)}
                disabled={isProcessing}
              >
                ↺
              </button>
              <button
                type="button"
                className="btn-frost-ghost btn-tight-xs"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                disabled={isProcessing}
              >
                ↻
              </button>
              {allowUseOriginal && onUseOriginal ? (
                <button
                  type="button"
                  className="btn-frost-outline btn-tight-sm ml-2"
                  onClick={handleUseOriginal}
                  disabled={isProcessing}
                >
                  Use Full Image
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageCropModal;
