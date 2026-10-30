/**
 * The one-page data sheet (docs/WORKFLOW.md §8): what a person reads and signs off, as markdown and as a picture. The
 * pictures use the pixel font in `artgen-primitives`, in the same dark style as the pixel-art review sheets, with the long edge
 * at most 1568 px (the review-image cap).
 */
import { drawText, GLYPH_H } from 'artgen-primitives/lib/font.ts';
import { Grid } from 'artgen-primitives/lib/grid.ts';

export interface DataSheet {
  /** "keep — terrain map", "goblin — character". */
  title: string;
  /** Ledger key: `map:keep`, or the brief id. */
  subject: string;
  rows: { label: string; value: string }[];
  /** What must hold: a map's requirements; for art, the animation contract. */
  must?: { text: string; met?: boolean }[];
  /** `#rrggbb`, art only (the kind's palette). */
  swatches?: string[];
  /** Reference files, relative to art/. */
  refs?: string[];
  /** The brief's text, cut to a few lines. */
  notes?: string;
}

export interface SheetRef { label: string; grid: Grid }

/** The sheet as markdown (`sheet.md`-style text for a pull request or a chat). */
export function dataSheetMarkdown(s: DataSheet): string {
  const out = [`# ${s.title}`, '', `Subject: \`${s.subject}\``, ''];
  if (s.rows.length) out.push('| | |', '|---|---|', ...s.rows.map(r => `| ${r.label} | ${r.value.replace(/\|/g, '\\|')} |`), '');
  if (s.must?.length) out.push('## Must hold', '', ...s.must.map(m => `- ${m.met === undefined ? '' : m.met ? '[x] ' : '[ ] '}${m.text}`), '');
  if (s.swatches?.length) out.push('## Palette', '', s.swatches.map(c => `\`${c}\``).join(' '), '');
  if (s.refs?.length) out.push('## References', '', ...s.refs.map(r => `- ${r}`), '');
  if (s.notes?.trim()) out.push('## Notes', '', s.notes.trim(), '');
  return out.join('\n').replace(/\n+$/, '\n');
}

const PAD = 12, TXT = 2, CH = (3 + 1) * TXT, LINE = GLYPH_H * TXT + 6, BG = '#16161c', FG = '#dddddd', DIM = '#8c8ca0', TITLE = '#ffffff', OK = '#7ad08a', BAD = '#e07a7a';
const MAX_EDGE = 1568, SHEET_W = 560, THUMB = 112;

/** The font has no accents or arrows; swap the few characters the sheets use for plain ones. */
const plain = (s: string): string => s.replace(/×/g, 'x').replace(/[–—−]/g, '-').replace(/…/g, '...').replace(/→/g, '->').replace(/[^\x20-\x7e]/g, '?');

/** Wrap on spaces to `n` characters a line; a longer word is cut. */
export function wrap(text: string, n: number): string[] {
  const out: string[] = [];
  for (const para of plain(text).split('\n')) {
    let line = '';
    for (let w of para.split(/\s+/).filter(Boolean)) {
      while (w.length > n) { if (line) { out.push(line); line = ''; } out.push(w.slice(0, n)); w = w.slice(n); }
      if (!line) line = w; else if (line.length + 1 + w.length <= n) line += ` ${w}`; else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out;
}

/** Shrink to fit a box by averaging (never enlarges). Map renders are far larger than a sheet. */
export function fitGrid(g: Grid, maxW: number, maxH: number): Grid {
  const k = Math.min(1, maxW / g.w, maxH / g.h);
  if (k >= 1) return g;
  const w = Math.max(1, Math.floor(g.w * k)), h = Math.max(1, Math.floor(g.h * k)), out = new Grid(w, h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * g.h) / h), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * g.h) / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * g.w) / w), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * g.w) / w));
      let r = 0, gr = 0, b = 0, a = 0, n = 0;
      for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) { const s = (j * g.w + i) * 4, al = g.d[s + 3]; r += g.d[s] * al; gr += g.d[s + 1] * al; b += g.d[s + 2] * al; a += al; n++; }
      const o = (y * w + x) * 4;
      if (a) { out.d[o] = r / a; out.d[o + 1] = gr / a; out.d[o + 2] = b / a; out.d[o + 3] = a / n; }
    }
  }
  return out;
}

interface Block { h: number; draw(g: Grid, x: number, y: number): void }

/** The sheet as blocks of drawing, `width` px wide; the blocks that don't fit under `maxH` are replaced by `...`. */
function blocks(s: DataSheet, width: number, maxH: number, o: { title: boolean; refs?: SheetRef[] }): Block[] {
  const cols = Math.floor((width - PAD * 2) / CH), all: Block[] = [];
  const text = (t: string, color: string, indent = 0): Block => ({ h: LINE, draw: (g, x, y) => drawText(g, x + indent * CH, y, t, color, TXT) });
  const head = (t: string): Block => ({ h: LINE + 4, draw: (g, x, y) => drawText(g, x, y + 4, t, DIM, TXT) });
  if (o.title) for (const l of wrap(s.title, cols)) all.push(text(l, TITLE));
  if (o.title) all.push(text(plain(s.subject), DIM));
  const lw = Math.min(14, Math.max(0, ...s.rows.map(r => r.label.length)) + 1);
  for (const r of s.rows) wrap(r.value, Math.max(8, cols - lw)).forEach((l, i) => all.push({ h: LINE, draw: (g, x, y) => { if (!i) drawText(g, x, y, plain(r.label).slice(0, lw - 1), DIM, TXT); drawText(g, x + lw * CH, y, l, FG, TXT); } }));
  if (s.must?.length) {
    all.push(head('MUST HOLD'));
    for (const m of s.must) wrap(m.text, cols - 4).forEach((l, i) => all.push({ h: LINE, draw: (g, x, y) => {
      if (!i) drawText(g, x, y, m.met === undefined ? ' - ' : m.met ? '[X]' : '[ ]', m.met === false ? BAD : m.met ? OK : DIM, TXT);
      drawText(g, x + 4 * CH, y, l, m.met === false ? BAD : FG, TXT);
    } }));
  }
  if (s.swatches?.length) {
    const per = Math.max(1, Math.floor((width - PAD * 2) / 24)), n = Math.ceil(s.swatches.length / per);
    all.push(head('PALETTE'), { h: n * 24, draw: (g, x, y) => s.swatches!.forEach((c, i) => g.fill(x + (i % per) * 24, y + Math.floor(i / per) * 24, 22, 22, c)) });
  }
  if (s.refs?.length) { all.push(head('REFERENCES')); for (const r of s.refs) for (const l of wrap(r, cols)) all.push(text(l, FG)); }
  if (o.refs?.length) {
    if (!s.refs?.length) all.push(head('REFERENCES'));
    const thumbs = o.refs.map(r => ({ label: r.label, grid: fitGrid(r.grid, THUMB, THUMB) })), per = Math.max(1, Math.floor((width - PAD * 2 + 8) / (THUMB + 8)));
    for (let i = 0; i < thumbs.length; i += per) {
      const row = thumbs.slice(i, i + per);
      all.push({ h: THUMB + LINE, draw: (g, x, y) => row.forEach((t, k) => {
        const tx = x + k * (THUMB + 8);
        g.fill(tx, y, THUMB, THUMB, '#2a2a33'); g.over(t.grid, tx + ((THUMB - t.grid.w) >> 1), y + ((THUMB - t.grid.h) >> 1));
        drawText(g, tx, y + THUMB + 3, plain(t.label).slice(0, Math.floor(THUMB / CH)), FG, TXT);
      }) });
    }
  }
  if (s.notes?.trim()) {
    all.push(head('NOTES'));
    const ls = wrap(s.notes.trim(), cols);
    for (const l of ls.slice(0, 8)) all.push(text(l, FG));
    if (ls.length > 8) all.push(text('...', DIM));
  }
  // cut what does not fit under the cap, ending on `...`
  let used = PAD * 2, keep = 0;
  while (keep < all.length && used + all[keep].h <= maxH - LINE) used += all[keep++].h;
  return keep === all.length ? all : [...all.slice(0, keep), text('...', DIM)];
}

const sumH = (bs: Block[]): number => bs.reduce((n, b) => n + b.h, 0);

/** The data sheet as a picture: at most 1568 px on the long edge (what does not fit is cut, ending in `...`). */
export function renderDataSheet(s: DataSheet, o: { refs?: SheetRef[]; maxEdge?: number } = {}): Grid {
  const max = Math.min(o.maxEdge ?? MAX_EDGE, MAX_EDGE), w = Math.min(SHEET_W, max), bs = blocks(s, w, max, { title: true, refs: o.refs }), h = sumH(bs) + PAD * 2;
  const g = new Grid(w, h).fill(0, 0, w, h, BG);
  let y = PAD;
  for (const b of bs) { b.draw(g, PAD, y); y += b.h; }
  return g;
}

/**
 * The review sheet of a subject: its render on the left, the data sheet on the right, the references underneath. The render
 * is shrunk to fit; the whole sheet stays within `maxEdge` (default 1568).
 */
export function subjectReviewSheet(o: { title: string; render: Grid; sheet: DataSheet; refs?: SheetRef[]; maxEdge?: number }): Grid {
  const max = Math.min(o.maxEdge ?? MAX_EDGE, MAX_EDGE), top = PAD + LINE + PAD / 2;
  const refRow = o.refs?.length ? blocks({ title: '', subject: '', rows: [] }, max, max / 3, { title: false, refs: o.refs }) : [];
  const refsH = sumH(refRow), sw = Math.min(SHEET_W, Math.floor(max / 3)), room = max - top - (refsH ? refsH + PAD : 0) - PAD;
  const side = blocks(o.sheet, sw, room + PAD * 2, { title: false });
  const render = fitGrid(o.render, max - sw - PAD * 3, room);
  const W = PAD * 3 + render.w + sw, bodyH = Math.max(render.h, sumH(side)), H = top + bodyH + (refsH ? refsH + PAD : 0) + PAD;
  const g = new Grid(W, H).fill(0, 0, W, H, BG);
  drawText(g, PAD, PAD, plain(o.title).slice(0, Math.floor((W - PAD * 2) / CH)), TITLE, TXT);
  g.fill(PAD, top, render.w, render.h, '#ffffff'); g.over(render, PAD, top);
  let y = top;
  for (const b of side) { b.draw(g, PAD * 2 + render.w, y); y += b.h; }
  y = top + bodyH + PAD;
  for (const b of refRow) { b.draw(g, PAD, y); y += b.h; }
  return g;
}

