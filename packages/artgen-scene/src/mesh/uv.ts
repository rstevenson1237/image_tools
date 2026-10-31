/**
 * UVs (docs/MESHES.md §5): box-projected charts. Triangles that share an edge and the same main axis (±x, ±y, ±z) form
 * a chart, projected onto that axis plane at `texels` per model unit, so the density is set and nearly even. A chart
 * that folds over itself is split into layers that don't (each triangle goes to the first layer it doesn't overlap). Charts are shelf-packed at whole-texel
 * offsets with a gutter; vertices split where charts meet. Tangents follow each chart's projection axes.
 */
import type { V3 } from '../t2/scene3d.ts';

/** A finished triangle mesh: positions in model units (artgen frame: x right, y toward the viewer, z up). */
export interface TriMesh {
  positions: Float32Array;
  normals: Float32Array;
  /** 0–1, v down the image (glTF). */
  uvs: Float32Array;
  /** xyz + handedness w (glTF): bitangent = cross(normal, tangent) · w points up the image. */
  tangents: Float32Array;
  indices: Uint32Array;
  /** Per triangle: index into `parts`. */
  part: Uint16Array;
  parts: string[];
  /** Per triangle: 1 when its normals are smooth, 0 when faceted. */
  smooth: Uint8Array;
}

export interface UvLayout { mesh: TriMesh; width: number; height: number; texels: number; charts: number }

export interface UvInput {
  positions: Float32Array;
  indices: Uint32Array;
  part: Uint16Array;
  parts: string[];
  smooth: Uint8Array;
  /** Smooth normal at a vertex position. */
  normal(p: V3): V3;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: V3): V3 => { const l = Math.hypot(a[0], a[1], a[2]); return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 1]; };
const axisVec = (a: number, s = 1): V3 => { const v: V3 = [0, 0, 0]; v[a] = s; return v; };

/**
 * Texel centres (x + 0.5, y + 0.5) inside a 2D triangle, with the barycentric weights of `a`, `b`, `c`. Each edge's
 * function is computed from its endpoints in one fixed order, so two triangles that share an edge get exactly opposite
 * values there, and a centre on the edge goes to one of them only (to the side the edge's inward normal points right,
 * or down when it is level): no texel is counted twice, none falls between.
 */
export function texelsIn(a: [number, number], b: [number, number], c: [number, number], each: (x: number, y: number, wa: number, wb: number, wc: number) => void): void {
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (!(Math.abs(area) > 1e-12)) return;
  const s = area > 0 ? 1 : -1;
  const x0 = Math.floor(Math.min(a[0], b[0], c[0])), x1 = Math.ceil(Math.max(a[0], b[0], c[0])), y0 = Math.floor(Math.min(a[1], b[1], c[1])), y1 = Math.ceil(Math.max(a[1], b[1], c[1]));
  // the edge u → v, positive on the triangle's side
  const edge = (u: [number, number], v: [number, number]) => {
    const flip = u[0] > v[0] || (u[0] === v[0] && u[1] > v[1]), p = flip ? v : u, q = flip ? u : v, k = (flip ? -1 : 1) * s;
    const nx = -(q[1] - p[1]) * k, ny = (q[0] - p[0]) * k, keep = nx > 0 || (nx === 0 && ny > 0);
    return { at: (x: number, y: number) => k * ((q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0])), keep };
  };
  const ea = edge(b, c), eb = edge(c, a), ec = edge(a, b), A = Math.abs(area);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const px = x + 0.5, py = y + 0.5, wa = ea.at(px, py), wb = eb.at(px, py), wc = ec.at(px, py);
    if (wa < 0 || wb < 0 || wc < 0) continue;
    if ((wa === 0 && !ea.keep) || (wb === 0 && !eb.keep) || (wc === 0 && !ec.keep)) continue;
    each(x, y, wa / A, wb / A, wc / A);
  }
}

/** The chart projection: texel coordinates of a point, and the 3D directions of +u and of "up the image" (−v). */
interface Proj { uv(p: V3): [number, number]; du: V3; up: V3 }

function axisProj(axis: number, sign: number, t: number): Proj {
  // seen from outside (+axis for sign > 0) u then v is counter-clockwise, so the texture is not mirrored
  const [ua, va] = sign > 0 ? [(axis + 1) % 3, (axis + 2) % 3] : [(axis + 2) % 3, (axis + 1) % 3];
  return { uv: p => [p[ua] * t, -p[va] * t], du: axisVec(ua), up: axisVec(va) };
}

const GUTTER = 2, MAX_ATLAS = 2048;
const pow2 = (n: number) => { let p = 16; while (p < n) p *= 2; return p; };

export function layoutUvs(m: UvInput, texels: number): UvLayout {
  const P = (i: number): V3 => [m.positions[i * 3], m.positions[i * 3 + 1], m.positions[i * 3 + 2]], tris = m.indices.length / 3;
  const corner = (t: number, c: number) => m.indices[t * 3 + c], fn: V3[] = [], label = new Int8Array(tris);
  for (let t = 0; t < tris; t++) {
    const a = P(corner(t, 0)), n = unit(cross(sub(P(corner(t, 1)), a), sub(P(corner(t, 2)), a)));
    fn.push(n);
    let best = 0;
    for (let ax = 1; ax < 3; ax++) if (Math.abs(n[ax]) > Math.abs(n[best]) + 1e-9) best = ax;
    label[t] = (best + 1) * (n[best] >= 0 ? 1 : -1);
  }
  // a triangle whose neighbours mostly face another axis joins them when it faces that axis well enough (fewer, larger charts;
  // a texel density of at least √0.6 ≈ 0.77 of the target)
  const nbrs: number[][] = Array.from({ length: tris }, () => []), byEdge0 = new Map<string, number>();
  for (let t = 0; t < tris; t++) for (let c = 0; c < 3; c++) {
    const a = corner(t, c), b = corner(t, (c + 1) % 3), key = a < b ? `${a},${b}` : `${b},${a}`, o = byEdge0.get(key);
    if (o === undefined) byEdge0.set(key, t); else { nbrs[t].push(o); nbrs[o].push(t); }
  }
  for (let pass = 0; pass < 2; pass++) for (let t = 0; t < tris; t++) {
    const votes = new Map<number, number>();
    for (const o of nbrs[t]) if (label[o] !== label[t]) votes.set(label[o], (votes.get(label[o]) ?? 0) + 1);
    for (const [l, v] of votes) if (v * 2 > nbrs[t].length && fn[t][Math.abs(l) - 1] * Math.sign(l) >= 0.6) { label[t] = l; break; }
  }
  // charts: union-find over shared edges with the same label
  const parent = Int32Array.from({ length: tris }, (_, i) => i), find = (i: number): number => { while (parent[i] !== i) i = parent[i] = parent[parent[i]]; return i; };
  const byEdge = new Map<string, number>();
  for (let t = 0; t < tris; t++) for (let c = 0; c < 3; c++) {
    const a = corner(t, c), b = corner(t, (c + 1) % 3), key = a < b ? `${a},${b}` : `${b},${a}`, o = byEdge.get(key);
    if (o === undefined) byEdge.set(key, t);
    else if (label[o] === label[t]) { const ra = find(o), rb = find(t); if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb); }
  }
  const groups = new Map<number, number[]>();
  for (let t = 0; t < tris; t++) { const r = find(t); let g = groups.get(r); if (!g) groups.set(r, (g = [])); g.push(t); }

  for (let tex = texels; ; tex /= 2) {
    // project; split a chart that folds over itself
    const charts: { tris: number[]; proj: Proj[]; uv: [number, number][][]; box: [number, number, number, number] }[] = [];
    const add = (ts: number[], proj: (t: number) => Proj) => {
      const ps = ts.map(proj), uv = ts.map((t, i) => [0, 1, 2].map(c => ps[i].uv(P(corner(t, c)))));
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const tri of uv) for (const [u, v] of tri) { x0 = Math.min(x0, u); y0 = Math.min(y0, v); x1 = Math.max(x1, u); y1 = Math.max(y1, v); }
      charts.push({ tris: ts, proj: ps, uv, box: [Math.floor(x0), Math.floor(y0), Math.ceil(x1), Math.ceil(y1)] });
    };
    for (const ts of groups.values()) {
      const l = label[ts[0]], pr = axisProj(Math.abs(l) - 1, Math.sign(l), tex);
      // a chart that folds over itself becomes layers: each triangle goes to the first layer it doesn't overlap
      const layers: { tris: number[]; seen: Set<number> }[] = [];
      for (const t of ts) {
        const [a, b, c] = [0, 1, 2].map(k => pr.uv(P(corner(t, k)))), cells: number[] = [];
        texelsIn(a, b, c, (x, y) => cells.push(x * 65536 + y));
        let layer = layers.find(L => !cells.some(k => L.seen.has(k)));
        if (!layer) layers.push((layer = { tris: [], seen: new Set() }));
        layer.tris.push(t);
        for (const k of cells) layer.seen.add(k);
      }
      for (const L of layers) add(L.tris, () => pr);
    }
    // shelf packing, tallest first
    const order = charts.map((_, i) => i).sort((a, b) => (charts[b].box[3] - charts[b].box[1]) - (charts[a].box[3] - charts[a].box[1]) || (charts[b].box[2] - charts[b].box[0]) - (charts[a].box[2] - charts[a].box[0]) || a - b);
    const rect = (i: number) => [charts[i].box[2] - charts[i].box[0] + 2 * GUTTER, charts[i].box[3] - charts[i].box[1] + 2 * GUTTER];
    const area = charts.reduce((s, _, i) => s + rect(i)[0] * rect(i)[1], 0), W = pow2(Math.max(...order.map(i => rect(i)[0]), Math.sqrt(area * 1.1)));
    const at: [number, number][] = new Array(charts.length);
    let x = 0, y = 0, row = 0;
    for (const i of order) {
      const [w, h] = rect(i);
      if (x + w > W) { x = 0; y += row; row = 0; }
      at[i] = [x + GUTTER - charts[i].box[0], y + GUTTER - charts[i].box[1]];
      x += w; row = Math.max(row, h);
    }
    const H = pow2(y + row);
    if ((W > MAX_ATLAS || H > MAX_ATLAS) && tex > 1 / 64) continue;
    // split the vertices per chart (and per triangle where faceted)
    const pos: number[] = [], nor: number[] = [], uvs: number[] = [], tan: number[] = [], idx = new Uint32Array(m.indices.length), seen = new Map<string, number>();
    charts.forEach((ch, ci) => ch.tris.forEach((t, k) => {
      const pr = ch.proj[k];
      for (let c = 0; c < 3; c++) {
        const vi = corner(t, c), key = m.smooth[t] ? `${ci},${vi}` : `t${t},${c}`;
        let out = seen.get(key);
        if (out === undefined) {
          const p = P(vi), n = m.smooth[t] ? m.normal(p) : fn[t], [u, v] = ch.uv[k][c];
          // tangent: +u on the surface; w so that cross(n, t)·w runs up the image
          const tt = unit(sub(pr.du, n.map(x => x * dot(n, pr.du)) as V3)), w = dot(cross(n, tt), pr.up) >= 0 ? 1 : -1;
          out = pos.length / 3;
          pos.push(...p); nor.push(...n); uvs.push((u + at[ci][0]) / W, (v + at[ci][1]) / H); tan.push(...tt, w);
          seen.set(key, out);
        }
        idx[t * 3 + c] = out;
      }
    }));
    return {
      mesh: { positions: new Float32Array(pos), normals: new Float32Array(nor), uvs: new Float32Array(uvs), tangents: new Float32Array(tan), indices: idx, part: m.part, parts: m.parts, smooth: m.smooth },
      width: W, height: H, texels: tex, charts: charts.length,
    };
  }
}
