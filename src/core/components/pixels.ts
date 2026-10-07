/** RGBA images from the artgen worker on canvases: nearest-neighbour only (pixel art never smooths). */

/** A rectangle in sprite pixels: x, y, w, h. */
export type Region = [x: number, y: number, w: number, h: number];

export interface Img {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

/** An offscreen canvas holding the image at 1×. */
export function imgCanvas(img: Img): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.w;
  c.height = img.h;
  const ctx = c.getContext('2d')!;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.w, img.h), 0, 0);
  return c;
}

/** Checkerboard in screen pixels (transparency backdrop). */
export function drawChecker(ctx: CanvasRenderingContext2D, w: number, h: number, size = 8): void {
  ctx.fillStyle = '#2a2d36';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#353945';
  for (let y = 0; y < h; y += size) for (let x = (y / size) % 2 ? size : 0; x < w; x += size * 2) ctx.fillRect(x, y, size, size);
}

/** Largest integer zoom that fits `img` into a box (at least 1). */
export const fitScale = (img: Pick<Img, 'w' | 'h'>, maxW: number, maxH: number, cap = 16): number =>
  Math.max(1, Math.min(cap, Math.floor(Math.min(maxW / img.w, maxH / img.h))));

/** `ImageData` → `Img` (reference images dropped into the palette extractor). */
export const fromImageData = (d: ImageData): Img => ({ w: d.width, h: d.height, data: d.data });

/** Pixels that differ between two same-sized images, as a mask image (magenta where changed). */
export function diffMask(a: Img, b: Img): { mask: Img; changed: number } {
  const data = new Uint8ClampedArray(a.w * a.h * 4);
  let changed = 0;
  if (a.w !== b.w || a.h !== b.h) return { mask: { w: a.w, h: a.h, data }, changed: -1 };
  for (let i = 0; i < a.w * a.h; i++) {
    const k = i * 4;
    if (a.data[k] !== b.data[k] || a.data[k + 1] !== b.data[k + 1] || a.data[k + 2] !== b.data[k + 2] || a.data[k + 3] !== b.data[k + 3]) {
      data[k] = 255; data[k + 1] = 0; data[k + 2] = 255; data[k + 3] = 200;
      changed++;
    }
  }
  return { mask: { w: a.w, h: a.h, data }, changed };
}
