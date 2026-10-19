/**
 * A window on a rendered sheet (`--crop`) and the size a render is fitted to (`--fit`), shared by the map and dungeon
 * renderers. The window is in map units; the renderer draws the whole sheet and shows only the window, so everything
 * inside it is the full render's own drawing.
 */

/** x, y, width, height in map units. */
export type Crop = [number, number, number, number];
export type SizeUnit = 'px' | 'mm';
export interface Fit { w: number; h: number; unit: SizeUnit }

/** Where the window sits in the render, in pixels. */
export interface Frame { x: number; y: number; w: number; h: number; r: number; b: number }

/** CSS pixels per millimetre (an SVG's `mm` and `px` relate at 96 to the inch). */
export const PX_PER_MM = 96 / 25.4;

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** The window cut to the sheet; an error when nothing of the sheet is inside it. */
export function clampCrop(c: Crop, cols: number, rows: number): Crop {
  const x0 = Math.max(0, c[0]), y0 = Math.max(0, c[1]), x1 = Math.min(cols, c[0] + c[2]), y1 = Math.min(rows, c[1] + c[3]);
  if (!(x1 > x0 && y1 > y0)) throw new Error(`crop ${c.join(',')} is outside the sheet (0,0,${cols},${rows})`);
  return [r3(x0), r3(y0), r3(x1 - x0), r3(y1 - y0)];
}

/** The window in pixels at `k` pixels per unit (the whole sheet when there is no crop). */
export function frameOf(crop: Crop | undefined, cols: number, rows: number, k: number): Frame {
  const [x, y, w, h] = crop ? clampCrop(crop, cols, rows) : [0, 0, cols, rows];
  return { x: x * k, y: y * k, w: w * k, h: h * k, r: (x + w) * k, b: (y + h) * k };
}

/** `x,y,w,h`, in map units, or with `cells` after it in grid cells of `perCell` units. */
export function parseCrop(v: string, perCell = 1): Crop {
  const m = v.trim().match(/^(.*?)\s*(cells?)?$/i), xs = m![1].split(',').map(s => s.trim());
  const n = xs.map(Number);
  if (xs.length !== 4 || xs.some((s, i) => s === '' || !Number.isFinite(n[i]))) throw new Error('--crop: x,y,w,h in map units (add "cells" to give grid cells), e.g. 0,60,16,46');
  if (n[2] <= 0 || n[3] <= 0) throw new Error('--crop: w and h must be above 0');
  const f = m![2] ? perCell : 1;
  return [n[0] * f, n[1] * f, n[2] * f, n[3] * f];
}

/** `180x260mm` or `800x600px` (px when no unit). */
export function parseFit(v: string): Fit {
  const m = v.trim().match(/^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*(mm|px)?$/i);
  if (!m || +m[1] <= 0 || +m[2] <= 0) throw new Error('--fit: WxH with an optional unit, e.g. 180x260mm or 800x600px');
  return { w: +m[1], h: +m[2], unit: (m[3]?.toLowerCase() ?? 'px') as SizeUnit };
}

/** The pixels per unit that fit a `w × h` unit window in the box with its aspect kept. */
export function fitPpu(w: number, h: number, fit: Fit): number {
  const f = fit.unit === 'mm' ? PX_PER_MM : 1;
  return Math.min((fit.w * f) / w, (fit.h * f) / h);
}

/** The root element's size attributes: the frame in pixels, or in millimetres. */
export function sizeAttrs(f: Frame, unit: SizeUnit = 'px'): string {
  const s = unit === 'mm' ? (v: number) => `${Math.round((v / PX_PER_MM) * 100) / 100}mm` : (v: number) => String(r3(v));
  return `width="${s(f.w)}" height="${s(f.h)}" viewBox="${r3(f.x)} ${r3(f.y)} ${r3(f.w)} ${r3(f.h)}"`;
}
