/**
 * `Raster`: a T2+ render before colours are fixed. Every pixel knows which item (shape or ramp) owns it and which
 * ramp step it uses, so the procedural pass (S2) and the finishing ops can move pixels along their own ramp and
 * the result stays on-palette whatever direction is applied.
 */
import { normHex } from './lib/color.ts';
import { Grid } from './lib/grid.ts';
import { putNormal } from './lib/normals.ts';
import { ellipsePts, fillPolygons, Mask, parsePath, rectPts, type Pt } from './geom.ts';

/** Indices of `bands` evenly spaced steps in a ramp of length `len` (all when the ramp is no longer). */
export function bandIndices(len: number, bands: number): number[] {
  if (bands >= len || bands < 1) return Array.from({ length: len }, (_, i) => i);
  if (bands === 1) return [len >> 1];
  return Array.from({ length: bands }, (_, i) => Math.round((i * (len - 1)) / (bands - 1)));
}

export interface RasterItem {
  /** Part name (shape `name`, or the ramp name for rasters built from a grid). */
  name?: string;
  /** Material ramp, lightest first (absent for fixed colours). */
  ramp?: string[];
  /** Ramp indices this item may use (direction `shading.bands`). */
  levels: number[];
  /** Fixed colour (no ramp). */
  fixed?: string;
  /** Draw order: higher is on top. */
  rank: number;
  /** Underlay ink (dark silhouette copy). */
  underlay?: boolean;
}

export const INK = 1;

/** A decal layer (STAGES.md §7.1): its ramp, the band it uses, and how much of its shape landed on its target. */
export interface RasterDecal {
  name: string;
  ramp: string[];
  /** A fixed ramp index; absent = the band of the pixel under the decal (so it is shaded with the surface). */
  band?: number;
  /** Shape pixels inside the frame, and those of them on the target part. */
  inside: number;
  total: number;
}

/** A decal shape: the primitives of a scene spec that a mark needs, in frame pixels. */
export interface DecalShape {
  type: string;
  x?: number; y?: number; w?: number; h?: number; r?: number;
  cx?: number; cy?: number; rx?: number; ry?: number;
  pts?: Pt[]; d?: string; fillRule?: 'nonzero' | 'evenodd';
  [k: string]: unknown;
}

export const DECAL_SHAPES = ['rect', 'ellipse', 'circle', 'poly', 'path'];

/**
 * Pixels covered by decal shapes (one byte per pixel of a w × h frame, 1 = covered). The fill code is the scene's:
 * `fillPolygons` into a 4 × 4 sampled `Mask`, and a pixel is covered when more than half of its samples are, as the
 * scene's `direct` mode decides it. Shapes outside the frame are clipped.
 */
export function decalCoverage(shapes: DecalShape | DecalShape[], w: number, h: number): Uint8Array {
  const S = 4, m = new Mask(w * S, h * S, S), tol = 0.5 / S;
  for (const s of ([] as DecalShape[]).concat(shapes)) {
    const num = (v: unknown, name: string): number => { if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`decal ${s.type}: ${name} must be a number`); return v; };
    switch (s.type) {
      case 'rect': fillPolygons(m, [rectPts(num(s.x ?? 0, 'x'), num(s.y ?? 0, 'y'), num(s.w, 'w'), num(s.h, 'h'), s.r ?? 0, tol)]); break;
      case 'ellipse': fillPolygons(m, [ellipsePts(num(s.cx, 'cx'), num(s.cy, 'cy'), num(s.rx, 'rx'), num(s.ry ?? s.rx, 'ry'), tol)]); break;
      case 'circle': fillPolygons(m, [ellipsePts(num(s.cx, 'cx'), num(s.cy, 'cy'), num(s.r, 'r'), s.r!, tol)]); break;
      case 'poly': fillPolygons(m, [s.pts ?? []], s.fillRule); break;
      case 'path': fillPolygons(m, parsePath(s.d ?? '', tol), s.fillRule); break;
      default: throw new Error(`decal shape type ${JSON.stringify(s.type)} is not one of ${DECAL_SHAPES.join(', ')}`);
    }
  }
  const out = new Uint8Array(w * h), half = (S * S) / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let n = 0;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) n += m.d[(y * S + j) * m.w + x * S + i];
    if (n > half) out[y * w + x] = 1;
  }
  return out;
}

/** The same byte mask mirrored across x (a mirrored cell's decals). */
export function flipMaskX(m: Uint8Array, w: number): Uint8Array {
  const out = new Uint8Array(m.length);
  for (let i = 0; i < m.length; i++) out[i] = m[((i / w) | 0) * w + (w - 1 - (i % w))];
  return out;
}

export class Raster {
  readonly w: number;
  readonly h: number;
  /** Owning item per pixel, -1 = empty. */
  readonly id: Int16Array;
  /** Ramp index per pixel. */
  readonly band: Int16Array;
  /** Per-pixel flags (INK = drawn in the ink colour). */
  readonly flag: Uint8Array;
  readonly items: RasterItem[];
  readonly ink: string;
  /** Screen-space normal per pixel (x right, y down, z toward the viewer), when the scene computed them. */
  normal?: Float32Array;
  /** Decal index per pixel (-1 none), once a decal layer ran (STAGES.md §7.1). */
  decal?: Int16Array;
  readonly decals: RasterDecal[] = [];

  constructor(w: number, h: number, items: RasterItem[], ink: string) {
    this.w = w; this.h = h; this.items = items; this.ink = ink;
    this.id = new Int16Array(w * h).fill(-1); this.band = new Int16Array(w * h); this.flag = new Uint8Array(w * h);
  }

  idx(x: number, y: number): number { return x >= 0 && y >= 0 && x < this.w && y < this.h ? y * this.w + x : -1; }

  /** Item owning (x, y), or null when empty or outside. */
  item(x: number, y: number): RasterItem | null {
    const i = this.idx(x, y);
    return i < 0 || this.id[i] < 0 ? null : this.items[this.id[i]];
  }

  filled(x: number, y: number): boolean { const i = this.idx(x, y); return i >= 0 && this.id[i] >= 0; }

  /** Move a pixel `steps` levels darker (negative = lighter) within its item's levels. Returns true if it moved. */
  step(i: number, steps: number): boolean {
    const id = this.id[i];
    if (id < 0 || this.flag[i] & INK) return false;
    const it = this.items[id];
    if (!it.ramp || it.levels.length < 2) return false;
    const L = it.levels, cur = this.band[i];
    let k = L.indexOf(cur);
    if (k < 0) k = L.reduce((best, v, j) => (Math.abs(v - cur) < Math.abs(L[best] - cur) ? j : best), 0);
    const nk = Math.max(0, Math.min(L.length - 1, k + steps));
    if (L[nk] === cur) return false;
    this.band[i] = L[nk];
    return true;
  }

  /** Set a pixel to an item's level `k` (0 = lightest level, -1 = darkest). */
  setLevel(i: number, k: number): void {
    const it = this.items[this.id[i]];
    if (!it?.ramp) return;
    this.band[i] = it.levels[k < 0 ? it.levels.length + k : Math.min(k, it.levels.length - 1)];
  }

  color(i: number): string | null {
    const id = this.id[i];
    if (id < 0) return null;
    if (this.flag[i] & INK) return this.ink;
    const d = this.decal && this.decal[i] >= 0 ? this.decals[this.decal[i]] : null;
    if (d) return d.ramp[Math.max(0, Math.min(d.ramp.length - 1, d.band ?? this.band[i]))];
    const it = this.items[id];
    return it.fixed ?? it.ramp![this.band[i]];
  }

  /** Start a decal layer: the index to write into `decal`. The caller sets pixels and counts `inside` / `total`. */
  addDecal(d: Omit<RasterDecal, 'inside' | 'total'>): RasterDecal {
    this.decal ??= new Int16Array(this.id.length).fill(-1);
    const full: RasterDecal = { ...d, inside: 0, total: 0 };
    this.decals.push(full);
    return full;
  }

  /** Per-pixel masks (1 = the decal's colour shows) by decal name, or undefined when no decal landed. Later decals cover earlier ones. */
  decalMasks(): Record<string, Uint8Array> | undefined {
    if (!this.decal || !this.decals.length) return undefined;
    const out: Record<string, Uint8Array> = {};
    this.decals.forEach(d => { out[d.name] = new Uint8Array(this.id.length); });
    for (let i = 0; i < this.decal.length; i++) if (this.decal[i] >= 0 && this.id[i] >= 0 && !(this.flag[i] & INK)) out[this.decals[this.decal[i]].name][i] = 1;
    return out;
  }

  /** Per decal: shape pixels in the frame and those on the target part (the `decal-inside` check). */
  decalStats(): Record<string, { inside: number; total: number }> | undefined {
    return this.decals.length ? Object.fromEntries(this.decals.map(d => [d.name, { inside: d.inside, total: d.total }])) : undefined;
  }

  /** Normal map of the filled pixels (ink pixels face the viewer), or undefined without normals. */
  normalMap(): Grid | undefined {
    if (!this.normal) return undefined;
    const g = new Grid(this.w, this.h);
    for (let i = 0; i < this.id.length; i++) {
      if (this.id[i] < 0) continue;
      const ink = !!(this.flag[i] & INK);
      putNormal(g, i % this.w, (i / this.w) | 0, ink ? [0, 0, 1] : [this.normal[i * 3], this.normal[i * 3 + 1], this.normal[i * 3 + 2]]);
    }
    return g;
  }

  toGrid(): Grid {
    const g = new Grid(this.w, this.h);
    for (let i = 0; i < this.id.length; i++) { const c = this.color(i); if (c) g.set(i % this.w, (i / this.w) | 0, c); }
    return g;
  }

  /** Build a raster from finished pixels: each colour maps to the first direction ramp holding it. */
  static fromGrid(g: Grid, ramps: Record<string, string[]>, ink: string, bands = 99): Raster {
    const byColor = new Map<string, [string, number]>();
    for (const [name, r] of Object.entries(ramps)) r.forEach((c, i) => { const k = normHex(c); if (!byColor.has(k)) byColor.set(k, [name, i]); });
    const items: RasterItem[] = [], itemOf = new Map<string, number>(), r = new Raster(g.w, g.h, items, normHex(ink));
    const inkHex = normHex(ink);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (g.alpha(x, y) < 255) continue;
      const c = g.get(x, y)!, i = y * g.w + x, hit = byColor.get(c), key = c === inkHex ? '#ink' : hit ? hit[0] : c;
      let id = itemOf.get(key);
      if (id === undefined) {
        id = items.length; itemOf.set(key, id);
        if (key === '#ink') items.push({ name: 'ink', fixed: inkHex, levels: [], rank: 0 });
        else if (hit) { const ramp = ramps[hit[0]].map(normHex); items.push({ name: hit[0], ramp, levels: bandIndices(ramp.length, bands), rank: 0 }); }
        else items.push({ fixed: c, levels: [], rank: 0 });
      }
      r.id[i] = id;
      if (key === '#ink') r.flag[i] = INK; else if (hit) r.band[i] = hit[1];
    }
    // ramp steps that the bands would not pick are still valid: keep them as levels so stepping works
    for (const it of items) if (it.ramp) it.levels = [...new Set([...it.levels, ...r.usedBands(items.indexOf(it))])].sort((a, b) => a - b);
    return r;
  }

  private usedBands(id: number): number[] {
    const s = new Set<number>();
    for (let i = 0; i < this.id.length; i++) if (this.id[i] === id && !(this.flag[i] & INK)) s.add(this.band[i]);
    return [...s];
  }
}
