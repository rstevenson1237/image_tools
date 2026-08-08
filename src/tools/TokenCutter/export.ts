import { croppedBoundsFromAlpha, imageDataToCanvas, downloadCanvasAsPng } from '../../core/utils/imageData';

export interface ExportOptions {
  /** Transparent margin kept around the silhouette, in source pixels. */
  padding?: number;
  /** Pad the result to a square so VTTs that assume 1:1 tokens don't stretch it. */
  square?: boolean;
}

function toSquare(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const size = Math.max(canvas.width, canvas.height);
  if (size === canvas.width && size === canvas.height) return canvas;

  const squared = document.createElement('canvas');
  squared.width = size;
  squared.height = size;
  const ctx = squared.getContext('2d');
  if (!ctx) throw new Error('Could not acquire a 2D context');
  ctx.drawImage(
    canvas,
    Math.round((size - canvas.width) / 2),
    Math.round((size - canvas.height) / 2),
  );
  return squared;
}

/** Crops a silhouette to its opaque bounds and returns it as a canvas. */
export function buildExportCanvas(
  silhouette: ImageData,
  { padding = 8, square = false }: ExportOptions = {},
): HTMLCanvasElement {
  const bounds = croppedBoundsFromAlpha(silhouette, { padding });
  if (!bounds) throw new Error('Nothing to export — the silhouette is empty.');
  const cropped = imageDataToCanvas(silhouette, bounds);
  return square ? toSquare(cropped) : cropped;
}

/** Suggests `monster.png` -> `monster-token.png`. */
export function suggestFilename(sourceName: string): string {
  const stem = sourceName.replace(/\.[^.]+$/, '') || 'token';
  return `${stem}-token.png`;
}

export async function exportSilhouette(
  silhouette: ImageData,
  sourceName: string,
  options: ExportOptions = {},
): Promise<void> {
  const canvas = buildExportCanvas(silhouette, options);
  await downloadCanvasAsPng(canvas, suggestFilename(sourceName));
}
