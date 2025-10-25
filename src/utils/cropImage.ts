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
}

interface CropImageOptions {
  areaPixels: Area;
  mimeType?: string;
  quality?: number;
  backgroundColor?: string;
  fileName?: string;
}

export const cropImageFromFile = async (
  file: File,
  options: CropImageOptions,
): Promise<CropImageResult> => {
  const { areaPixels, mimeType = file.type || 'image/png', quality = 0.92, backgroundColor, fileName } =
    options;

  const dataUrl = await readFileAsDataURL(file);
  const imageElement = await loadImage(dataUrl);

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

  ctx.drawImage(
    imageElement,
    areaPixels.x,
    areaPixels.y,
    areaPixels.width,
    areaPixels.height,
    0,
    0,
    areaPixels.width,
    areaPixels.height,
  );

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

  return {
    file: croppedFile,
    previewUrl,
  };
};
