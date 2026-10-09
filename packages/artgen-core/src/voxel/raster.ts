/**
 * Voxel `raster` renderer (SPEC §7; PLAN P6a): rays through a dense voxel grid at `ss` samples per pixel (a z-buffer
 * by construction), for any yaw and any view camera. Every sample keeps its part, material, depth and normal; the
 * samples vote per pixel (mode downsample, R3), so the output stays palette-exact. Buffers kept at final resolution:
 * colour, depth, part id and normal — the normal buffer is the sprite's normal map (P6a/P6d lit sprites), depth and
 * part ids draw the inner lines ("internal-resolution outlines": lines come from the geometry buffers, not from the
 * colours), and the outer line is the direction's line pass.
 *
 * Shading per part: `flat` lights each cube face (the `cubes` look, now at any yaw), `toon` lights a smooth normal
 * estimated from the occupancy around the surface voxel (radius `smooth`), banded to `direction.shading.bands` — the
 * fix for the speckled stair-steps of organic voxel forms (artlab E4).
 */
import { Grid } from '../lib/grid.ts';
import { bandIndices } from '../t2/raster.ts';
import { cross3, dot3, lightIn, toScreen, type Camera, type V3 } from '../views/camera.ts';

export interface VoxelCell { v: V3; mat: number; part: number; toon: boolean }

/** A voxel model ready to render: integer cells, material ramps (lightest first) and part names. */
export interface VoxelSet { cells: VoxelCell[]; mats: string[][]; parts: string[] }

export interface VoxelRasterOptions {
  camera: Camera;
  /** Model rotation about the vertical axis, degrees (facing yaw). */
  yaw?: number;
  w: number;
  h: number;
  /** Screen pixel of the pivot (default: (w/2, 0.8·h)). */
  at?: [number, number];
  /** Model point the yaw turns about and `at` pins to the screen (default: footprint centre at z = 0). */
  pivot?: V3;
  /** Samples per pixel per axis (default 4). */
  ss?: number;
  bands: number;
  /** Screen-space light [x right, y down, z toward the viewer]. */
  light: readonly number[];
  /** Shading gain (default 1.4). */
  gain?: number;
  /** Toon normal radius in voxels (default 2). */
  smooth?: number;
  /** Inner lines from the buffers: `none`, `depth` (depth steps ≥ `innerDepth` voxels), `parts` (also part borders). */
  inner?: 'none' | 'depth' | 'parts';
  innerDepth?: number;
  ink: string;
  /** Outer line pass (the direction's). */
  line?: (g: Grid) => Grid;
  /** Ground shadow colour (rgba) or null. */
  shadow?: string | null;
  /**
   * `blob` (default): an ellipse under the lower body's footprint (feet and legs, not a raised sword); `footprint`: every
   * occupied column projected to the ground (boxy props).
   */
  shadowShape?: 'blob' | 'footprint';
}

export interface VoxelRaster {
  grid: Grid;
  /** Per pixel: depth toward the viewer in voxel units (NaN = empty). */
  depth: Float32Array;
  /** Per pixel: part index (-1 = empty). */
  part: Int16Array;
  /** Normal map (RGB = screen normal, OpenGL convention: x right, y up, z toward the viewer). */
  normal: Grid;
}

const EMPTY = -1;

export class VoxelGrid {
  readonly x0: number; readonly y0: number; readonly z0: number;
  readonly nx: number; readonly ny: number; readonly nz: number;
  /** Cell index + 1 per voxel (0 = empty). */
  readonly occ: Int32Array;
  readonly set: VoxelSet;

  constructor(set: VoxelSet) {
    this.set = set;
    const xs = set.cells.map(c => c.v[0]), ys = set.cells.map(c => c.v[1]), zs = set.cells.map(c => c.v[2]);
    const lo = (a: number[]) => (a.length ? Math.min(...a) : 0), hi = (a: number[]) => (a.length ? Math.max(...a) : 0);
    this.x0 = lo(xs); this.y0 = lo(ys); this.z0 = lo(zs);
    this.nx = hi(xs) - this.x0 + 1; this.ny = hi(ys) - this.y0 + 1; this.nz = hi(zs) - this.z0 + 1;
    this.occ = new Int32Array(this.nx * this.ny * this.nz);
    set.cells.forEach((c, i) => { this.occ[this.index(c.v[0], c.v[1], c.v[2])] = i + 1; });
  }

  index(x: number, y: number, z: number): number { return ((z - this.z0) * this.ny + (y - this.y0)) * this.nx + (x - this.x0); }

  /** Cell index at a voxel, or -1. */
  at(x: number, y: number, z: number): number {
    if (x < this.x0 || y < this.y0 || z < this.z0 || x >= this.x0 + this.nx || y >= this.y0 + this.ny || z >= this.z0 + this.nz) return EMPTY;
    return this.occ[this.index(x, y, z)] - 1;
  }

  get empty(): boolean { return !this.set.cells.length; }

  /** Footprint centre at z = 0. */
  pivot(): V3 {
    if (this.empty) return [0, 0, 0];
    return [this.x0 + this.nx / 2, this.y0 + this.ny / 2, 0];
  }
}

const rotZ = (v: V3, deg: number): V3 => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
};

function inv3(m: V3[]): V3[] {
  const [a, b, c] = m, det = dot3(a, cross3(b, c));
  if (Math.abs(det) < 1e-12) throw new Error('voxel raster: degenerate camera');
  const r0 = cross3(b, c), r1 = cross3(c, a), r2 = cross3(a, b);
  // inverse = transpose of [r0 r1 r2] / det
  return [[r0[0] / det, r1[0] / det, r2[0] / det], [r0[1] / det, r1[1] / det, r2[1] / det], [r0[2] / det, r1[2] / det, r2[2] / det]];
}

export interface RayHit { cell: number; face: V3; depth: number }

/** Ray caster over a voxel grid for one camera + yaw: screen point (px relative to the pivot) → first voxel hit. */
export class VoxelCaster {
  private readonly A: V3[];
  /** Ray direction into the scene and toward the viewer, model frame. */
  readonly into: V3;
  readonly toward: V3;
  private readonly far: number;
  readonly g: VoxelGrid;
  readonly cam: Camera;
  readonly yaw: number;
  readonly pivot: V3;
  constructor(g: VoxelGrid, cam: Camera, yaw: number, pivot: V3) {
    this.g = g; this.cam = cam; this.yaw = yaw; this.pivot = pivot;
    this.A = inv3([cam.M[0], cam.M[1], cam.dv]);
    let n = cross3(cam.M[0], cam.M[1]);
    const l = Math.hypot(...n);
    n = [n[0] / l, n[1] / l, n[2] / l];
    if (dot3(n, cam.dv) < 0) n = [-n[0], -n[1], -n[2]];
    this.toward = rotZ(n, -yaw);
    this.into = [-this.toward[0], -this.toward[1], -this.toward[2]];
    this.far = Math.hypot(g.nx, g.ny, g.nz) + Math.hypot(g.x0 - pivot[0], g.y0 - pivot[1], g.z0 - pivot[2]) + Math.hypot(g.nx, g.ny, g.nz) + 4;
  }

  /** Model-frame point on the screen point's ray (on the depth-0 plane). */
  origin(wx: number, wy: number): V3 {
    const A = this.A, q: V3 = [A[0][0] * wx + A[0][1] * wy, A[1][0] * wx + A[1][1] * wy, A[2][0] * wx + A[2][1] * wy];
    const p = rotZ(q, -this.yaw);
    return [p[0] + this.pivot[0], p[1] + this.pivot[1], p[2] + this.pivot[2]];
  }

  cast(wx: number, wy: number): RayHit | null {
    const g = this.g;
    if (g.empty) return null;
    const P = this.origin(wx, wy), d = this.into, T = this.far;
    const O: V3 = [P[0] + this.toward[0] * T, P[1] + this.toward[1] * T, P[2] + this.toward[2] * T];
    const lo = [g.x0, g.y0, g.z0], hi = [g.x0 + g.nx, g.y0 + g.ny, g.z0 + g.nz];
    let t0 = -Infinity, t1 = Infinity, axis = 0;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-12) { if (O[a] < lo[a] || O[a] >= hi[a]) return null; continue; }
      let ta = (lo[a] - O[a]) / d[a], tb = (hi[a] - O[a]) / d[a];
      if (ta > tb) [ta, tb] = [tb, ta];
      if (ta > t0) { t0 = ta; axis = a; }
      if (tb < t1) t1 = tb;
    }
    if (t0 > t1 || t1 < 0) return null;
    let s = Math.max(0, t0) + 1e-7;
    const i = [0, 1, 2].map(a => Math.min(hi[a] - 1, Math.max(lo[a], Math.floor(O[a] + d[a] * s))));
    const step = d.map(v => (v > 0 ? 1 : v < 0 ? -1 : 0));
    const tMax = [0, 1, 2].map(a => (step[a] === 0 ? Infinity : (i[a] + (step[a] > 0 ? 1 : 0) - O[a]) / d[a]));
    const tDelta = d.map(v => (v === 0 ? Infinity : Math.abs(1 / v)));
    for (let guard = 0; guard < 4096; guard++) {
      const c = g.at(i[0], i[1], i[2]);
      if (c >= 0) {
        const face: V3 = [0, 0, 0];
        face[axis] = -step[axis];
        return { cell: c, face, depth: T - s };
      }
      const a = tMax[0] < tMax[1] ? (tMax[0] < tMax[2] ? 0 : 2) : tMax[1] < tMax[2] ? 1 : 2;
      s = tMax[a]; i[a] += step[a]; tMax[a] += tDelta[a]; axis = a;
      if (i[a] < lo[a] || i[a] >= hi[a]) return null;
    }
    return null;
  }

  /** Does the ray through a screen point hit the ground (z = 0) under an occupied column? */
  groundHit(wx: number, wy: number, columns: Set<number>): boolean {
    const P = this.origin(wx, wy), d = this.into;
    if (Math.abs(d[2]) < 1e-9) return false;
    // the origin is on the ray; walk to z = 0
    const s = -P[2] / d[2], x = Math.floor(P[0] + d[0] * s), y = Math.floor(P[1] + d[1] * s);
    return columns.has(x * 65536 + y);
  }
}

/** Outward smooth normal of a surface voxel from the empty cells around it (model frame). */
export function smoothNormal(g: VoxelGrid, v: V3, r: number): V3 | null {
  let x = 0, y = 0, z = 0;
  for (let k = -r; k <= r; k++) for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    const d2 = i * i + j * j + k * k;
    if (!d2 || d2 > r * r + r) continue;
    if (g.at(v[0] + i, v[1] + j, v[2] + k) < 0) { const w = 1 / Math.sqrt(d2); x += i * w; y += j * w; z += k * w; }
  }
  const l = Math.hypot(x, y, z);
  return l < 1e-6 ? null : [x / l, y / l, z / l];
}

/** Screen position of a model point (pivot / yaw / camera as the raster uses them). */
export function project(cam: Camera, yaw: number, pivot: V3, at: [number, number], p: V3): [number, number] {
  const q = rotZ([p[0] - pivot[0], p[1] - pivot[1], p[2] - pivot[2]], yaw);
  return [at[0] + dot3(cam.M[0], q), at[1] + dot3(cam.M[1], q)];
}

/**
 * Ramp index for a screen-space normal under screen-space light `Ls` (the 2D `normal` shading formula); `ref` is the
 * light level that takes the middle band (default `Ls[2]`: a surface facing the viewer).
 */
export function bandFor(ns: V3, Ls: V3, lv: number[], gain = 1.4, ref = Ls[2]): number {
  const nl = lv.length, mid = (nl - 1) >> 1, pos = Math.round(mid - (dot3(ns, Ls) - ref) * gain * (nl - 1));
  return lv[Math.max(0, Math.min(nl - 1, pos))];
}

/** Render a voxel set: colour + depth + part + normal buffers at final resolution. */
export function rasterVoxels(set: VoxelSet, o: VoxelRasterOptions): VoxelRaster {
  const { w, h, camera: cam } = o, ss = o.ss ?? 4, yaw = o.yaw ?? 0, g = new VoxelGrid(set);
  const pivot = o.pivot ?? g.pivot(), at = o.at ?? [w / 2, Math.round(h * 0.8)];
  const caster = new VoxelCaster(g, cam, yaw, pivot), L = lightIn(cam, o.light), Ls = toScreen(cam, L), ref = cam.ref ? dot3(toScreen(cam, cam.ref), Ls) : Ls[2];
  const gain = o.gain ?? 1.4, smoothR = o.smooth ?? 2, levels = set.mats.map(m => bandIndices(m.length, o.bands));
  const normals = new Map<number, V3>();
  const W = w * ss, H = h * ss, N = W * H;
  const sKey = new Int32Array(N).fill(-1), sDepth = new Float32Array(N), sNorm = new Float32Array(N * 3);
  for (let sy = 0; sy < H; sy++) for (let sx = 0; sx < W; sx++) {
    const hit = caster.cast((sx + 0.5) / ss - at[0], (sy + 0.5) / ss - at[1]);
    if (!hit) continue;
    const c = set.cells[hit.cell];
    let n: V3 = hit.face;
    if (c.toon) {
      let sn = normals.get(hit.cell);
      if (!sn) { sn = smoothNormal(g, c.v, smoothR) ?? hit.face; normals.set(hit.cell, sn); }
      n = sn;
    }
    const ns = toScreen(cam, rotZ(n, yaw)), band = bandFor(ns, Ls, levels[c.mat], gain, ref);
    const p = sy * W + sx;
    sKey[p] = (c.part * 256 + c.mat) * 256 + band;
    sDepth[p] = hit.depth;
    sNorm.set(ns, p * 3);
  }
  // vote per pixel
  const grid = new Grid(w, h), depth = new Float32Array(w * h).fill(NaN), part = new Int16Array(w * h).fill(-1), nrm = new Float32Array(w * h * 3);
  const half = (ss * ss) / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const counts = new Map<number, number>();
    let empty = 0;
    for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) {
      const k = sKey[(y * ss + j) * W + x * ss + i];
      if (k < 0) empty++; else counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    if (empty > half) continue;
    let best = -1, bn = 0;
    for (const [k, n] of counts) if (n > bn || (n === bn && k > best)) { best = k; bn = n; }
    let dsum = 0, nx = 0, ny = 0, nz = 0;
    for (let j = 0; j < ss; j++) for (let i = 0; i < ss; i++) {
      const p = (y * ss + j) * W + x * ss + i;
      if (sKey[p] !== best) continue;
      dsum += sDepth[p]; nx += sNorm[p * 3]; ny += sNorm[p * 3 + 1]; nz += sNorm[p * 3 + 2];
    }
    const q = y * w + x, band = best & 255, mat = (best >> 8) & 255, pt = best >> 16, nl = Math.hypot(nx, ny, nz) || 1;
    grid.set(x, y, set.mats[mat][band]);
    depth[q] = dsum / bn; part[q] = pt;
    nrm[q * 3] = nx / nl; nrm[q * 3 + 1] = ny / nl; nrm[q * 3 + 2] = nz / nl;
  }
  // inner lines from depth / part buffers: the farther pixel of a step gets the ink, so the nearer form keeps its edge
  let out = grid;
  if ((o.inner ?? 'depth') !== 'none') {
    const thr = o.innerDepth ?? 3, inked: number[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const q = y * w + x;
      if (part[q] < 0) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const r = Y * w + X;
        if (part[r] < 0) continue;
        const step = depth[r] - depth[q];
        if (step >= thr || (o.inner === 'parts' && part[r] !== part[q] && step > 0.5)) { inked.push(q); break; }
      }
    }
    out = grid.clone();
    for (const q of inked) out.set(q % w, (q / w) | 0, o.ink);
  }
  const filled = (g2: Grid, x: number, y: number) => g2.alpha(x, y) > 0;
  if (o.line) out = o.line(out);
  // normal map: geometry pixels from the buffer; outline pixels face the viewer
  const normal = new Grid(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!filled(out, x, y)) continue;
    const q = y * w + x, i = q * 4;
    const [nx, ny, nz] = part[q] >= 0 ? [nrm[q * 3], nrm[q * 3 + 1], nrm[q * 3 + 2]] : [0, 0, 1];
    normal.d[i] = Math.round((nx * 0.5 + 0.5) * 255); normal.d[i + 1] = Math.round((-ny * 0.5 + 0.5) * 255);
    normal.d[i + 2] = Math.round((nz * 0.5 + 0.5) * 255); normal.d[i + 3] = 255;
  }
  if (o.shadow) {
    const sh = new Grid(w, h);
    if (o.shadowShape === 'footprint') {
      const cols = new Set<number>();
      for (const c of set.cells) cols.add(c.v[0] * 65536 + c.v[1]);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (caster.groundHit(x + 0.5 - at[0], y + 0.5 - at[1], cols)) sh.set(x, y, o.shadow);
    } else {
      // ground points of the lower quarter of the model, projected; the ellipse spans their spread
      const zTop = g.z0 + Math.max(1, Math.ceil(g.nz / 4)), pts: [number, number][] = [];
      for (const c of set.cells) if (c.v[2] < zTop) pts.push(project(cam, yaw, pivot, at, [c.v[0] + 0.5, c.v[1] + 0.5, 0]));
      // a camera that doesn't see the ground plane (side view) casts no ground shadow
      const sees = Math.abs(cam.M[1][0]) + Math.abs(cam.M[1][1]) > 1e-6;
      if (pts.length && sees) {
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
        const rx = Math.max(2, (Math.max(...xs) - Math.min(...xs)) / 2 + 1), flat = Math.abs(cam.M[1][1]) / Math.max(1e-6, Math.abs(cam.M[0][0]) + Math.abs(cam.M[0][1]));
        const ry = Math.max(1, Math.max((Math.max(...ys) - Math.min(...ys)) / 2 + 0.5, rx * Math.min(0.5, flat || 0.5)));
        for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++)
          if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) sh.set(x, y, o.shadow);
      }
    }
    out = sh.stamp(out);
  }
  return { grid: out, depth, part, normal };
}
