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
import { Grid } from '../lib/grid.ts';
import { Voxels, type FaceRamp } from '../lib/voxel.ts';
import { camera, facingYaw, lightIn, toScreen } from '../views/camera.ts';
import { bandFor, project, rasterVoxels, smoothNormal, VoxelGrid, type VoxelRaster, type VoxelSet } from '../voxel/raster.ts';
import { voxCells, type VoxModel } from '../voxel/vox.ts';
import { dist2, parseColor } from '../lib/color.ts';
import { bandIndices } from './raster.ts';

/** Ramp holding the colour closest to `hex`. */
function nearestRamp(pal: Record<string, string[]>, hex: string): string {
  const [r, g, b] = parseColor(hex);
  let best = '', bd = Infinity;
  for (const [name, ramp] of Object.entries(pal)) for (const c of ramp) { const d = dist2(parseColor(c), r, g, b); if (d < bd) { bd = d; best = name; } }
  return best;
}

export type V3 = [number, number, number];

export interface Spec3 {
  type: 'box' | 'slab' | 'ellipsoid' | 'capsule' | 'sdf' | 'cells' | 'group' | 'union' | 'subtract' | 'intersect';
  /** cells: fine-voxel positions as they are (imported `.vox` models, hand-placed voxels). */
  cells?: V3[];
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
  /** raster renderer: `flat` lights cube faces, `toon` a smooth normal (organic forms). Inherited; default from the render. */
  shade?: 'flat' | 'toon';
  name?: string;
}

export interface Scene3DOptions {
  /** Voxels per model unit. */
  k?: number;
}

export interface Render3DOptions {
  /** cubes: screen position of the model origin (px). raster: screen position of the pivot (default `at`). */
  ox?: number;
  oy?: number;
  /** Facing name: `cubes` takes s, w, n, e; `raster` any of the 4/8/16 facings (and `yaw` on top). */
  facing?: string;
  /** `cubes` (artlab 4×4 iso stamps, default) or `raster` (any yaw and view, depth/normal buffers, toon shading). */
  renderer?: 'cubes' | 'raster';
  /** raster: view camera (default the direction's view; `fp` renders billboards). */
  view?: string;
  /** raster: extra yaw in degrees on top of the facing. */
  yaw?: number;
  /** raster: size per model unit (default 1 = the cubes size at k = 1: 2 px across, 2 px up per unit); k adds detail, not size. */
  scale?: number;
  /** raster: screen position of the pivot (default (ox, oy), else (w/2, 0.8·h)). */
  at?: [number, number];
  /** raster: model point (model units) the yaw turns about; default the footprint centre. Set it for animations. */
  pivot?: V3;
  /** raster: default shading for parts without `shade` (default `flat`). */
  shade?: 'flat' | 'toon';
  /** raster: toon normal radius in fine voxels (default 2). */
  smooth?: number;
  /** raster: inner lines (default from `line.inner`: none → none, selective → depth, all → parts). */
  inner?: 'none' | 'depth' | 'parts';
  innerDepth?: number;
  gain?: number;
  /** raster/billboard: camera elevation in degrees. */
  elevation?: number;
  ss?: number;
  outline?: boolean;
  /** Ground shadow (default true). */
  shadow?: boolean;
  /** raster: `blob` ellipse under the lower body (default) or the `footprint` of every column (boxy props). */
  shadowShape?: 'blob' | 'footprint';
  edgeLight?: boolean;
}

type Vox = Map<string, { v: V3; ramp: FaceRamp; solid: string; mat: string[]; part: string; shade?: 'flat' | 'toon' }>;
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
      case 'cells': for (const c of s.cells ?? []) out.push([Math.round(c[0]), Math.round(c[1]), Math.round(c[2])]); break;
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
    const walk = (s: Spec3, parents: Spec3[], inh: { ramp?: string[]; hi?: string; shade?: 'flat' | 'toon'; part?: string }) => {
      const ramp = this.ramp(s.mat) ?? inh.ramp, hi = s.hi ?? inh.hi, label = s.name ?? s.type, shade = s.shade ?? inh.shade;
      const part = s.name ?? inh.part ?? s.type;
      if (s.type === 'group') { (s.children ?? []).forEach(c => walk(c, [s, ...parents], { ramp, hi, shade, part: s.name ?? inh.part })); return; }
      if (!ramp) throw new Error(`3D ${label}: needs mat`);
      let cells = this.occupancy(s);
      for (const p of parents) cells = this.xform(cells, { ...p, type: 'group' });
      const fr = this.face(ramp, hi);
      let clash = 0;
      for (const v of cells) {
        const kk = key(v), prev = vox.get(kk);
        if (s.type === 'slab' && !prev && !s.add) continue; // a slab recolours the surface it lies on
        if (prev && s.type !== 'slab' && prev.solid !== label && prev.ramp[0] !== fr[0]) clash++;
        vox.set(kk, { v, ramp: fr, solid: s.type === 'slab' && prev ? prev.solid : label, mat: ramp, part, shade });
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

  /**
   * Add an imported `.vox` model: one `cells` spec per palette colour, each with the material `mats` maps its colour
   * index (or hex) to, else the direction ramp nearest that colour. `at` offsets it in fine voxels.
   */
  addVox(model: VoxModel, o: { mats?: Record<string, string>; at?: V3; name?: string; shade?: 'flat' | 'toon' } = {}): this {
    const at = o.at ?? [0, 0, 0];
    for (const g of voxCells(model)) {
      const mat = o.mats?.[g.index] ?? o.mats?.[g.color] ?? nearestRamp(this.dir.pal, g.color);
      this.add({ type: 'cells', name: o.name ?? `vox${g.index}`, mat, shade: o.shade, cells: g.cells.map(c => [c[0] + at[0], c[1] + at[1], c[2] + at[2]] as V3) });
    }
    return this;
  }

  /** The voxels as a render-ready set: material ramps, part names, per-cell shading (`fallback` for unshaded parts). */
  voxelSet(fallback: 'flat' | 'toon' = 'flat'): VoxelSet {
    const mats: string[][] = [], parts: string[] = [], mi = new Map<string, number>(), pi = new Map<string, number>();
    const cells = [...this.voxels().values()].map(c => {
      const mk = c.mat.join(',');
      if (!mi.has(mk)) { mi.set(mk, mats.length); mats.push(c.mat); }
      if (!pi.has(c.part)) { pi.set(c.part, parts.length); parts.push(c.part); }
      return { v: c.v, mat: mi.get(mk)!, part: pi.get(c.part)!, toon: (c.shade ?? fallback) === 'toon' };
    });
    if (mats.length > 255 || parts.length > 32000) throw new Error('3D: too many materials or parts');
    return { cells, mats, parts };
  }

  /** Raster render with its buffers (depth, part ids, normal map). */
  raster(w: number, h: number, o: Render3DOptions = {}, line?: (g: Grid) => Grid): VoxelRaster {
    const view = o.view ?? this.dir.camera.view, k = this.k;
    // scale is per model unit, so k adds detail without changing the size
    const cam = camera(view === 'fp' ? 'billboard' : view, { scale: (o.scale ?? 1) / k, frontRatio: this.dir.camera.oblique?.frontRatio, elevation: o.elevation });
    const inner = o.inner ?? (this.dir.line.inner === 'none' ? 'none' : this.dir.line.inner === 'all' ? 'parts' : 'depth');
    return rasterVoxels(this.voxelSet(o.shade), {
      // facings are screen directions: in iso the model's front (+y) turns to screen-down for `s` (grid-aligned at the diagonals)
      camera: cam, yaw: facingYaw(o.facing ?? 's') + (view === 'iso' ? -45 : 0) + (o.yaw ?? 0), w, h,
      at: o.at ?? (o.ox !== undefined && o.oy !== undefined ? [o.ox, o.oy] : undefined),
      pivot: o.pivot && [o.pivot[0] * k, o.pivot[1] * k, o.pivot[2] * k], ss: o.ss ?? 4, bands: this.dir.shading.bands, light: this.dir.camera.light,
      gain: o.gain, smooth: o.smooth, inner, innerDepth: o.innerDepth, ink: this.dir.outline,
      line: o.outline === false ? undefined : line, shadow: o.shadow === false ? null : this.dir.shadow, shadowShape: o.shadowShape,
    });
  }

  /**
   * Screen pixel of a model point (model units) under the same raster options — anchors for 3D assets (`hand`, `eye`)
   * that follow every facing and frame. Rounded to the pixel; `undefined` when the point is outside the frame.
   */
  screen(w: number, h: number, o: Render3DOptions, p: V3): [number, number] | undefined {
    const view = o.view ?? this.dir.camera.view, k = this.k;
    const cam = camera(view === 'fp' ? 'billboard' : view, { scale: (o.scale ?? 1) / k, frontRatio: this.dir.camera.oblique?.frontRatio, elevation: o.elevation });
    const pivot: V3 = o.pivot ? [o.pivot[0] * k, o.pivot[1] * k, o.pivot[2] * k] : new VoxelGrid(this.voxelSet()).pivot();
    const at = o.at ?? (o.ox !== undefined && o.oy !== undefined ? [o.ox, o.oy] : [w / 2, Math.round(h * 0.8)]) as [number, number];
    const [x, y] = project(cam, facingYaw(o.facing ?? 's') + (view === 'iso' ? -45 : 0) + (o.yaw ?? 0), pivot, at, [p[0] * k, p[1] * k, p[2] * k]);
    const px: [number, number] = [Math.floor(x), Math.floor(y)];
    return px[0] >= 0 && px[1] >= 0 && px[0] < w && px[1] < h ? px : undefined;
  }

  render(w: number, h: number, o: Render3DOptions = {}, line?: (g: Grid) => Grid): Grid {
    if (o.renderer === 'raster') {
      const r = this.raster(w, h, o, line);
      r.grid.normal = r.normal;
      return r.grid;
    }
    const m = this.model(o.facing ?? 's');
    if (line) Object.assign(m.defaults, { applyLine: line });
    return m.render(w, h, { ox: o.ox ?? 0, oy: o.oy ?? 0, ss: o.ss, outline: o.outline, shadow: o.shadow, edgeLight: o.edgeLight });
  }

  /**
   * Sprite-stack slices (view `stack`): one top-down image per voxel layer, bottom first, `scale` px per voxel, lit
   * from above with the same normals the raster renderer uses (toon parts round off), each outlined with the
   * direction's line (`outline: false` to skip). Frame `i` of a stack asset is
   * slice `i`; the runtime draws them rotated and stepped up (`StackSprite`).
   */
  slices(w: number, h: number, o: { scale?: number; shade?: 'flat' | 'toon'; smooth?: number; gain?: number; outline?: boolean; line?: (g: Grid) => Grid } = {}): Grid[] {
    const set = this.voxelSet(o.shade), s = o.scale ?? 1;
    if (!set.cells.length) return [];
    const g = new VoxelGrid(set), cam = camera('topdown'), Ls = toScreen(cam, lightIn(cam, this.dir.camera.light));
    const levels = set.mats.map(m => bandIndices(m.length, this.dir.shading.bands)), [cx, cy] = g.pivot();
    const out: Grid[] = [];
    for (let z = g.z0; z < g.z0 + g.nz; z++) {
      const img = new Grid(w, h);
      for (const c of set.cells) {
        if (c.v[2] !== z) continue;
        const n = c.toon ? smoothNormal(g, c.v, o.smooth ?? 2) ?? [0, 0, 1] : [0, 0, 1] as V3;
        const col = set.mats[c.mat][bandFor(toScreen(cam, n), Ls, levels[c.mat], o.gain ?? 1.4)];
        img.fill(Math.round(w / 2 + (c.v[0] - cx) * s), Math.round(h / 2 + (c.v[1] - cy) * s), Math.max(1, Math.round(s)), Math.max(1, Math.round(s)), col);
      }
      // each slice carries the direction's line: stacked, the lines read as the object's contour at every angle
      out.push(o.outline !== false && o.line ? o.line(img) : img);
    }
    return out;
  }
}
