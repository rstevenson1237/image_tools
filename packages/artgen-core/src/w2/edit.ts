/**
 * Colour tokens over rendered pixels (P3): the restyle diff (does a direction change move every asset the same
 * way?) and the hand-edit round trip (SPEC §6.6: an edited PNG becomes token ops in a finishing revision, so the
 * edit survives a restyle wherever it maps to a palette ramp).
 */
import { dirContext, type Direction } from '../direction.ts';
import { parseColor, dist2 } from '../lib/color.ts';
import { drawText, GLYPH_H, textWidth } from '../lib/font.ts';
import { Grid } from '../lib/grid.ts';
import { checker } from '../qa/sheet.ts';

/** Colour → token (`ramp.i`, `outline`) under a direction; partial alpha is `shadow`; null for transparent or off-palette. */
export function tokenizer(dir: Direction): (g: Grid, x: number, y: number) => string | null {
  const dc = dirContext(dir), map = new Map<string, string>([[dc.outline, 'outline']]);
  for (const [name, r] of Object.entries(dc.pal)) r.forEach((c, i) => { if (!map.has(c)) map.set(c, `${name}.${i}`); });
  return (g, x, y) => {
    const a = g.alpha(x, y);
    if (!a) return null;
    if (a < 255) return 'shadow';
    return map.get(g.get(x, y)!) ?? null;
  };
}

/** Nearest palette token for any colour (exact first). */
export function nearestToken(dir: Direction, hex: string): { token: string; exact: boolean } {
  const dc = dirContext(dir), [r, g, b] = parseColor(hex);
  let best = 'outline', bd = dist2(parseColor(dc.outline), r, g, b);
  for (const [name, ramp] of Object.entries(dc.pal)) ramp.forEach((c, i) => {
    const d = dist2(parseColor(c), r, g, b);
    if (d < bd) { bd = d; best = `${name}.${i}`; }
  });
  return { token: best, exact: bd === 0 };
}

export interface RestyleDiff {
  /** Share of pixels whose colour changed. */
  changedPct: number;
  /** Share of opaque pixels with the same token before and after (1 = the restyle only recoloured). */
  tokenSame: number;
  /** Before-colour → after-colours; consistent when every before-colour maps to exactly one after-colour. */
  consistent: boolean;
  mapping: Record<string, string[]>;
}

export function restyleDiff(before: Grid, after: Grid, from: Direction, to: Direction): RestyleDiff {
  if (before.w !== after.w || before.h !== after.h) throw new Error(`restyle diff: size changed ${before.w}x${before.h} → ${after.w}x${after.h}`);
  const ta = tokenizer(from), tb = tokenizer(to), map = new Map<string, Set<string>>();
  let changed = 0, opaque = 0, same = 0;
  for (let y = 0; y < before.h; y++) for (let x = 0; x < before.w; x++) {
    const a = before.get(x, y), b = after.get(x, y);
    if (a !== b || before.alpha(x, y) !== after.alpha(x, y)) changed++;
    if (before.alpha(x, y) === 255 || after.alpha(x, y) === 255) {
      opaque++;
      if (ta(before, x, y) === tb(after, x, y)) same++;
      const k = a ?? 'none';
      map.set(k, (map.get(k) ?? new Set()).add(b ?? 'none'));
    }
  }
  const mapping = Object.fromEntries([...map].map(([k, v]) => [k, [...v]]));
  return { changedPct: Math.round((1000 * changed) / (before.w * before.h)) / 10, tokenSame: opaque ? Math.round((1000 * same) / opaque) / 1000 : 1, consistent: [...map.values()].every(s => s.size === 1), mapping };
}

/** Pixels whose token differs between two renders, red on a dim copy of `after`. */
export function tokenDiffMask(before: Grid, after: Grid, from: Direction, to: Direction): Grid {
  const ta = tokenizer(from), tb = tokenizer(to), g = new Grid(after.w, after.h);
  for (let y = 0; y < after.h; y++) for (let x = 0; x < after.w; x++) {
    if (ta(before, x, y) !== tb(after, x, y)) g.set(x, y, '#ff3040');
    else if (after.alpha(x, y)) g.set(x, y, '#3a3a44');
  }
  return g;
}

const PAD = 10, TXT = 2, LAB = GLYPH_H * TXT + 6, BG = '#16161c', FG = '#dddddd';

/** Before | after | token diff, one row per asset; scale reduced to keep the long edge ≤ maxEdge. */
export function restyleSheet(title: string, rows: { label: string; before: Grid; after: Grid; mask: Grid; bg?: string }[], scale = 3, maxEdge = 1568): Grid {
  const size = (s: number) => {
    const cw = Math.max(...rows.map(r => r.after.w * s), textWidth('token diff', TXT)) + PAD;
    const W = Math.max(PAD + cw * 3, PAD * 2 + textWidth(title, TXT), ...rows.map(r => PAD * 2 + textWidth(r.label, TXT)));
    const H = PAD + LAB * 2 + rows.reduce((n, r) => n + LAB + r.after.h * s + PAD, 0);
    return { cw, W, H };
  };
  let s = scale, L = size(s);
  while (Math.max(L.W, L.H) > maxEdge && s > 1) { s--; L = size(s); }
  const g = new Grid(L.W, L.H).fill(0, 0, L.W, L.H, BG);
  drawText(g, PAD, PAD, title, '#ffffff', TXT);
  ['before', 'after', 'token diff'].forEach((h, i) => drawText(g, PAD + i * L.cw, PAD + LAB, h, FG, TXT));
  let y = PAD + LAB * 2;
  for (const r of rows) {
    drawText(g, PAD, y, r.label, FG, TXT);
    const top = y + LAB;
    [r.before, r.after, r.mask].forEach((im, i) => {
      const big = im.scale(s), x = PAD + i * L.cw;
      if (r.bg && i < 2) g.fill(x, top, big.w, big.h, r.bg); else checker(g, x, top, big.w, big.h);
      g.over(big, x, top);
    });
    y = top + r.after.h * s + PAD;
  }
  return g;
}

export type EditOp = [number, number, string | null];

/**
 * Token ops that turn `current` into `edited` (same size). Edited colours snap to the nearest palette token
 * (counted in `snapped`); a cleared pixel is `null`.
 */
export function editOps(current: Grid, edited: Grid, dir: Direction): { ops: EditOp[]; snapped: number } {
  if (current.w !== edited.w || current.h !== edited.h) throw new Error(`edited image is ${edited.w}x${edited.h}, the render is ${current.w}x${current.h}`);
  const ops: EditOp[] = [];
  let snapped = 0;
  for (let y = 0; y < current.h; y++) for (let x = 0; x < current.w; x++) {
    const a = current.get(x, y), b = edited.get(x, y), ea = edited.alpha(x, y);
    if (a === b && current.alpha(x, y) === ea) continue;
    if (!ea) { ops.push([x, y, null]); continue; }
    if (ea < 255) continue; // partial alpha is the engine's shadow; hand edits don't author it
    const t = nearestToken(dir, b!);
    if (!t.exact) snapped++;
    ops.push([x, y, t.token]);
  }
  return { ops, snapped };
}
