/**
 * artlab T4 voxel model + `cubes` iso renderer (becomes the T2+ 3D-mode renderer, P1b).
 * Each voxel is a 4×4 px cube: rows 0–1 top face, rows 2–3 left (+y) | right (+x) faces. Painter's order.
 */
import { Grid } from './grid.ts';
import { groundShadow } from './iso.ts';
import * as post from './post.ts';

/** Voxel face colours: [top, left (+y), right (+x), top highlight?]. */
export type FaceRamp = [string, string, string, string?];
type Vox = [number, number, number, FaceRamp];

/** Material ramp (light, mid, dark) → face ramp, with an optional top highlight. */
export const face = (m: string[], hi?: string): FaceRamp => [m[0], m[1], m[2] || m[1], hi];

export interface VoxelRenderOptions {
  ox: number;
  oy: number;
  outline?: boolean;
  outlineColor?: string;
  /** Footprint shadow under z = 0 voxels. */
  shadow?: boolean;
  shadowColor?: string;
  edgeLight?: boolean;
  /** Supersample factor: render at ss×, mode-downsample, then shadow + outline at final resolution. */
  ss?: number;
  /** With ss: ground shadow ellipse [cx, cy, rx] at final resolution. */
  shadowAt?: [number, number, number];
}

export class Voxels {
  readonly m = new Map<string, Vox>();
  readonly k: number;
  readonly defaults: { outlineColor?: string; shadowColor?: string; applyLine?: (g: Grid) => Grid };
  thick = 1;

  /**
   * k = voxels per model unit: author in coarse units, get k-times finer voxels.
   * Outline/shadow colours and the outer-line pass are render defaults (ctx.lib.voxel.model() fills them from
   * the direction); an explicit `outlineColor` option draws a plain outline instead.
   */
  constructor({ k = 1, outlineColor, shadowColor, applyLine }: { k?: number; outlineColor?: string; shadowColor?: string; applyLine?: (g: Grid) => Grid } = {}) {
    this.k = k; this.defaults = { outlineColor, shadowColor, applyLine };
  }

  private outerLine(g: Grid, outlineColor: string | undefined): Grid {
    if (this.defaults.applyLine && outlineColor === this.defaults.outlineColor) return this.defaults.applyLine(g);
    return post.outline(g, need(outlineColor, 'outlineColor'));
  }

  set(x: number, y: number, z: number, ramp: FaceRamp | null): this {
    x = Math.round(x); y = Math.round(y); z = Math.round(z);
    if (ramp) this.m.set(`${x},${y},${z}`, [x, y, z, ramp]); else this.m.delete(`${x},${y},${z}`);
    return this;
  }

  has(x: number, y: number, z: number): boolean { return this.m.has(`${x},${y},${z}`); }

  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, ramp: FaceRamp): this {
    const k = this.k;
    [x0, y0, z0] = [x0, y0, z0].map(v => Math.round(v * k));
    [x1, y1, z1] = [x1, y1, z1].map(v => Math.round((v + 1) * k) - 1);
    for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, z, ramp);
    return this;
  }

  ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, ramp: FaceRamp): this {
    const k = this.k;
    [cx, cy, cz, rx, ry, rz] = [cx, cy, cz, rx, ry, rz].map(v => v * k);
    if (k > 1) { cx += (k - 1) / 2; cy += (k - 1) / 2; cz += (k - 1) / 2; }
    for (let z = Math.floor(cz - rz); z <= cz + rz; z++) for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1) this.set(x, y, z, ramp);
    return this;
  }

  line(a: number[], b: number[], ramp: FaceRamp): this {
    const k = this.k, [x0, y0, z0] = a.map(v => v * k), [x1, y1, z1] = b.map(v => v * k);
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)) || 1;
    for (let i = 0; i <= n; i++) {
      const px = x0 + ((x1 - x0) * i) / n, py = y0 + ((y1 - y0) * i) / n, pz = z0 + ((z1 - z0) * i) / n;
      for (let c = 0; c < Math.max(1, this.thick || 1); c++) this.set(px + (c & 1), py + ((c >> 1) & 1), pz, ramp);
    }
    return this;
  }

  /** Recolour voxels: `fn` returns a new face ramp or nothing to keep the voxel as is. */
  paint(fn: (x: number, y: number, z: number, r: FaceRamp) => FaceRamp | null | undefined): this {
    for (const v of this.m.values()) { const r = fn(v[0], v[1], v[2], v[3]); if (r) v[3] = r; }
    return this;
  }

  render(w: number, h: number, options: VoxelRenderOptions): Grid {
    const opts = { ...this.defaults, ...options }, ss = opts.ss || 1;
    if (ss === 1) return this.renderCubes(w, h, opts);
    const big = this.renderCubes(w * ss, h * ss, { ...opts, ox: opts.ox * ss, oy: opts.oy * ss, outline: false, shadow: false });
    let g = post.modeDownsample(big, ss);
    if (opts.shadowAt) {
      const s = new Grid(w, h);
      groundShadow(s, ...opts.shadowAt, need(opts.shadowColor, 'shadowColor'));
      g = s.stamp(g);
    }
    return opts.outline === false ? g : this.outerLine(g, opts.outlineColor);
  }

  /** The artlab 4×4 iso cube stamp renderer. */
  renderCubes(w: number, h: number, options: VoxelRenderOptions): Grid {
    const { ox, oy, outline = true, outlineColor, shadow = true, shadowColor, edgeLight = true } = { ...this.defaults, ...options };
    let g = new Grid(w, h);
    const vs = [...this.m.values()].sort((a, b) => a[0] + a[1] - (b[0] + b[1]) || a[2] - b[2]);
    if (shadow) {
      const xs = vs.filter(v => v[2] === 0);
      if (xs.length) { // ground shadow from the footprint
        const sh = new Grid(w, h);
        for (const [x, y] of xs) {
          const sx = ox + (x - y) * 2, sy = oy + (x + y) + 2;
          for (let j = -1; j < 3; j++) for (let i = -3; i < 3; i++) sh.set(sx + i, sy + j, '#000000');
        }
        const sc = need(shadowColor, 'shadowColor');
        for (let i = 0; i < w * h; i++) if (sh.d[i * 4 + 3]) g.set(i % w, Math.floor(i / w), sc);
      }
    }
    for (const [x, y, z, r] of vs) {
      const sx = ox + (x - y) * 2 - 2, sy = oy + (x + y) - z * 2, T = r[0], L = r[1], Rt = r[2] || r[1];
      const topLit = edgeLight && !this.has(x, y, z + 1) && (!this.has(x - 1, y, z) || !this.has(x, y - 1, z));
      for (let i = 0; i < 4; i++) { g.set(sx + i, sy, T); g.set(sx + i, sy + 1, T); }
      if (topLit && !this.has(x, y - 1, z + 1)) { g.set(sx + 1, sy, r[3] || T); g.set(sx + 2, sy, r[3] || T); }
      for (let j = 2; j < 4; j++) { g.set(sx, sy + j, L); g.set(sx + 1, sy + j, L); g.set(sx + 2, sy + j, Rt); g.set(sx + 3, sy + j, Rt); }
    }
    if (outline) g = this.outerLine(g, outlineColor);
    return g;
  }
}

function need(v: string | undefined, name: string): string {
  if (!v) throw new Error(`voxel render: ${name} missing (build models from ctx.lib.voxel so direction colours apply)`);
  return v;
}
