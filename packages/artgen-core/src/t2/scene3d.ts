/**
 * T2+ 3D mode (SPEC §6.3, §7; D13): the same kind of specs in 3D — box, slab, ellipsoid, capsule, sdf, groups with
 * translate / 90° rotations / mirror, and booleans — voxelised and rendered by the voxel `cubes` iso renderer.
 * Facings rotate the model about the vertical axis, so one model gives every facing and every state.
 *
 * R5: decoration is a surface **slab**: a slab recolours the voxels it overlaps (with `add: true` it also fills
 * empty cells, for raised trim). Solids that interpenetrate solids of another material are reported by `lint()`.
 */
import type { DirContext } from '../direction.ts';
import { normHex } from '../lib/color.ts';
import type { Grid } from '../lib/grid.ts';
import { Voxels, type FaceRamp } from '../lib/voxel.ts';
import { bandIndices } from './raster.ts';

export type V3 = [number, number, number];

export interface Spec3 {
  type: 'box' | 'slab' | 'ellipsoid' | 'capsule' | 'sdf' | 'group' | 'union' | 'subtract' | 'intersect';
  /** box / slab: origin cell and size in model units. */
  x?: number; y?: number; z?: number; w?: number; d?: number; h?: number;
  /** ellipsoid */
  cx?: number; cy?: number; cz?: number; rx?: number; ry?: number; rz?: number;
  /** capsule */
  a?: V3; b?: V3; r?: number;
  /** sdf: signed distance in model units (≤ 0 inside), evaluated at voxel centres inside `bbox`. */
  fn?: (x: number, y: number, z: number) => number;
  bbox?: [number, number, number, number, number, number];
  shapes?: Spec3[];
  children?: Spec3[];
  translate?: V3;
  /** Degrees about the vertical axis, multiples of 90, around `origin`. */
  rotate?: number;
  mirror?: 'x' | 'y';
  origin?: V3;
  /** Material ramp or name (inherited). */
  mat?: string | string[];
  /** slab: also fill empty cells in its region (raised trim) instead of only recolouring. */
  add?: boolean;
  /** Top-edge highlight colour token (cubes renderer edge light). */
  hi?: string;
  name?: string;
}

export interface Scene3DOptions {
  /** Voxels per model unit. */
  k?: number;
}

export interface Render3DOptions {
  /** Screen position of model origin (px). */
  ox: number;
  oy: number;
  /** Facing name (`s` front, then clockwise `w`, `n`, `e`; diagonals are not supported by the cubes renderer). */
  facing?: string;
  ss?: number;
  outline?: boolean;
  /** Footprint shadow under z = 0 voxels (default true). */
  shadow?: boolean;
  edgeLight?: boolean;
}

type Vox = Map<string, { v: V3; ramp: FaceRamp; solid: string }>;
const key = (v: V3) => `${v[0]},${v[1]},${v[2]}`;
const FACING_ROT: Record<string, number> = { s: 0, w: 90, n: 180, e: 270 };

export class Scene3D {
  readonly specs: Spec3[] = [];
  readonly k: number;
  readonly dir: DirContext;
  private warnings: string[] = [];

  constructor(dir: DirContext, opts: Scene3DOptions = {}) { this.dir = dir; this.k = opts.k ?? 1; }

  add(...s: Spec3[]): this { this.specs.push(...s); return this; }

  private ramp(m: Spec3['mat']): string[] | undefined {
    if (m === undefined) return undefined;
    if (Array.isArray(m)) return m.map(normHex);
    const r = this.dir.pal[m] ?? this.dir.pal[this.dir.palette.materials[m]];
    if (!r) throw new Error(`3D: unknown material ${JSON.stringify(m)}`);
    return r;
  }

  private face(r: string[], hi?: string): FaceRamp {
    const L = bandIndices(r.length, Math.max(3, this.dir.shading.bands)), n = L.length;
    const top = r[L[0]], left = r[L[Math.min(1, n - 1)]], right = r[L[Math.min(2, n - 1)]] ?? left;
    let h: string | undefined;
    if (hi) { const [name, idx] = hi.split('.'); h = this.dir.pal[name]?.[idx === undefined ? 0 : +idx]; if (!h) throw new Error(`3D: unknown colour token ${hi}`); }
    return [top, left, right, h];
  }

  /** Fine-voxel cells of one primitive (local coordinates). */
  private cells(s: Spec3): V3[] {
    const k = this.k, out: V3[] = [];
    const scan = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, inside: (x: number, y: number, z: number) => boolean) => {
      for (let z = Math.floor(z0 * k); z < Math.ceil(z1 * k); z++) for (let y = Math.floor(y0 * k); y < Math.ceil(y1 * k); y++)
        for (let x = Math.floor(x0 * k); x < Math.ceil(x1 * k); x++) if (inside((x + 0.5) / k, (y + 0.5) / k, (z + 0.5) / k)) out.push([x, y, z]);
    };
    const n = (v: number | undefined, name: string) => { if (typeof v !== 'number') throw new Error(`3D ${s.type}${s.name ? ` ${s.name}` : ''}: ${name} required`); return v; };
    switch (s.type) {
      case 'box': case 'slab': {
        const x = s.x ?? 0, y = s.y ?? 0, z = s.z ?? 0;
        scan(x, y, z, x + n(s.w, 'w'), y + n(s.d, 'd'), z + n(s.h, 'h'), () => true);
        break;
      }
      case 'ellipsoid': {
        const cx = n(s.cx, 'cx'), cy = n(s.cy, 'cy'), cz = n(s.cz, 'cz'), rx = n(s.rx, 'rx'), ry = s.ry ?? rx, rz = s.rz ?? rx;
        scan(cx - rx, cy - ry, cz - rz, cx + rx, cy + ry, cz + rz, (x, y, z) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1);
        break;
      }
      case 'capsule': {
        const a = s.a!, b = s.b!, r = n(s.r, 'r'), ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1;
        scan(Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.min(a[2], b[2]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, Math.max(a[2], b[2]) + r, (x, y, z) => {
          const t = Math.max(0, Math.min(1, ((x - a[0]) * ab[0] + (y - a[1]) * ab[1] + (z - a[2]) * ab[2]) / l2));
          return (x - a[0] - ab[0] * t) ** 2 + (y - a[1] - ab[1] * t) ** 2 + (z - a[2] - ab[2] * t) ** 2 <= r * r;
        });
        break;
      }
      case 'sdf': {
        const [x0, y0, z0, x1, y1, z1] = s.bbox ?? (() => { throw new Error('3D sdf: bbox required'); })();
        scan(x0, y0, z0, x1, y1, z1, (x, y, z) => s.fn!(x, y, z) <= 0);
        break;
      }
      default: throw new Error(`3D: ${s.type} is not a primitive`);
    }
    return out;
  }

  /** Transform fine cells by a node's translate / rotate / mirror. */
  private xform(cells: V3[], s: Spec3): V3[] {
    const k = this.k, [ox, oy] = (s.origin ?? [0, 0, 0]).map(v => v * k);
    let out = cells;
    if (s.mirror) out = out.map(([x, y, z]) => (s.mirror === 'x' ? [2 * ox - 1 - x, y, z] : [x, 2 * oy - 1 - y, z]) as V3);
    const rot = (((s.rotate ?? 0) % 360) + 360) % 360;
    if (rot % 90) throw new Error('3D: rotate must be a multiple of 90 (cubes renderer)');
    for (let r = 0; r < rot; r += 90) out = out.map(([x, y, z]) => [Math.round(ox - (y + 0.5 - oy) - 0.5), Math.round(oy + (x + 0.5 - ox) - 0.5), z] as V3);
    if (s.translate) { const [tx, ty, tz] = s.translate.map(v => Math.round(v * k)); out = out.map(([x, y, z]) => [x + tx, y + ty, z + tz] as V3); }
    return out;
  }

  /** Cells occupied by a spec (any type), in the parent's coordinates. */
  private occupancy(s: Spec3): V3[] {
    if (s.type === 'group' || s.type === 'union') return this.xform((s.children ?? s.shapes ?? []).flatMap(c => this.occupancy(c)), s);
    if (s.type === 'subtract' || s.type === 'intersect') {
      const [first, ...rest] = (s.shapes ?? []).map(c => new Map(this.occupancy(c).map(v => [key(v), v])));
      if (!first) return [];
      for (const m of rest) for (const kk of [...first.keys()]) if (s.type === 'subtract' ? m.has(kk) : !m.has(kk)) first.delete(kk);
      return this.xform([...first.values()], s);
    }
    return this.xform(this.cells(s), s);
  }

  /** Voxelise the scene (later specs paint over earlier ones; slabs only recolour or add). */
  voxels(): Vox {
    const vox: Vox = new Map();
    this.warnings = [];
    const walk = (s: Spec3, parents: Spec3[], inh: { ramp?: string[]; hi?: string }) => {
      const ramp = this.ramp(s.mat) ?? inh.ramp, hi = s.hi ?? inh.hi, label = s.name ?? s.type;
      if (s.type === 'group') { (s.children ?? []).forEach(c => walk(c, [s, ...parents], { ramp, hi })); return; }
      if (!ramp) throw new Error(`3D ${label}: needs mat`);
      let cells = this.occupancy(s);
      for (const p of parents) cells = this.xform(cells, { ...p, type: 'group' });
      const fr = this.face(ramp, hi);
      let clash = 0;
      for (const v of cells) {
        const kk = key(v), prev = vox.get(kk);
        if (s.type === 'slab' && !prev && !s.add) continue; // a slab recolours the surface it lies on
        if (prev && s.type !== 'slab' && prev.solid !== label && prev.ramp[0] !== fr[0]) clash++;
        vox.set(kk, { v, ramp: fr, solid: s.type === 'slab' && prev ? prev.solid : label });
      }
      if (clash) this.warnings.push(`${label} interpenetrates other solids (${clash} voxels): model surface decoration as a slab (R5)`);
    };
    for (const s of this.specs) walk(s, [], {});
    return vox;
  }

  lint(): string[] { this.voxels(); return [...this.warnings]; }

  /** Voxel model in the engine's `Voxels` form, rotated for a facing. */
  model(facing = 's'): Voxels {
    const vox = this.voxels(), m = new Voxels({ outlineColor: this.dir.outline, shadowColor: this.dir.shadow });
    const rot = FACING_ROT[facing];
    if (rot === undefined) throw new Error(`3D: facing ${facing} not supported by the cubes renderer (s, w, n, e)`);
    const cs = [...vox.values()];
    if (!cs.length) return m;
    // rotate about the footprint centre so the model stays in place
    const xs = cs.map(c => c.v[0]), ys = cs.map(c => c.v[1]);
    const cx = (Math.min(...xs) + Math.max(...xs) + 1) / 2, cy = (Math.min(...ys) + Math.max(...ys) + 1) / 2;
    for (const { v: [x, y, z], ramp } of cs) {
      let [px, py] = [x + 0.5 - cx, y + 0.5 - cy];
      for (let r = 0; r < rot; r += 90) [px, py] = [-py, px];
      m.set(Math.round(px + cx - 0.5), Math.round(py + cy - 0.5), z, ramp);
    }
    return m;
  }

  render(w: number, h: number, o: Render3DOptions, line?: (g: Grid) => Grid): Grid {
    const m = this.model(o.facing ?? 's');
    if (line) Object.assign(m.defaults, { applyLine: line });
    return m.render(w, h, { ox: o.ox, oy: o.oy, ss: o.ss, outline: o.outline, shadow: o.shadow, edgeLight: o.edgeLight });
  }
}
