/**
 * artlab T2 primitives (the T2+ starting point): shape specs rasterised without anti-aliasing, with automatic
 * material shading. Light, shading bands, outline and shadow colours come from the direction.
 */
import { Grid } from './grid.ts';
import * as post from './post.ts';

type Pt = [number, number];
const N4: Pt[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export interface Spec {
  type: 'ellipse' | 'rect' | 'poly' | 'line';
  cx?: number; cy?: number; rx?: number; ry?: number;
  x?: number; y?: number; w?: number; h?: number; r?: number;
  pts?: Pt[];
  x0?: number; y0?: number; x1?: number; y1?: number;
  /** Material ramp (lightest first) or a single colour. */
  mat?: string | string[];
  /** Fixed colour; skips shading. */
  color?: string;
  shade?: 'flat' | 'bevel' | 'sphere' | 'cyl';
  axis?: 'x' | 'y';
  rim?: number;
  ink?: string;
  inkAll?: string;
  pattern?: (x: number, y: number, c: string) => string | null | undefined;
  mirrorX?: number;
  mirrorY?: number;
}

/** Rasterisers: pixel coordinates covered by a spec (pixel-centre sampling). */
export const R = {
  ellipse({ cx = 0, cy = 0, rx = 1, ry = 1 }: Spec): Pt[] {
    const out: Pt[] = [];
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) out.push([x, y]);
      }
    return out;
  },
  rect({ x = 0, y = 0, w = 1, h = 1, r = 0 }: Spec): Pt[] {
    const out: Pt[] = [];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      if (r) { // cut corners for a rounded look
        const cx = Math.min(i, w - 1 - i), cy = Math.min(j, h - 1 - j);
        if (cx < r && cy < r && r - cx + (r - cy) > r + 1) continue;
      }
      out.push([x + i, y + j]);
    }
    return out;
  },
  poly({ pts = [] }: Spec): Pt[] {
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), out: Pt[] = [];
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
      for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
        const px = x + 0.5, py = y + 0.5;
        let ins = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) ins = !ins;
        }
        if (ins) out.push([x, y]);
      }
    return out;
  },
  line({ x0 = 0, y0 = 0, x1 = 0, y1 = 0, w = 1 }: Spec): Pt[] {
    const out: Pt[] = [];
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (;;) {
      for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) out.push([x0 + i, y0 + j]);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) { e += dy; x0 += sx; }
      if (e2 <= dx) { e += dx; y0 += sy; }
    }
    return out;
  },
};

/** Mirror a spec across the vertical axis x = ax (or horizontal y = ay). */
export function mirrorSpec(s: Spec, ax?: number | null, ay?: number | null): Spec {
  const m: Spec = { ...s, pts: s.pts?.map(p => [...p] as Pt), mirrorX: undefined, mirrorY: undefined };
  const fx = (v: number) => (ax != null ? 2 * ax - v : v), fy = (v: number) => (ay != null ? 2 * ay - v : v);
  if (s.type === 'ellipse') { m.cx = fx(s.cx ?? 0); m.cy = fy(s.cy ?? 0); }
  if (s.type === 'rect') {
    if (ax != null) m.x = 2 * ax - (s.x ?? 0) - (s.w ?? 1);
    if (ay != null) m.y = 2 * ay - (s.y ?? 0) - (s.h ?? 1);
  }
  if (s.type === 'poly') m.pts = (s.pts ?? []).map(([x, y]) => [fx(x), fy(y)]);
  if (s.type === 'line') {
    m.x0 = Math.round(fx((s.x0 ?? 0) + 0.5) - 0.5); m.x1 = Math.round(fx((s.x1 ?? 0) + 0.5) - 0.5);
    m.y0 = Math.round(fy((s.y0 ?? 0) + 0.5) - 0.5); m.y1 = Math.round(fy((s.y1 ?? 0) + 0.5) - 0.5);
  }
  return m;
}

/** Pick `bands` evenly spaced colours from a ramp (whole ramp when it is no longer than `bands`). */
export function bandRamp(mat: string[], bands: number): string[] {
  if (bands >= mat.length || bands < 1) return mat;
  if (bands === 1) return [mat[Math.floor(mat.length / 2)]];
  return Array.from({ length: bands }, (_, i) => mat[Math.round((i * (mat.length - 1)) / (bands - 1))]);
}

export interface SceneOptions {
  /** Light direction in screen space; artlab default upper-left. */
  light?: [number, number] | number[];
  /** Max shading bands per material (direction `shading.bands`). */
  bands?: number;
  outlineColor?: string;
  shadowColor?: string;
  /** Outer-line pass used instead of a plain outline (direction `line.outer`: dark | selout | none). */
  applyLine?: (g: Grid) => Grid;
}

export class Scene {
  readonly w: number;
  readonly h: number;
  readonly shapes: Spec[] = [];
  readonly light: [number, number];
  readonly bands: number;
  readonly outlineColor?: string;
  readonly shadowColor?: string;
  readonly applyLine?: (g: Grid) => Grid;

  constructor(w: number, h: number, opts: SceneOptions = {}) {
    this.w = w; this.h = h;
    this.light = [Math.sign(opts.light?.[0] ?? -1), Math.sign(opts.light?.[1] ?? -1)];
    this.bands = opts.bands ?? 99;
    this.outlineColor = opts.outlineColor; this.shadowColor = opts.shadowColor; this.applyLine = opts.applyLine;
  }

  add(spec: Spec): this {
    this.shapes.push(spec);
    if (spec.mirrorX != null) this.shapes.push(mirrorSpec(spec, spec.mirrorX));
    if (spec.mirrorY != null) this.shapes.push(mirrorSpec(spec, null, spec.mirrorY));
    return this;
  }

  addAll(list: Spec[]): this { list.forEach(s => this.add(s)); return this; }

  /** Shade modes: 'flat' | 'bevel' (edge light/dark) | 'sphere' (normal bands) | 'cyl' (bands across one axis). */
  shadeColor(s: Spec, x: number, y: number, set: Set<string>): string {
    const mat = bandRamp(Array.isArray(s.mat) ? s.mat : [s.mat ?? '#ff00ff'], this.bands);
    if (mat.length === 1 || s.shade === 'flat') return mat[Math.min(1, mat.length - 1)] || mat[0];
    const [lx, ly] = this.light, last = mat.length - 1;
    if (s.shade === 'sphere' && s.type === 'ellipse') {
      const nx = (x + 0.5 - (s.cx ?? 0)) / (s.rx ?? 1), ny = (y + 0.5 - (s.cy ?? 0)) / (s.ry ?? 1);
      const d = (nx * lx + ny * ly) / Math.SQRT2;
      if (s.rim && nx * nx + ny * ny > s.rim) return mat[last];
      return mat[Math.max(0, Math.min(last, Math.round((1 - (d + 1) / 2) * last)))];
    }
    if (s.shade === 'cyl') {
      const t = s.axis === 'x' ? (y + 0.5 - (s.y ?? 0)) / (s.h ?? 1) : (x + 0.5 - (s.x ?? 0)) / (s.w ?? 1);
      return mat[Math.max(0, Math.min(last, Math.floor(t * (last + 1))))];
    }
    const has = (a: number, b: number) => set.has(a + ',' + b);
    const lit = !has(x + lx, y) || !has(x, y + ly), dark = !has(x - lx, y) || !has(x, y - ly);
    if (lit && !dark) return mat[0];
    if (dark && !lit) return mat[last];
    return mat[Math.min(1, last)];
  }

  render({ outline = true, outlineColor = this.outlineColor, shadow = null as [number, number] | null, shadowColor = this.shadowColor } = {}): Grid {
    let g = new Grid(this.w, this.h);
    for (const s of this.shapes) {
      const px = R[s.type](s), set = new Set(px.map(p => p[0] + ',' + p[1])), buf: [number, number, string][] = [];
      for (const [x, y] of px) {
        let c = s.color || this.shadeColor(s, x, y, set);
        if (s.pattern) c = s.pattern(x, y, c) || c;
        // selective inner outline where this shape overlaps something already drawn
        if (s.ink && N4.some(([dx, dy]) => !set.has(x + dx + ',' + (y + dy)) && g.alpha(x + dx, y + dy) > 200)) c = s.ink;
        if (s.inkAll && N4.some(([dx, dy]) => !set.has(x + dx + ',' + (y + dy)))) c = s.inkAll;
        buf.push([x, y, c]);
      }
      for (const [x, y, c] of buf) g.set(x, y, c);
    }
    if (outline && this.applyLine && outlineColor === this.outlineColor) g = this.applyLine(g);
    else if (outline) {
      if (!outlineColor) throw new Error('Scene.render: outline colour missing (pass it or build the scene from ctx.lib.prim)');
      g = post.outline(g, outlineColor);
    }
    if (shadow) {
      if (!shadowColor) throw new Error('Scene.render: shadow colour missing');
      g = post.dropShadow(g, shadow[0], shadow[1], shadowColor);
    }
    return g;
  }
}
