/**
 * Voxelising outside meshes (docs/MESHES.md §10, plan §8b). Triangles (artgen's frame, metres) are scaled to voxels;
 * every voxel a triangle overlaps (the separating-axis test) is surface, the outside is flood-filled from a padded
 * border, and what is neither is solid, so a closed mesh comes out filled and an open one as its shell. A surface voxel
 * takes the colour of its nearest triangle at the nearest point; a solid voxel the colour of its nearest surface voxel.
 */
import type { V3 } from '../t2/scene3d.ts';
import { triangleColor, type GlbTriangles } from './gltf.ts';

export interface VoxelizeOptions {
  /** Voxels per metre. */
  perMetre: number;
  /** Largest side, voxels (default 256, the `.vox` limit). */
  max?: number;
}

export interface Voxelized {
  size: V3;
  /** [x, y, z] voxels from 0, with their sRGB colour. */
  cells: { v: V3; rgb: [number, number, number] }[];
  /** Metres per voxel. */
  metresPerVoxel: number;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Does a triangle overlap the box centred at `c` with half-size `h` (Akenine-Möller's separating-axis test)? */
export function triBoxOverlap(c: V3, h: number, a: V3, b: V3, d: V3): boolean {
  const v0 = sub(a, c), v1 = sub(b, c), v2 = sub(d, c), e = [sub(v1, v0), sub(v2, v1), sub(v0, v2)];
  for (const ed of e) for (let ax = 0; ax < 3; ax++) {
    const axis: V3 = cross([ax === 0 ? 1 : 0, ax === 1 ? 1 : 0, ax === 2 ? 1 : 0], ed);
    if (Math.abs(axis[0]) + Math.abs(axis[1]) + Math.abs(axis[2]) < 1e-12) continue;
    const p0 = dot(v0, axis), p1 = dot(v1, axis), p2 = dot(v2, axis), r = h * (Math.abs(axis[0]) + Math.abs(axis[1]) + Math.abs(axis[2]));
    if (Math.min(p0, p1, p2) > r || Math.max(p0, p1, p2) < -r) return false;
  }
  for (let ax = 0; ax < 3; ax++) if (Math.min(v0[ax], v1[ax], v2[ax]) > h || Math.max(v0[ax], v1[ax], v2[ax]) < -h) return false;
  const n = cross(e[0], e[1]), r = h * (Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2]));
  return Math.abs(dot(n, v0)) <= r;
}

/** The point of triangle abc nearest p, as barycentric weights (Ericson, Real-Time Collision Detection 5.1.5). */
export function closestOnTriangle(p: V3, a: V3, b: V3, c: V3): V3 {
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a), d1 = dot(ab, ap), d2 = dot(ac, ap);
  if (d1 <= 0 && d2 <= 0) return [1, 0, 0];
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp);
  if (d3 >= 0 && d4 <= d3) return [0, 1, 0];
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return [1 - v, v, 0]; }
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp);
  if (d6 >= 0 && d5 <= d6) return [0, 0, 1];
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return [1 - w, 0, w]; }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / (d4 - d3 + (d5 - d6)); return [0, 1 - w, w]; }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return [1 - v - w, v, w];
}

export function voxelizeTriangles(m: GlbTriangles, o: VoxelizeOptions): Voxelized {
  const P = m.positions, n = P.length / 9, max = o.max ?? 256;
  if (!n) throw new Error('voxelize: no triangles');
  const lo: V3 = [Infinity, Infinity, Infinity], hi: V3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], P[i + a]); hi[a] = Math.max(hi[a], P[i + a]); }
  const s = o.perMetre, size = [0, 1, 2].map(a => Math.max(1, Math.ceil((hi[a] - lo[a]) * s - 1e-9))) as V3;
  if (Math.max(...size) > max) throw new Error(`voxelize: ${size.join('x')} voxels; at most ${max} a side (use fewer voxels per metre)`);
  // voxel coordinates, the model's box centred in the grid on x and y, on the ground (z = 0)
  const off: V3 = [(size[0] - (hi[0] - lo[0]) * s) / 2, (size[1] - (hi[1] - lo[1]) * s) / 2, 0];
  const V = (t: number, c: number): V3 => [0, 1, 2].map(a => (P[t * 9 + c * 3 + a] - lo[a]) * s + off[a]) as V3;
  // padded grid: a ring of empty voxels so the outside connects round the model
  const [X, Y, Z] = [size[0] + 2, size[1] + 2, size[2] + 2], idx = (x: number, y: number, z: number) => ((z + 1) * Y + (y + 1)) * X + (x + 1);
  const surf = new Int32Array(X * Y * Z).fill(-1), dist = new Float32Array(X * Y * Z).fill(Infinity), bary: V3[] = new Array(X * Y * Z);
  for (let t = 0; t < n; t++) {
    const a = V(t, 0), b = V(t, 1), c = V(t, 2);
    const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(size[0] - 1, Math.floor(Math.max(a[0], b[0], c[0])));
    const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(size[1] - 1, Math.floor(Math.max(a[1], b[1], c[1])));
    const z0 = Math.max(0, Math.floor(Math.min(a[2], b[2], c[2]))), z1 = Math.min(size[2] - 1, Math.floor(Math.max(a[2], b[2], c[2])));
    for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const ctr: V3 = [x + 0.5, y + 0.5, z + 0.5];
      if (!triBoxOverlap(ctr, 0.5 + 1e-6, a, b, c)) continue;
      const w = closestOnTriangle(ctr, a, b, c), q = [0, 1, 2].map(k => a[k] * w[0] + b[k] * w[1] + c[k] * w[2]), d = (q[0] - ctr[0]) ** 2 + (q[1] - ctr[1]) ** 2 + (q[2] - ctr[2]) ** 2;
      const i = idx(x, y, z);
      if (d < dist[i]) { dist[i] = d; surf[i] = t; bary[i] = w; }
    }
  }
  // flood the outside from the padded border (6-connected, through non-surface voxels)
  const outside = new Uint8Array(X * Y * Z), stack: number[] = [0];
  outside[0] = 1;
  while (stack.length) {
    const i = stack.pop()!, x = i % X, y = Math.floor(i / X) % Y, z = Math.floor(i / (X * Y));
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const a = x + dx, b = y + dy, c = z + dz;
      if (a < 0 || b < 0 || c < 0 || a >= X || b >= Y || c >= Z) continue;
      const j = (c * Y + b) * X + a;
      if (outside[j] || surf[j] >= 0) continue;
      outside[j] = 1; stack.push(j);
    }
  }
  // colours: surface voxels from their triangle; solid voxels from the nearest surface voxel (breadth first)
  const rgb: ([number, number, number] | undefined)[] = new Array(X * Y * Z), queue: number[] = [];
  for (let i = 0; i < surf.length; i++) if (surf[i] >= 0) { rgb[i] = triangleColor(m, surf[i], bary[i]); queue.push(i); }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q], x = i % X, y = Math.floor(i / X) % Y, z = Math.floor(i / (X * Y));
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const a = x + dx, b = y + dy, c = z + dz;
      if (a < 0 || b < 0 || c < 0 || a >= X || b >= Y || c >= Z) continue;
      const j = (c * Y + b) * X + a;
      if (outside[j] || rgb[j]) continue;
      rgb[j] = rgb[i]; queue.push(j);
    }
  }
  const cells: Voxelized['cells'] = [];
  for (let z = 0; z < size[2]; z++) for (let y = 0; y < size[1]; y++) for (let x = 0; x < size[0]; x++) {
    const i = idx(x, y, z);
    if (!outside[i] && rgb[i]) cells.push({ v: [x, y, z], rgb: rgb[i]!.map(Math.round) as [number, number, number] });
  }
  return { size, cells, metresPerVoxel: 1 / s };
}
