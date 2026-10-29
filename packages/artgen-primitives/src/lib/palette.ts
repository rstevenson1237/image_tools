/** Palettes: Lospec `.hex`/`.gpl` import, hue-shifted ramp generator, extract-from-image, restrict, swap. */
import { fromHsl, lumaOf, normHex, parseColor, toHex, toHsl } from './color.ts';
import { Grid } from './grid.ts';

export type Ramps = Record<string, string[]>;

/** Lospec `.hex`: one `rrggbb` per line (with or without `#`). */
export function parseHexPalette(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.trim().match(/^#?([0-9a-fA-F]{6})$/);
    if (m) out.push('#' + m[1].toLowerCase());
  }
  return out;
}

/** GIMP `.gpl`: header lines, then `R G B [name]` rows. */
export function parseGpl(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.trim().match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(\s|$)/);
    if (m) out.push(toHex(+m[1], +m[2], +m[3]));
  }
  return out;
}

function hueToward(h: number, target: number, amount: number): number {
  const diff = ((target - h + 540) % 360) - 180;
  return h + Math.sign(diff) * Math.min(Math.abs(diff), amount);
}

export interface RampOptions {
  /** Number of colours, lightest first. */
  steps?: number;
  /** Degrees of hue shift at the ends: highlights toward warm (60°), shadows toward cool (240°). */
  hueShift?: number;
  /** Total lightness span (0–1) from lightest to darkest. */
  contrast?: number;
}

/** Hue-shifted ramp around a base colour, lightest first (the base sits in the middle). */
export function generateRamp(base: string, { steps = 3, hueShift = 12, contrast = 0.45 }: RampOptions = {}): string[] {
  const b = toHsl(base), out: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : (i / (steps - 1)) * 2 - 1; // -1 lightest … +1 darkest
    const grey = b.s < 0.05;
    const h = grey ? b.h : hueToward(b.h, t < 0 ? 60 : 240, hueShift * Math.abs(t));
    const s = grey ? b.s : b.s * (t < 0 ? 1 - 0.25 * -t : 1 + 0.1 * t);
    const l = Math.max(0.04, Math.min(0.97, b.l - (t * contrast) / 2));
    out.push(fromHsl({ h, s, l }));
  }
  return out;
}

/** Median-cut palette of an image's opaque pixels (alpha ≥ 128). */
export function medianCut(g: Grid, n: number): string[] {
  const px: [number, number, number][] = [];
  for (let i = 0; i < g.w * g.h; i++) if (g.d[i * 4 + 3] >= 128) px.push([g.d[i * 4], g.d[i * 4 + 1], g.d[i * 4 + 2]]);
  if (!px.length) return [];
  const boxes = [px];
  const range = (b: [number, number, number][], c: number) => {
    let lo = 255, hi = 0;
    for (const p of b) { if (p[c] < lo) lo = p[c]; if (p[c] > hi) hi = p[c]; }
    return hi - lo;
  };
  while (boxes.length < n) {
    let bi = -1, bc = 0, br = 0;
    boxes.forEach((b, i) => { for (let c = 0; c < 3; c++) { const r = range(b, c); if (b.length > 1 && r > br) { br = r; bi = i; bc = c; } } });
    if (bi < 0) break;
    const b = boxes[bi].sort((p, q) => p[bc] - q[bc]), mid = b.length >> 1;
    boxes.splice(bi, 1, b.slice(0, mid), b.slice(mid));
  }
  const out = boxes.map(b => {
    const s = b.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]);
    return toHex(Math.round(s[0] / b.length), Math.round(s[1] / b.length), Math.round(s[2] / b.length));
  });
  return [...new Set(out)];
}

/** Group colours into ramps: greys together, the rest split by hue gaps; each ramp lightest first. */
export function rampsFromColors(colors: string[], { hueGap = 30, greySat = 0.12 } = {}): Ramps {
  const hs = colors.map(c => ({ c, ...toHsl(c) }));
  const greys = hs.filter(x => x.s < greySat), chroma = hs.filter(x => x.s >= greySat).sort((a, b) => a.h - b.h);
  const groups: (typeof hs)[] = [];
  for (const x of chroma) {
    const last = groups[groups.length - 1];
    if (last && x.h - last[last.length - 1].h <= hueGap) last.push(x); else groups.push([x]);
  }
  // hue wraps: merge the last group into the first when they are close across 360°
  if (groups.length > 1) {
    const first = groups[0], last = groups[groups.length - 1];
    if (first[0].h + 360 - last[last.length - 1].h <= hueGap) { first.unshift(...last); groups.pop(); }
  }
  if (greys.length) groups.push(greys);
  const ramps: Ramps = {};
  groups.forEach((g, i) => { ramps[`r${i}`] = g.map(x => x.c).sort((a, b) => lumaOf(b) - lumaOf(a)); });
  return ramps;
}

/** Extract a palette from a reference image: median cut, then ramp ordering. */
export function extractPalette(g: Grid, n = 16): { colors: string[]; ramps: Ramps } {
  const colors = medianCut(g, n);
  return { colors, ramps: rampsFromColors(colors) };
}

/** Flatten ramps (optionally only the named ones) plus extra singles into a unique colour list. */
export function restrict(ramps: Ramps, names?: string[], extra: string[] = []): string[] {
  const keys = names ?? Object.keys(ramps), out: string[] = [];
  for (const k of keys) {
    const r = ramps[k];
    if (!r) throw new Error(`unknown ramp: ${k}`);
    out.push(...r.map(normHex));
  }
  out.push(...extra.map(normHex));
  return [...new Set(out)];
}

/** Replace colours by a `{ from: to }` map (keys/values any accepted colour; alpha kept). */
export function swapColors(g: Grid, map: Record<string, string>): Grid {
  const m = new Map(Object.entries(map).map(([a, b]) => [normHex(a), parseColor(b)]));
  const out = g.clone();
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const c = g.get(x, y), to = c && m.get(c);
    if (to) { const i = (y * g.w + x) * 4; out.d[i] = to[0]; out.d[i + 1] = to[1]; out.d[i + 2] = to[2]; }
  }
  return out;
}
