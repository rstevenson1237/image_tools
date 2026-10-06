/**
 * W1 sheets (SPEC §4.2): the **style tile** (the same probe set under each candidate, one column per candidate)
 * and the **style sheet** written to `art/direction.png` when a direction is locked (palette swatches with ramp
 * names, scale ruler, light diagram, anchors, do/don't). Pixel font only, so sheets are deterministic.
 */
import { resolveSize, type Direction } from '../direction.ts';
import { lumaOf } from '../lib/color.ts';
import { drawText, GLYPH_H, textWidth } from '../lib/font.ts';
import { Grid } from '../lib/grid.ts';
import { checker } from '../qa/sheet.ts';

const PAD = 12, TXT = 2, LINE = GLYPH_H * TXT + 6, BG = '#16161c', FG = '#dddddd', DIM = '#8a8a96', TITLE = '#ffffff';

/** Greedy word wrap to `max` characters per line. */
export function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (cur && (cur + ' ' + w).length > max) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) out.push(cur);
  return out;
}

/** Ramps as rows of swatches, optionally with names. Returns the drawn height. */
function swatches(g: Grid | null, x: number, y: number, dir: Direction, sw: number, names: boolean): { w: number; h: number } {
  const rows = [...Object.entries(dir.palette.ramps), ['outline', [dir.palette.outline]] as [string, string[]]];
  const nameW = names ? Math.max(...rows.map(([n]) => textWidth(n, TXT))) + 8 : 0;
  let w = 0;
  rows.forEach(([name, ramp], i) => {
    const yy = y + i * (sw + 2);
    if (g && names) drawText(g, x, yy + ((sw - GLYPH_H * TXT) >> 1), name, DIM, TXT);
    ramp.forEach((c, k) => g?.fill(x + nameW + k * (sw + 2), yy, sw, sw, c));
    w = Math.max(w, nameW + ramp.length * (sw + 2));
  });
  return { w, h: rows.length * (sw + 2) };
}

export interface ProbeImages {
  character: Grid;
  prop: Grid;
  tile: Grid;
  /** Effect frames, left to right. */
  effect: Grid[];
}

export interface StyleTileColumn {
  /** Column header, e.g. `A swamp-a`. */
  label: string;
  /** A few short lines describing the candidate. */
  notes: string[];
  dir: Direction;
  probes: ProbeImages;
  /** Game background (defaults to `dir.background`, else a dark neutral). */
  background?: string;
  /** Gate results per probe (shown under each probe). */
  gates?: Partial<Record<keyof ProbeImages, boolean>>;
}

function tiled(tile: Grid, n: number): Grid {
  const g = new Grid(tile.w * n, tile.h * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) g.over(tile, i * tile.w, j * tile.h);
  return g;
}

/** Iso tiles (2:1 diamonds) tile on a staggered grid; square tiles on a plain grid. */
function tileField(tile: Grid, n: number): Grid {
  if (tile.h * 2 !== tile.w) return tiled(tile, n);
  const W = tile.w * n, H = (tile.h * (n + 1)) / 1, g = new Grid(W, H);
  for (let j = -1; j <= n * 2; j++) for (let i = -1; i <= n; i++) g.over(tile, i * tile.w + (j % 2 ? tile.w / 2 : 0), (j * tile.h) / 2);
  return g;
}

/**
 * One sheet, one column per candidate: header and notes, palette swatches, then the probe set — character and
 * prop at 1× and display scale on the game background, the ground tile tiled 3×3, the effect strip.
 */
export function styleTile(title: string, columns: StyleTileColumn[], { scale = 4, maxEdge = 1568 } = {}): Grid {
  const layout = (sc: number) => {
    const cols = columns.map(c => {
      const p = c.probes, sw = Math.max(6, sc * 3);
      const pal = swatches(null, 0, 0, c.dir, sw, false);
      const field = tileField(p.tile, 3);
      const fx = p.effect.reduce((n, f) => n + f.w * sc + 4, 0);
      const w = Math.max(
        textWidth(c.label, TXT), ...c.notes.map(n => textWidth(n, TXT)), pal.w,
        p.character.w + 6 + p.character.w * sc, p.prop.w + 6 + p.prop.w * sc, field.w * sc, fx,
      );
      const h = LINE + c.notes.length * LINE + 6 + pal.h + 8
        + LINE + Math.max(p.character.h * sc, p.character.h) + 8
        + LINE + p.prop.h * sc + 8
        + LINE + field.h * sc + 8
        + LINE + Math.max(0, ...p.effect.map(f => f.h * sc)) + 8;
      return { c, w, h, sw, field };
    });
    const W = PAD + cols.reduce((n, c) => n + c.w + PAD * 2, 0), H = PAD + LINE + PAD + Math.max(...cols.map(c => c.h)) + PAD;
    return { cols, W: Math.max(W, PAD * 2 + textWidth(title, TXT)), H };
  };
  let sc = scale, L = layout(sc);
  while (Math.max(L.W, L.H) > maxEdge && sc > 1) { sc--; L = layout(sc); }
  const g = new Grid(L.W, L.H).fill(0, 0, L.W, L.H, BG);
  drawText(g, PAD, PAD, title, TITLE, TXT);
  let x = PAD;
  for (const { c, w, sw, field } of L.cols) {
    const bg = c.background ?? c.dir.background ?? '#202028', p = c.probes;
    let y = PAD + LINE + PAD;
    drawText(g, x, y, c.label, TITLE, TXT); y += LINE;
    for (const n of c.notes) { drawText(g, x, y, n, DIM, TXT); y += LINE; }
    y += 6;
    y += swatches(g, x, y, c.dir, sw, false).h + 8;
    const gate = (k: keyof ProbeImages) => (c.gates?.[k] === undefined ? '' : c.gates[k] ? '  gate ok' : '  gate FAIL');
    const sprite = (k: 'character' | 'prop', s: Grid) => {
      drawText(g, x, y, k + gate(k), FG, TXT); y += LINE;
      g.fill(x, y, s.w, s.h, bg); g.over(s, x, y);
      const bx = x + s.w + 6, big = s.scale(sc);
      g.fill(bx, y, big.w, big.h, bg); g.over(big, bx, y);
      y += Math.max(big.h, s.h) + 8;
    };
    sprite('character', p.character);
    sprite('prop', p.prop);
    drawText(g, x, y, `tile 3x3${gate('tile')}`, FG, TXT); y += LINE;
    const fb = field.scale(sc);
    g.fill(x, y, fb.w, fb.h, bg); g.over(fb, x, y); y += fb.h + 8;
    drawText(g, x, y, `effect ${p.effect.length} frames${gate('effect')}`, FG, TXT); y += LINE;
    let fxX = x;
    for (const f of p.effect) { const b = f.scale(sc); g.fill(fxX, y, b.w, b.h, bg); g.over(b, fxX, y); fxX += b.w + 4; }
    x += w + PAD * 2;
    if (x - PAD < g.w) g.fill(x - PAD - 1, PAD + LINE, 1, g.h - PAD * 2 - LINE, '#2c2c36');
  }
  return g;
}

/** Shaded disc lit from `light` in the direction's ramp: shows where light comes from and how bands step. */
function lightDiagram(dir: Direction, r: number): Grid {
  const ramp = dir.palette.ramps[dir.palette.materials.metal ?? ''] ?? Object.values(dir.palette.ramps).sort((a, b) => b.length - a.length)[0];
  const [lx, ly, lz] = dir.camera.light, n = Math.hypot(lx, ly, lz) || 1, bands = Math.min(dir.shading.bands, ramp.length);
  const size = r * 2 + 1 + 8, g = new Grid(size, size), c = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x + 0.5 - c) / r, dy = (y + 0.5 - c) / r, d2 = dx * dx + dy * dy;
    if (d2 > 1) continue;
    const dz = Math.sqrt(1 - d2), dot = Math.max(0, (dx * lx + dy * ly + dz * lz) / n);
    const b = Math.min(bands - 1, Math.floor((1 - dot) * bands));
    g.set(x, y, ramp[Math.round((b * (ramp.length - 1)) / Math.max(1, bands - 1))]);
  }
  // light arrow from outside toward the centre
  // light arrow: from the light's side (the vector points at the light) in toward the disc
  const ux = lx / (Math.hypot(lx, ly) || 1), uy = ly / (Math.hypot(lx, ly) || 1), ax = c + ux * (r + 3), ay = c + uy * (r + 3);
  for (let t = 0; t <= 4; t++) g.set(Math.round(ax - ux * t), Math.round(ay - uy * t), '#ffe9a0');
  return g;
}

/**
 * `art/direction.png`: id + version, pitch, palette swatches with ramp names, scale ruler (frame size per kind),
 * light diagram, line/shading settings, anchors at 1× and display scale, do/don't.
 */
export function styleSheet(dir: Direction, anchors: { label: string; grid: Grid }[], { scale = 4, maxEdge = 1568 } = {}): Grid {
  const bg = dir.background ?? '#202028';
  const kinds = Object.keys(dir.scale).filter(k => k !== 'proportions');
  const sizes = kinds.map(k => ({ k, s: resolveSize(dir, k) }));
  const pitch = wrap(dir.theme.pitch ?? '', 70), notes = wrap(dir.theme.notes ?? '', 70);
  const settings = [
    `view ${dir.camera.view}, ${dir.camera.directions} facings, pixel scale ${dir.camera.pixelScale}x, light ${dir.camera.light.join(',')}`,
    `line outer ${dir.line.outer}, inner ${dir.line.inner}, weight ${dir.line.weight}`,
    `shading ${dir.shading.bands} bands, hue shift ${dir.shading.hueShift}, dither ${dir.shading.dither}, highlight ${dir.shading.highlight}`,
    `detail ${dir.detail.density}, min feature ${dir.detail.minFeaturePx}px; pipeline ${dir.pipeline.revisionPasses} revisions + ${dir.pipeline.finishPass ? 'finish' : 'no finish'}`,
  ];
  const rules = [...dir.rules.do.map(r => `DO   ${r}`), ...dir.rules.dont.map(r => `DONT ${r}`)];
  const build = (sc: number) => {
    const sw = 10, pal = swatches(null, 0, 0, dir, sw, true), light = lightDiagram(dir, 14);
    const rulerW = sizes.reduce((n, { k, s }) => n + Math.max(s[0], textWidth(k, TXT)) + PAD, 0), rulerH = LINE + Math.max(...sizes.map(({ s }) => s[1]), 0) + 8;
    const anchorsW = anchors.reduce((n, a) => n + a.grid.w * (sc + 1) + 6 + PAD, 0), anchorsH = anchors.length ? LINE + Math.max(...anchors.map(a => a.grid.h * sc)) + LINE + 8 : 0;
    const textLines = [...pitch, ...notes, ...settings, ...rules];
    const W = PAD * 2 + Math.max(pal.w + PAD * 2 + light.w * 3, rulerW, anchorsW, ...textLines.map(l => textWidth(l, TXT)), textWidth(`${dir.id} v${dir.version}`, TXT * 2));
    const H = PAD + LINE * 2 + (pitch.length + notes.length) * LINE + 8 + LINE + Math.max(pal.h, light.h * 3) + 8 + LINE + settings.length * LINE + 8 + rulerH + anchorsH + (rules.length ? LINE + rules.length * LINE : 0) + PAD;
    return { W, H, sw, light };
  };
  let sc = scale, L = build(sc);
  while (Math.max(L.W, L.H) > maxEdge && sc > 1) { sc--; L = build(sc); }
  const g = new Grid(L.W, L.H).fill(0, 0, L.W, L.H, BG);
  let y = PAD;
  drawText(g, PAD, y, `${dir.id} v${dir.version} (${dir.status})`, TITLE, TXT * 2); y += LINE * 2;
  for (const l of pitch) { drawText(g, PAD, y, l, FG, TXT); y += LINE; }
  for (const l of notes) { drawText(g, PAD, y, l, DIM, TXT); y += LINE; }
  y += 8;
  drawText(g, PAD, y, 'PALETTE', FG, TXT);
  const pal = swatches(g, PAD, y + LINE, dir, L.sw, true);
  const lx = PAD + pal.w + PAD * 2;
  drawText(g, lx, y, 'LIGHT', FG, TXT);
  const lg = L.light.scale(3);
  g.fill(lx, y + LINE, lg.w, lg.h, bg); g.over(lg, lx, y + LINE);
  y += LINE + Math.max(pal.h, lg.h) + 8;
  drawText(g, PAD, y, 'SETTINGS', FG, TXT); y += LINE;
  for (const l of settings) { drawText(g, PAD, y, l, DIM, TXT); y += LINE; }
  y += 8;
  // scale ruler: one frame outline per kind at 1x, so relative sizes read at a glance
  let x = PAD;
  const maxH = Math.max(...sizes.map(({ s }) => s[1]), 0);
  for (const { k, s } of sizes) {
    drawText(g, x, y, k, DIM, TXT);
    const top = y + LINE + (maxH - s[1]);
    g.fill(x, top, s[0], s[1], bg);
    for (let i = 0; i < s[0]; i++) { g.set(x + i, top, '#5a5a66'); g.set(x + i, top + s[1] - 1, '#5a5a66'); }
    for (let j = 0; j < s[1]; j++) { g.set(x, top + j, '#5a5a66'); g.set(x + s[0] - 1, top + j, '#5a5a66'); }
    x += Math.max(s[0], textWidth(k, TXT)) + PAD;
  }
  y += LINE + maxH + 8;
  if (anchors.length) {
    drawText(g, PAD, y, 'ANCHORS', FG, TXT); y += LINE;
    x = PAD;
    const rowH = Math.max(...anchors.map(a => a.grid.h * sc));
    for (const a of anchors) {
      checker(g, x, y, a.grid.w, a.grid.h, 4); g.over(a.grid, x, y);
      const bx = x + a.grid.w + 6, big = a.grid.scale(sc);
      g.fill(bx, y, big.w, big.h, bg); g.over(big, bx, y);
      drawText(g, x, y + rowH + 4, a.label, DIM, TXT);
      x = bx + big.w + PAD;
    }
    y += rowH + LINE + 8;
  }
  if (rules.length) {
    drawText(g, PAD, y, 'RULES', FG, TXT); y += LINE;
    for (const r of rules) { drawText(g, PAD, y, r, r.startsWith('DO ') ? '#9fd39a' : '#e39a9a', TXT); y += LINE; }
  }
  return g;
}

/** Mean luma of a direction's ramps — used to check candidates are visibly distinct. */
export const paletteLuma = (d: Direction): number => {
  const l = Object.values(d.palette.ramps).flat().map(lumaOf);
  return l.reduce((a, b) => a + b, 0) / (l.length || 1);
};
