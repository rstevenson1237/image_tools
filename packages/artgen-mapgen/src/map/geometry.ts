/** Shapes on the sample grid: coverage, the samples a shape touches, and the distance from one. */
import type { Shape } from './spec.ts';

/** Coverage of a shape at (x, y), 0..1; `soft` fades the outer half of discs and strokes (for elevate). */
export function coverage(s: Shape, x: number, y: number, soft = false): number {
  const fall = (d: number, r: number) => (d >= r ? 0 : !soft || d <= r * 0.4 ? 1 : 0.5 + 0.5 * Math.cos(((d - r * 0.4) / (r * 0.6)) * Math.PI));
  if ('circle' in s) return fall(Math.hypot(x - s.circle[0], y - s.circle[1]), s.circle[2]);
  if ('poly' in s) {
    const p = s.poly;
    let inside = false;
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
      if ((p[i + 1] > y) !== (p[j + 1] > y) && x < ((p[j] - p[i]) * (y - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) inside = !inside;
    }
    return inside ? 1 : 0;
  }
  return fall(distToPolyline(s.stroke, x, y), s.width / 2);
}

export function distToPolyline(p: number[], x: number, y: number): number {
  if (p.length === 2) return Math.hypot(x - p[0], y - p[1]);
  let best = Infinity;
  for (let i = 2; i < p.length; i += 2) {
    const ax = p[i - 2], ay = p[i - 1], dx = p[i] - ax, dy = p[i + 1] - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

/** Bounding box of a shape in map units [x0, y0, x1, y1]. */
export function bbox(s: Shape): [number, number, number, number] {
  if ('circle' in s) { const [x, y, r] = s.circle; return [x - r, y - r, x + r, y + r]; }
  const p = 'poly' in s ? s.poly : s.stroke, pad = 'stroke' in s ? s.width / 2 : 0;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}

/** Call `fn(index, coverage)` for each sample a shape touches. */
export function eachCovered(f: { res: number; w: number; h: number }, s: Shape, soft: boolean, fn: (i: number, c: number) => void): void {
  const [x0, y0, x1, y1] = bbox(s), r = f.res;
  for (let j = Math.max(0, Math.floor(y0 * r)); j < Math.min(f.h, Math.ceil(y1 * r) + 1); j++)
    for (let i = Math.max(0, Math.floor(x0 * r)); i < Math.min(f.w, Math.ceil(x1 * r) + 1); i++) {
      const c = coverage(s, (i + 0.5) / r, (j + 0.5) / r, soft);
      if (c > 0) fn(j * f.w + i, c);
    }
}

/**
 * Distance (map units) from each sample to the nearest sample a shape covers, up to `reach`; 0 inside the shape and
 * `reach` (or more) beyond it. With `inside`, the other way round: from each covered sample to the nearest one the shape
 * does not cover, 0 outside. A two-pass chamfer over the shape's box widened by `reach`, so it costs the box, not the map.
 */
export function distanceTo(f: { res: number; w: number; h: number }, s: Shape, reach: number, inside = false): Float32Array {
  const out = new Float32Array(f.w * f.h).fill(inside ? 0 : reach), r = f.res, pad = Math.ceil(reach * r) + 1;
  const [bx0, by0, bx1, by1] = bbox(s);
  const x0 = Math.max(0, Math.floor(bx0 * r) - pad), y0 = Math.max(0, Math.floor(by0 * r) - pad), x1 = Math.min(f.w - 1, Math.ceil(bx1 * r) + pad), y1 = Math.min(f.h - 1, Math.ceil(by1 * r) + pad);
  const ww = x1 - x0 + 1, hh = y1 - y0 + 1, big = 1e9, d = new Float32Array(ww * hh).fill(big);
  for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) if ((coverage(s, (x0 + i + 0.5) / r, (y0 + j + 0.5) / r) > 0) !== inside) d[j * ww + i] = 0;
  const D = Math.SQRT2;
  for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) {
    let v = d[j * ww + i];
    if (i > 0) v = Math.min(v, d[j * ww + i - 1] + 1);
    if (j > 0) { v = Math.min(v, d[(j - 1) * ww + i] + 1); if (i > 0) v = Math.min(v, d[(j - 1) * ww + i - 1] + D); if (i < ww - 1) v = Math.min(v, d[(j - 1) * ww + i + 1] + D); }
    d[j * ww + i] = v;
  }
  for (let j = hh - 1; j >= 0; j--) for (let i = ww - 1; i >= 0; i--) {
    let v = d[j * ww + i];
    if (i < ww - 1) v = Math.min(v, d[j * ww + i + 1] + 1);
    if (j < hh - 1) { v = Math.min(v, d[(j + 1) * ww + i] + 1); if (i < ww - 1) v = Math.min(v, d[(j + 1) * ww + i + 1] + D); if (i > 0) v = Math.min(v, d[(j + 1) * ww + i - 1] + D); }
    d[j * ww + i] = v;
  }
  for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) out[(y0 + j) * f.w + x0 + i] = Math.min(reach, d[j * ww + i] / r) * (inside && d[j * ww + i] === 0 ? 0 : 1);
  return out;
}
