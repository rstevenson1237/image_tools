/**
 * Terrain map generator: height and moisture fields from seeded noise, the map's edits applied in order, rivers
 * traced downhill, every sample classified into a terrain, and the readability pass (small patches merged away).
 */
import { rng } from '../lib/rng.ts';
import { pGradient } from '../tex/noise.ts';
import { RESOLUTION, TERRAINS, type MapSpec, type Shape, type Terrain } from './spec.ts';
import { chaikin, simplifyLine, type Line } from './trace.ts';

export interface MapLine {
  pts: number[];
  /** Width in map units. */
  width: number;
}

/**
 * A river as a filled ribbon: an evenly spaced centre line, the width at each of its points (growing smoothly
 * downstream, flaring where it opens into water), and the outline the renderer fills and banks.
 */
export interface River {
  pts: number[];
  widths: number[];
  /** Closed ring (map units): both banks, a round cap at the source, and one at the end unless it opens into water. */
  outline: number[];
  /** True when it runs into the sea or a lake (the end of the ribbon lies in the water). */
  mouth: boolean;
}

export interface MapField {
  /** Samples per map unit; sample (i, j) sits at ((i + 0.5) / res, (j + 0.5) / res). */
  res: number;
  w: number;
  h: number;
  /** Land height above the waterline, 0..1 (0 on water). */
  elevation: Float32Array;
  /** Terrain index into TERRAINS per sample. */
  terrain: Uint8Array;
  rivers: River[];
  roads: MapLine[];
}

export const terrainIndex = (t: Terrain): number => TERRAINS.indexOf(t);
const T = Object.fromEntries(TERRAINS.map((t, i) => [t, i])) as Record<Terrain, number>;
const isWater = (t: number) => t === T.deep || t === T.water;

/** Coverage of a shape at (x, y), 0..1; `soft` fades the outer half of discs and strokes (for elevate). */
export function coverage(s: Shape, x: number, y: number, soft = false): number {
  const fall = (d: number, r: number) => (d >= r ? 0 : !soft || d <= r * 0.4 ? 1 : 0.5 + 0.5 * Math.cos(((d - r * 0.4) / (r * 0.6)) * Math.PI));
  if ('circle' in s) return fall(Math.hypot(x - s.circle[0], y - s.circle[1]), s.circle[2]);
  if ('poly' in s) {
    const p = s.poly;
    let inside = false;
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
      if ((p[i + 1] > y) !== (p[j + 1] > y) && x < ((p[j] - p[i]) * (y - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) inside = !inside;
    }
    return inside ? 1 : 0;
  }
  return fall(distToPolyline(s.stroke, x, y), s.width / 2);
}

function distToPolyline(p: number[], x: number, y: number): number {
  if (p.length === 2) return Math.hypot(x - p[0], y - p[1]);
  let best = Infinity;
  for (let i = 2; i < p.length; i += 2) {
    const ax = p[i - 2], ay = p[i - 1], dx = p[i] - ax, dy = p[i + 1] - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

/** Bounding box of a shape in map units [x0, y0, x1, y1]. */
function bbox(s: Shape): [number, number, number, number] {
  if ('circle' in s) { const [x, y, r] = s.circle; return [x - r, y - r, x + r, y + r]; }
  const p = 'poly' in s ? s.poly : s.stroke, pad = 'stroke' in s ? s.width / 2 : 0;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}

/** Call `fn(index, coverage)` for each sample a shape touches. */
function eachCovered(f: { res: number; w: number; h: number }, s: Shape, soft: boolean, fn: (i: number, c: number) => void): void {
  const [x0, y0, x1, y1] = bbox(s), r = f.res;
  for (let j = Math.max(0, Math.floor(y0 * r)); j < Math.min(f.h, Math.ceil(y1 * r) + 1); j++)
    for (let i = Math.max(0, Math.floor(x0 * r)); i < Math.min(f.w, Math.ceil(x1 * r) + 1); i++) {
      const c = coverage(s, (i + 0.5) / r, (j + 0.5) / r, soft);
      if (c > 0) fn(j * f.w + i, c);
    }
}

/** Value at quantile q of a field. */
function quantile(f: Float32Array, q: number): number {
  if (q <= 0) return -Infinity;
  const s = Float32Array.from(f).sort();
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
}

/** Box blur, clamped at the edges, `passes` times. */
function blur(f: Float32Array, w: number, h: number, r: number, passes = 1): Float32Array {
  let a = f;
  for (let p = 0; p < passes; p++) {
    const tmp = new Float32Array(a.length), out = new Float32Array(a.length);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += a[j * w + Math.min(w - 1, Math.max(0, i + k))];
      tmp[j * w + i] = s / (2 * r + 1);
    }
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += tmp[Math.min(h - 1, Math.max(0, j + k)) * w + i];
      out[j * w + i] = s / (2 * r + 1);
    }
    a = out;
  }
  return a;
}

/** Raw height 0..1 from fBm noise, shaped by the land mode and relief. */
function heightField(spec: MapSpec, w: number, h: number): Float32Array {
  const g = spec.gen, R = 4, cells = Math.max(2, Math.round((R * Math.max(spec.cols, spec.rows)) / g.feature));
  const opts = { w: w * R, h: h * R, cells, cellsY: Math.max(2, Math.round((cells * h) / w)), octaves: 5, gain: 0.35 + g.roughness * 0.25, seed: spec.seed };
  const r = rng(spec.seed), ox = Math.floor(r() * w * (R - 1)), oy = Math.floor(r() * h * (R - 1));
  const f = new Float32Array(w * h);
  let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let v = pGradient(i + ox, j + oy, opts);
    if (g.land === 'island') {
      const dx = (i + 0.5) / w - 0.5, dy = (j + 0.5) / h - 0.5;
      v -= Math.pow(Math.hypot(dx, dy) * 2, 2.2) * 0.55;
    }
    f[j * w + i] = v; lo = Math.min(lo, v); hi = Math.max(hi, v);
  }
  const k = 1.7 - g.relief * 1.1;
  for (let n = 0; n < f.length; n++) f[n] = Math.pow((f[n] - lo) / (hi - lo || 1), k);
  return f;
}

/** Fill depressions (priority flood from the edges and the water) so every land sample drains downhill. */
function fillDepressions(h: Float32Array, w: number, hh: number, water: Uint8Array): Float32Array {
  const out = Float32Array.from(h), seen = new Uint8Array(h.length), heap: number[] = [];
  const less = (a: number, b: number) => out[a] < out[b];
  const push = (n: number) => { heap.push(n); let c = heap.length - 1; while (c) { const p = (c - 1) >> 1; if (!less(heap[c], heap[p])) break; [heap[c], heap[p]] = [heap[p], heap[c]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && less(heap[l], heap[m])) m = l; if (r < heap.length && less(heap[r], heap[m])) m = r; if (m === c) break; [heap[c], heap[m]] = [heap[m], heap[c]]; c = m; } } return top; };
  for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) {
    const n = j * w + i;
    if (water[n] || i === 0 || j === 0 || i === w - 1 || j === hh - 1) { seen[n] = 1; push(n); }
  }
  while (heap.length) {
    const n = pop(), i = n % w, j = (n - i) / w;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const x = i + di, y = j + dj, m = y * w + x;
      if ((!di && !dj) || x < 0 || y < 0 || x >= w || y >= hh || seen[m]) continue;
      seen[m] = 1;
      if (out[m] <= out[n]) out[m] = out[n] + 1e-6;
      push(m);
    }
  }
  return out;
}

/** Trace generated rivers downhill from high ground; marks river samples in `wet`. */
function traceRivers(spec: MapSpec, filled: Float32Array, elev: Float32Array, water: Uint8Array, w: number, h: number, res: number, wet: Uint8Array): { pts: number[]; mouth: boolean }[] {
  const n = spec.gen.rivers;
  if (!n) return [];
  const r = rng(spec.seed * 31 + 7), cands: number[] = [];
  for (let k = 0; k < elev.length; k++) if (!water[k] && elev[k] > 0.4 && elev[k] < 0.85) cands.push(k);
  cands.sort((a, b) => elev[b] - elev[a]);
  const spacing = (Math.max(spec.cols, spec.rows) / (n + 1)) * res, sources: number[] = [];
  for (let tries = 0; tries < 400 && sources.length < n && cands.length; tries++) {
    const k = cands[Math.floor(Math.pow(r(), 2) * cands.length)], x = k % w, y = (k - x) / w;
    if (sources.every(s => Math.hypot((s % w) - x, Math.floor(s / w) - y) > spacing)) sources.push(k);
  }
  const out: { pts: number[]; mouth: boolean }[] = [];
  for (const s of sources) {
    const path: number[] = [];
    let k = s, mouth = false;
    for (let step = 0; step < w * h; step++) {
      const x = k % w, y = (k - x) / w;
      path.push((x + 0.5) / res, (y + 0.5) / res);
      if (water[k]) { mouth = true; break; }
      if (wet[k] === 2) break;
      wet[k] = 2;
      let best = -1, low = filled[k];
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const xx = x + di, yy = y + dj, m = yy * w + xx;
        if ((!di && !dj) || xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        if (filled[m] < low) { low = filled[m]; best = m; }
      }
      if (best < 0) break;
      k = best;
    }
    if (path.length / 2 < res * 3) continue;
    out.push({ pts: smoothLine(path, res), mouth });
  }
  return out;
}

/**
 * Fit a river's mouth to the shore as drawn (the simplified terrain, not the raw height field): cut it just past the
 * first point in water, or carry it on in its last direction (up to 3 units) until it reaches water. Null when no
 * water is that close: the river keeps its course and ends with a round cap.
 */
function toShore(pts: number[], water: (x: number, y: number) => boolean): number[] | null {
  const n = pts.length / 2;
  for (let i = 2; i < n; i++) if (water(pts[i * 2], pts[i * 2 + 1])) return pts.slice(0, (i + 1) * 2);
  const ex = pts[n * 2 - 2], ey = pts[n * 2 - 1];
  let k = n - 2, dx = 0, dy = 0;
  while (k > 0 && Math.hypot(ex - pts[k * 2], ey - pts[k * 2 + 1]) < 0.5) k--;
  dx = ex - pts[k * 2]; dy = ey - pts[k * 2 + 1];
  const len = Math.hypot(dx, dy);
  if (!len) return null;
  for (let d = 0.1; d <= 3; d += 0.1) {
    const x = ex + (dx / len) * d, y = ey + (dy / len) * d;
    if (water(x, y)) return [...pts, ex + (dx / len) * (d + 0.15), ey + (dy / len) * (d + 0.15)];
  }
  return null;
}

/** River width at the mouth for a preset (map units). */
export const riverWidth = (spec: Pick<MapSpec, 'preset'>): number => (spec.preset === 'local' ? 0.35 : 0.16);

/** Width profile: sources start at 60 % of the mouth width; the flare at a mouth reaches 2.2 × over 4.5 widths. */
const SOURCE = 0.6, FLARE = 1.2, FLARE_LAND = 3, FLARE_WATER = 1.5;

const smoothstep = (t: number) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); };

/** Points every `step` along a polyline (both ends kept). */
function resample(p: number[], step: number): number[] {
  const out = [p[0], p[1]];
  let carry = 0;
  for (let i = 2; i < p.length; i += 2) {
    const ax = p[i - 2], ay = p[i - 1], seg = Math.hypot(p[i] - ax, p[i + 1] - ay);
    let d = step - carry;
    for (; d <= seg; d += step) out.push(ax + ((p[i] - ax) * d) / seg, ay + ((p[i + 1] - ay) * d) / seg);
    carry = seg - (d - step);
  }
  const n = out.length;
  if (Math.hypot(out[n - 2] - p[p.length - 2], out[n - 1] - p[p.length - 1]) > step * 0.3) out.push(p[p.length - 2], p[p.length - 1]);
  else { out[n - 2] = p[p.length - 2]; out[n - 1] = p[p.length - 1]; }
  return out;
}

/**
 * Build a river ribbon of mouth width `W`. The width grows smoothly from 60 % at the source (fast at first, then
 * levelling off, like the flow of a real river). A river that reaches water is carried on 1.5 widths past the shore
 * and flares over its last stretch with a smoothstep, so it widens without a kink, follows its own curve and opens into
 * the lake or sea.
 */
function riverRibbon(line: number[], W: number, mouth: boolean): River {
  let p = line;
  if (mouth) {
    const n = p.length / 2, ex = p[n * 2 - 2], ey = p[n * 2 - 1];
    let k = n - 2;
    while (k > 0 && Math.hypot(ex - p[k * 2], ey - p[k * 2 + 1]) < W * 2) k--;
    const dx = ex - p[k * 2], dy = ey - p[k * 2 + 1], len = Math.hypot(dx, dy) || 1;
    p = [...p, ex + (dx / len) * W * FLARE_WATER, ey + (dy / len) * W * FLARE_WATER];
  }
  const c = resample(p, Math.min(0.1, W * 0.4)), n = c.length / 2, s = [0];
  for (let i = 1; i < n; i++) s.push(s[i - 1] + Math.hypot(c[i * 2] - c[i * 2 - 2], c[i * 2 + 1] - c[i * 2 - 1]));
  const L = s[n - 1] || 1, shore = mouth ? Math.max(L * 0.5, L - W * FLARE_WATER) : L;
  const widths = s.map(d => {
    const base = W * (SOURCE + (1 - SOURCE) * Math.pow(Math.min(d, shore) / shore, 0.6));
    return mouth ? base * (1 + FLARE * smoothstep((d - (shore - W * FLARE_LAND)) / (W * (FLARE_LAND + FLARE_WATER)))) : base;
  });
  // normals from a tangent averaged over ±2 samples, so the banks stay smooth through bends
  const nx: number[] = [], ny: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 2), b = Math.min(n - 1, i + 2), tx = c[b * 2] - c[a * 2], ty = c[b * 2 + 1] - c[a * 2 + 1], tl = Math.hypot(tx, ty) || 1;
    nx.push(-ty / tl); ny.push(tx / tl);
  }
  const side = (i: number, sgn: number) => [c[i * 2] + nx[i] * sgn * widths[i] / 2, c[i * 2 + 1] + ny[i] * sgn * widths[i] / 2];
  /** Half circle around point i from the +normal side to the −normal side, bulging along `dir` (±1 = with / against the flow). */
  const cap = (i: number, dir: number, from: number) => {
    const out: number[] = [], r = widths[i] / 2, tx = ny[i] * dir, ty = -nx[i] * dir;
    for (let k = 1; k < 8; k++) {
      const a = (k / 8) * Math.PI, cs = Math.cos(a) * from, sn = Math.sin(a);
      out.push(c[i * 2] + r * (nx[i] * cs + tx * sn), c[i * 2 + 1] + r * (ny[i] * cs + ty * sn));
    }
    return out;
  };
  const outline: number[] = [];
  for (let i = 0; i < n; i++) outline.push(...side(i, 1));
  if (!mouth) outline.push(...cap(n - 1, 1, 1));
  for (let i = n - 1; i >= 0; i--) outline.push(...side(i, -1));
  outline.push(...cap(0, -1, -1));
  return { pts: c, widths, outline, mouth };
}

/** Smooth a polyline: thin it to about one point per half unit (steepest-descent paths zigzag sample by sample), then round it. */
function smoothLine(pts: number[], res: number): number[] {
  const thin: number[] = [pts[0], pts[1]];
  for (let i = 2; i < pts.length - 2; i += 2) if (Math.hypot(pts[i] - thin[thin.length - 2], pts[i + 1] - thin[thin.length - 1]) >= 0.5) thin.push(pts[i], pts[i + 1]);
  thin.push(pts[pts.length - 2], pts[pts.length - 1]);
  return simplifyLine(chaikin({ pts: thin, closed: false } as Line, 3), 0.15 / res).pts;
}

/** Rasterise a line into `wet` (so moisture rises along rivers). */
function markLine(pts: number[], width: number, w: number, h: number, res: number, wet: Uint8Array): void {
  eachCovered({ res, w, h }, { stroke: pts, width: Math.max(width, 1 / res) * 2 }, false, i => { if (!wet[i]) wet[i] = 1; });
}

/** Majority filter (3×3), then merge connected patches smaller than `minArea` samples into their largest neighbour. */
function simplifyTerrain(t: Uint8Array, w: number, h: number, passes: number, minArea: number): Uint8Array {
  let a = t;
  for (let p = 0; p < passes; p++) {
    const out = new Uint8Array(a.length), count = new Uint16Array(TERRAINS.length);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      count.fill(0);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) count[a[Math.min(h - 1, Math.max(0, j + dj)) * w + Math.min(w - 1, Math.max(0, i + di))]]++;
      const own = a[j * w + i];
      let best = own;
      for (let c = 0; c < count.length; c++) if (count[c] > count[best]) best = c;
      out[j * w + i] = count[best] >= 5 ? best : own;
    }
    a = out;
  }
  if (minArea <= 1) return a;
  const label = new Int32Array(a.length).fill(-1), stack: number[] = [];
  for (let s = 0; s < a.length; s++) {
    if (label[s] >= 0) continue;
    const cls = a[s], members: number[] = [], border = new Map<number, number>();
    label[s] = s; stack.push(s);
    while (stack.length) {
      const n = stack.pop()!, i = n % w, j = (n - i) / w;
      members.push(n);
      for (const [x, y] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const m = y * w + x;
        if (a[m] === cls) { if (label[m] < 0) { label[m] = s; stack.push(m); } }
        else border.set(a[m], (border.get(a[m]) ?? 0) + 1);
      }
    }
    if (members.length >= minArea || !border.size) continue;
    let into = -1, most = 0;
    for (const [c, k] of border) if (k > most) { most = k; into = c; }
    for (const n of members) a[n] = into;
  }
  return a;
}

/** Terrain by height above water (0..1) and moisture (0..1). */
function classify(e: number, m: number, local: boolean): number {
  if (e < 0.035) return m > 0.72 ? T.marsh : T.sand;
  if (!local && e > 0.84) return T.snow;
  if (e > (local ? 0.7 : 0.64)) return T.rock;
  if (m > 0.78 && e < 0.2) return T.marsh;
  if (m < 0.2) return T.desert;
  if (m < 0.38) return T.scrub;
  if (m < 0.6) return T.grass;
  return T.forest;
}

export function generateMap(spec: MapSpec): MapField {
  const res = RESOLUTION[spec.preset], w = spec.cols * res, h = spec.rows * res, N = w * h, g = spec.gen;
  const field = { res, w, h };
  const raw = heightField(spec, w, h), sea = quantile(raw, g.sea);
  for (const ed of spec.edits) if (ed.op === 'elevate') eachCovered(field, ed.shape, true, (i, c) => { raw[i] = Math.max(0, Math.min(1.2, raw[i] + ed.amount * c)); });

  const water = new Uint8Array(N), elev = new Float32Array(N), seaLevel = Number.isFinite(sea) ? sea : -0.01;
  for (let n = 0; n < N; n++) {
    if (raw[n] < seaLevel) water[n] = 1;
    else elev[n] = Math.min(1, (raw[n] - seaLevel) / (1 - seaLevel || 1));
  }
  const terrain = new Uint8Array(N), wet = new Uint8Array(N);
  // open water as the edits leave it (painted lakes included): where generated rivers stop
  const open = Uint8Array.from(water);
  for (const ed of spec.edits) if (ed.op === 'paint') { const v = ed.terrain === 'water' || ed.terrain === 'deep' ? 1 : 0; eachCovered(field, ed.shape, false, i => { open[i] = v; }); }
  // rivers are traced now (they wet the land around them); their mouths are fitted to the drawn shore at the end
  const mains: { pts: number[]; width: number; mouth: boolean }[] = traceRivers(spec, fillDepressions(raw, w, h, water), elev, open, w, h, res, wet).map(r => ({ ...r, width: riverWidth(spec) }));
  for (const ed of spec.edits) if (ed.op === 'river') mains.push({ pts: smoothLine(ed.points, res), width: ed.width ?? riverWidth(spec), mouth: ed.delta !== false });
  const roads: MapLine[] = [];
  for (const ed of spec.edits) {
    if (ed.op === 'road') roads.push({ pts: smoothLine(ed.points, res), width: spec.preset === 'local' ? 0.5 : 0.08 });
  }
  for (const rv of mains) markLine(rv.pts, rv.width, w, h, res, wet);

  // moisture: noise, plus nearness to water and rivers, biased by the moisture setting
  const near = new Float32Array(N);
  for (let n = 0; n < N; n++) near[n] = water[n] || wet[n] ? 1 : 0;
  const nearB = blur(near, w, h, Math.max(1, Math.round(res * 1.5)), 2);
  const mopts = { w: w * 4, h: h * 4, cells: Math.max(2, Math.round((4 * Math.max(spec.cols, spec.rows)) / (g.feature * 1.4))), octaves: 3, seed: spec.seed + 101 };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const n = j * w + i;
    if (water[n]) { terrain[n] = raw[n] < seaLevel - Math.max(0.08, seaLevel * 0.35) ? T.deep : T.water; continue; }
    const m = 0.5 + (pGradient(i + w, j + h, mopts) - 0.5) * 1.8 + nearB[n] * 0.25 + (g.moisture - 0.5) * 0.9 - elev[n] * 0.12;
    terrain[n] = classify(elev[n], Math.max(0, Math.min(1, m)), spec.preset === 'local');
  }

  const minArea = Math.round(Math.pow(g.simplify * res * 0.55, 2));
  const simple = simplifyTerrain(terrain, w, h, Math.ceil(g.simplify), minArea);
  for (const ed of spec.edits) if (ed.op === 'paint') { const c = T[ed.terrain]; eachCovered(field, ed.shape, false, i => { simple[i] = c; }); }
  for (let n = 0; n < N; n++) if (isWater(simple[n])) elev[n] = 0;

  // each river widens smoothly downstream; one that ends in water as drawn is fitted to the shore and flares into it
  const shown = (x: number, y: number) => { const i = Math.floor(x * res), j = Math.floor(y * res); return i >= 0 && j >= 0 && i < w && j < h && isWater(simple[j * w + i]); };
  const rivers = mains.map(m => {
    const fit = m.mouth ? toShore(m.pts, shown) : null;
    return riverRibbon(fit ?? m.pts, m.width, !!fit);
  });
  return { res, w, h, elevation: elev, terrain: simple, rivers, roads };
}

/** Terrains present, most common first. */
export function terrainsUsed(f: MapField): Terrain[] {
  const count = new Array<number>(TERRAINS.length).fill(0);
  for (const t of f.terrain) count[t]++;
  return TERRAINS.map((t, i) => [t, count[i]] as const).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]).map(([t]) => t);
}
