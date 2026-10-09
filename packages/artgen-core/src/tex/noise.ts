/**
 * Periodic noise (SPEC §9, PLAN P6b): every function tiles over a `w × h` image by construction — lattices and
 * feature points wrap at the image size — so textures built from them are seamless without blending seams away.
 * Coordinates are pixels; `cells` is how many lattice cells span the image (integers keep the period exact).
 */

const hash2 = (i: number, j: number, seed: number): number => {
  let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const mod = (a: number, b: number) => ((a % b) + b) % b;
const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

export interface PeriodicOptions {
  /** Image size the noise repeats over. */
  w: number;
  h: number;
  /** Lattice cells across the image at the first octave (default 4; per axis with `cellsY`). */
  cells?: number;
  cellsY?: number;
  octaves?: number;
  /** Amplitude falloff per octave (default 0.5). */
  gain?: number;
  seed?: number;
}

/** Periodic value noise, fBm over `octaves`, in [0, 1]. */
export function pValue(x: number, y: number, o: PeriodicOptions): number {
  const oct = o.octaves ?? 1, g = o.gain ?? 0.5, seed = o.seed ?? 1;
  let sum = 0, amp = 1, norm = 0, cx = o.cells ?? 4, cy = o.cellsY ?? cx;
  for (let k = 0; k < oct; k++) {
    const fx = (x / o.w) * cx, fy = (y / o.h) * cy, i = Math.floor(fx), j = Math.floor(fy), u = smooth(fx - i), v = smooth(fy - j);
    const at = (a: number, b: number) => hash2(mod(a, cx), mod(b, cy), seed + k * 1013);
    const a = at(i, j), b = at(i + 1, j), c = at(i, j + 1), d = at(i + 1, j + 1);
    sum += amp * (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v);
    norm += amp; amp *= g; cx *= 2; cy *= 2;
  }
  return sum / norm;
}

/** Periodic gradient (Perlin) noise, fBm, in [0, 1]. */
export function pGradient(x: number, y: number, o: PeriodicOptions): number {
  const oct = o.octaves ?? 1, g = o.gain ?? 0.5, seed = o.seed ?? 1;
  let sum = 0, amp = 1, norm = 0, cx = o.cells ?? 4, cy = o.cellsY ?? cx;
  for (let k = 0; k < oct; k++) {
    const fx = (x / o.w) * cx, fy = (y / o.h) * cy, i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j, u = smooth(tx), v = smooth(ty);
    const grad = (a: number, b: number, dx: number, dy: number) => { const t = hash2(mod(a, cx), mod(b, cy), seed + k * 7919) * Math.PI * 2; return Math.cos(t) * dx + Math.sin(t) * dy; };
    const n00 = grad(i, j, tx, ty), n10 = grad(i + 1, j, tx - 1, ty), n01 = grad(i, j + 1, tx, ty - 1), n11 = grad(i + 1, j + 1, tx - 1, ty - 1);
    const nx0 = n00 + (n10 - n00) * u, nx1 = n01 + (n11 - n01) * u;
    sum += amp * (nx0 + (nx1 - nx0) * v);
    norm += amp; amp *= g; cx *= 2; cy *= 2;
  }
  return Math.max(0, Math.min(1, 0.5 + (sum / norm) * 0.75));
}

export interface WorleyResult {
  /** Distance to the nearest feature point, in cell units. */
  f1: number;
  /** Distance to the second nearest. */
  f2: number;
  /** Stable id of the nearest feature's cell (for per-stone colour, mortar, …). */
  id: number;
  /** The nearest feature point in pixels (wrapped into the image). */
  cx: number;
  cy: number;
}

/** Periodic Worley (cellular) noise: one jittered feature point per cell (`jitter` 0–1), distances wrap. */
export function pWorley(x: number, y: number, o: PeriodicOptions & { jitter?: number }): WorleyResult {
  const cx = o.cells ?? 4, cy = o.cellsY ?? cx, seed = o.seed ?? 1, jit = o.jitter ?? 0.9;
  const fx = (x / o.w) * cx, fy = (y / o.h) * cy, i = Math.floor(fx), j = Math.floor(fy);
  let f1 = Infinity, f2 = Infinity, id = 0, px = 0, py = 0;
  for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) {
    const ci = mod(i + a, cx), cj = mod(j + b, cy);
    const ox = 0.5 + (hash2(ci, cj, seed) - 0.5) * jit, oy = 0.5 + (hash2(ci, cj, seed + 31) - 0.5) * jit;
    const qx = i + a + ox, qy = j + b + oy, d = Math.hypot(qx - fx, (qy - fy) * (cx / cy) * (o.h / o.w)); // in x-cell units, round in pixels
    if (d < f1) { f2 = f1; f1 = d; id = cj * cx + ci; px = mod(qx, cx); py = mod(qy, cy); } else if (d < f2) f2 = d;
  }
  return { f1, f2, id, cx: (px / cx) * o.w, cy: (py / cy) * o.h };
}

/** A periodic scalar field sampled per pixel (row-major Float32Array). */
export function field(w: number, h: number, fn: (x: number, y: number) => number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = fn(x + 0.5, y + 0.5);
  return out;
}

/** Stretch a field to [0, 1]. */
export function normalize(f: Float32Array): Float32Array {
  let lo = Infinity, hi = -Infinity;
  for (const v of f) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const out = new Float32Array(f.length), r = hi - lo || 1;
  for (let i = 0; i < f.length; i++) out[i] = (f[i] - lo) / r;
  return out;
}

/** Box blur with wrap-around (periodic), radius `r` px. */
export function blurWrap(f: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(f.length), out = new Float32Array(f.length), n = 2 * r + 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let k = -r; k <= r; k++) s += f[y * w + mod(x + k, w)]; tmp[y * w + x] = s / n; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let k = -r; k <= r; k++) s += tmp[mod(y + k, h) * w + x]; out[y * w + x] = s / n; }
  return out;
}
