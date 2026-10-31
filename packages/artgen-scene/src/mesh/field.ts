/**
 * The distance field of a 3D-mode scene (docs/MESHES.md §3): the same solids `Scene3D.voxels()` walks (a primitive, or a
 * `union` / `subtract` / `intersect` node as one solid; a `group` hands its transform, material, part and shade to its
 * children), each as a signed distance function in model units (≤ 0 inside). Geometry is the minimum over the solids that
 * add volume (every solid but a slab without `add`); the colour at a surface point follows the voxel rules: the last solid
 * in walk order that holds the point half a voxel under the surface paints it.
 */
import { normHex } from 'artgen-primitives/lib/color.ts';
import type { DirContext } from '../direction.ts';
import type { Scene3D, Spec3, V3 } from '../t2/scene3d.ts';

export type Sdf = (x: number, y: number, z: number) => number;

/** One solid of the scene, in walk order. */
export interface Solid {
  name: string;
  sdf: Sdf;
  /** Adds volume (false for a slab without `add`, which only recolours). */
  geometry: boolean;
  /** A slab: paints what its box overlaps. */
  slab: boolean;
  ramp: string[];
  /** The ramp's name in the direction, when the spec named one (roughness and metal follow it). */
  role?: string;
  part: string;
  shade?: 'flat' | 'toon';
  grain?: number;
  rough?: number;
  metal?: number;
}

export interface SceneField {
  solids: Solid[];
  /** Voxels per model unit (the scene's `k`): the colour probe steps half a voxel inside. */
  k: number;
  /** Geometry distance at a point (model units). */
  sdf: Sdf;
  /** Outward unit normal at a point (the field's gradient; `fallback` where it vanishes). */
  normal(x: number, y: number, z: number, fallback?: V3): V3;
  /** The solid that colours the surface at `p` with outward normal `n`. */
  paint(p: V3, n: V3): Solid;
  /** Model-unit box of the voxels, [x0, y0, z0, x1, y1, z1]; undefined for an empty scene. */
  bounds?: [number, number, number, number, number, number];
}

/** The node transforms of `Scene3D.xform`, read as continuous maps (model units). */
type Xf = Pick<Spec3, 'translate' | 'rotate' | 'mirror' | 'origin'>;

/** Map a point back through one node's transform (the voxel order is mirror, quarter turns, translate). */
function invert(s: Xf, k: number, p: V3): V3 {
  let [x, y, z] = p;
  if (s.translate) { x -= Math.round(s.translate[0] * k) / k; y -= Math.round(s.translate[1] * k) / k; z -= Math.round(s.translate[2] * k) / k; }
  const [ox, oy] = s.origin ?? [0, 0, 0], rot = ((((s.rotate ?? 0) % 360) + 360) % 360) / 90;
  // the voxels round a quarter turn about a half-voxel origin half a voxel up (`Math.round`): so does the field
  const f = ((((ox + oy) * k) % 1) + 1) % 1, up = Math.abs(f - 0.5) < 1e-9 ? 0.5 / k : 0;
  for (let r = 0; r < rot; r++) [x, y] = [ox + (y - up - oy), oy - (x - up - ox)];
  if (s.mirror === 'x') x = 2 * ox - x;
  else if (s.mirror === 'y') y = 2 * oy - y;
  return [x, y, z];
}

const boxSdf = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Sdf => {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, cz = (z0 + z1) / 2, hx = Math.abs(x1 - x0) / 2, hy = Math.abs(y1 - y0) / 2, hz = Math.abs(z1 - z0) / 2;
  return (x, y, z) => {
    const qx = Math.abs(x - cx) - hx, qy = Math.abs(y - cy) - hy, qz = Math.abs(z - cz) - hz;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0);
  };
};

/** Distance to a set of fine voxels (imported `.vox` cells): the nearest cube of the other state within two cells. */
function cellsSdf(cells: V3[], k: number): Sdf {
  if (!cells.length) return () => Infinity;
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (const [x, y, z] of cells) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); z0 = Math.min(z0, z); x1 = Math.max(x1, x); y1 = Math.max(y1, y); z1 = Math.max(z1, z); }
  const nx = x1 - x0 + 1, ny = y1 - y0 + 1, nz = z1 - z0 + 1, occ = new Uint8Array(nx * ny * nz);
  for (const [x, y, z] of cells) occ[((z - z0) * ny + (y - y0)) * nx + (x - x0)] = 1;
  const at = (i: number, j: number, l: number) => i >= x0 && j >= y0 && l >= z0 && i <= x1 && j <= y1 && l <= z1 && occ[((l - z0) * ny + (j - y0)) * nx + (i - x0)] === 1;
  const outer = boxSdf(x0, y0, z0, x1 + 1, y1 + 1, z1 + 1), R = 2;
  return (px, py, pz) => {
    const x = px * k, y = py * k, z = pz * k, far = outer(x, y, z);
    if (far > R) return far / k;
    const i = Math.floor(x), j = Math.floor(y), l = Math.floor(z), inside = at(i, j, l);
    let best = R + 1;
    for (let c = -R; c <= R; c++) for (let b = -R; b <= R; b++) for (let a = -R; a <= R; a++) {
      if (at(i + a, j + b, l + c) === inside) continue;
      const dx = Math.max(i + a - x, 0, x - (i + a + 1)), dy = Math.max(j + b - y, 0, y - (j + b + 1)), dz = Math.max(l + c - z, 0, z - (l + c + 1));
      best = Math.min(best, Math.hypot(dx, dy, dz));
    }
    return (inside ? -best : best) / k;
  };
}

const need = (s: Spec3, v: number | undefined, name: string): number => {
  if (typeof v !== 'number') throw new Error(`3D ${s.type}${s.name ? ` ${s.name}` : ''}: ${name} required`);
  return v;
};

/** The distance function of one spec in its parent's coordinates (its own transform included). */
function specSdf(s: Spec3, k: number): Sdf {
  let local: Sdf;
  switch (s.type) {
    case 'box': case 'slab': {
      const x = s.x ?? 0, y = s.y ?? 0, z = s.z ?? 0;
      local = boxSdf(x, y, z, x + need(s, s.w, 'w'), y + need(s, s.d, 'd'), z + need(s, s.h, 'h'));
      break;
    }
    case 'ellipsoid': {
      const cx = need(s, s.cx, 'cx'), cy = need(s, s.cy, 'cy'), cz = need(s, s.cz, 'cz'), rx = need(s, s.rx, 'rx'), ry = s.ry ?? rx, rz = s.rz ?? rx;
      local = (x, y, z) => {
        const ax = (x - cx) / rx, ay = (y - cy) / ry, az = (z - cz) / rz, k0 = Math.hypot(ax, ay, az), k1 = Math.hypot(ax / rx, ay / ry, az / rz);
        return k1 < 1e-12 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
      };
      break;
    }
    case 'capsule': {
      const a = s.a!, b = s.b!, r = need(s, s.r, 'r'), ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1;
      local = (x, y, z) => {
        const t = Math.max(0, Math.min(1, ((x - a[0]) * ab[0] + (y - a[1]) * ab[1] + (z - a[2]) * ab[2]) / l2));
        return Math.hypot(x - a[0] - ab[0] * t, y - a[1] - ab[1] * t, z - a[2] - ab[2] * t) - r;
      };
      break;
    }
    case 'sdf': {
      if (!s.bbox) throw new Error('3D sdf: bbox required');
      const fn = s.fn!, clip = boxSdf(...s.bbox);
      local = (x, y, z) => Math.max(fn(x, y, z), clip(x, y, z));
      break;
    }
    case 'cells': local = cellsSdf((s.cells ?? []).map(c => [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])] as V3), k); break;
    case 'group': case 'union': {
      const fs = (s.children ?? s.shapes ?? []).map(c => specSdf(c, k));
      local = (x, y, z) => { let d = Infinity; for (const f of fs) d = Math.min(d, f(x, y, z)); return d; };
      break;
    }
    case 'subtract': case 'intersect': {
      const [first, ...rest] = (s.shapes ?? []).map(c => specSdf(c, k));
      if (!first) local = () => Infinity;
      else if (s.type === 'subtract') local = (x, y, z) => { let d = first(x, y, z); for (const f of rest) d = Math.max(d, -f(x, y, z)); return d; };
      else local = (x, y, z) => { let d = first(x, y, z); for (const f of rest) d = Math.max(d, f(x, y, z)); return d; };
      break;
    }
    default: throw new Error(`3D: unknown spec type ${JSON.stringify((s as Spec3).type)}`);
  }
  if (!s.translate && !s.rotate && !s.mirror) return local;
  return (x, y, z) => { const q = invert(s, k, [x, y, z]); return local(q[0], q[1], q[2]); };
}

/** A spec's material as a ramp and, when it names one, the ramp's name (Scene3D's own lookup). */
function material(dir: DirContext, m: Spec3['mat']): { ramp: string[]; role?: string } | undefined {
  if (m === undefined) return undefined;
  if (Array.isArray(m)) return { ramp: m.map(normHex) };
  const role = dir.pal[m] ? m : dir.palette.materials[m], ramp = role ? dir.pal[role] : undefined;
  if (!ramp) throw new Error(`3D: unknown material ${JSON.stringify(m)}`);
  return { ramp, role };
}

/** The scene's solids as distance functions, with the geometry and paint queries. */
export function sceneField(scene: Scene3D): SceneField {
  const k = scene.k, solids: Solid[] = [];
  type Inh = { mat?: { ramp: string[]; role?: string }; shade?: 'flat' | 'toon'; part?: string; grain?: number; rough?: number; metal?: number };
  const walk = (s: Spec3, parents: Spec3[], inh: Inh) => {
    const mat = material(scene.dir, s.mat) ?? inh.mat, shade = s.shade ?? inh.shade, label = s.name ?? s.type;
    const grain = s.grain ?? inh.grain, rough = s.rough ?? inh.rough, metal = s.metal ?? inh.metal;
    if (s.type === 'group') { (s.children ?? []).forEach(c => walk(c, [s, ...parents], { mat, shade, part: s.name ?? inh.part, grain, rough, metal })); return; }
    if (!mat) throw new Error(`3D ${label}: needs mat`);
    const own = specSdf(s, k), chain = parents.filter(p => p.translate || p.rotate || p.mirror).reverse();
    const sdf: Sdf = chain.length ? (x, y, z) => { let q: V3 = [x, y, z]; for (const p of chain) q = invert(p, k, q); return own(q[0], q[1], q[2]); } : own;
    solids.push({ name: label, sdf, geometry: s.type !== 'slab' || s.add === true, slab: s.type === 'slab', ramp: mat.ramp, role: mat.role, part: s.name ?? inh.part ?? s.type, shade, grain, rough, metal });
  };
  for (const s of scene.specs) walk(s, [], {});
  const geo = solids.filter(s => s.geometry);
  const sdf: Sdf = (x, y, z) => { let d = Infinity; for (const s of geo) { const v = s.sdf(x, y, z); if (v < d) d = v; } return d; };
  const set = scene.voxelSet();
  let bounds: SceneField['bounds'];
  if (set.cells.length) {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const c of set.cells) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], c.v[a]); hi[a] = Math.max(hi[a], c.v[a] + 1); }
    bounds = [lo[0] / k, lo[1] / k, lo[2] / k, hi[0] / k, hi[1] / k, hi[2] / k];
  }
  const normal = (x: number, y: number, z: number, fallback: V3 = [0, 0, 1]): V3 => {
    const e = 0.02 / k, gx = sdf(x + e, y, z) - sdf(x - e, y, z), gy = sdf(x, y + e, z) - sdf(x, y - e, z), gz = sdf(x, y, z + e) - sdf(x, y, z - e), l = Math.hypot(gx, gy, gz);
    return l > 1e-12 && Number.isFinite(l) ? [gx / l, gy / l, gz / l] : fallback;
  };
  const paint = (p: V3, n: V3): Solid => {
    const d = 0.5 / k, x = p[0] - n[0] * d, y = p[1] - n[1] * d, z = p[2] - n[2] * d;
    let hit: Solid | undefined, near: Solid = solids[0], nd = Infinity;
    for (const s of solids) {
      const v = s.sdf(x, y, z);
      if (v <= 0) hit = s;
      if (s.geometry && v < nd) { nd = v; near = s; }
    }
    return hit ?? near;
  };
  return { solids, k, sdf, normal, paint, bounds };
}
