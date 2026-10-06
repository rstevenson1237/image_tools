/** Pixel-art post passes (artlab set + selout and ordered dither). Colours always come from the caller (R11). */
import { dist2, normHex, parseColor } from './color.ts';
import { Grid } from './grid.ts';

const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8: [number, number][] = [...N4, [1, 1], [-1, -1], [1, -1], [-1, 1]];

/** Outer 1 px outline: every empty pixel 4- (or 8-) adjacent to a filled pixel gets `color`. */
export function outline(g: Grid, color: string, diag = false): Grid {
  const out = g.clone(), nb = diag ? N8 : N4;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g.alpha(x, y) > 127) continue;
    if (nb.some(([dx, dy]) => g.alpha(x + dx, y + dy) > 200)) out.set(x, y, color);
  }
  return out;
}

/**
 * Selective outline: like `outline`, but each outline pixel takes the darkest colour of the ramp its
 * neighbouring fill belongs to (falls back to `fallback` for colours outside every ramp).
 */
export function selout(g: Grid, ramps: string[][], fallback: string): Grid {
  const darkest = new Map<string, string>();
  for (const r of ramps) for (const c of r) darkest.set(normHex(c), normHex(r[r.length - 1]));
  const out = g.clone();
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g.alpha(x, y) > 127) continue;
    const n = N4.find(([dx, dy]) => g.alpha(x + dx, y + dy) > 200);
    if (!n) continue;
    const c = g.get(x + n[0], y + n[1])!;
    out.set(x, y, darkest.get(c) ?? fallback);
  }
  return out;
}

const BAYER: Record<string, number[][]> = {
  bayer2: [[0, 2], [3, 1]].map(r => r.map(v => (v + 0.5) / 4)),
  bayer4: [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map(r => r.map(v => (v + 0.5) / 16)),
};

export type Dither = 'none' | 'bayer2' | 'bayer4' | 'noise';

/**
 * Snap every pixel to the nearest palette colour; alpha becomes 0 or 255 (cut at `alphaCut`).
 * With an ordered dither, pixels between two palette colours alternate by the Bayer threshold.
 */
export function quantize(g: Grid, pal: string[], { alphaCut = 128, dither = 'none' as Dither } = {}): Grid {
  const P = pal.map(parseColor), out = new Grid(g.w, g.h), m = BAYER[dither];
  for (let i = 0; i < g.w * g.h; i++) {
    const a = g.d[i * 4 + 3];
    if (a < alphaCut) continue;
    const r = g.d[i * 4], gg = g.d[i * 4 + 1], b = g.d[i * 4 + 2];
    let best = 0, bd = 1e9, second = 0, sd = 1e9;
    for (let k = 0; k < P.length; k++) {
      const d = dist2(P[k], r, gg, b);
      if (d < bd) { second = best; sd = bd; bd = d; best = k; } else if (d < sd) { sd = d; second = k; }
    }
    let k = best;
    if (m && P.length > 1) {
      const x = i % g.w, y = (i / g.w) | 0, t = Math.sqrt(bd) / (Math.sqrt(bd) + Math.sqrt(sd) || 1);
      if (t > m[y % m.length][x % m.length]) k = second;
    }
    out.d.set([P[k][0], P[k][1], P[k][2], 255], i * 4);
  }
  return out;
}

/** Majority (mode) downsample by integer factor `f`: most common opaque colour per block, keeps lines crisp. */
export function modeDownsample(g: Grid, f: number): Grid {
  const out = new Grid(Math.floor(g.w / f), Math.floor(g.h / f));
  for (let y = 0; y < out.h; y++) for (let x = 0; x < out.w; x++) {
    const counts = new Map<string, number>();
    let empty = 0;
    for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) {
      const c = g.get(x * f + i, y * f + j);
      if (!c) { empty++; continue; }
      counts.set(c, (counts.get(c) || 0) + 1);
    }
    if (empty > (f * f) / 2) continue;
    let best: string | null = null, bn = 0;
    for (const [c, n] of counts) if (n > bn) { bn = n; best = c; }
    out.set(x, y, best);
  }
  return out;
}

/** Drop shadow offset (dx, dy), drawn under the sprite. */
export function dropShadow(g: Grid, dx: number, dy: number, color: string): Grid {
  const out = new Grid(g.w, g.h);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.alpha(x - dx, y - dy) > 200) out.set(x, y, color);
  return out.stamp(g);
}

/** Replace isolated single pixels whose four neighbours share one other colour. */
export function despeckle(g: Grid): Grid {
  const out = g.clone();
  for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) {
    const c = g.get(x, y);
    if (!c) continue;
    const n = [g.get(x + 1, y), g.get(x - 1, y), g.get(x, y + 1), g.get(x, y - 1)];
    if (n.every(v => v && v !== c) && n[0] === n[1] && n[1] === n[2]) out.set(x, y, n[0]);
  }
  return out;
}
