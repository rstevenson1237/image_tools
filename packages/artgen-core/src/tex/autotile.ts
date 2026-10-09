/**
 * Autotile synthesis (SPEC §9, PLAN P6b): the transition tiles between two terrains — `over` (grass, water, a raised
 * floor) lying on `base` (dirt, sand…) — for the runtime's `wang16` and `blob47` resolvers (same bit layout and
 * canonical order as `artgen-runtime/src/autotile.ts`). Each tile is cut from the two seamless textures at the same
 * pixel, so neighbouring tiles continue each other; the boundary wobbles by periodic noise taken along the edge it runs
 * beside (the same noise for every tile), so a boundary leaving one tile enters the next at the same point.
 *
 * The edge of `over` catches the light on the lit side (one step lighter) and darkens on the far side, and `base` gets
 * a cast shadow beyond it, so the upper terrain reads as lying on top.
 */
import type { DirContext } from '../direction.ts';
import { Grid } from '../lib/grid.ts';
import { pGradient } from './noise.ts';

export const N = 1, NE = 2, E = 4, SE = 8, S = 16, SW = 32, W = 64, NW = 128;

export function reduceCorners(m: number): number {
  let r = m & (N | E | S | W);
  if (m & NE && m & N && m & E) r |= NE;
  if (m & SE && m & S && m & E) r |= SE;
  if (m & SW && m & S && m & W) r |= SW;
  if (m & NW && m & N && m & W) r |= NW;
  return r;
}

/** The 47 reduced masks, ascending: tile `i` of a blob47 set is drawn for `BLOB47[i]`. */
export const BLOB47: readonly number[] = [...new Set(Array.from({ length: 256 }, (_, m) => reduceCorners(m)))].sort((a, b) => a - b);

/** 8-bit neighbour mask a tile of a layout is drawn for (`wang16` index bits: N=1, E=2, S=4, W=8). */
export function autotileMask(layout: 'wang16' | 'blob47', index: number): number {
  if (layout === 'blob47') {
    const m = BLOB47[index];
    if (m === undefined) throw new Error(`blob47 has 47 tiles (index ${index})`);
    return m;
  }
  if (index < 0 || index > 15) throw new Error(`wang16 has 16 tiles (index ${index})`);
  return (index & 1 ? N : 0) | (index & 2 ? E : 0) | (index & 4 ? S : 0) | (index & 8 ? W : 0);
}

export const autotileCount = (layout: 'wang16' | 'blob47'): number => (layout === 'blob47' ? 47 : 16);

export interface AutotileOptions {
  /** The upper terrain and the one beneath, both seamless and the tile's size. */
  over: Grid;
  base: Grid;
  /** Inset of the boundary from a tile edge where the neighbour is not `over` (default a quarter tile). */
  inset?: number;
  /** Boundary wobble in px (default inset / 2). */
  wobble?: number;
  seed?: number;
  /** Rim on `over`'s edge and shadow on `base` (default true). */
  rim?: boolean;
}

/** Does `over` cover pixel (x, y) of a tile drawn for neighbour mask `m`? */
export function autotileCovers(m: number, x: number, y: number, s: number, o: { inset: number; wobble: number; seed: number }): boolean {
  const px = x + 0.5, py = y + 0.5, { inset, wobble, seed } = o;
  const along = (t: number, k: number) => wobble * (pGradient(t, 0, { w: s, h: s, cells: 2, octaves: 2, seed: seed + k }) - 0.5) * 2;
  // inset lines for edges whose neighbour isn't over; the wobble depends on the coordinate along the edge only
  const top = m & N ? -1 : inset + along(px, 1), bottom = m & S ? s + 1 : s - inset - along(px, 2);
  const left = m & W ? -1 : inset + along(py, 3), right = m & E ? s + 1 : s - inset - along(py, 4);
  if (px < left || px > right || py < top || py > bottom) return false;
  // convex corners (both edges inset) are rounded
  const r = inset * 0.8;
  for (const [sx, sy, a, b] of [[-1, -1, !(m & W), !(m & N)], [1, -1, !(m & E), !(m & N)], [-1, 1, !(m & W), !(m & S)], [1, 1, !(m & E), !(m & S)]] as [number, number, boolean, boolean][]) {
    if (!a || !b) continue;
    const cx = sx < 0 ? left + r : right - r, cy = sy < 0 ? top + r : bottom - r;
    const inX = sx < 0 ? cx - px : px - cx, inY = sy < 0 ? cy - py : py - cy;
    if (inX > 0 && inY > 0 && Math.hypot(inX, inY) > r) return false;
  }
  // concave corners (both edges present, diagonal missing): a notch out of the corner
  const notch = inset + along(px + py, 5) * 0.5;
  if (m & N && m & E && !(m & NE) && Math.hypot(s - px, py) < notch) return false;
  if (m & S && m & E && !(m & SE) && Math.hypot(s - px, s - py) < notch) return false;
  if (m & S && m & W && !(m & SW) && Math.hypot(px, s - py) < notch) return false;
  if (m & N && m & W && !(m & NW) && Math.hypot(px, py) < notch) return false;
  return true;
}

/** One autotile: `over` where the mask covers, `base` elsewhere, with a rim and a cast shadow along the boundary. */
export function autotile(dir: DirContext, layout: 'wang16' | 'blob47', index: number, o: AutotileOptions): Grid {
  const s = o.over.w, m = autotileMask(layout, index), inset = o.inset ?? Math.round(s / 4), opts = { inset, wobble: o.wobble ?? inset / 2, seed: o.seed ?? 1 };
  if (o.base.w !== s || o.over.h !== s || o.base.h !== s) throw new Error('autotile: over and base must be square textures of the same size');
  const cov = new Uint8Array(s * s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) cov[y * s + x] = autotileCovers(m, x, y, s, opts) ? 1 : 0;
  // coverage outside the tile continues the neighbours: covered when the mask says that side is over
  const at = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < s && y < s) return cov[y * s + x];
    const bx = x < 0 ? W : x >= s ? E : 0, by = y < 0 ? N : y >= s ? S : 0;
    const bit = bx && by ? (bx === W ? (by === N ? NW : SW) : by === N ? NE : SE) : bx || by;
    return m & bit ? 1 : 0;
  };
  const step = stepper(dir), g = new Grid(s, s), [lx, ly] = dir.camera.light.map(Math.sign);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    if (cov[y * s + x]) {
      // the edge of the upper terrain catches the light on the lit side and darkens on the far side
      const c = o.over.get(x, y)!, lit = o.rim !== false && ((lx && !at(x + lx, y)) || (ly && !at(x, y + ly)));
      const far = o.rim !== false && ((lx && !at(x - lx, y)) || (ly && !at(x, y - ly)));
      g.set(x, y, lit && !far ? step(c, -1) : far ? step(c, 1) : c);
    } else {
      // base under the shadow of over: the over pixel toward the light covers it
      const c = o.base.get(x, y)!, shadowed = o.rim !== false && (at(x + lx, y + ly) || at(x + lx, y) || at(x, y + ly));
      g.set(x, y, shadowed ? step(c, 1) : c);
    }
  }
  if (o.over.normal && o.base.normal) {
    const n = new Grid(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const src = cov[y * s + x] ? o.over.normal : o.base.normal, i = (y * s + x) * 4; n.d.set(src.d.subarray(i, i + 4), i); }
    g.normal = n;
  }
  return g;
}

/** Colour `k` steps darker along its direction ramp (unchanged when it isn't on one). */
function stepper(dir: DirContext): (c: string, k: number) => string {
  const at = new Map<string, [string, number]>();
  for (const [name, r] of Object.entries(dir.pal)) r.forEach((c, i) => { if (!at.has(c)) at.set(c, [name, i]); });
  return (c, k) => { const hit = at.get(c); if (!hit) return c; const r = dir.pal[hit[0]]; return r[Math.max(0, Math.min(r.length - 1, hit[1] + k))]; };
}

/** A whole set as one sheet (review): tiles in canonical order, `cols` per row, 1 px apart. */
export function autotileSheet(tiles: Grid[], cols = 8): Grid {
  const s = tiles[0].w, rows = Math.ceil(tiles.length / cols), g = new Grid(cols * (s + 1) - 1, rows * (s + 1) - 1);
  tiles.forEach((t, i) => g.blit(t, (i % cols) * (s + 1), Math.floor(i / cols) * (s + 1)));
  return g;
}

/**
 * A test map for review (the autotiles in use): an island of `over` on `base` (transparent without one), resolved cell by cell with the runtime's
 * rule and drawn from the set. Shows whether neighbouring tiles continue each other.
 */
export function autotileMap(tiles: Grid[], layout: 'wang16' | 'blob47', base?: Grid, cells = 8, seed = 3): Grid {
  const s = tiles[0].w, solid = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= cells || y >= cells) return false;
    const dx = x - (cells - 1) / 2, dy = y - (cells - 1) / 2;
    return Math.hypot(dx * 1.1, dy) < cells * 0.36 + Math.sin(x * 1.7 + y * 2.3 + seed) * 0.9;
  };
  const OFF: [number, number, number][] = [[0, -1, N], [1, -1, NE], [1, 0, E], [1, 1, SE], [0, 1, S], [-1, 1, SW], [-1, 0, W], [-1, -1, NW]];
  const g = new Grid(cells * s, cells * s);
  for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
    if (!solid(x, y)) { if (base) g.blit(base, x * s, y * s); continue; }
    let m = 0;
    for (const [dx, dy, b] of OFF) if (solid(x + dx, y + dy)) m |= b;
    g.blit(tiles[autotileIndexOf(layout, m)], x * s, y * s);
  }
  return g;
}

/** Tile index for an 8-bit neighbour mask (the runtime's `wang16` / `blob47`). */
export function autotileIndexOf(layout: 'wang16' | 'blob47', mask: number): number {
  if (layout === 'wang16') return (mask & N ? 1 : 0) | (mask & E ? 2 : 0) | (mask & S ? 4 : 0) | (mask & W ? 8 : 0);
  return BLOB47.indexOf(reduceCorners(mask & 255));
}
