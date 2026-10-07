/**
 * Review sheets (R7): one row per version — [1× on checker] [scaled on checker] [scaled in context] [silhouette] —
 * with v(n−1) beside v(n), the direction's anchors underneath, labels in the pixel font, long edge ≤ 1568 px.
 * The silhouette panel (rev 9) shows the opaque body solid black on light grey: a shape that does not read in black
 * does not read in the game.
 */
import { drawText, GLYPH_H, textWidth } from '../lib/font.ts';
import { Grid } from '../lib/grid.ts';

export interface SheetRow {
  label: string;
  grid: Grid;
  /** Display scale (reduced automatically to fit `maxEdge`). */
  scale: number;
  /** Solid game background for the context panel. */
  bg?: string;
  /** Context drawn under the sprite in the third panel (same size as the sprite, e.g. an iso floor). */
  context?: Grid;
  /** Add the black silhouette panel (default true; off for full-bleed tiles, whose silhouette is a square). */
  silhouette?: boolean;
}

const SIL_BG = '#c8c8c8', SIL_INK = '#000000';

/** The opaque body (alpha 255: ground shadows and glows are translucent) as solid black on transparent. */
export function silhouette(g: Grid): Grid {
  const out = new Grid(g.w, g.h);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.alpha(x, y) === 255) out.set(x, y, SIL_INK);
  return out;
}

/** Silhouette panel scale for a row shown at `s`: half size, so the shape is judged small, as in the game. */
const silScale = (s: number) => Math.max(1, Math.round(s / 2));

export interface ReviewSheetOptions {
  title: string;
  rows: SheetRow[];
  anchors?: { label: string; grid: Grid }[];
  anchorScale?: number;
  maxEdge?: number;
}

const PAD = 12, TXT = 2, LAB = GLYPH_H * TXT + 6, BG = '#16161c', FG = '#dddddd', TITLE = '#ffffff';

/** Checkerboard of `s` px squares. */
export function checker(g: Grid, x: number, y: number, w: number, h: number, s = 8): void {
  for (let j = 0; j < h; j += s) for (let i = 0; i < w; i += s)
    g.fill(x + i, y + j, Math.min(s, w - i), Math.min(s, h - j), ((i + j) / s) % 2 ? '#2a2a33' : '#33333d');
}

function layout(o: ReviewSheetOptions, k: number) {
  let W = PAD * 2 + textWidth(o.title, TXT), H = PAD + LAB + PAD / 2;
  const rows = o.rows.map(r => {
    const s = Math.max(1, Math.round(r.scale * k)), sw = r.grid.w * s, sh = r.grid.h * s;
    const sil = r.silhouette === false ? 0 : PAD + r.grid.w * silScale(s);
    W = Math.max(W, PAD * 4 + r.grid.w + sw * 2 + sil, PAD * 2 + textWidth(r.label, TXT));
    const y = H; H += LAB + sh + PAD;
    return { r, s, sw, sh, y };
  });
  const as = Math.max(1, Math.round((o.anchorScale ?? 3) * k)), anchors = o.anchors ?? [];
  let ay = 0;
  if (anchors.length) {
    ay = H; const aw = anchors.reduce((n, a) => n + a.grid.w * as + PAD, PAD);
    W = Math.max(W, aw); H += LAB + Math.max(...anchors.map(a => a.grid.h * as)) + LAB + PAD;
  }
  return { W, H, rows, as, ay };
}

export function reviewSheet(o: ReviewSheetOptions): Grid {
  const maxEdge = o.maxEdge ?? 1568;
  let k = 1, L = layout(o, k);
  while (Math.max(L.W, L.H) > maxEdge && k > 0.05) { k *= 0.85; L = layout(o, k); }
  const g = new Grid(L.W, L.H).fill(0, 0, L.W, L.H, BG);
  drawText(g, PAD, PAD, o.title, TITLE, TXT);
  for (const { r, s, sw, sh, y } of L.rows) {
    drawText(g, PAD, y, r.label, FG, TXT);
    const top = y + LAB, big = r.grid.scale(s);
    checker(g, PAD, top, r.grid.w, r.grid.h, 4); g.over(r.grid, PAD, top);
    const x2 = PAD * 2 + r.grid.w; checker(g, x2, top, sw, sh); g.over(big, x2, top);
    const x3 = x2 + sw + PAD;
    g.fill(x3, top, sw, sh, r.bg ?? '#000000');
    if (r.context) g.over(r.context.scale(s), x3, top);
    g.over(big, x3, top);
    if (r.silhouette !== false) {
      const ss = silScale(s), x4 = x3 + sw + PAD;
      g.fill(x4, top, r.grid.w * ss, r.grid.h * ss, SIL_BG);
      g.over(silhouette(r.grid).scale(ss), x4, top);
    }
  }
  if (o.anchors?.length) {
    drawText(g, PAD, L.ay, 'ANCHORS', FG, TXT);
    let x = PAD;
    for (const a of o.anchors) {
      const top = L.ay + LAB, big = a.grid.scale(L.as);
      checker(g, x, top, big.w, big.h); g.over(big, x, top);
      drawText(g, x, top + big.h + 4, a.label, FG, TXT);
      x += big.w + PAD;
    }
  }
  return g;
}

/** Grid of images with labels underneath (comparison sheets); each column and row sizes to its own content. */
export function contactSheet(title: string, items: { label: string; grid: Grid; bg?: string; context?: Grid }[], scale: number, cols: number, maxEdge = 1568): Grid {
  const size = (sc: number) => {
    const cw = Array.from({ length: cols }, (_, c) => Math.max(0, ...items.filter((_, n) => n % cols === c).map(i => Math.max(i.grid.w * sc, textWidth(i.label, TXT)))) + PAD);
    const rh = Array.from({ length: Math.ceil(items.length / cols) }, (_, r) => Math.max(...items.slice(r * cols, r * cols + cols).map(i => i.grid.h * sc)) + LAB + PAD);
    const W = Math.max(PAD + cw.reduce((a, b) => a + b, 0), PAD * 2 + textWidth(title, TXT)), H = PAD + LAB + rh.reduce((a, b) => a + b, 0) + PAD;
    return { cw, rh, W, H };
  };
  let s = scale, L = size(s);
  while (Math.max(L.W, L.H) > maxEdge && s > 1) { s--; L = size(s); }
  const g = new Grid(L.W, L.H).fill(0, 0, L.W, L.H, BG);
  drawText(g, PAD, PAD, title, TITLE, TXT);
  items.forEach((it, n) => {
    const c = n % cols, r = Math.floor(n / cols), big = it.grid.scale(s);
    const x = PAD + L.cw.slice(0, c).reduce((a, b) => a + b, 0), y = PAD + LAB + L.rh.slice(0, r).reduce((a, b) => a + b, 0);
    if (it.bg) g.fill(x, y, big.w, big.h, it.bg); else checker(g, x, y, big.w, big.h);
    if (it.context) g.over(it.context.scale(s), x, y);
    g.over(big, x, y);
    drawText(g, x, y + big.h + 4, it.label, FG, TXT);
  });
  return g;
}
