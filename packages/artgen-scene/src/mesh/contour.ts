/**
 * Dual contouring of a distance field (docs/MESHES.md §4): the field is sampled on a grid; every grid edge whose ends
 * differ in sign gives a quad of the four cells round it, and each cell's one vertex sits at the least-squares point of
 * the crossings' tangent planes (pulled a little toward their mean, kept inside the cell), so flat faces stay flat and
 * box edges stay sharp. The surface is closed by construction. `contourBudget` picks the largest grid whose triangle
 * count fits a budget (a binary search: the count only needs the samples).
 */
import type { V3 } from '../t2/scene3d.ts';
import type { Sdf } from './field.ts';

/** An indexed triangle surface in model units: one vertex per contoured cell. */
export interface Contour {
  positions: Float32Array;
  indices: Uint32Array;
  /** Cells along the longest side of the box. */
  n: number;
  /** Grid spacing, model units. */
  h: number;
}

interface Samples { v: Float32Array; nx: number; ny: number; nz: number; o: V3; h: number }

function sample(sdf: Sdf, box: [number, number, number, number, number, number], n: number): Samples {
  const L = Math.max(box[3] - box[0], box[4] - box[1], box[5] - box[2], 1e-6), h = L / n;
  // one empty cell all round, so every crossing has its four cells and the border is outside
  const dims = [0, 1, 2].map(a => Math.max(1, Math.ceil((box[a + 3] - box[a]) / h - 1e-9)) + 2);
  const o: V3 = [0, 1, 2].map(a => (box[a] + box[a + 3]) / 2 - (dims[a] * h) / 2) as V3;
  const [nx, ny, nz] = dims, v = new Float32Array((nx + 1) * (ny + 1) * (nz + 1));
  let i = 0;
  for (let z = 0; z <= nz; z++) for (let y = 0; y <= ny; y++) for (let x = 0; x <= nx; x++) {
    const border = x === 0 || y === 0 || z === 0 || x === nx || y === ny || z === nz;
    v[i++] = border ? Math.max(h, sdf(o[0] + x * h, o[1] + y * h, o[2] + z * h)) : sdf(o[0] + x * h, o[1] + y * h, o[2] + z * h);
  }
  return { v, nx, ny, nz, o, h };
}

const inside = (d: number) => d <= 0;

/** Triangles dual contouring would make at this grid: two per crossing edge. */
function crossings(s: Samples): number {
  const { v, nx, ny, nz } = s, X = 1, Y = nx + 1, Z = (nx + 1) * (ny + 1);
  let c = 0;
  for (let z = 0; z <= nz; z++) for (let y = 0; y <= ny; y++) for (let x = 0; x <= nx; x++) {
    const i = z * Z + y * Y + x, a = inside(v[i]);
    if (x < nx && a !== inside(v[i + X])) c++;
    if (y < ny && a !== inside(v[i + Y])) c++;
    if (z < nz && a !== inside(v[i + Z])) c++;
  }
  return c * 2;
}

/** Solve the 3×3 system m·x = b (Cramer); null when singular. */
function solve3(m: number[], b: V3): V3 | null {
  const [a, bb, c, d, e, f, g, h, i] = m, det = a * (e * i - f * h) - bb * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-12) return null;
  return [
    (b[0] * (e * i - f * h) - bb * (b[1] * i - f * b[2]) + c * (b[1] * h - e * b[2])) / det,
    (a * (b[1] * i - f * b[2]) - b[0] * (d * i - f * g) + c * (d * b[2] - b[1] * g)) / det,
    (a * (e * b[2] - b[1] * h) - bb * (d * b[2] - b[1] * g) + b[0] * (d * h - e * g)) / det,
  ];
}

function mesh(sdf: Sdf, normal: (x: number, y: number, z: number) => V3, s: Samples): Contour & { n: number } {
  const { v, nx, ny, nz, o, h } = s, X = 1, Y = nx + 1, Z = (nx + 1) * (ny + 1);
  const cellOf = (x: number, y: number, z: number) => (z * ny + y) * nx + x;
  // per cell: the crossings on its edges (point, normal)
  const acc = new Map<number, { p: number[]; n: number[] }>();
  const edges: [number, number, number, number, boolean][] = []; // x, y, z, axis, inside at the lower end
  const point = (x: number, y: number, z: number): V3 => [o[0] + x * h, o[1] + y * h, o[2] + z * h];
  for (let z = 0; z <= nz; z++) for (let y = 0; y <= ny; y++) for (let x = 0; x <= nx; x++) {
    const i = z * Z + y * Y + x, a = inside(v[i]);
    for (let ax = 0; ax < 3; ax++) {
      const lim = ax === 0 ? x < nx : ax === 1 ? y < ny : z < nz;
      if (!lim) continue;
      const j = i + (ax === 0 ? X : ax === 1 ? Y : Z);
      if (a === inside(v[j])) continue;
      edges.push([x, y, z, ax, a]);
      // the crossing: bisection on the real field, between the two samples
      const p0 = point(x, y, z), p1 = point(x + (ax === 0 ? 1 : 0), y + (ax === 1 ? 1 : 0), z + (ax === 2 ? 1 : 0));
      let lo = 0, hi = 1;
      for (let it = 0; it < 10; it++) {
        const t = (lo + hi) / 2, d = sdf(p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, p0[2] + (p1[2] - p0[2]) * t);
        if (inside(d) === a) lo = t; else hi = t;
      }
      const t = (lo + hi) / 2, c: V3 = [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, p0[2] + (p1[2] - p0[2]) * t], nn = normal(c[0], c[1], c[2]);
      // the four cells sharing this edge
      const u = (ax + 1) % 3, w = (ax + 2) % 3;
      for (const [du, dw] of [[-1, -1], [0, -1], [0, 0], [-1, 0]]) {
        const q = [x, y, z];
        q[u] += du; q[w] += dw;
        if (q[0] < 0 || q[1] < 0 || q[2] < 0 || q[0] >= nx || q[1] >= ny || q[2] >= nz) continue;
        const k = cellOf(q[0], q[1], q[2]);
        let e = acc.get(k);
        if (!e) acc.set(k, (e = { p: [], n: [] }));
        e.p.push(...c); e.n.push(...nn);
      }
    }
  }
  // one vertex per cell: argmin Σ (n·(x − p))² + λ|x − mean|², kept inside the cell
  const index = new Map<number, number>(), pos: number[] = [], lambda = 0.05;
  for (const k of [...acc.keys()].sort((a, b) => a - b)) {
    const { p, n } = acc.get(k)!, m = p.length / 3, mean: V3 = [0, 0, 0];
    for (let i = 0; i < m; i++) for (let a = 0; a < 3; a++) mean[a] += p[i * 3 + a] / m;
    const A = [lambda, 0, 0, 0, lambda, 0, 0, 0, lambda], b: V3 = [0, 0, 0];
    for (let i = 0; i < m; i++) {
      const ni = [n[i * 3], n[i * 3 + 1], n[i * 3 + 2]], di = ni[0] * (p[i * 3] - mean[0]) + ni[1] * (p[i * 3 + 1] - mean[1]) + ni[2] * (p[i * 3 + 2] - mean[2]);
      for (let r = 0; r < 3; r++) { for (let c = 0; c < 3; c++) A[r * 3 + c] += ni[r] * ni[c]; b[r] += ni[r] * di; }
    }
    const d = solve3(A, b) ?? [0, 0, 0], cx = k % nx, cy = Math.floor(k / nx) % ny, cz = Math.floor(k / (nx * ny));
    const lo = point(cx, cy, cz);
    index.set(k, pos.length / 3);
    for (let a = 0; a < 3; a++) pos.push(Math.min(lo[a] + h, Math.max(lo[a], mean[a] + d[a])));
  }
  const idx: number[] = [], P = (i: number): V3 => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  const d2 = (a: V3, b: V3) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  for (const [x, y, z, ax, a] of edges) {
    const u = (ax + 1) % 3, w = (ax + 2) % 3;
    // the cells round the edge, counter-clockwise seen from +axis (u × w = axis)
    const q = [[-1, -1], [0, -1], [0, 0], [-1, 0]].map(([du, dw]) => { const c = [x, y, z]; c[u] += du; c[w] += dw; return index.get(cellOf(c[0], c[1], c[2]))!; });
    // outward is +axis when the lower end is inside
    const [q0, q1, q2, q3] = a ? q : [q[0], q[3], q[2], q[1]];
    if (d2(P(q0), P(q2)) <= d2(P(q1), P(q3))) idx.push(q0, q1, q2, q0, q2, q3);
    else idx.push(q0, q1, q3, q1, q2, q3);
  }
  return { positions: new Float32Array(pos), indices: new Uint32Array(idx), n: Math.max(nx, ny, nz) - 2, h };
}

/** Contour a field in a box at `n` cells along its longest side. */
export function contourField(sdf: Sdf, normal: (x: number, y: number, z: number) => V3, box: [number, number, number, number, number, number], n: number): Contour {
  return mesh(sdf, normal, sample(sdf, box, n));
}

/** The finest grid (4–`max` cells along the longest side) whose contour has at most `budget` triangles; the coarsest when none does. */
export function contourBudget(sdf: Sdf, normal: (x: number, y: number, z: number) => V3, box: [number, number, number, number, number, number], budget: number, max = 160): Contour {
  const count = (n: number) => crossings(sample(sdf, box, n));
  let lo = 4;
  if (count(lo) > budget) return contourField(sdf, normal, box, lo);
  let hi = lo;
  while (hi < max) { const next = Math.min(max, hi * 2); if (count(next) > budget) { hi = next; break; } lo = hi = next; }
  // count(lo) fits; count(hi) does not, unless hi = lo = max
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (count(mid) <= budget) lo = mid; else hi = mid; }
  return contourField(sdf, normal, box, lo);
}
