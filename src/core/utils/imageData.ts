import type { Rect } from './geometry';

/**
 * Tightest rectangle containing every pixel whose alpha exceeds `alphaThreshold`,
 * optionally grown by `padding` and clamped to the image. Returns null when the
 * image is fully transparent.
 *
 * Shared rather than tool-local: any tool that produces a transparent asset
 * wants to trim the empty margin before export.
 */
export function croppedBoundsFromAlpha(
  image: ImageData,
  { alphaThreshold = 0, padding = 0 }: { alphaThreshold?: number; padding?: number } = {},
): Rect | null {
  const { width, height, data } = image;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const rowStart = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[rowStart + x * 4 + 3]! > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return null;

  const x = Math.max(0, minX - padding);
  const y = Math.max(0, minY - padding);
  const right = Math.min(width, maxX + 1 + padding);
  const bottom = Math.min(height, maxY + 1 + padding);
  return { x, y, width: right - x, height: bottom - y };
}

/** Draws ImageData onto a fresh canvas, cropped to `rect` if supplied. */
export function imageDataToCanvas(image: ImageData, rect?: Rect | null): HTMLCanvasElement {
  const source = document.createElement('canvas');
  source.width = image.width;
  source.height = image.height;
  const sourceCtx = source.getContext('2d');
  if (!sourceCtx) throw new Error('Could not acquire a 2D context');
  sourceCtx.putImageData(image, 0, 0);

  if (!rect) return source;

  const cropped = document.createElement('canvas');
  cropped.width = rect.width;
  cropped.height = rect.height;
  const croppedCtx = cropped.getContext('2d');
  if (!croppedCtx) throw new Error('Could not acquire a 2D context');
  croppedCtx.drawImage(
    source,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    rect.width,
    rect.height,
  );
  return cropped;
}

/** Reads the full pixel buffer of an image element. */
export function imageDataFromElement(
  element: CanvasImageSource,
  width: number,
  height: number,
): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not acquire a 2D context');
  ctx.drawImage(element, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}
