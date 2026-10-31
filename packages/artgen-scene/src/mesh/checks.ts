/**
 * Mesh checks (docs/MESHES.md §8), each `{ id, status, detail }` like the workflow's `Check`:
 *   mesh-closed    every edge is matched by the same edge the other way (no hole, no flipped triangle)
 *   mesh-budget    no more triangles than the budget
 *   mesh-scale     the height in metres against the brief's `height`: a flag past ±20 %, as the sprite's own `height` check (skipped without one)
 *   uv-bounds      every UV inside 0–1
 *   uv-overlap     no texel centre inside two triangles
 *   texel-density  every triangle's texels per model unit within 0.7–1.3 times the target
 */
import { texelsIn, type TriMesh } from './uv.ts';

export interface MeshCheck { id: string; status: 'pass' | 'fail' | 'flag' | 'skip'; detail: string }

export interface MeshCheckOptions {
  budget: number;
  /** Atlas size in texels. */
  atlas: [number, number];
  /** Target texels per model unit. */
  texels: number;
  /** Metres per model unit, and the brief's height in metres (when it gives one). */
  metresPerUnit?: number;
  height?: number;
  /** The share the height may be off before it is flagged (default 0.2, the sprite's `heightTolerance`). */
  heightTolerance?: number;
}

const f2 = (n: number) => (Math.round(n * 100) / 100).toString();

export function meshChecks(m: TriMesh, o: MeshCheckOptions): MeshCheck[] {
  const { positions: P, uvs: U, indices: I } = m, tris = I.length / 3, out: MeshCheck[] = [];
  // closed: count directed edges by position (vertices are split at UV seams and faceted triangles)
  const key = (v: number) => `${P[v * 3]},${P[v * 3 + 1]},${P[v * 3 + 2]}`, edges = new Map<string, number>();
  for (let t = 0; t < tris; t++) for (let c = 0; c < 3; c++) {
    const e = `${key(I[t * 3 + c])}|${key(I[t * 3 + ((c + 1) % 3)])}`;
    edges.set(e, (edges.get(e) ?? 0) + 1);
  }
  let open = 0;
  for (const [e, n] of edges) { const [a, b] = e.split('|'); if ((edges.get(`${b}|${a}`) ?? 0) !== n) open += Math.abs(n - (edges.get(`${b}|${a}`) ?? 0)); }
  out.push({ id: 'mesh-closed', status: tris && !open ? 'pass' : 'fail', detail: !tris ? 'no triangles' : open ? `${open} unmatched edge${open === 1 ? '' : 's'} (a hole or a flipped triangle)` : `closed: ${edges.size / 2} edges, each matched` });
  out.push({ id: 'mesh-budget', status: tris <= o.budget ? 'pass' : 'fail', detail: `${tris} triangles, budget ${o.budget}` });
  if (o.height && o.metresPerUnit) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 2; i < P.length; i += 3) { lo = Math.min(lo, P[i]); hi = Math.max(hi, P[i]); }
    const h = (hi - lo) * o.metresPerUnit, off = Math.abs(h - o.height) / o.height, limit = o.heightTolerance ?? 0.2;
    // the mesh is as tall as the sprite is drawn: like the sprite's `height` check, being off is a warning
    out.push({ id: 'mesh-scale', status: off <= limit ? 'pass' : 'flag', detail: `${f2(h)} m tall, the brief says ${o.height} m (${Math.round(off * 100)} % off; ${Math.round(limit * 100)} % allowed)` });
  } else out.push({ id: 'mesh-scale', status: 'skip', detail: 'the brief gives no height' });
  let outside = 0;
  for (const u of U) if (!(u >= 0 && u <= 1)) outside++;
  out.push({ id: 'uv-bounds', status: outside ? 'fail' : 'pass', detail: outside ? `${outside} UV coordinates outside 0–1` : 'every UV inside 0–1' });
  const [W, H] = o.atlas, hit = new Uint8Array(W * H);
  let twice = 0, lo = Infinity, hi = 0;
  for (let t = 0; t < tris; t++) {
    const [a, b, c] = [I[t * 3], I[t * 3 + 1], I[t * 3 + 2]], uv = (v: number): [number, number] => [U[v * 2] * W, U[v * 2 + 1] * H];
    texelsIn(uv(a), uv(b), uv(c), (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; if (hit[i]) twice++; hit[i] = 1; });
    // density: √(texel area ÷ surface area), against the target
    const p = (v: number) => [P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], [A, B, C] = [p(a), p(b), p(c)];
    const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
    const area3 = Math.hypot(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]) / 2;
    const [ua, ub, uc] = [uv(a), uv(b), uv(c)], area2 = Math.abs((ub[0] - ua[0]) * (uc[1] - ua[1]) - (ub[1] - ua[1]) * (uc[0] - ua[0])) / 2;
    if (area3 < 1e-9) continue;
    const d = Math.sqrt(area2 / area3) / o.texels;
    lo = Math.min(lo, d); hi = Math.max(hi, d);
  }
  out.push({ id: 'uv-overlap', status: twice ? 'fail' : 'pass', detail: twice ? `${twice} texels inside two triangles` : `no texel inside two triangles (${W}x${H} atlas)` });
  const ok = lo >= 0.7 && hi <= 1.3;
  out.push({ id: 'texel-density', status: !tris ? 'skip' : ok ? 'pass' : 'fail', detail: !tris ? 'no triangles' : `${f2(lo)}–${f2(hi)} times the target ${o.texels} texels per unit (0.7–1.3 allowed)` });
  return out;
}
