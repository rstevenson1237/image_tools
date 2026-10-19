/**
 * The ground shaped to a map's `require` list, before it is classified (see `Requirement` in `spec.ts`). Nothing here
 * paints: a terrain requirement pulls moisture and height towards what that terrain is made of and the generator
 * classifies as it always does, so the contours follow the ground and the edge of a forest is the edge of its wet,
 * not the edge of a polygon. Each requirement is felt in full inside its area and fades over `blend` outside it.
 */
import { pGradient } from '../lib/noise.ts';
import { distanceTo, eachCovered } from './geometry.ts';
import type { MapSpec, Requirement, Terrain } from './spec.ts';

type Grid = { res: number; w: number; h: number };
type Band = [number, number];
type HeightReq = Extract<Requirement, { kind: 'height' }>;

/** Terrains the generator classifies by moisture: their edge is ragged and eroded. The rest follow height (or the waterline), so they keep their whole area at full strength. */
const WET_EDGE = new Set<Terrain>(['forest', 'grass', 'scrub', 'desert', 'marsh']);

/** What a terrain is classified from, in height above the waterline (0..1) and moisture (0..1); the numbers keep clear of `classify`'s thresholds. */
function bands(t: Terrain, local: boolean): { e?: Band; m?: Band } {
  const dry: Band = [0.08, (local ? 0.7 : 0.64) - 0.12];
  switch (t) {
    case 'forest': return { e: dry, m: [0.65, 0.75] };
    case 'grass': return { e: dry, m: [0.42, 0.55] };
    case 'scrub': return { e: dry, m: [0.25, 0.35] };
    case 'desert': return { e: dry, m: [0.03, 0.15] };
    case 'marsh': return { e: [0.008, 0.15], m: [0.82, 0.95] };
    case 'sand': return { e: [0.008, 0.03], m: [0.05, 0.6] };
    case 'rock': return { e: local ? [0.76, 1] : [0.68, 0.8] };
    case 'snow': return { e: [0.88, 1] };
    default: return {};
  }
}

/**
 * The weight a requirement has at each sample: 1 in its area, and outside it falling (as (1 - d / blend)³, so it is felt
 * mostly near the edge) to 0 at `blend` map units. For all but a stated height the distance to the edge is warped by noise
 * first, so the edge wanders instead of following the area's outline (a height is smooth and is never warped: noise in it
 * would be noise in its contours). `wet` ground, classified by moisture, has the quick short-waved noise that makes a
 * forest's edge ragged, and is centred on the outline, so a rim just inside it is weakened too, by at most a fifth of the
 * area's reach; `land` (rock, sand, water: classified by height) wanders outwards on a wide, slow noise only.
 */
function weights(spec: MapSpec, f: Grid, area: Parameters<typeof distanceTo>[1], blend: number, mode: 'wet' | 'land' | 'height'): Float32Array {
  if (!(blend > 0)) { const w = new Float32Array(f.w * f.h); eachCovered(f, area, false, i => { w[i] = 1; }); return w; }
  const out = distanceTo(f, area, blend), wet = mode === 'wet';
  const inner = wet ? distanceTo(f, area, blend, true) : null;
  let core = 0;
  if (inner) for (let n = 0; n < inner.length; n++) core = Math.max(core, inner[n]);
  // full strength from `lead + amp` inside the outline (wet), and the noise moves the edge by up to `amp`
  const lead = inner ? Math.min(blend * 0.2, core * 0.2) : 0, amp = inner ? Math.min(blend * 0.3, core * 0.3) : blend * 0.4, ramp = blend * 0.25;
  // short waves (4 and 1.8 cells at feature 16), so a wet edge seldom runs straight for more than a few squares; or one wide wave
  const noise = (scale: number, seed: number) => ({ w: f.w * 4, h: f.h * 4, cells: Math.max(2, Math.round((4 * spec.cols) / (spec.gen.feature * scale))), cellsY: Math.max(2, Math.round((4 * spec.rows) / (spec.gen.feature * scale))), octaves: 2, seed: spec.seed + seed });
  const waves = mode === 'wet' ? [noise(0.26, 303), noise(0.11, 509)] : mode === 'land' ? [noise(1, 709)] : [];
  const w = new Float32Array(f.w * f.h);
  for (let n = 0; n < w.length; n++) {
    const d = out[n], deep = inner ? inner[n] : 0;
    if (d >= blend) continue;
    if (d <= 0 && (!inner || deep >= lead + amp)) { w[n] = 1; continue; }
    const i = n % f.w, j = (n - i) / f.w, signed = d > 0 ? d : -deep;
    let v = 0;
    if (waves.length) v = Math.max(-1, Math.min(1, (waves.reduce((t, o) => t + pGradient(i + f.w, j + f.h, o), 0) - waves.length / 2) * (wet ? 2.6 : 3)));
    const a = inner ? amp : amp * Math.min(1, signed / ramp), s = Math.max(0, signed + lead + v * a) / (blend + lead);
    w[n] = s >= 1 ? 0 : (1 - s) ** 3;
  }
  return w;
}

const intersect = (a: Band, b: Band): Band | null => { const lo = Math.max(a[0], b[0]), hi = Math.min(a[1], b[1]); return lo <= hi ? [lo, hi] : null; };

export interface Shaped {
  /** Moisture at sample `n`, given the generator's own `m` there. */
  moisture(n: number, m: number): number;
  /** Samples a generated river may not enter (the `clear` areas, widened by `margin` map units). */
  blocked: Uint8Array | null;
  /** The `clear` requirements, to test a finished river against. */
  clear: Extract<Requirement, { kind: 'clear' }>[];
}

/** A polyline that passes through each of `p`'s points (a Catmull-Rom spline), a point about every half unit. */
export function streamCurve(p: number[]): number[] {
  const n = p.length / 2, out: number[] = [p[0], p[1]], P = (i: number) => [p[Math.max(0, Math.min(n - 1, i)) * 2], p[Math.max(0, Math.min(n - 1, i)) * 2 + 1]];
  for (let i = 0; i < n - 1; i++) {
    const [p0, p1, p2, p3] = [P(i - 1), P(i), P(i + 1), P(i + 2)], k = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 0.5));
    for (let s = 1; s <= k; s++) {
      const t = s / k, t2 = t * t, t3 = t2 * t;
      out.push(...[0, 1].map(a => 0.5 * (2 * p1[a] + (p2[a] - p0[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 + (3 * p1[a] - p0[a] - 3 * p2[a] + p3[a]) * t3)));
    }
  }
  return out;
}

export interface Stream { id: string; points: number[]; width?: number; delta?: boolean }

/**
 * Shape `raw` (the height field, 0..~1, edits applied) in place to the requirements, in this order: stream valleys,
 * terrain, then explicit height bands (so a stated height beats what a terrain would have chosen). Where a terrain and
 * a height band cover the same ground the terrain's own band is narrowed to the height's, so a requirement the two
 * cannot both meet is left for `check` to name rather than hidden. Later requirements win over earlier ones where they overlap.
 */
export function shapeGround(spec: MapSpec, f: Grid, raw: Float32Array, seaLevel: number, margin: number): Shaped {
  const list = spec.require ?? [], local = spec.preset === 'local', N = f.w * f.h, feature = spec.gen.feature;
  const base = Float32Array.from(raw, v => Math.max(0, Math.min(1, v)));
  const toRaw = (e: number) => seaLevel + e * (1 - seaLevel);
  const blendOf = (r: Requirement) => r.blend ?? feature;

  // a stream's valley: the bed runs down from where the stream starts (never climbing), walls rise to the old ground over a few units
  for (const r of list) {
    if (r.kind !== 'path' || r.path !== 'stream') continue;
    const p = streamCurve(r.points), valley = Math.min(feature * 0.5, 4), steps: [number, number][] = [];
    for (let i = 0; i < p.length - 2; i += 2) {
      const len = Math.hypot(p[i + 2] - p[i], p[i + 3] - p[i + 1]), k = Math.max(1, Math.ceil(len * f.res));
      for (let s = 0; s < k; s++) steps.push([p[i] + ((p[i + 2] - p[i]) * s) / k, p[i + 1] + ((p[i + 3] - p[i + 1]) * s) / k]);
    }
    steps.push([p[p.length - 2], p[p.length - 1]]);
    const at = (x: number, y: number) => raw[Math.min(f.h - 1, Math.max(0, Math.floor(y * f.res))) * f.w + Math.min(f.w - 1, Math.max(0, Math.floor(x * f.res)))];
    const bed = steps.map(([x, y]) => at(x, y)), floor = Math.max(seaLevel + 0.004, 0);
    for (let i = 1; i < bed.length; i++) bed[i] = Math.min(bed[i], bed[i - 1]);
    // the bed is smoothed (a running mean over a unit) and kept a little above the waterline, so a stream is a valley and never a lake
    const win = Math.max(1, Math.round(f.res)), smooth = bed.map((_, i) => { let s = 0, c = 0; for (let k = Math.max(0, i - win); k <= Math.min(bed.length - 1, i + win); k++) { s += bed[k]; c++; } return Math.max(floor, s / c); });
    const strokes = steps.length, reach = valley;
    // nearest step per sample, over the stroke's box
    const best = new Float32Array(N).fill(reach), bedAt = new Float32Array(N);
    for (let k = 0; k < strokes; k++) {
      const [sx, sy] = steps[k], x0 = Math.max(0, Math.floor((sx - reach) * f.res)), x1 = Math.min(f.w - 1, Math.ceil((sx + reach) * f.res)), y0 = Math.max(0, Math.floor((sy - reach) * f.res)), y1 = Math.min(f.h - 1, Math.ceil((sy + reach) * f.res));
      for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
        const d = Math.hypot((i + 0.5) / f.res - sx, (j + 0.5) / f.res - sy), n = j * f.w + i;
        if (d < best[n]) { best[n] = d; bedAt[n] = smooth[k]; }
      }
    }
    for (let n = 0; n < N; n++) {
      if (best[n] >= reach) continue;
      const wgt = 0.5 + 0.5 * Math.cos((best[n] / reach) * Math.PI), target = Math.min(raw[n], bedAt[n]);
      raw[n] += (target - raw[n]) * wgt;
    }
  }

  const heights = list.filter((r): r is HeightReq => r.kind === 'height');
  const heightW = new Map<HeightReq, Float32Array>(heights.map(h => [h, weights(spec, f, h.area, blendOf(h), 'height')]));
  const toBand = (h: HeightReq): Band => [Math.max(h.low / spec.topo.maxElevation, 0.002), Math.min(h.high / spec.topo.maxElevation, 1)];
  /** Pull the ground towards the band [lo, hi]: each sample to the place in the band that `profile` (default: the generator's own noise) gives it. */
  const pull = (w: Float32Array, lo: number, hi: number, profile: Float32Array = base) => { for (let n = 0; n < N; n++) if (w[n] > 0) raw[n] += (lo + (hi - lo) * profile[n] - raw[n]) * w[n]; };
  /**
   * Where a stated height is held, the ground rises with depth into the area (a rise has a crown, a wall rises away from
   * the way it faces) and the generator's noise only roughens it, so the contours follow the shape of the area.
   */
  const rise = (h: HeightReq): Float32Array => {
    const depth = distanceTo(f, h.area, Math.min(Math.max(blendOf(h), 1) * 4, 80), true);
    let core = 0;
    for (let n = 0; n < N; n++) core = Math.max(core, depth[n]);
    return Float32Array.from(base, (b, n) => (core > 0 ? Math.min(1, 0.7 * (depth[n] / core) + 0.3 * b) : b));
  };

  const moist: { w: Float32Array; band: Band }[] = [], ground: { w: Float32Array; band: Band }[] = [];
  const terrains = list.flatMap(r => (r.kind === 'terrain' ? [{ r, w: weights(spec, f, r.area, blendOf(r), WET_EDGE.has(r.terrain) ? 'wet' : 'land'), b: bands(r.terrain, local) }] : []));
  /** The share of `a`'s full-strength samples that `b` also holds at full strength. */
  const within = (a: Float32Array, b: Float32Array) => { let inside = 0, total = 0; for (let n = 0; n < N; n++) if (a[n] === 1) { total++; if (b[n] === 1) inside++; } return total ? inside / total : 0; };
  // where a terrain and a stated height cover the same ground each takes the part of its band inside the other's; bands that
  // do not meet are left as they are (the stated height beats the terrain's), so `check` names what cannot be both
  const heightBand = new Map<HeightReq, Band>(heights.map(h => [h, toBand(h)]));
  for (const t of terrains) {
    if (t.r.terrain === 'water' || t.r.terrain === 'deep') {
      // under the waterline: shallow water within the shallows' reach of the shore, deep water well below it
      const gap = Math.max(0.08, seaLevel * 0.35), lo = t.r.terrain === 'deep' ? 0 : seaLevel - gap * 0.9, hi = t.r.terrain === 'deep' ? Math.max(0, seaLevel - gap * 1.15) : seaLevel - 0.004;
      if (hi > lo) pull(t.w, lo, hi);
      if (t.b.m) moist.push({ w: t.w, band: t.b.m });
      continue;
    }
    if (t.b.m) moist.push({ w: t.w, band: t.b.m });
    if (!t.b.e) continue;
    let e: Band = t.b.e;
    for (const h of heights) {
      const hw = heightW.get(h)!, hb = heightBand.get(h)!;
      if (within(t.w, hw) > 0.5) e = intersect(e, hb) ?? hb;
      if (within(hw, t.w) > 0.5) heightBand.set(h, intersect(hb, t.b.e) ?? hb);
    }
    ground.push({ w: t.w, band: e });
  }
  for (const g of ground) pull(g.w, toRaw(g.band[0]), toRaw(g.band[1]));
  for (const h of heights) { const [lo, hi] = heightBand.get(h)!; pull(heightW.get(h)!, toRaw(lo), toRaw(hi), rise(h)); }

  const clear = list.filter((r): r is Extract<Requirement, { kind: 'clear' }> => r.kind === 'clear');
  let blocked: Uint8Array | null = null;
  for (const c of clear) {
    blocked ??= new Uint8Array(N);
    const d = distanceTo(f, c.area, margin + 0.01);
    for (let n = 0; n < N; n++) if (d[n] <= margin) blocked[n] = 1;
  }
  return {
    moisture(n, m) {
      for (const { w, band } of moist) if (w[n] > 0) m += (band[0] + (band[1] - band[0]) * Math.max(0, Math.min(1, m)) - m) * w[n];
      return m;
    },
    blocked, clear,
  };
}

/** Streams the requirements ask for, in the order the file lists them. */
export function streamsOf(spec: MapSpec): Stream[] {
  return (spec.require ?? []).flatMap(r => (r.kind === 'path' && r.path === 'stream' ? [{ id: r.id, points: r.points, width: r.width, delta: r.delta }] : []));
}

/**
 * A road through `points` that keeps to them and takes the gentler ground between: a least-cost path on a lattice of
 * half-cell steps, where each step costs its length, plus a charge for the height it climbs or drops and for water.
 * `elev` is the height above the waterline (0..1) and `wet` marks open water.
 */
export function routeRoad(points: number[], f: Grid, elev: Float32Array, wet: Uint8Array): number[] {
  const step = Math.max(1, Math.round(f.res / 2)), W = Math.ceil(f.w / step), H = Math.ceil(f.h / step), unit = step / f.res;
  const at = (i: number, j: number) => Math.min(f.h - 1, j * step + (step >> 1)) * f.w + Math.min(f.w - 1, i * step + (step >> 1));
  const cell = (x: number, y: number): [number, number] => [Math.max(0, Math.min(W - 1, Math.floor((x * f.res) / step))), Math.max(0, Math.min(H - 1, Math.floor((y * f.res) / step)))];
  const out: number[] = [points[0], points[1]];
  for (let p = 2; p < points.length; p += 2) {
    const [si, sj] = cell(points[p - 2], points[p - 1]), [ti, tj] = cell(points[p], points[p + 1]);
    const dist = new Float32Array(W * H).fill(Infinity), from = new Int32Array(W * H).fill(-1), done = new Uint8Array(W * H), heap: number[] = [], key = new Float32Array(W * H);
    const less = (a: number, b: number) => key[a] < key[b];
    const push = (n: number) => { heap.push(n); let c = heap.length - 1; while (c) { const q = (c - 1) >> 1; if (!less(heap[c], heap[q])) break; [heap[c], heap[q]] = [heap[q], heap[c]]; c = q; } };
    const pop = () => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = c * 2 + 1, r = l + 1; let m = c; if (l < heap.length && less(heap[l], heap[m])) m = l; if (r < heap.length && less(heap[r], heap[m])) m = r; if (m === c) break; [heap[c], heap[m]] = [heap[m], heap[c]]; c = m; } } return top; };
    const goal = tj * W + ti, h = (i: number, j: number) => Math.hypot(i - ti, j - tj) * unit;
    dist[sj * W + si] = 0; key[sj * W + si] = h(si, sj); push(sj * W + si);
    while (heap.length) {
      const n = pop();
      if (done[n]) continue;
      done[n] = 1;
      if (n === goal) break;
      const i = n % W, j = (n - i) / W;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const x = i + di, y = j + dj, m = y * W + x;
        if ((!di && !dj) || x < 0 || y < 0 || x >= W || y >= H || done[m]) continue;
        const len = Math.hypot(di, dj) * unit, rise = Math.abs(elev[at(x, y)] - elev[at(i, j)]);
        const c = dist[n] + len + rise * 40 + (wet[at(x, y)] ? len * 3 : 0);
        if (c < dist[m]) { dist[m] = c; from[m] = n; key[m] = c + h(x, y); push(m); }
      }
    }
    const path: number[] = [];
    for (let n = goal; n >= 0 && n !== sj * W + si; n = from[n]) { const i = n % W, j = (n - i) / W; path.push(((i + 0.5) * step) / f.res, ((j + 0.5) * step) / f.res); }
    for (let k = path.length - 2; k >= 0; k -= 2) out.push(path[k], path[k + 1]);
    out.push(points[p], points[p + 1]);
  }
  return out;
}

