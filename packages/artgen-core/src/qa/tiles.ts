/**
 * Tile metrics (SPEC §9, §11; PLAN P6b).
 *
 * `seam`: how much more the colour jumps across the wrap edges (right → left, bottom → top) than between neighbours
 * inside the tile. 1 = the edges are as continuous as the interior; a seam shows above ~1.6.
 *
 * `repetition`: what makes a tiled floor read as a grid — structure at the scale of the tile itself. The tile's luma is
 * low-passed (wrap-around box blur, radius ≈ tile/6, twice), so speckle and small features vanish and only blotches
 * the size of a quarter tile or more survive; their spread (`lowStd`, luma units) and the strongest one
 * (`landmark`, how far the most distinct blotch sits from the mean) are what an eye picks up as the same mark
 * repeating every tile. Calibrated on the P3 fixtures' tiles that blind review called out (calibration.md).
 */
import type { Grid } from '../lib/grid.ts';
import { blurWrap } from '../tex/noise.ts';

const lumaAt = (g: Grid, x: number, y: number) => { const i = (y * g.w + x) * 4; return 0.299 * g.d[i] + 0.587 * g.d[i + 1] + 0.114 * g.d[i + 2]; };
const diff = (g: Grid, a: number, b: number) => {
  const i = a * 4, j = b * 4;
  return Math.abs(g.d[i] - g.d[j]) + Math.abs(g.d[i + 1] - g.d[j + 1]) + Math.abs(g.d[i + 2] - g.d[j + 2]) + Math.abs(g.d[i + 3] - g.d[j + 3]);
};

export interface SeamMetric { ratio: number; edge: number; interior: number }

/**
 * The colour step across the wrap edges against the strong steps inside the tile: per row boundary (and per column
 * boundary) the mean step along it; the wrap boundary is compared with the 90th percentile of the interior ones. A
 * seamless texture's wrap is an ordinary boundary (≈ 1 or below); a plank seam on the tile edge matches the plank seams
 * inside; a cut-off gradient or a mismatched feature stands out above all of them.
 */
export function seamMetric(g: Grid): SeamMetric {
  const { w, h } = g;
  const rowStep = (j: number) => { let s = 0; for (let x = 0; x < w; x++) s += diff(g, j * w + x, ((j + 1) % h) * w + x); return s / w; };
  const colStep = (i: number) => { let s = 0; for (let y = 0; y < h; y++) s += diff(g, y * w + i, y * w + ((i + 1) % w)); return s / h; };
  const p90 = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * 0.9))] ?? 0; };
  const rows = Array.from({ length: h - 1 }, (_, j) => rowStep(j)), cols = Array.from({ length: w - 1 }, (_, i) => colStep(i));
  const rw = rowStep(h - 1), cw = colStep(w - 1), ri = p90(rows), ci = p90(cols);
  const ratio = Math.max(rw / Math.max(1, ri), cw / Math.max(1, ci));
  return { ratio: +ratio.toFixed(2), edge: +Math.max(rw, cw).toFixed(1), interior: +Math.max(ri, ci).toFixed(1) };
}

export interface RepetitionMetric {
  /** Spread of the low-passed luma (blotches about a quarter tile or bigger), luma units. */
  lowStd: number;
  /** How far the most distinct blotch sits from the mean, luma units. */
  landmark: number;
  /** Marks: pixels in minority colours (< 12 % of the tile each) at least 25 luma off the tile mean, in blobs of ≥ 2 px. */
  markShare: number;
  /** Their mean luma distance from the tile mean. */
  markContrast: number;
  /** markShare × markContrast: how much the marks weigh. */
  marks: number;
  /** How many separate marks the tile has: a handful lands on the same spots every tile and draws the lattice. */
  markBlobs: number;
  /** Marks much stronger than the tile's typical mark (> 2.2 × the median mark contrast, and > 60) in colours of their own
   * (< 1.5 % of the tile), 3 px or more: landmarks even in a busy tile. */
  standouts: number;
  radius: number;
}

export function repetitionMetric(g: Grid): RepetitionMetric {
  const { w, h } = g, L = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) L[y * w + x] = g.alpha(x, y) ? lumaAt(g, x, y) : 0;
  const r = Math.max(2, Math.round(Math.min(w, h) / 6)), B = blurWrap(blurWrap(L, w, h, r), w, h, r);
  let mean = 0, lmean = 0;
  for (const v of B) mean += v;
  mean /= B.length;
  for (const v of L) lmean += v;
  lmean /= L.length;
  let s = 0, m = 0;
  for (const v of B) { s += (v - mean) ** 2; m = Math.max(m, Math.abs(v - mean)); }
  const counts = new Map<number, number>(), key = (i: number) => (g.d[i * 4] << 16) | (g.d[i * 4 + 1] << 8) | g.d[i * 4 + 2];
  for (let i = 0; i < w * h; i++) counts.set(key(i), (counts.get(key(i)) ?? 0) + 1);
  const mark = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) if (counts.get(key(i))! / (w * h) < 0.12) { const d = Math.abs(L[i] - lmean); if (d > 25) mark[i] = d; }
  const seen = new Uint8Array(w * h);
  let mk = 0, mc = 0, blobs = 0;
  const blobContrast: number[] = [], blobRare: boolean[] = [];
  for (let i = 0; i < w * h; i++) {
    if (!mark[i] || seen[i]) continue;
    const blob: number[] = [], st = [i];
    seen[i] = 1;
    while (st.length) {
      const p = st.pop()!, x = p % w, y = (p / w) | 0;
      blob.push(p);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = (((y + dy) % h + h) % h) * w + (((x + dx) % w) + w) % w; if (mark[q] && !seen[q]) { seen[q] = 1; st.push(q); } }
    }
    if (blob.length >= 2) {
      blobs++; mk += blob.length;
      let c = 0;
      for (const p of blob) { mc += mark[p]; c += mark[p]; }
      blobContrast.push(c / blob.length);
      // a landmark's colour belongs to it: it appears nowhere else much (< 1.5 % of the tile)
      blobRare.push(blob.length >= 3 && blob.every(p => counts.get(key(p))! / (w * h) < 0.015));
    }
  }
  // standouts: marks far stronger than the tile's typical mark (a glowing mushroom among pebbles)
  const sorted = [...blobContrast].sort((a, b) => a - b), median = sorted.length ? sorted[sorted.length >> 1] : 0;
  const standouts = blobContrast.filter((c, i) => blobRare[i] && c > Math.max(60, 2.2 * median)).length;
  const markShare = mk / (w * h), markContrast = mk ? mc / mk : 0;
  return {
    lowStd: +Math.sqrt(s / B.length).toFixed(1), landmark: +m.toFixed(1), markShare: +markShare.toFixed(3), markContrast: +markContrast.toFixed(1),
    marks: +(markShare * markContrast).toFixed(2), markBlobs: blobs, standouts, radius: r,
  };
}

export interface RepetitionThresholds { lowStd: number; marks: number; maxBlobs: number }
/**
 * Calibrated on the P3 fixtures' five tiles, all marked down by blind review for a visible grid: mud (8 marks), bog-water
 * (7) and linoleum's dashes (2) are flagged here, the iso floor by its dark rim (`borderContrast` 60 > 25, checked in
 * conformance); ward-wall (19 low-contrast stains and grout ticks) is not. Of the twelve material recipes (swamp
 * direction), lava and carpet are flagged at 32 px only, snow (its sparkles) and tech (vents and light strips: a periodic
 * design, `review.periodic`) at both sizes.
 */
export const REPETITION_FLAG: RepetitionThresholds = { lowStd: 5, marks: 0.3, maxBlobs: 12 };

/** Why a tile reads as a grid when repeated (empty: it doesn't). */
export function repetitionIssues(m: RepetitionMetric, th: RepetitionThresholds = REPETITION_FLAG): string[] {
  const out: string[] = [];
  if (m.lowStd > th.lowStd) out.push(`tile-sized blotches (low-frequency spread ${m.lowStd} > ${th.lowStd})`);
  if (m.markBlobs >= 1 && m.markBlobs <= th.maxBlobs && m.marks >= th.marks) out.push(`${m.markBlobs} contrasting mark${m.markBlobs > 1 ? 's' : ''} land on the same spots every tile (weight ${m.marks})`);
  else if (m.standouts >= 1 && m.standouts <= 6) out.push(`${m.standouts} mark${m.standouts > 1 ? 's' : ''} far stronger than the rest stand out every tile`);
  return out;
}

export const repeats = (m: RepetitionMetric, th?: RepetitionThresholds): boolean => repetitionIssues(m, th).length > 0;

/**
 * The tile as one period of its repeat: a full-bleed square tile as it is; a 2:1 iso diamond (transparent corners) with
 * its corners filled from the diagonal neighbours (the staggered layout repeats every w × h). Undefined when the
 * transparent pixels aren't the corners of a staggered repeat.
 */
export function periodicPatch(g: Grid): Grid | undefined {
  let holes = 0;
  for (let i = 3; i < g.d.length; i += 4) if (g.d[i] < 255) holes++;
  if (!holes) return g;
  const out = g.clone(), hw = g.w >> 1, hh = g.h >> 1;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g.alpha(x, y) === 255) continue;
    const sx = (x + hw) % g.w, sy = (y + hh) % g.h;
    if (g.alpha(sx, sy) !== 255) return undefined;
    out.d.set(g.d.subarray((sy * g.w + sx) * 4, (sy * g.w + sx) * 4 + 4), (y * g.w + x) * 4);
  }
  return out;
}

/**
 * How much the tile's own border stands out from its inside, in luma: a dark rim (grout, an outline round the diamond)
 * draws the tile grid across a floor even when nothing inside the tile repeats. The border is the outer pixel ring of a
 * square tile, or the pixels of an iso diamond next to its transparent corners.
 */
export function borderContrast(g: Grid): number {
  let holes = false;
  for (let i = 3; i < g.d.length; i += 4) if (g.d[i] < 255) { holes = true; break; }
  let bs = 0, bn = 0, is = 0, inn = 0;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    if (g.alpha(x, y) < 255) continue;
    const ring = holes
      ? [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g.alpha(x + dx, y + dy) < 255)
      : x === 0 || y === 0 || x === g.w - 1 || y === g.h - 1;
    const l = lumaAt(g, x, y);
    if (ring) { bs += l; bn++; } else { is += l; inn++; }
  }
  return bn && inn ? +Math.abs(bs / bn - is / inn).toFixed(1) : 0;
}
