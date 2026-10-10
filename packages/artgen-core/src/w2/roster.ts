/**
 * Roster review (rev 9, from the calibration study): what no single-asset review can see. A lineup of every finished
 * non-tile asset on one ground baseline (relative scale, light hierarchy, friend/foe separation, style drift), a sheet
 * of shuffled lettered black silhouettes (named by a fresh reviewer before they see the asset list), the drawn heights
 * against the briefs' real-world heights, and the most-overlapping silhouette pairs. Pure: the CLI renders and writes.
 */
import { drawText } from '../lib/font.ts';
import { Grid } from '../lib/grid.ts';
import { rng } from '../lib/rng.ts';

export interface RosterItem { id: string; kind: string; grid: Grid; notes?: string; /** Real-world height in metres (brief). */ height?: number }

/** Opaque body (alpha 255) bounding box and mask. */
export interface Body { x0: number; y0: number; w: number; h: number; mask: Uint8Array }

export function body(g: Grid): Body {
  let x0 = g.w, y0 = g.h, x1 = -1, y1 = -1;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.alpha(x, y) === 255) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 < 0) return { x0: 0, y0: 0, w: 0, h: 0, mask: new Uint8Array(0) };
  const w = x1 - x0 + 1, h = y1 - y0 + 1, mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) mask[y * w + x] = g.alpha(x0 + x, y0 + y) === 255 ? 1 : 0;
  return { x0, y0, w, h, mask };
}

/** Silhouette overlap (intersection over union) of two bodies aligned bottom-centre, at their drawn size. */
export function silhouetteOverlap(a: Body, b: Body): number {
  const W = Math.max(a.w, b.w), H = Math.max(a.h, b.h);
  const at = (s: Body, x: number, y: number) => { const sx = x - ((W - s.w) >> 1), sy = y - (H - s.h); return sx >= 0 && sy >= 0 && sx < s.w && sy < s.h && s.mask[sy * s.w + sx] === 1; };
  let i = 0, u = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = at(a, x, y), q = at(b, x, y); if (p && q) i++; if (p || q) u++; }
  return u ? i / u : 0;
}

export interface RosterSize { id: string; kind: string; drawn: number; height?: number; expected?: number; dev?: number; flag: boolean }
export interface RosterPair { a: string; b: string; overlap: number }

export interface RosterResult {
  /** Colour lineup on one baseline: 1× strip on top, the same ×scale below; left to right in item order. */
  lineup: Grid;
  /** Shuffled, lettered black silhouettes (enlarged, plus 1× in each cell's corner). */
  silhouettes: Grid;
  /** Letter → asset id (keep it from the reviewer). */
  key: Record<string, string>;
  sizes: RosterSize[];
  /** The most-overlapping silhouette pairs (the highest one was confused in every calibration roster). */
  pairs: RosterPair[];
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Build the roster sheets and numbers. `pxPerMetre` turns brief heights into expected pixels; sizes off by more than
 * `tolerance` flag. `seed` shuffles the silhouettes (vary it between rounds so a reviewer can't learn the order).
 */
export function roster(items: RosterItem[], o: { bg: string; pxPerMetre: number; tolerance?: number; seed?: number; scale?: number; topPairs?: number }): RosterResult {
  if (items.length > LETTERS.length) throw new Error(`roster: at most ${LETTERS.length} assets per sheet (got ${items.length}); pass a subset`);
  const tol = o.tolerance ?? 0.2, Z = o.scale ?? 4, bodies = items.map(it => body(it.grid));
  // lineup: bodies bottom-aligned on one ground line, 1× then ×Z
  const gap = 6, W = bodies.reduce((s, b) => s + b.w + gap, gap), H = Math.max(1, ...bodies.map(b => b.h)) + 4;
  const line = new Grid(W, H).fill(0, 0, W, H, o.bg);
  let x = gap;
  items.forEach((it, i) => {
    const b = bodies[i];
    for (let j = 0; j < b.h; j++) for (let k = 0; k < b.w; k++) if (b.mask[j * b.w + k]) line.set(x + k, H - 2 - b.h + j, it.grid.get(b.x0 + k, b.y0 + j)!);
    x += b.w + gap;
  });
  const lineup = new Grid(W * Z + 20, H * Z + H + 30).fill(0, 0, W * Z + 20, H * Z + H + 30, o.bg);
  lineup.blit(line, 10, 10);
  lineup.blit(line.scale(Z), 10, H + 20);
  // silhouettes: seeded shuffle, lettered cells, enlarged + 1× in the corner
  const r = rng(o.seed ?? 1), order = items.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  const S = 5, cell = Math.max(8, ...bodies.map(b => Math.max(b.w, b.h))) * S + 16, cols = Math.min(5, Math.max(1, items.length)), rows = Math.ceil(items.length / cols);
  const silhouettes = new Grid(cols * cell, Math.max(1, rows) * (cell + 12)).fill(0, 0, cols * cell, Math.max(1, rows) * (cell + 12), '#d8d8d8');
  const key: Record<string, string> = {};
  order.forEach((ix, n) => {
    const b = bodies[ix], cx = (n % cols) * cell, cy = Math.floor(n / cols) * (cell + 12), L = LETTERS[n];
    key[L] = items[ix].id;
    drawText(silhouettes, cx + 4, cy + 3, L, '#000000', 1);
    const ox = cx + ((cell - b.w * S) >> 1), oy = cy + 12 + cell - 8 - b.h * S;
    for (let j = 0; j < b.h; j++) for (let k = 0; k < b.w; k++) if (b.mask[j * b.w + k]) {
      silhouettes.fill(ox + k * S, oy + j * S, S, S, '#000000');
      silhouettes.set(cx + cell - b.w - 3 + k, cy + 3 + j, '#000000');
    }
  });
  const sizes: RosterSize[] = items.map((it, i) => {
    const drawn = bodies[i].h;
    if (!it.height) return { id: it.id, kind: it.kind, drawn, flag: false };
    const expected = it.height * o.pxPerMetre, dev = (drawn - expected) / expected;
    return { id: it.id, kind: it.kind, drawn, height: it.height, expected: Math.round(expected * 10) / 10, dev: Math.round(dev * 100) / 100, flag: Math.abs(dev) > tol };
  });
  const pairs: RosterPair[] = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) pairs.push({ a: items[i].id, b: items[j].id, overlap: Math.round(silhouetteOverlap(bodies[i], bodies[j]) * 1000) / 1000 });
  pairs.sort((p, q) => q.overlap - p.overlap);
  return { lineup, silhouettes, key, sizes, pairs: pairs.slice(0, o.topPairs ?? 5) };
}

/** What the roster reviewer returns (`artgen roster record <file>`). */
export interface RosterReview {
  /** Step 1, before seeing the asset list: a free guess per silhouette letter and its readability 1–5. */
  silhouettes: { letter: string; guess: string; readability: number }[];
  /** The lineup, per asset id: scale verdict and the cross-asset issues it shows. */
  lineup: { id: string; scale?: 'ok' | 'too big' | 'too small'; scaleNote?: string; issues?: string[] }[];
  /** Roster-wide notes (light hierarchy, friend/foe separation, style drift…). */
  notes?: string[];
}

/** Open issues per asset from a roster review (silhouettes rated ≤ 2, wrong scale, lineup issues). */
export function rosterIssues(review: RosterReview, key: Record<string, string>): Record<string, string[]> {
  const out: Record<string, string[]> = {}, push = (id: string, s: string) => { (out[id] ??= []).push(s); };
  for (const s of review.silhouettes ?? []) {
    const id = key[s.letter];
    if (!id) throw new Error(`roster record: no silhouette ${JSON.stringify(s.letter)} on the last roster sheet`);
    if (s.readability <= 2) push(id, `silhouette reads as "${s.guess}" (${s.readability}/5)`);
  }
  const ids = new Set(Object.values(key));
  for (const l of review.lineup ?? []) {
    if (!ids.has(l.id)) throw new Error(`roster record: ${l.id} was not on the last roster sheet`);
    if (l.scale && l.scale !== 'ok') push(l.id, `lineup: ${l.scale}${l.scaleNote ? ` — ${l.scaleNote}` : ''}`);
    for (const i of (l.issues ?? []).slice(0, 2)) push(l.id, `lineup: ${i}`);
  }
  return out;
}
