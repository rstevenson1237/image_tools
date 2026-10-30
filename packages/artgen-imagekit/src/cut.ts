/**
 * Cut: the subject of a picture as a silhouette, and a token cropped around it. The Token Cutter, `artgen cut` and the
 * silhouette of the Shape gate (docs/TOOLING-PLAN.md §8, stage 1) all run these functions.
 */
import { fillChain, fillHoles, fillPolygon, ringArea } from './contours.ts';
import { binarize, newMask, type Mask, type Pixels, type ThresholdMode } from './mask.ts';
import { contourShapes } from './trace.ts';

export interface CutOptions {
  /** Grey level between subject and background, or `'otsu'`. */
  threshold: ThresholdMode;
  /** The lighter region is the subject. */
  invert: boolean;
  /** Keep the largest blob and fill the holes in it. */
  keepLargestBlob: boolean;
  /** Close kernel that seals speckle; 0 = none. */
  smoothing: number;
}

export const defaultCutOptions: CutOptions = { threshold: 'otsu', invert: false, keepLargestBlob: true, smoothing: 5 };

/** Parse `#rgb` or `#rrggbb`. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const s = hex.replace('#', '').trim(), full = s.length === 3 ? s.split('').map(c => c + c).join('') : s;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`"${hex}" is not a valid hex colour`);
  return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16) };
}

/** Keep only the largest blob of a mask, with its holes filled (stray specks and the gaps between limbs go). A mask with no blob is left as it is. */
export function keepLargestFilledBlob(m: Mask): Mask {
  let best = -1, bestArea = 0;
  const shapes = contourShapes(m, false);
  shapes.forEach((s, i) => { const a = ringArea(s.outer.points); if (a > bestArea) { bestArea = a; best = i; } });
  return best < 0 ? m : fillChain(shapes[best].outer.chain, m.w, m.h);
}

/** `a` AND `b`, in place in `a`. */
function intersect(a: Mask, b: Mask): void { for (let i = 0; i < a.d.length; i++) if (!b.d[i]) a.d[i] = 0; }

/**
 * The silhouette mask of the subject inside `polygon` (a lasso in pixels; fewer than three points select the whole picture):
 * threshold the picture, clip it to the lasso, optionally keep the largest blob filled, and clip again so nothing leaves the lasso.
 */
export function silhouetteMask(img: Pixels, polygon: ReadonlyArray<{ x: number; y: number }> = [], o: Partial<CutOptions> = {}): Mask {
  const s = { ...defaultCutOptions, ...o }, lasso = fillPolygon(polygon, img.w, img.h);
  let { binary } = binarize(img, { threshold: s.threshold, invert: s.invert, blur: 3, smoothing: s.smoothing, respectAlpha: true });
  intersect(binary, lasso);
  if (s.keepLargestBlob) { binary = keepLargestFilledBlob(binary); intersect(binary, lasso); }
  return binary;
}

/** A silhouette picture: `color` where the mask is set, transparent elsewhere. */
export function silhouetteImage(m: Mask, color: string): { w: number; h: number; d: Uint8ClampedArray } {
  const { r, g, b } = hexToRgb(color), d = new Uint8ClampedArray(m.w * m.h * 4);
  for (let i = 0; i < m.d.length; i++) if (m.d[i]) { d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
  return { w: m.w, h: m.h, d };
}

/** The silhouette of the subject in `color`, as the Token Cutter extracts it. */
export function extractSilhouette(img: Pixels, polygon: ReadonlyArray<{ x: number; y: number }>, color: string, o: Partial<CutOptions> = {}): { w: number; h: number; d: Uint8ClampedArray } {
  return silhouetteImage(silhouetteMask(img, polygon, o), color);
}

export interface Box { x: number; y: number; w: number; h: number }

/** The bounds of the pixels with alpha above `min` (default 0), grown by `padding` and kept inside the picture; null when none. */
export function alphaBounds(img: Pixels, padding = 0, min = 0): Box | null {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1;
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.d[(y * img.w + x) * 4 + 3] > min) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return null;
  const px0 = Math.max(0, x0 - padding), py0 = Math.max(0, y0 - padding), px1 = Math.min(img.w - 1, x1 + padding), py1 = Math.min(img.h - 1, y1 + padding);
  return { x: px0, y: py0, w: px1 - px0 + 1, h: py1 - py0 + 1 };
}

export interface TokenOptions {
  /** Transparent margin around the subject, in pixels. */
  padding: number;
  /** Pad the result to a square so a tabletop that assumes 1:1 tokens does not stretch it. */
  square: boolean;
  /** Whole-number enlargement, nearest neighbour (pixel art stays crisp). */
  scale: number;
}

export const defaultTokenOptions: TokenOptions = { padding: 8, square: false, scale: 1 };

/** Crop a picture to its subject (its non-transparent pixels), with a margin, optionally square, optionally enlarged. Throws when nothing is opaque. */
export function cropToken(img: Pixels, o: Partial<TokenOptions> = {}): { w: number; h: number; d: Uint8ClampedArray } {
  const s = { ...defaultTokenOptions, ...o }, box = alphaBounds(img, s.padding);
  if (!box) throw new Error('nothing to cut: the picture is empty (no opaque pixel)');
  const k = Math.max(1, Math.round(s.scale)), cw = box.w * k, ch = box.h * k, size = s.square ? Math.max(cw, ch) : 0;
  const w = s.square ? size : cw, h = s.square ? size : ch, ox = s.square ? Math.round((size - cw) / 2) : 0, oy = s.square ? Math.round((size - ch) / 2) : 0;
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const from = ((box.y + Math.floor(y / k)) * img.w + box.x + Math.floor(x / k)) * 4, to = ((y + oy) * w + x + ox) * 4;
    for (let c = 0; c < 4; c++) d[to + c] = img.d[from + c];
  }
  return { w, h, d };
}

/** A picture with everything outside `mask` made transparent (the art kept where the mask is set). */
export function applyMask(img: Pixels, m: Mask): { w: number; h: number; d: Uint8ClampedArray } {
  const d = new Uint8ClampedArray(img.w * img.h * 4);
  for (let i = 0; i < m.d.length; i++) if (m.d[i]) for (let c = 0; c < 4; c++) d[i * 4 + c] = img.d[i * 4 + c];
  return { w: img.w, h: img.h, d };
}

/** The pixels with alpha at least `min` (default 128: translucent shadows and glows are not the body), holes filled when `fill`. For art that is already cut out. */
export function alphaMask(img: Pixels, min = 128, fill = true): Mask {
  const m = newMask(img.w, img.h);
  for (let i = 0; i < m.d.length; i++) if (img.d[i * 4 + 3] >= min) m.d[i] = 255;
  return fill ? fillHoles(m) : m;
}
