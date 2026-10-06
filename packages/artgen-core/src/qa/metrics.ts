/** artlab `measure()`: objective pixel-art hygiene signals that complement visual review. */
import { luma, parseColor } from '../lib/color.ts';
import type { Grid } from '../lib/grid.ts';

export interface Metrics {
  fillPct: number;
  colors: number;
  aaPartialPct: number;
  offPalettePct: number;
  orphanPct: number;
  outlinePct: number;
  symmetryPct: number;
  /** Heuristic 0–10: clean palette, outlines, few orphans, limited colours. */
  hygiene: number;
}

export interface MeasureOptions {
  symAxis?: 'x' | 'y' | 'none';
  /** Allowed opaque colours (`#rrggbb`). */
  palette: string[];
  /** Shadow colour (`rgba()`); its pixels are skipped. Default artlab's rgba(0,0,0,0.35). */
  shadow?: string;
}

/** True for a deliberate shadow pixel: shadow RGB at exactly the shadow alpha. */
export function isShadowPixel(d: Uint8ClampedArray, i: number, shadow: readonly number[]): boolean {
  return d[i + 3] === shadow[3] && d[i] === shadow[0] && d[i + 1] === shadow[1] && d[i + 2] === shadow[2];
}

export function measure(g: Grid, { symAxis = 'x', palette, shadow = 'rgba(0,0,0,0.35)' }: MeasureOptions): Metrics {
  const { w, h, d } = g, pal = new Set(palette), sh = parseColor(shadow);
  let filled = 0, partial = 0, offPal = 0, orphans = 0, edge = 0, edgeDark = 0, symHit = 0, symTot = 0;
  const colors = new Set<string>();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, a = d[i + 3];
    if (!a) continue;
    if (isShadowPixel(d, i, sh)) continue;
    filled++;
    if (a < 255) partial++;
    const c = g.get(x, y)!;
    colors.add(c);
    if (!pal.has(c)) offPal++;
    const n = [g.get(x + 1, y), g.get(x - 1, y), g.get(x, y + 1), g.get(x, y - 1)];
    if (n.every(v => v !== c)) orphans++;
    if (n.some(v => !v)) { edge++; if (luma(d[i], d[i + 1], d[i + 2]) < 70) edgeDark++; }
    const mx = symAxis === 'x' ? w - 1 - x : x, my = symAxis === 'x' ? y : h - 1 - y;
    if (symAxis !== 'none') { symTot++; if (g.get(mx, my) === c) symHit++; }
  }
  const pct = (v: number) => (filled ? +((100 * v) / filled).toFixed(1) : 0);
  const m: Metrics = {
    fillPct: +((100 * filled) / (w * h)).toFixed(1), colors: colors.size, aaPartialPct: pct(partial),
    offPalettePct: pct(offPal), orphanPct: pct(orphans), outlinePct: edge ? +((100 * edgeDark) / edge).toFixed(1) : 0,
    symmetryPct: symTot ? +((100 * symHit) / symTot).toFixed(1) : 0, hygiene: 0,
  };
  let s = 10;
  s -= Math.min(3, m.aaPartialPct / 5); s -= Math.min(2, m.offPalettePct / 10); s -= Math.min(2, Math.max(0, m.orphanPct - 4) / 4);
  s -= m.outlinePct < 60 ? (60 - m.outlinePct) / 30 : 0; s -= m.colors > 24 ? Math.min(2, (m.colors - 24) / 10) : 0;
  m.hygiene = +Math.max(0, s).toFixed(1);
  return m;
}
