/**
 * Trace: a picture or a sketch to closed polygon rings (a shape is an outline and the holes in it), in the picture's pixels.
 * The SVG Tracer, `artgen trace` and the map outline all run this one function.
 */
import { findContours, ringArea, simplifyRing, type Contour } from './contours.ts';
import { binarize, type Mask, type Pixels, type ThresholdMode } from './mask.ts';

export interface TraceOptions {
  threshold: ThresholdMode;
  /** The lighter region is the subject. */
  invert: boolean;
  /** Gaussian kernel size; 0 = none. */
  blur: number;
  /** Close kernel that seals speckle; 0 = none. */
  smoothing: number;
  /** Intersect with the source alpha, so transparent art traces its own shape. */
  respectAlpha: boolean;
  /** Douglas–Peucker tolerance in pixels; 0 keeps every corner. */
  simplifyTolerance: number;
  /** Rings under this area (px²) are dropped. */
  minArea: number;
  /** Emit the holes in a shape. False traces outlines only. */
  keepHoles: boolean;
  /** At most this many shapes, largest first. */
  maxPaths: number;
}

export const defaultTraceOptions: TraceOptions = {
  threshold: 'otsu', invert: false, blur: 3, smoothing: 3, respectAlpha: true, simplifyTolerance: 1.5, minArea: 24, keepHoles: true, maxPaths: 120,
};

/** One closed ring in pixels, flat `[x, y, …]`. */
export interface TracedRing { points: Float32Array; area: number }
export interface TracedShape { outer: TracedRing; holes: TracedRing[] }
export interface TraceResult {
  width: number;
  height: number;
  shapes: TracedShape[];
  /** Rings dropped by `minArea` or `maxPaths`. */
  droppedCount: number;
  /** The grey level applied: what `'otsu'` chose. */
  thresholdUsed: number;
}

/** The blobs of a mask with their holes, in the order OpenCV lists them: the last found first, each followed by its holes. `holes: false` keeps only blobs the image edge encloses. */
export function contourShapes(mask: Mask, holes = true): { outer: Contour; holes: Contour[] }[] {
  const all = findContours(mask), out: { outer: Contour; holes: Contour[] }[] = [], slot = new Map<number, { outer: Contour; holes: Contour[] }>();
  for (let i = all.length - 1; i >= 0; i--) {
    const c = all[i];
    // a blob inside a hole is a shape of its own; with holes off it is not met at all
    if (c.hole || (!holes && c.parent >= 0)) continue;
    const s = { outer: c, holes: [] as Contour[] };
    slot.set(i, s);
    out.push(s);
  }
  if (holes) for (let i = all.length - 1; i >= 0; i--) if (all[i].hole) slot.get(all[i].parent)?.holes.push(all[i]);
  return out;
}

/** The blobs of a mask as closed rings. */
export function traceMask(mask: Mask, o: Partial<TraceOptions> = {}, thresholdUsed = 0): TraceResult {
  const s = { ...defaultTraceOptions, ...o };
  let dropped = 0;
  const ring = (c: Contour): TracedRing | null => {
    const area = ringArea(c.points);
    if (area < s.minArea) return null;
    let pts: ArrayLike<number> = c.points;
    if (s.simplifyTolerance > 0) { const simple = simplifyRing(c.points, s.simplifyTolerance); if (simple.length >= 6) pts = simple; }
    return pts.length < 6 ? null : { points: Float32Array.from(pts as ArrayLike<number>), area };
  };
  const shapes: TracedShape[] = [];
  for (const sh of contourShapes(mask, s.keepHoles)) {
    const outer = ring(sh.outer);
    if (!outer) { dropped++; continue; }
    const holes: TracedRing[] = [];
    for (const h of sh.holes) { const r = ring(h); if (r) holes.push(r); else dropped++; }
    shapes.push({ outer, holes });
  }
  shapes.sort((a, b) => b.outer.area - a.outer.area);
  if (shapes.length > s.maxPaths) { dropped += shapes.length - s.maxPaths; shapes.length = s.maxPaths; }
  return { width: mask.w, height: mask.h, shapes, droppedCount: dropped, thresholdUsed };
}

/** Trace a picture: grey → blur → threshold → close → alpha, then the rings of what is left. */
export function traceImage(img: Pixels, o: Partial<TraceOptions> = {}): TraceResult {
  const s = { ...defaultTraceOptions, ...o };
  const { binary, thresholdUsed } = binarize(img, s);
  return traceMask(binary, s, thresholdUsed);
}
