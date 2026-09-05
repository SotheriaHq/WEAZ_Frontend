/**
 * Stamps a handle into the middle of a rendered QR canvas.
 *
 * Separate from the component so the geometry — how much of the code the plate
 * is allowed to cover — is testable without a DOM render, and so the preview
 * and the PNG export cannot drift apart: both read the same canvas.
 *
 * Scannability budget: the plate is capped at `MAX_PLATE_WIDTH_RATIO` of the
 * code's width and its height follows the font, so a long handle shrinks its
 * type rather than growing the plate. At the caps the plate hides roughly 5% of
 * the symbol, well inside the ~25% that error-correction level Q recovers.
 */

export const MAX_PLATE_WIDTH_RATIO = 0.56;
export const BASE_FONT_RATIO = 0.075;
export const MIN_FONT_RATIO = 0.042;
const PLATE_PADDING_RATIO = 0.35; // of font size, horizontally
const PLATE_HEIGHT_RATIO = 1.65; // of font size

export interface QrCenterLabelColors {
  fgColor: string;
  bgColor: string;
}

export interface QrCenterLabelGeometry {
  fontSize: number;
  plateWidth: number;
  plateHeight: number;
}

/**
 * Font size and plate box for a handle drawn at the centre of a `size`-wide
 * code. `measureText` is injected so the sizing loop can be exercised without a
 * canvas; the real caller passes the 2D context's measurer.
 */
export function resolveQrCenterLabelGeometry(
  text: string,
  size: number,
  measureText: (text: string, fontSize: number) => number,
): QrCenterLabelGeometry {
  const maxPlateWidth = size * MAX_PLATE_WIDTH_RATIO;
  const minFontSize = size * MIN_FONT_RATIO;

  let fontSize = size * BASE_FONT_RATIO;
  let textWidth = measureText(text, fontSize);

  // Shrink to fit rather than widen the plate — a wider plate eats more of the
  // symbol, a smaller font does not.
  while (
    fontSize > minFontSize &&
    textWidth + fontSize * PLATE_PADDING_RATIO * 2 > maxPlateWidth
  ) {
    fontSize -= size * 0.004;
    textWidth = measureText(text, fontSize);
  }

  const plateWidth = Math.min(
    maxPlateWidth,
    textWidth + fontSize * PLATE_PADDING_RATIO * 2,
  );

  return {
    fontSize,
    plateWidth,
    plateHeight: fontSize * PLATE_HEIGHT_RATIO,
  };
}

export const qrCenterLabelFont = (fontSize: number): string =>
  `700 ${fontSize}px system-ui, -apple-system, "Segoe UI", sans-serif`;

/** Draws the handle plate onto an already-rendered QR canvas. */
export function drawQrCenterLabel(
  canvas: HTMLCanvasElement,
  text: string,
  colors: QrCenterLabelColors,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const size = Math.min(canvas.width, canvas.height);
  if (!size) return;

  const geometry = resolveQrCenterLabelGeometry(text, size, (value, fontSize) => {
    ctx.font = qrCenterLabelFont(fontSize);
    return ctx.measureText(value).width;
  });

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const left = centerX - geometry.plateWidth / 2;
  const top = centerY - geometry.plateHeight / 2;
  const radius = geometry.plateHeight / 2;

  ctx.save();

  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(left, top, geometry.plateWidth, geometry.plateHeight, radius);
  } else {
    ctx.rect(left, top, geometry.plateWidth, geometry.plateHeight);
  }
  ctx.fillStyle = colors.bgColor;
  ctx.fill();

  ctx.font = qrCenterLabelFont(geometry.fontSize);
  ctx.fillStyle = colors.fgColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, centerX, centerY, geometry.plateWidth - geometry.fontSize * 0.4);

  ctx.restore();
}
