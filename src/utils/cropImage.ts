import type { Area } from 'react-easy-crop';

const readFileAsDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      resolve(reader.result as string);
    });
    reader.addEventListener('error', reject);
    reader.readAsDataURL(file);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', reject);
    image.src = src;
  });

export interface CropImageResult {
  file: File;
  previewUrl: string;
  disposePreview: () => void;
}

interface CropImageOptions {
  areaPixels: Area;
  /**
   * Degrees the user rotated the image by in the cropper.
   *
   * This is not optional detail: react-easy-crop reports `areaPixels` in the
   * ROTATED coordinate space. Drawing those coordinates straight from the
   * unrotated source — which this function used to do — silently crops the wrong
   * region as soon as the user touches a rotate button. The image must be
   * rotated onto an intermediate canvas first so the two spaces agree.
   */
  rotation?: number;
  mimeType?: string;
  quality?: number;
  backgroundColor?: string;
  fileName?: string;
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Bounding box of `width`x`height` rotated by `rotation` degrees. */
const rotatedBounds = (width: number, height: number, rotation: number) => {
  const radians = toRadians(rotation);
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  return {
    width: Math.floor(width * cos + height * sin),
    height: Math.floor(width * sin + height * cos),
  };
};

export const cropImageFromFile = async (
  file: File,
  options: CropImageOptions,
): Promise<CropImageResult> => {
  const {
    areaPixels,
    rotation = 0,
    mimeType = file.type || 'image/png',
    quality = 0.92,
    backgroundColor,
    fileName,
  } = options;

  const dataUrl = await readFileAsDataURL(file);
  const imageElement = await loadImage(dataUrl);

  // Source to crop from. With no rotation that is the image itself; with
  // rotation it is the image painted upright onto its rotated bounding box, so
  // the cropper's reported coordinates line up with the pixels we sample.
  let source: CanvasImageSource = imageElement;
  let sourceWidth = imageElement.width;
  let sourceHeight = imageElement.height;

  const normalizedRotation = ((rotation % 360) + 360) % 360;
  if (normalizedRotation !== 0) {
    const bounds = rotatedBounds(imageElement.width, imageElement.height, normalizedRotation);
    const rotationCanvas = document.createElement('canvas');
    rotationCanvas.width = bounds.width;
    rotationCanvas.height = bounds.height;
    const rotationCtx = rotationCanvas.getContext('2d');
    if (!rotationCtx) {
      throw new Error('Canvas rendering context not available');
    }
    if (backgroundColor) {
      rotationCtx.fillStyle = backgroundColor;
      rotationCtx.fillRect(0, 0, bounds.width, bounds.height);
    }
    rotationCtx.translate(bounds.width / 2, bounds.height / 2);
    rotationCtx.rotate(toRadians(normalizedRotation));
    rotationCtx.drawImage(imageElement, -imageElement.width / 2, -imageElement.height / 2);
    source = rotationCanvas;
    sourceWidth = bounds.width;
    sourceHeight = bounds.height;
  }

  const canvas = document.createElement('canvas');
  canvas.width = areaPixels.width;
  canvas.height = areaPixels.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas rendering context not available');
  }

  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // `restrictPosition={false}` lets the crop window extend past the image edge,
  // so the requested rect can start negative or run past the source. Clamp the
  // sampled region and place it at the matching offset, leaving any overhang as
  // background instead of letting drawImage stretch the edge pixels.
  const sx = Math.max(0, areaPixels.x);
  const sy = Math.max(0, areaPixels.y);
  const sw = Math.max(0, Math.min(areaPixels.x + areaPixels.width, sourceWidth) - sx);
  const sh = Math.max(0, Math.min(areaPixels.y + areaPixels.height, sourceHeight) - sy);

  if (sw > 0 && sh > 0) {
    ctx.drawImage(source, sx, sy, sw, sh, sx - areaPixels.x, sy - areaPixels.y, sw, sh);
  }

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((createdBlob) => {
      if (!createdBlob) {
        reject(new Error('Failed to create blob from canvas'));
        return;
      }
      resolve(createdBlob);
    }, mimeType, quality);
  });

  const croppedFile = new File([blob], fileName ?? `cropped-${file.name}`, { type: mimeType });
  const previewUrl = URL.createObjectURL(croppedFile);
  let disposed = false;

  const disposePreview = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    URL.revokeObjectURL(previewUrl);
  };

  return {
    file: croppedFile,
    previewUrl,
    disposePreview,
  };
};
